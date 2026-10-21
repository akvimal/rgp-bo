import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreateVendorDto, VendorLicenseDto } from "./dto/create-vendor.dto";
import { Vendor } from "src/entities/vendor.entity";
import { AuditService } from "src/core/audit/audit.service";

const EXPIRY_WARNING_DAYS = 60;
// GST state codes: 01-38, plus 97 (other territory) and 99 (centre jurisdiction)
const validStateCode = (c: string) => /^[0-9]{2}$/.test(c) && ((+c >= 1 && +c <= 38) || c === "97" || c === "99");

/** Where a vendor stands on its licences: NONE recorded, all EXPIRED, one EXPIRING soon, or VALID. */
export type LicenseStatus = "NONE" | "EXPIRED" | "EXPIRING" | "VALID";

@Injectable()
export class VendorService {

    constructor(@InjectRepository(Vendor) private readonly vendorRepository: Repository<Vendor>,
                private readonly audit: AuditService) { }

    private get manager(): EntityManager { return this.vendorRepository.manager; }

    private norm(g?: string | null): string | null {
        const t = (g ?? "").trim().toUpperCase();
        return t === "" ? null : t;
    }

    private async gstinOk(g: string): Promise<boolean> {
        const [r] = await this.manager.query(`select public.is_valid_gstin($1) as ok`, [g]);
        return !!r?.ok;
    }

    /**
     * Checks the cross-field rules and fills what a GSTIN implies (state, PAN, registration type).
     * A GSTIN is only re-checked when it changes, so editing another field of a vendor whose stored GSTIN was
     * mistyped long ago still works (it shows up flagged in the list until corrected).
     */
    private async prepare(dto: Partial<CreateVendorDto>, existing: Vendor | null): Promise<Partial<Vendor>> {
        const out: any = {};
        const map: Record<string, string> = {
            name: "name", legalname: "legalname", vendortype: "vendortype", registrationtype: "registrationtype", pan: "pan",
            statecode: "statecode", address: "address", city: "city", pincode: "pincode", contactname: "contactname",
            contactphone: "contactphone", mobile: "mobile", email: "email", repname: "repname", repphone: "repphone",
            paymenttermsdays: "paymenttermsdays", creditlimit: "creditlimit", discountpcnt: "discountpcnt", bankname: "bankname",
            bankaccount: "bankaccount", bankifsc: "bankifsc", upiid: "upiid", comments: "comments", props: "props",
        };
        for (const k of Object.keys(map)) {
            if ((dto as any)[k] !== undefined) out[map[k]] = (dto as any)[k];
        }

        const storedG = this.norm(existing?.gstn);
        const gstnSent = dto.gstn !== undefined;
        const g = gstnSent ? this.norm(dto.gstn) : storedG;
        if (gstnSent) out.gstn = g;

        if (gstnSent && g && g !== storedG) {
            if (!(await this.gstinOk(g))) {
                throw new BadRequestException("The GSTIN is not valid: check the letters and digits and the last check character.");
            }
            out.statecode = g.substring(0, 2);
            out.pan = g.substring(2, 12);
            const dup = await this.manager.query(
                `select business_name from vendor where upper(btrim(gstn)) = $1 and active and ($2::int is null or id <> $2) limit 1`,
                [g, existing?.id ?? null]);
            if (dup.length) throw new ConflictException(`That GSTIN already belongs to the vendor "${dup[0].business_name}".`);
        }

        let reg: string = out.registrationtype ?? existing?.registrationtype ?? "UNKNOWN";
        if (g) {
            if (reg === "UNREGISTERED") throw new BadRequestException("An unregistered vendor cannot have a GSTIN.");
            if (reg === "UNKNOWN") reg = "REGULAR";
        } else if (reg === "REGULAR" || reg === "COMPOSITION") {
            throw new BadRequestException("A GSTIN is needed for a regular or composition vendor.");
        }
        if (out.registrationtype !== undefined || (g && existing?.registrationtype !== reg) || !existing) out.registrationtype = reg;

        const state = out.statecode ?? existing?.statecode;
        if (out.statecode && !validStateCode(out.statecode)) throw new BadRequestException("The state code is not a valid GST state code.");
        if (g && state && g.substring(0, 2) !== state && gstnSent) throw new BadRequestException("The state code does not match the GSTIN.");
        return out;
    }

    private checkLicenses(list: VendorLicenseDto[]) {
        const seen = new Set<string>();
        for (const l of list) {
            const key = `${l.licensetype}|${(l.number || "").trim().toUpperCase()}`;
            if (seen.has(key)) throw new BadRequestException(`The licence ${l.number} is listed twice.`);
            seen.add(key);
            if (l.validfrom && l.validto && l.validto < l.validfrom) {
                throw new BadRequestException(`Licence ${l.number}: valid-to is before valid-from.`);
            }
        }
    }

    private async replaceLicenses(tx: EntityManager, vendorId: number, list: VendorLicenseDto[], userid?: number) {
        await tx.query(`delete from vendor_license where vendor_id = $1`, [vendorId]);
        for (const l of list) {
            await tx.query(
                `insert into vendor_license (vendor_id, license_type, number, valid_from, valid_to, notes, created_by)
                 values ($1,$2,$3,$4,$5,$6,$7)`,
                [vendorId, l.licensetype, l.number.trim(), l.validfrom || null, l.validto || null, l.notes || null, userid ?? null]);
        }
    }

    private async conflictAware<T>(work: () => Promise<T>): Promise<T> {
        try {
            return await work();
        } catch (e: any) {
            if (e?.code === "23505") {
                if (String(e.detail || e.constraint || "").includes("gstn")) throw new ConflictException("That GSTIN already belongs to another vendor.");
                throw new ConflictException("A vendor with this name already exists.");
            }
            throw e;
        }
    }

    async create(dto: CreateVendorDto, userid?: number) {
        const data = await this.prepare(dto, null);
        if (dto.licenses) this.checkLicenses(dto.licenses);
        const id = await this.conflictAware(() => this.manager.transaction(async (tx) => {
            const saved: any = await tx.getRepository(Vendor).save({ ...data, createdby: userid, updatedby: userid } as any);
            if (dto.licenses) await this.replaceLicenses(tx, saved.id, dto.licenses, userid);
            return saved.id as number;
        }));
        return this.findById(id);
    }

    async update(id: any, dto: Partial<CreateVendorDto> | any, userid?: number) {
        const vid = +id;
        const existing = await this.vendorRepository.findOne({ where: { id: vid } });
        if (!existing) throw new NotFoundException("Vendor not found.");
        // the delete route disables; it bypasses the form rules
        if (dto && Object.keys(dto).every((k) => k === "isActive")) {
            return dto.isActive === false ? this.disable(vid, userid) : this.enable(vid, userid);
        }
        const data = await this.prepare(dto, existing);
        if (dto.licenses) this.checkLicenses(dto.licenses);
        await this.conflictAware(() => this.manager.transaction(async (tx) => {
            if (Object.keys(data).length) await tx.getRepository(Vendor).update(vid, { ...data, updatedby: userid } as any);
            if (dto.licenses) await this.replaceLicenses(tx, vid, dto.licenses, userid);
        }));
        return this.findById(vid);
    }

    /**
     * Per licence type the latest valid-to counts (a renewal is a new row, the old one is history); a row with no
     * valid-to is open-ended. The vendor shows the worst of its types: EXPIRED, then EXPIRING (within 60 days), then VALID.
     */
    private status(rows: Array<{ license_type: string; valid_to: string | null }>): { status: LicenseStatus; nextexpiry: string | null } {
        if (!rows.length) return { status: "NONE", nextexpiry: null };
        const today = new Date().toISOString().slice(0, 10);
        const soon = new Date(Date.now() + EXPIRY_WARNING_DAYS * 86400000).toISOString().slice(0, 10);
        const latest = new Map<string, string | null>();
        for (const r of rows) {
            const d = r.valid_to ? String(r.valid_to).slice(0, 10) : null;
            const cur = latest.get(r.license_type);
            if (!latest.has(r.license_type) || d === null || (cur !== null && cur !== undefined && d > cur)) latest.set(r.license_type, d);
        }
        let worst: LicenseStatus = "VALID";
        let nextexpiry: string | null = null;
        for (const d of latest.values()) {
            if (d === null) continue;
            if (d < today) worst = "EXPIRED";
            else if (d <= soon && worst !== "EXPIRED") worst = "EXPIRING";
            if (nextexpiry === null || d < nextexpiry) nextexpiry = d;
        }
        return { status: worst, nextexpiry };
    }

    private async decorate(vendors: Vendor[], withLicenses: boolean) {
        if (!vendors.length) return [];
        const ids = vendors.map((v) => v.id);
        const lic = await this.manager.query(
            `select id, vendor_id, license_type, number, to_char(valid_from, 'YYYY-MM-DD') as valid_from, to_char(valid_to, 'YYYY-MM-DD') as valid_to, notes from vendor_license where vendor_id = any($1::int[]) order by valid_to nulls last, id`, [ids]);
        const bad = await this.manager.query(
            `select id from vendor where id = any($1::int[]) and coalesce(btrim(gstn), '') <> '' and not public.is_valid_gstin(upper(btrim(gstn)))`, [ids]);
        const badSet = new Set<number>(bad.map((r: any) => r.id));
        // purchase figures from completed invoices; balance = invoice total less every payment recorded against it
        const inv = await this.manager.query(
            `with inv as (
               select i.vendor_id, i.invoice_date, coalesce(i.due_date, i.invoice_date) as due, i.total::numeric as total,
                      coalesce((select sum(p.amount) from vendor_payment p where p.invoice_id = i.id), 0)::numeric as paid
                 from purchase_invoice i
                where i.vendor_id = any($1::int[]) and i.status = 'COMPLETE' and i.active and not i.archive)
             select vendor_id, count(*)::int as invoices, to_char(max(invoice_date), 'YYYY-MM-DD') as last_purchase,
                    round(coalesce(sum(total), 0), 2) as total,
                    round(coalesce(sum(total) filter (where invoice_date >= current_date - 365), 0), 2) as last12,
                    round(coalesce(sum(greatest(total - paid, 0)), 0), 2) as outstanding,
                    round(coalesce(sum(greatest(total - paid, 0)) filter (where due < current_date), 0), 2) as overdue
               from inv group by vendor_id`, [ids]);
        const pay = await this.manager.query(
            `select vendor_id, to_char(max(pay_date), 'YYYY-MM-DD') as last_payment from vendor_payment where vendor_id = any($1::int[]) group by vendor_id`, [ids]);
        const statsBy = new Map<number, any>(inv.map((r: any) => [r.vendor_id, r]));
        const payBy = new Map<number, string>(pay.map((r: any) => [r.vendor_id, r.last_payment]));
        const byVendor = new Map<number, any[]>();
        for (const l of lic) {
            if (!byVendor.has(l.vendor_id)) byVendor.set(l.vendor_id, []);
            byVendor.get(l.vendor_id)!.push(l);
        }
        return vendors.map((v) => {
            const rows = byVendor.get(v.id) || [];
            const st = this.status(rows);
            const s = statsBy.get(v.id);
            const base: any = { ...v,
                stats: {
                    invoices: s?.invoices ?? 0, lastpurchase: s?.last_purchase ?? null,
                    total: +(s?.total ?? 0), last12: +(s?.last12 ?? 0),
                    outstanding: +(s?.outstanding ?? 0), overdue: +(s?.overdue ?? 0), lastpayment: payBy.get(v.id) ?? null,
                },
                status: !v.isActive ? "DISABLED" : v.blocked ? "BLOCKED" : "ACTIVE", licensestatus: st.status, licensenextexpiry: st.nextexpiry, licensecount: rows.length, gstinInvalid: badSet.has(v.id) };
            if (withLicenses) {
                base.licenses = rows.map((r) => ({
                    id: r.id, licensetype: r.license_type, number: r.number,
                    validfrom: r.valid_from ? String(r.valid_from).slice(0, 10) : null,
                    validto: r.valid_to ? String(r.valid_to).slice(0, 10) : null, notes: r.notes,
                }));
            }
            return base;
        });
    }

    /**
     * status: 'active' (default: everything not disabled, blocked ones included), 'usable' (active and not blocked: what
     * a purchase form may offer), 'blocked', 'disabled' or 'all'.
     */
    async findAll(status = "active") {
        const qb = this.vendorRepository.createQueryBuilder(`p`);
        switch (status) {
            case "usable": qb.where("p.active = true and p.blocked = false"); break;
            case "blocked": qb.where("p.active = true and p.blocked = true"); break;
            case "disabled": qb.where("p.active = false"); break;
            case "all": break;
            default: qb.where("p.active = true");
        }
        const vendors = await qb.getMany();
        return this.decorate(vendors, false);
    }

    private async mustFind(id: number): Promise<Vendor> {
        const v = await this.vendorRepository.findOne({ where: { id } });
        if (!v) throw new NotFoundException("Vendor not found.");
        return v;
    }

    /** Puts a vendor on hold: stays listed, can still be paid, but no new requests, orders or invoices. */
    async block(id: number, reason: string, userid: number) {
        const v = await this.mustFind(id);
        if (!v.isActive) throw new BadRequestException("This vendor is disabled. Enable it before blocking.");
        const why = (reason || "").trim().slice(0, 200);
        await this.vendorRepository.update(id, { blocked: true, blockreason: why, blockedon: new Date(), blockedby: userid, updatedby: userid } as any);
        await this.audit.record({ userId: userid, action: "vendor.blocked", entityType: "vendors", entityId: id,
            summary: `vendor ${v.name.trim()} blocked: ${why}`, details: { reason: why } });
        return this.findById(id);
    }

    async unblock(id: number, userid: number) {
        const v = await this.mustFind(id);
        if (v.blocked) {
            await this.vendorRepository.update(id, { blocked: false, blockreason: null, blockedon: null, blockedby: null, updatedby: userid } as any);
            await this.audit.record({ userId: userid, action: "vendor.unblocked", entityType: "vendors", entityId: id,
                summary: `vendor ${v.name.trim()} unblocked`, details: { was: v.blockreason } });
        }
        return this.findById(id);
    }

    /** Retires a vendor: hidden from pick lists, history and dues kept, can be enabled again. */
    async disable(id: number, userid?: number) {
        const v = await this.mustFind(id);
        await this.vendorRepository.update(id, { isActive: false, updatedby: userid } as any);
        await this.audit.record({ userId: userid ?? null, action: "vendor.disabled", entityType: "vendors", entityId: id, summary: `vendor ${v.name.trim()} disabled` });
        return { id, isActive: false };
    }

    async enable(id: number, userid?: number) {
        const v = await this.mustFind(id);
        await this.conflictAware(() => this.vendorRepository.update(id, { isActive: true, updatedby: userid } as any));
        await this.audit.record({ userId: userid ?? null, action: "vendor.enabled", entityType: "vendors", entityId: id, summary: `vendor ${v.name.trim()} enabled` });
        return this.findById(id);
    }

    async findById(id: number) {
        const v = await this.vendorRepository.findOne({ where: { id } });
        if (!v) return v;
        return (await this.decorate([v], true))[0];
    }

    /** Licences that have run out or will within `days` (default 60), soonest first. Only the latest row of each type counts. */
    async expiringLicenses(days = EXPIRY_WARNING_DAYS) {
        return this.manager.query(
            `select id, vendor_id, vendor, licensetype, number, validto, days_left from (
               select distinct on (l.vendor_id, l.license_type)
                      l.id, l.vendor_id, v.business_name as vendor, l.license_type as licensetype, l.number, to_char(l.valid_to, 'YYYY-MM-DD') as validto, l.valid_to as vt,
                      (l.valid_to - current_date) as days_left
                 from vendor_license l join vendor v on v.id = l.vendor_id
                where v.active
                order by l.vendor_id, l.license_type, l.valid_to desc nulls first, l.id desc) latest
              where vt is not null and vt <= current_date + $1::int
              order by vt, vendor`, [Math.min(Math.max(+days || EXPIRY_WARNING_DAYS, 1), 365)]);
    }
}

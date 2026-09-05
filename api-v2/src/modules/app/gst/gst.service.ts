import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
import { GstReturnPeriod } from "src/entities/gst-return-period.entity";
import { GstInwardSupply } from "src/entities/gst-inward-supply.entity";
import { GstReconciliation } from "src/entities/gst-reconciliation.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Business } from "src/entities/business.entity";
import { Vendor } from "src/entities/vendor.entity";

/** A status a human has already ruled on - the matcher must never overwrite these on re-run. */
const RESOLVED_STATUSES = new Set(['ACCEPTED', 'DISPUTED', 'EXCLUDED', 'CARRIED_FORWARD']);
// Decision #7 (locked 2026-09-04): matcher value/date tolerances.
const VALUE_ABS_TOLERANCE = 1;
const VALUE_PCT_TOLERANCE = 0.01;
const DATE_TOLERANCE_DAYS = 3;

@Injectable()
export class GstService {

    constructor(
        @InjectRepository(GstReturnPeriod) private readonly periodRepository: Repository<GstReturnPeriod>,
        @InjectRepository(GstInwardSupply) private readonly inwardRepository: Repository<GstInwardSupply>,
        @InjectRepository(GstReconciliation) private readonly reconRepository: Repository<GstReconciliation>,
        @InjectRepository(PurchaseInvoice) private readonly invoiceRepository: Repository<PurchaseInvoice>,
        @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
        @InjectRepository(Vendor) private readonly vendorRepository: Repository<Vendor>,
        @InjectEntityManager() private manager: EntityManager,
    ) {}

    /** Single-GSTIN-per-business assumption (decision #1): resolve "the" business when none is passed. */
    private async resolveBusinessId(businessid?: number | string): Promise<number> {
        if (businessid) {
            return +businessid;
        }
        const business = await this.businessRepository.findOne({ where: { isActive: true } as any, order: { id: 'ASC' } as any });
        if (!business) {
            throw new BadRequestException('No business is configured.');
        }
        return business.id;
    }

    async ensurePeriod(businessidRaw: number | string | undefined, period: string, userid: number) {
        const businessid = await this.resolveBusinessId(businessidRaw);
        if (!period || !/^\d{4}-\d{2}$/.test(period)) {
            throw new BadRequestException('A valid period (YYYY-MM) is required.');
        }
        let row = await this.periodRepository.findOne({ where: { businessid, period } });
        if (!row) {
            row = await this.periodRepository.save({
                businessid, period, status: 'OPEN',
                itcavailable: 0, itcclaimed: 0, itconhold: 0, itcreversed: 0,
                createdby: userid, updatedby: userid,
            });
        }
        return row;
    }

    async listPeriods(businessidRaw?: any) {
        const businessid = await this.resolveBusinessId(businessidRaw);
        return this.periodRepository.find({ where: { businessid }, order: { period: 'DESC' } });
    }

    // ---------------------------------------------------------------------------
    // Import
    // ---------------------------------------------------------------------------

    async importReturn(dto: any, userid: number) {
        const businessid = await this.resolveBusinessId(dto.businessid);
        const period = dto.period;
        const source = `${dto.source || '2B'}`.toUpperCase();
        if (!['2A', '2B'].includes(source)) {
            throw new BadRequestException('source must be 2A or 2B.');
        }
        if (!period || !/^\d{4}-\d{2}$/.test(period)) {
            throw new BadRequestException('A valid period (YYYY-MM) is required.');
        }
        if (!dto.file) {
            throw new BadRequestException('No file payload provided.');
        }

        const rows = this.parseReturnFile(dto.file);
        if (!rows.length) {
            throw new BadRequestException('No invoice rows found in the uploaded file.');
        }

        const importbatch = `${source}-${period}-${Date.now()}`;

        return this.manager.transaction('SERIALIZABLE', async (tm) => {
            // Idempotent per (business, period, source): re-importing replaces the whole batch.
            await tm.delete(GstInwardSupply, { businessid, period, source });

            const saved: GstInwardSupply[] = [];
            for (const row of rows) {
                saved.push(await tm.save(GstInwardSupply, {
                    businessid, period, source,
                    suppliergstin: row.suppliergstin || null,
                    suppliername: row.suppliername || null,
                    invoiceno: row.invoiceno,
                    invoicedate: row.invoicedate || null,
                    invoicevalue: +row.invoicevalue || 0,
                    taxablevalue: +row.taxablevalue || 0,
                    cgst: +row.cgst || 0,
                    sgst: +row.sgst || 0,
                    igst: +row.igst || 0,
                    cess: +row.cess || 0,
                    placeofsupply: row.placeofsupply || null,
                    reversecharge: !!row.reversecharge,
                    itcavailability: row.itcavailability || null,
                    filingstatus: row.filingstatus || null,
                    filingperiod: row.filingperiod || period,
                    importbatch,
                    raw: row.raw ?? row,
                    createdby: userid, updatedby: userid,
                }));
            }

            const importedField = source === '2B' ? 'gstr2bimportedat' : 'gstr2aimportedat';
            let periodRow = await tm.findOne(GstReturnPeriod, { where: { businessid, period } });
            if (!periodRow) {
                periodRow = await tm.save(GstReturnPeriod, {
                    businessid, period, status: 'OPEN',
                    itcavailable: 0, itcclaimed: 0, itconhold: 0, itcreversed: 0,
                    createdby: userid, updatedby: userid,
                });
            }
            await tm.update(GstReturnPeriod, periodRow.id, { [importedField]: new Date(), updatedby: userid } as any);

            return { imported: saved.length, importbatch, period, source };
        });
    }

    /** Accepts the official GSTR-2A/2B JSON (docdata.b2b[].inv[].itms[]) or a flat pre-normalised array. */
    private parseReturnFile(file: any): any[] {
        const b2b = file?.data?.docdata?.b2b || file?.docdata?.b2b;
        if (Array.isArray(b2b)) {
            const rows: any[] = [];
            for (const supplier of b2b) {
                const suppliergstin = supplier.ctin;
                const suppliername = supplier.cfs || supplier.trdnm || null;
                for (const inv of (supplier.inv || [])) {
                    const items = inv.itms || inv.items || [];
                    const sums = items.reduce((acc: any, it: any) => {
                        const d = it.itm_det || it;
                        acc.taxablevalue += +(d.txval || 0);
                        acc.cgst += +(d.camt || 0);
                        acc.sgst += +(d.samt || 0);
                        acc.igst += +(d.iamt || 0);
                        acc.cess += +(d.csamt || 0);
                        return acc;
                    }, { taxablevalue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 });
                    rows.push({
                        suppliergstin, suppliername,
                        invoiceno: inv.inum, invoicedate: this.parseGstDate(inv.idt),
                        invoicevalue: +(inv.val || 0),
                        ...sums,
                        placeofsupply: inv.pos || null,
                        reversecharge: `${inv.rev || ''}`.toUpperCase() === 'Y',
                        itcavailability: inv.itcavl || inv.itc_avl || null,
                        filingstatus: inv.irngstin ? 'FILED' : (inv.fils || null),
                        raw: inv,
                    });
                }
            }
            return rows;
        }

        if (Array.isArray(file)) {
            return file.map((row: any) => ({
                ...row,
                invoicedate: row.invoicedate || row.invoice_date || null,
                suppliergstin: row.suppliergstin || row.supplier_gstin,
                suppliername: row.suppliername || row.supplier_name,
                invoiceno: row.invoiceno || row.invoice_no,
                invoicevalue: row.invoicevalue ?? row.invoice_value,
                taxablevalue: row.taxablevalue ?? row.taxable_value,
                placeofsupply: row.placeofsupply || row.place_of_supply,
                reversecharge: row.reversecharge ?? row.reverse_charge,
                itcavailability: row.itcavailability || row.itc_availability,
                filingstatus: row.filingstatus || row.filing_status,
                filingperiod: row.filingperiod || row.filing_period,
            }));
        }

        return [];
    }

    /** GSTR portal JSON dates are DD-MM-YYYY. */
    private parseGstDate(value: any): string | null {
        if (!value) {
            return null;
        }
        const match = `${value}`.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (match) {
            return `${match[3]}-${match[2]}-${match[1]}`;
        }
        return `${value}`.slice(0, 10);
    }

    // ---------------------------------------------------------------------------
    // Matching
    // ---------------------------------------------------------------------------

    async runMatch(dto: any, userid: number) {
        const businessid = await this.resolveBusinessId(dto.businessid);
        const period = dto.period;
        if (!period) {
            throw new BadRequestException('A period is required.');
        }
        await this.ensurePeriod(businessid, period, userid);

        return this.manager.transaction('SERIALIZABLE', async (tm) => {
            const inward = await tm.find(GstInwardSupply, { where: { businessid, period, isActive: true, isArchived: false } });
            const books = await tm.find(PurchaseInvoice, { where: { gstperiod: period, isActive: true, isArchived: false } as any });

            const existing = await tm.find(GstReconciliation, { where: { businessid, period } });
            const resolvedByInward = new Set(existing.filter((r) => r.inwardsupplyid && RESOLVED_STATUSES.has(r.status)).map((r) => r.inwardsupplyid));
            const resolvedByInvoice = new Set(existing.filter((r) => r.purchaseinvoiceid && RESOLVED_STATUSES.has(r.status)).map((r) => r.purchaseinvoiceid));

            // Wipe only the auto-generated (not yet human-resolved) rows so a re-run starts clean.
            const staleIds = existing.filter((r) => !RESOLVED_STATUSES.has(r.status)).map((r) => r.id);
            if (staleIds.length) {
                await tm.delete(GstReconciliation, staleIds);
            }

            const norm = (s: any) => `${s || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const usedInward = new Set<number>();
            const usedBooks = new Set<number>();
            const tally = { matched: 0, probable: 0, mismatch: 0, missingIn2b: 0, missingInBooks: 0 };

            for (const book of books) {
                if (resolvedByInvoice.has(book.id)) {
                    usedBooks.add(book.id);
                    continue;
                }
                if (!book.suppliergstin) {
                    continue; // nothing to reconcile against without a supplier GSTIN
                }

                const candidates = inward.filter((i) => !usedInward.has(i.id) && norm(i.suppliergstin) === norm(book.suppliergstin));
                let best: GstInwardSupply | null = null;
                let verdict: 'EXACT' | 'PROBABLE' | 'MISMATCH' | null = null;

                for (const c of candidates) {
                    const sameNo = norm(c.invoiceno) === norm(book.invoiceno);
                    const dateClose = this.daysApart(c.invoicedate, book.invoicedate) <= DATE_TOLERANCE_DAYS;
                    const valueClose = this.within(c.invoicevalue, +(book.total || 0));

                    if (sameNo && valueClose) { best = c; verdict = 'EXACT'; break; }
                    if (sameNo && !valueClose) { best = c; verdict = 'MISMATCH'; break; }
                    if (!best && (sameNo || dateClose) && valueClose) { best = c; verdict = 'PROBABLE'; }
                }

                if (best && verdict) {
                    usedInward.add(best.id);
                    usedBooks.add(book.id);
                    const variances = verdict === 'MISMATCH' ? {
                        invoice_value: { books: book.total, portal: best.invoicevalue },
                        taxable_value: { books: book.taxablevalue, portal: best.taxablevalue },
                    } : null;
                    await tm.save(GstReconciliation, {
                        businessid, period,
                        purchaseinvoiceid: book.id, inwardsupplyid: best.id,
                        matchtype: verdict === 'PROBABLE' ? 'PROBABLE' : 'EXACT',
                        status: verdict === 'EXACT' ? 'MATCHED' : verdict,
                        variances,
                        createdby: userid, updatedby: userid,
                    });
                    await tm.update(GstInwardSupply, best.id, { matchedinvoiceid: book.id });
                    if (verdict === 'EXACT') tally.matched++;
                    else if (verdict === 'PROBABLE') tally.probable++;
                    else tally.mismatch++;
                }
            }

            for (const book of books) {
                if (usedBooks.has(book.id) || resolvedByInvoice.has(book.id) || !book.suppliergstin) {
                    continue;
                }
                await tm.save(GstReconciliation, {
                    businessid, period, purchaseinvoiceid: book.id, inwardsupplyid: null,
                    matchtype: null, status: 'MISSING_IN_2B',
                    createdby: userid, updatedby: userid,
                });
                tally.missingIn2b++;
            }

            for (const row of inward) {
                if (usedInward.has(row.id) || resolvedByInward.has(row.id)) {
                    continue;
                }
                await tm.save(GstReconciliation, {
                    businessid, period, purchaseinvoiceid: null, inwardsupplyid: row.id,
                    matchtype: null, status: 'MISSING_IN_BOOKS',
                    createdby: userid, updatedby: userid,
                });
                tally.missingInBooks++;
            }

            return tally;
        });
    }

    private daysApart(a: string | null, b: string | null): number {
        if (!a || !b) {
            return 999;
        }
        const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
        return Math.round(diff / 86400000);
    }

    private within(a: number, b: number): boolean {
        const diff = Math.abs((a || 0) - (b || 0));
        if (diff <= VALUE_ABS_TOLERANCE) {
            return true;
        }
        const base = Math.max(Math.abs(a || 0), Math.abs(b || 0), 1);
        return diff / base <= VALUE_PCT_TOLERANCE;
    }

    // ---------------------------------------------------------------------------
    // Worklist / summary / ITC ledger
    // ---------------------------------------------------------------------------

    async worklist(businessidRaw: any, period: string, status?: string) {
        const businessid = await this.resolveBusinessId(businessidRaw);
        if (!period) {
            throw new BadRequestException('A period is required.');
        }
        return this.manager.query(`
            select
                r.id, r.status, r.match_type, r.variances, r.resolution_note, r.resolved_at,
                pi.id as invoice_id, pi.invoice_no as invoice_no, pi.invoice_date as invoice_date,
                pi.total as invoice_total, pi.supplier_gstin as books_gstin,
                v.business_name as vendor_name,
                gi.id as inward_id, gi.invoice_no as portal_invoice_no, gi.invoice_date as portal_invoice_date,
                gi.invoice_value as portal_value, gi.supplier_gstin as portal_gstin, gi.supplier_name as portal_supplier_name,
                gi.taxable_value as portal_taxable, gi.cgst as portal_cgst, gi.sgst as portal_sgst, gi.igst as portal_igst
            from gst_reconciliation r
            left join purchase_invoice pi on pi.id = r.purchase_invoice_id
            left join vendor v on v.id = pi.vendor_id
            left join gst_inward_supply gi on gi.id = r.inward_supply_id
            where r.business_id = $1 and r.period = $2 and r.active = true
              and ($3::text is null or r.status = $3)
            order by
              case r.status
                when 'MISMATCH' then 0 when 'PROBABLE' then 1
                when 'MISSING_IN_2B' then 2 when 'MISSING_IN_BOOKS' then 3
                else 4
              end,
              r.id
        `, [businessid, period, status || null]);
    }

    async summary(businessidRaw: any, period: string) {
        const ledger = await this.computeLedger(businessidRaw, period);
        return ledger;
    }

    private async computeLedger(businessidRaw: any, period: string) {
        const businessid = await this.resolveBusinessId(businessidRaw);
        if (!period) {
            throw new BadRequestException('A period is required.');
        }
        const rows = await this.manager.query(`
            select
                r.status,
                count(*)::int as cnt,
                coalesce(sum(coalesce(pi.cgst_amount,0) + coalesce(pi.sgst_amount,0) + coalesce(pi.igst_amount,0)), 0) as books_itc,
                coalesce(sum(coalesce(gi.cgst,0) + coalesce(gi.sgst,0) + coalesce(gi.igst,0)), 0) as portal_itc
            from gst_reconciliation r
            left join purchase_invoice pi on pi.id = r.purchase_invoice_id
            left join gst_inward_supply gi on gi.id = r.inward_supply_id
            where r.business_id = $1 and r.period = $2 and r.active = true
            group by r.status
        `, [businessid, period]);

        const byStatus = new Map<string, any>(rows.map((r: any) => [r.status, r]));
        const itcOf = (status: string, side: 'books_itc' | 'portal_itc' = 'books_itc') => +(byStatus.get(status)?.[side] || 0);
        const countOf = (status: string) => +(byStatus.get(status)?.cnt || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const matchedItc = itcOf('MATCHED') + itcOf('ACCEPTED');
        const mismatchItc = itcOf('MISMATCH');
        const missingIn2bItc = itcOf('MISSING_IN_2B');
        const disputedItc = itcOf('DISPUTED');
        const carriedForwardItc = itcOf('CARRIED_FORWARD');

        return {
            businessid, period,
            matched: { count: countOf('MATCHED'), itc: round2(itcOf('MATCHED')) },
            probable: { count: countOf('PROBABLE'), itc: round2(itcOf('PROBABLE')) },
            mismatch: { count: countOf('MISMATCH'), itc_at_risk: round2(mismatchItc) },
            missing_in_2b: { count: countOf('MISSING_IN_2B'), itc_at_risk: round2(missingIn2bItc) },
            missing_in_books: { count: countOf('MISSING_IN_BOOKS'), portal_itc: round2(itcOf('MISSING_IN_BOOKS', 'portal_itc')) },
            accepted: { count: countOf('ACCEPTED'), itc: round2(itcOf('ACCEPTED')) },
            disputed: { count: countOf('DISPUTED'), itc: round2(disputedItc) },
            excluded: { count: countOf('EXCLUDED') },
            carried_forward: { count: countOf('CARRIED_FORWARD'), itc: round2(carriedForwardItc) },
            itc_claimable: round2(matchedItc),
            itc_on_hold: round2(mismatchItc + disputedItc),
            itc_carried_forward: round2(carriedForwardItc),
        };
    }

    // ---------------------------------------------------------------------------
    // Row actions
    // ---------------------------------------------------------------------------

    private async findReconOrThrow(id: number) {
        const row = await this.reconRepository.findOne({ where: { id } });
        if (!row) {
            throw new NotFoundException('Reconciliation row not found.');
        }
        return row;
    }

    async accept(id: number, userid: number, note?: string) {
        const row = await this.findReconOrThrow(id);
        const nextStatus = row.status === 'PROBABLE' ? 'MATCHED' : 'ACCEPTED';
        await this.reconRepository.update(id, {
            status: nextStatus, resolutionnote: note || row.resolutionnote,
            resolvedby: userid, resolvedat: new Date(), updatedby: userid,
        });
        return this.reconRepository.findOne({ where: { id } });
    }

    async dispute(id: number, userid: number, note?: string) {
        await this.findReconOrThrow(id);
        if (!note) {
            throw new BadRequestException('A note is required when marking a row disputed.');
        }
        await this.reconRepository.update(id, {
            status: 'DISPUTED', resolutionnote: note, resolvedby: userid, resolvedat: new Date(), updatedby: userid,
        });
        return this.reconRepository.findOne({ where: { id } });
    }

    async exclude(id: number, userid: number, note?: string) {
        await this.findReconOrThrow(id);
        await this.reconRepository.update(id, {
            status: 'EXCLUDED', resolutionnote: note || null, resolvedby: userid, resolvedat: new Date(), updatedby: userid,
        });
        return this.reconRepository.findOne({ where: { id } });
    }

    async carryForward(id: number, userid: number, note?: string) {
        const row = await this.findReconOrThrow(id);
        if (row.status !== 'MISSING_IN_2B') {
            throw new BadRequestException('Only a "missing in 2B" row can be carried forward.');
        }
        await this.reconRepository.update(id, {
            status: 'CARRIED_FORWARD', resolutionnote: note || row.resolutionnote,
            resolvedby: userid, resolvedat: new Date(), updatedby: userid,
        });
        return this.reconRepository.findOne({ where: { id } });
    }

    /** "Missing in books" -> drafts a purchase_invoice header from the portal row, for the normal GRN flow to pick up. */
    async createInvoiceFromPortalRow(id: number, userid: number) {
        const row = await this.findReconOrThrow(id);
        if (row.status !== 'MISSING_IN_BOOKS' || !row.inwardsupplyid) {
            throw new BadRequestException('This row has no portal invoice to create a draft from.');
        }
        const inward = await this.inwardRepository.findOne({ where: { id: row.inwardsupplyid } });
        if (!inward) {
            throw new NotFoundException('Portal invoice row not found.');
        }
        const vendor = inward.suppliergstin
            ? await this.vendorRepository.findOne({ where: { gstn: inward.suppliergstin } as any })
            : null;
        if (!vendor) {
            throw new BadRequestException(`No vendor found with GSTIN ${inward.suppliergstin || '(none)'} - add the vendor first, then create the invoice manually and re-run the match.`);
        }

        // purchase_invoice.store_id is NOT NULL (WS-6) - this draft path bypasses
        // PurchaseInvoiceService.create(), so it must resolve one itself.
        const storeRows = await this.manager.query(`select id from stores order by id asc limit 1`);
        const storeid = storeRows?.[0]?.id;
        if (!storeid) {
            throw new BadRequestException('No store is configured to receive this invoice.');
        }

        const invoice = await this.invoiceRepository.save({
            vendorid: vendor.id,
            storeid,
            invoiceno: inward.invoiceno,
            invoicedate: inward.invoicedate || new Date().toISOString().slice(0, 10),
            status: 'NEW',
            grno: '',
            duedate: inward.invoicedate,
            paymentstatus: 'Unpaid',
            total: inward.invoicevalue,
            comments: `Drafted from GST ${inward.source} import - reconcile line items manually.`,
            suppliergstin: inward.suppliergstin,
            placeofsupply: inward.placeofsupply,
            supplytype: inward.igst > 0 ? 'INTER' : 'INTRA',
            invoicetype: 'REGULAR',
            reversecharge: inward.reversecharge,
            itceligibility: 'INPUTS',
            gstreconstatus: 'UNRECONCILED',
            gstperiod: inward.period,
            createdby: userid,
        } as any);

        await this.reconRepository.update(id, {
            purchaseinvoiceid: (invoice as any).id, status: 'MATCHED', matchtype: 'MANUAL',
            resolvedby: userid, resolvedat: new Date(), updatedby: userid,
        });
        await this.inwardRepository.update(inward.id, { matchedinvoiceid: (invoice as any).id });

        return invoice;
    }

    // ---------------------------------------------------------------------------
    // Lock period
    // ---------------------------------------------------------------------------

    async lockPeriod(businessidRaw: any, period: string, userid: number) {
        const businessid = await this.resolveBusinessId(businessidRaw);
        const periodRow = await this.ensurePeriod(businessid, period, userid);
        if (periodRow.status === 'LOCKED') {
            throw new BadRequestException('This period is already locked.');
        }

        const ledger = await this.computeLedger(businessid, period);

        return this.manager.transaction('SERIALIZABLE', async (tm) => {
            await tm.update(GstReturnPeriod, periodRow.id, {
                status: 'LOCKED',
                itcavailable: ledger.itc_claimable,
                itcclaimed: ledger.itc_claimable,
                itconhold: ledger.itc_on_hold,
                itcreversed: 0,
                updatedby: userid,
            });

            const finalize = async (statuses: string[], reconStatus: string) => {
                const ids = (await tm.find(GstReconciliation, {
                    where: { businessid, period, status: In(statuses) },
                })).map((r) => r.purchaseinvoiceid).filter((id): id is number => !!id);
                if (ids.length) {
                    await tm.update(PurchaseInvoice, ids, { gstreconstatus: reconStatus } as any);
                }
            };

            await finalize(['MATCHED', 'ACCEPTED'], 'MATCHED');
            await finalize(['MISMATCH'], 'MISMATCH');
            await finalize(['MISSING_IN_2B'], 'MISSING_IN_2B');
            await finalize(['EXCLUDED'], 'EXCLUDED');

            return tm.findOne(GstReturnPeriod, { where: { id: periodRow.id } });
        });
    }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Business } from "src/entities/business.entity";
import { AuditService } from "src/core/audit/audit.service";
import { isValidApprovalMode } from "src/core/approval-mode";
import { ModulesService } from "src/core/modules/modules.service";
import { PlatformService } from "src/core/platform/platform.service";
import { UserService } from "../users/user.service";
import { PRESETS, PRESET_INFO, Preset, PresetInput, planPreset } from "./business-preset";

import { isOwnerRole } from 'src/core/roles';
@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly modules: ModulesService,
    private readonly users: UserService,
    private readonly platform: PlatformService,
  ) {}

  /** The business the signed-in Business Head belongs to. Nobody else reaches this, and nobody reaches another business. */
  private async ownBusiness(user: any): Promise<Business> {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!isOwnerRole(role?.name)) throw new ForbiddenException("Only the Business Head can manage the business details.");
    const [u] = await this.manager.query(`select business_id from app_user where id = $1`, [user?.id || 0]);
    const b = u?.business_id ? await this.businessRepository.findOne({ where: { id: u.business_id } }) : null;
    if (!b) throw new NotFoundException("Your user is not linked to a business.");
    return b;
  }

  async mine(user: any) {
    const b = await this.ownBusiness(user);
    return { ...b, singleperson: await this.isSinglePerson(user, b) };
  }

  /** a shop run by one person (an Owner-operator login, or the "Just me" preset): there is nobody else to approve anything */
  private async isSinglePerson(user: any, b: Business): Promise<boolean> {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    return role?.name === "Owner-operator" || b.staffingpreset === "solo";
  }

  // ---------------------------------------------------------------- staffing presets (the setup wizard)
  /** The presets on offer, the one chosen, and each store as it is set up now. */
  async presets(user: any) {
    const b = await this.ownBusiness(user);
    return { current: b.staffingpreset, locked: this.modules.lockedByPlan(), presets: PRESETS.map((k) => ({ ...PRESET_INFO[k], unavailable: this.presetUnavailable(k) })), stores: await this.storesNow(b.id) };
  }

  /** why a preset does not fit the hosted plan (a one-store plan cannot run "several stores"), or null */
  private presetUnavailable(key: Preset): string | null {
    const limits = this.platform.entitlements()?.limits;
    if (!limits) return null;
    if (key === "multi_store" && limits.stores < 2) return "Needs a plan with more than one store.";
    if (key === "manager_and_staff" && limits.users < 3) return "Needs a plan with at least three logins (owner, manager, staff).";
    if (key === "owner_and_staff" && limits.users < 2) return "Needs a plan with at least two logins.";
    return null;
  }

  private async storesNow(businessId: number) {
    const rows = await this.manager.query(
      `select s.id, s.location, s.shift_mode, s.operator_required,
              (select count(*)::int from store_shifts sh where sh.store_id = s.id and sh.status = 'OPEN') as open
         from stores s where s.business_id = $1 and s.active and not s.archive order by s.id`, [businessId]);
    return rows.map((r: any) => ({ id: r.id, location: String(r.location).trim(), shiftmode: r.shift_mode === "staff" ? "staff" : "time", operatorrequired: !!r.operator_required, openshifts: r.open }));
  }

  private async planFor(business: Business, body: any) {
    if (!PRESETS.includes(body?.preset)) throw new BadRequestException("Choose one of: " + PRESETS.join(", ") + ".");
    const unfit = this.presetUnavailable(body.preset);
    if (unfit) throw new ForbiddenException(`That setup does not fit your plan. ${unfit}`);
    for (const k of ["shiftmode"]) if (body[k] !== undefined && !["time", "staff"].includes(body[k])) throw new BadRequestException("Shift mode must be time or staff.");
    for (const [id, v] of Object.entries(body.stores || {})) if ((v as any)?.shiftmode !== undefined && !["time", "staff"].includes((v as any).shiftmode)) throw new BadRequestException(`Shift mode for store ${id} must be time or staff.`);
    const m = await this.modules.forBusiness(business.id);
    return planPreset(body as PresetInput, {
      approvalmode: business.approvalmode === "self" ? "self" : "separate",
      modules: { hr: m.hr, transfers: m.transfers, stock_audits: m.stock_audits },
      stores: await this.storesNow(business.id),
    });
  }

  /** What a preset would change here, without changing anything. */
  async previewPreset(user: any, body: any) {
    const b = await this.ownBusiness(user);
    return { ...(await this.planFor(b, body)), info: PRESET_INFO[body.preset as Preset] };
  }

  /**
   * Applies a preset as defaults: approval mode, the modules it decides, and each store's shift mode and operator rule. Users,
   * shifts and history are never touched. A store with a shift open keeps its mode until the shift is closed, so the whole
   * switch waits (nothing is half applied). Logins listed in `accounts` are created afterwards, each reported on its own.
   */
  async applyPreset(user: any, body: any) {
    const b = await this.ownBusiness(user);
    const plan = await this.planFor(b, body);
    if (plan.blockers.length) throw new ConflictException(plan.blockers.join(" "));
    const before = { preset: b.staffingpreset, approvalmode: b.approvalmode };
    await this.manager.transaction(async (tx) => {
      await tx.query(`update business set staffing_preset = $2, approval_mode = $3 where id = $1`, [b.id, plan.preset, plan.approvalmode]);
      for (const s of plan.stores) {
        await tx.query(`update stores set shift_mode = $2, operator_required = $3 where id = $1`, [s.id, s.shiftmode, s.operatorrequired]);
      }
    });
    if (Object.keys(plan.modules).length) await this.modules.update(b.id, user.id, plan.modules);
    await this.audit.record({
      userId: user.id, action: "business.preset_applied", entityType: "businesses", entityId: b.id,
      summary: `setup preset ${before.preset || "none"} -> ${plan.preset}: ${plan.changes.concat(plan.stores.flatMap((s) => s.changes.map((c) => `${s.location} ${c}`))).join("; ") || "no setting changed"}`,
      details: { before, plan },
    });
    const accounts: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const a of Array.isArray(body.accounts) ? body.accounts : []) {
      try {
        if (!a?.email || !a?.password || !a?.fullname) throw new BadRequestException("A login needs a name, an email and a password.");
        const roleRows = await this.manager.query(`select id from app_role where name = $1`, [a.role]);
        if (!roleRows[0]) throw new BadRequestException("Unknown kind of login.");
        await this.users.createScoped({ fullname: a.fullname, email: a.email, password: a.password, phone: a.phone || "", location: a.location || "", roleid: roleRows[0].id, storeids: a.storeids || [] } as any, user.id);
        accounts.push({ email: a.email, ok: true });
      } catch (e: any) {
        const m = e?.response?.message ?? e?.message ?? "Could not create the login.";
        accounts.push({ email: a?.email || "", ok: false, error: Array.isArray(m) ? m.join(" ") : String(m) });
      }
    }
    return { ...plan, info: PRESET_INFO[plan.preset], accounts, current: plan.preset };
  }

  /** Which modules the Business Head's business has switched on (the whole picture, with defaults filled in). */
  async myModules(user: any) {
    const b = await this.ownBusiness(user);
    const state = await this.modules.forBusiness(b.id);
    const locked = this.modules.lockedByPlan();
    return locked.length ? { ...state, locked } : state;
  }

  async updateMyModules(user: any, body: any) {
    const b = await this.ownBusiness(user);
    return this.modules.update(b.id, user.id, body);
  }

  /**
   * The Business Head edits their own business's details. The GSTIN is checked (format, state, checksum) and the state
   * code follows from it; a business cannot be created, renamed to a clash, disabled or removed from here.
   */
  async updateMine(user: any, body: any) {
    const cur = await this.ownBusiness(user);
    const clean = (v: any, max: number, label: string) => {
      const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
      if (t.length > max) throw new BadRequestException(`${label} can be at most ${max} characters.`);
      return t || null;
    };
    const fields: any = {};
    if (body.name !== undefined) {
      const n = clean(body.name, 40, "The name");
      if (!n || n.length < 2) throw new BadRequestException("The business name is required.");
      fields.name = n;
    }
    if (body.legalname !== undefined) fields.legalname = clean(body.legalname, 120, "The legal name");
    if (body.address !== undefined) fields.address = clean(body.address, 200, "The address");
    if (body.pincode !== undefined) {
      const p = clean(body.pincode, 10, "The pincode");
      if (p && !/^[0-9]{6}$/.test(p)) throw new BadRequestException("The pincode must be 6 digits.");
      fields.pincode = p;
    }
    if (body.approvalmode !== undefined) {
      if (!isValidApprovalMode(body.approvalmode)) throw new BadRequestException("Approval mode must be self or separate.");
      fields.approvalmode = body.approvalmode;
    }
    if (body.gstin !== undefined) {
      const g = ((body.gstin || "") as string).trim().toUpperCase();
      if (g) {
        const [ok] = await this.manager.query(`select public.is_valid_gstin($1) as ok`, [g]);
        if (!ok?.ok) throw new BadRequestException("That is not a valid GSTIN. Check the 15 characters, the state code and the check digit.");
        fields.gstin = g;
        fields.statecode = g.substring(0, 2);
      } else {
        fields.gstin = null;
      }
    }
    if (body.statecode !== undefined && !fields.statecode) {
      const s = clean(body.statecode, 2, "The state code");
      if (s && !/^(0[1-9]|[12][0-9]|3[0-8])$/.test(s)) throw new BadRequestException("The state code must be a two-digit GST state code (01-38).");
      fields.statecode = s;
    }
    const single = await this.isSinglePerson(user, cur);
    if (!Object.keys(fields).length) return { ...cur, singleperson: single };
    try {
      await this.businessRepository.update(cur.id, fields);
    } catch (e: any) {
      if (String(e?.code) === "23505") throw new ConflictException("Another business already has that name.");
      throw e;
    }
    const after = await this.businessRepository.findOne({ where: { id: cur.id } });
    const diff: any = {};
    for (const k of Object.keys(fields)) if ((cur as any)[k] !== (after as any)[k]) diff[k] = { from: (cur as any)[k] ?? null, to: (after as any)[k] ?? null };
    if (Object.keys(diff).length) {
      await this.audit.record({ userId: user.id, action: "business.details_updated", entityType: "businesses", entityId: cur.id, summary: `business details changed: ${Object.keys(diff).join(", ")}`, details: diff });
    }
    return { ...after, singleperson: single };
  }

  findAll() {
    return this.businessRepository.createQueryBuilder("business")
      .where("business.active = true")
      .andWhere("business.archive = false")
      .orderBy("business.name", "ASC")
      .getMany();
  }

  async create(body: any, userid: any) {
    const payload = {
      name: body.name,
      isActive: body.isActive !== false,
      isArchived: false,
      ...this.gstFields(body),
    };
    return this.businessRepository.save(payload);
  }

  async update(id: number, body: any) {
    const current = await this.businessRepository.findOne({ where: { id } });
    if (!current) {
      throw new Error("Business not found");
    }
    await this.businessRepository.update(id, {
      name: body.name,
      isActive: body.isActive === undefined ? current.isActive : !!body.isActive,
      isArchived: body.isArchived === undefined ? current.isArchived : !!body.isArchived,
      ...this.gstFields(body),
    });
    return this.businessRepository.findOne({ where: { id } });
  }

  /** GST registration fields (WS-4): only touched when the caller actually sends them, so a plain name/status edit is a no-op here. */
  private gstFields(body: any) {
    const fields: any = {};
    if (body.gstin !== undefined) fields.gstin = body.gstin || null;
    if (body.legalname !== undefined) fields.legalname = body.legalname || null;
    if (body.statecode !== undefined) fields.statecode = body.statecode || null;
    if (body.address !== undefined) fields.address = body.address || null;
    if (body.pincode !== undefined) fields.pincode = body.pincode || null;
    return fields;
  }

  async remove(id: number) {
    await this.businessRepository.update(id, {
      isActive: false,
      isArchived: true,
    });
    return { success: true };
  }
}

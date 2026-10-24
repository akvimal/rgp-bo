import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Store } from "src/entities/store.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";
import { StoreShift } from "src/entities/store-shift.entity";
import { StoreShiftTemplate } from "src/entities/store-shift-template.entity";
import { AppUser } from "src/entities/appuser.entity";
import { UserStore } from "src/entities/user-store.entity";
import { Business } from "src/entities/business.entity";
import { AuditService } from "src/core/audit/audit.service";
import { PlatformService } from "src/core/platform/platform.service";
import { denominationTotal, normalizeDenominations } from "./denominations";
import { findAccountableUser, loadStoreProfile, parseProfileInput, parseStoreType } from "./store-profile";
import { DepositRule, checkDepositRule, describeDepositRule, evaluateDeposit, parseDepositInput } from "./deposit-rule";
import { ChecklistAssistant } from "./checklist-assistant";
import { ChecklistKind, CHECKLIST_KINDS, DEFAULT_CHECKLISTS, effectiveChecklist, isChecklistKind, normalizeChecklistItems, requiredChecklistKeys, validateChecklist } from "./shift-checklist";

import { isOwnerRole, isManagerRole, NOT_A_PERSON } from 'src/core/roles';
@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
    @InjectRepository(StoreShiftTemplate) private readonly templateRepository: Repository<StoreShiftTemplate>,
    @InjectRepository(StoreShift) private readonly shiftRepository: Repository<StoreShift>,
    @InjectRepository(StoreCashAccount) private readonly cashAccountRepository: Repository<StoreCashAccount>,
    @InjectRepository(AppUser) private readonly userRepository: Repository<AppUser>,
    @InjectRepository(UserStore) private readonly userStoreRepository: Repository<UserStore>,
    @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly platform: PlatformService,
    private readonly assistant: ChecklistAssistant,
  ) {}

  async findStores() {
    const stores: any[] = await this.storeRepository.createQueryBuilder("store")
      .leftJoinAndSelect("store.business", "business")
      .where("store.active = true")
      .andWhere("store.archive = false")
      .orderBy("store.id", "ASC")
      .getMany();
    const lic = await this.manager.query(`select store_id, license_type, valid_to::text as valid_to from store_license`);
    for (const s of stores) {
      const st = this.licenseStatus(lic.filter((l: any) => l.store_id === s.id));
      s.licensestatus = st.status;
      s.licensenextexpiry = st.nextexpiry;
    }
    return stores;
  }

  // ---------------------------------------------------------------- licences and ship-to
  private licenseStatus(rows: Array<{ license_type: string; valid_to: string | null }>): { status: string; nextexpiry: string | null } {
    if (!rows.length) return { status: "NONE", nextexpiry: null };
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const latest = new Map<string, string | null>();
    for (const r of rows) {
      const d = r.valid_to ? String(r.valid_to).slice(0, 10) : null;
      const cur = latest.get(r.license_type);
      if (!latest.has(r.license_type) || d === null || (cur !== null && cur !== undefined && d > cur)) latest.set(r.license_type, d);
    }
    let worst = "VALID";
    let next: string | null = null;
    for (const d of latest.values()) {
      if (d === null) continue;
      if (d < today) worst = "EXPIRED";
      else if (d <= soon && worst !== "EXPIRED") worst = "EXPIRING";
      if (next === null || d < next) next = d;
    }
    return { status: worst, nextexpiry: next };
  }

  private async ownStore(userid: number, id: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const store = await this.storeRepository.findOne({ where: { id }, relations: ["business"] });
    if (!store) throw new NotFoundException("Store not found.");
    if (store.business?.id !== caller.businessid) throw new ForbiddenException("You can only manage stores in your own business");
    return store;
  }

  async getLicenses(id: number, userid: number) {
    const store = await this.ownStore(userid, id);
    const licenses = await this.manager.query(
      `select id, license_type as licensetype, number, valid_from::text as validfrom, valid_to::text as validto, notes
         from store_license where store_id = $1 order by license_type, valid_to desc nulls first, id`, [id]);
    const st = this.licenseStatus(licenses.map((l: any) => ({ license_type: l.licensetype, valid_to: l.validto })));
    return { id, location: store.location, address: store.address, pincode: store.pincode, phone: store.phone, licenses, licensestatus: st.status, licensenextexpiry: st.nextexpiry };
  }

  /** Replaces the store's ship-to details and licences (the list sent is the whole list), checked and audited. */
  async saveLicenses(id: number, body: any, userid: number) {
    const store = await this.ownStore(userid, id);
    const TYPES = ["RETAIL_20_21", "WHOLESALE_20B_21B", "FSSAI", "OTHER"];
    const text = (v: any, max: number, label: string) => {
      const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
      if (t.length > max) throw new BadRequestException(`${label} can be at most ${max} characters.`);
      return t || null;
    };
    const fields: any = {};
    if (body.address !== undefined) fields.address = text(body.address, 200, "The address");
    if (body.phone !== undefined) {
      const p = text(body.phone, 20, "The phone");
      if (p && !/^[0-9+() -]{6,20}$/.test(p)) throw new BadRequestException("The phone number is not valid.");
      fields.phone = p;
    }
    if (body.pincode !== undefined) {
      const p = text(body.pincode, 10, "The pincode");
      if (p && !/^[0-9]{6}$/.test(p)) throw new BadRequestException("The pincode must be 6 digits.");
      fields.pincode = p;
    }
    let list: any[] | null = null;
    if (body.licenses !== undefined) {
      if (!Array.isArray(body.licenses)) throw new BadRequestException("licenses must be a list.");
      const seen = new Set<string>();
      list = body.licenses.map((l: any) => {
        if (!TYPES.includes(l?.licensetype)) throw new BadRequestException(`Licence type must be one of ${TYPES.join(", ")}.`);
        const number = text(l.number, 40, "The licence number");
        if (!number) throw new BadRequestException("Every licence needs a number.");
        const date = (v: any, label: string) => {
          if (v === undefined || v === null || v === "") return null;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(Date.parse(String(v)))) throw new BadRequestException(`${label} must be a date (YYYY-MM-DD).`);
          return String(v);
        };
        const validfrom = date(l.validfrom, "Valid-from");
        const validto = date(l.validto, "Valid-to");
        if (validfrom && validto && validto < validfrom) throw new BadRequestException(`Licence ${number}: valid-to is before valid-from.`);
        const key = `${l.licensetype}|${number.toUpperCase()}`;
        if (seen.has(key)) throw new BadRequestException(`The licence ${number} is listed twice.`);
        seen.add(key);
        return { licensetype: l.licensetype, number, validfrom, validto, notes: text(l.notes, 200, "Notes") };
      });
    }
    const before = await this.getLicenses(id, userid);
    await this.manager.transaction(async (tx) => {
      if (Object.keys(fields).length) await tx.getRepository(Store).update(id, fields);
      if (list) {
        await tx.query(`delete from store_license where store_id = $1`, [id]);
        for (const l of list) {
          await tx.query(
            `insert into store_license (store_id, license_type, number, valid_from, valid_to, notes, created_by) values ($1,$2,$3,$4,$5,$6,$7)`,
            [id, l.licensetype, l.number, l.validfrom, l.validto, l.notes, userid]);
        }
      }
    });
    const after = await this.getLicenses(id, userid);
    const brief = (r: any) => ({ address: r.address, pincode: r.pincode, phone: r.phone, licenses: r.licenses.map((l: any) => `${l.licensetype} ${l.number} ${l.validto || "open"}`) });
    await this.audit.record({
      userId: userid, action: "store.licenses_updated", entityType: "stores", entityId: id,
      summary: `${store.location}: ${after.licenses.length} licence(s), ${after.licensestatus}`,
      details: { before: brief(before), after: brief(after) },
    });
    return after;
  }

  // ---------------------------------------------------------------- store profile (how the till runs)
  async getProfile(storeid: number) {
    const profile = await loadStoreProfile(this.manager, storeid);
    if (!profile) throw new NotFoundException("Store not found.");
    return profile;
  }

  /** Business Head only. Changing the shift mode needs every shift of the store closed first; history is never touched. */
  async updateProfile(id: number, body: any, userid: number) {
    const store = await this.ownStore(userid, id);
    const values = parseProfileInput(body || {});
    if (!Object.keys(values).length) throw new BadRequestException("Nothing to change.");
    const before = await this.getProfile(id);
    if (values.shift_mode && values.shift_mode !== before.shiftmode) {
      const [open] = await this.manager.query(`select count(*)::int as n from store_shifts where store_id = $1 and status = 'OPEN'`, [id]);
      if (open.n > 0) throw new ConflictException(`${store.location.trim()} has ${open.n} open shift${open.n === 1 ? "" : "s"}. Close ${open.n === 1 ? "it" : "them"} before changing the shift mode.`);
    }
    await this.storeRepository.update(id, {
      ...(values.shift_mode !== undefined ? { shiftmode: values.shift_mode } : {}),
      ...(values.till !== undefined ? { till: values.till } : {}),
      ...(values.accountable_role !== undefined ? { accountablerole: values.accountable_role } : {}),
      ...(values.approval_mode !== undefined ? { approvalmode: values.approval_mode } : {}),
      ...(values.operator_required !== undefined ? { operatorrequired: values.operator_required } : {}),
      ...(values.cash_refund_limit !== undefined ? { cashrefundlimit: values.cash_refund_limit } : {}),
      ...(values.operator_hold_minutes !== undefined ? { operatorholdminutes: values.operator_hold_minutes } : {}),
    } as any);
    const after = await this.getProfile(id);
    await this.audit.record({
      userId: userid, action: "store.profile_updated", entityType: "stores", entityId: id,
      summary: `${store.location.trim()}: ${after.shiftmode}-based shifts, ${after.till} till, operator ${after.operatorrequired ? "asked" : "not asked"}`,
      details: { before, after },
    });
    return after;
  }

  private async isManager(userid: number | null | undefined) {
    if (!userid) return false;
    const [r] = await this.manager.query(`select r.name from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [userid]);
    return isManagerRole(r?.name);
  }

  /** The open shift this person works in (staff-based store) or the store's one shared shift (time-based). */
  async findOpenShiftFor(storeid: number, userid: number | null | undefined) {
    const profile = await loadStoreProfile(this.manager, storeid);
    const qb = this.shiftRepository.createQueryBuilder("shift")
      .leftJoinAndSelect("shift.template", "template")
      .leftJoinAndSelect("shift.assigneduser", "assigneduser")
      .where("shift.store_id = :storeid", { storeid })
      .andWhere("shift.status = 'OPEN'");
    if (profile?.shiftmode === "staff") qb.andWhere("shift.assigned_user_id = :userid", { userid: userid || 0 });
    return qb.orderBy("shift.shift_date", "DESC").addOrderBy("shift.id", "DESC").getOne();
  }

  async createStore(body: any, userid: any) {
    const businessid = body.businessid ? Number(body.businessid) : await this.getDefaultBusinessId();
    if (!businessid) {
      throw new Error("Business is required");
    }
    const payload = {
      location: body.location,
      storetype: parseStoreType(body.storetype) ?? "pharmacy",
      depositthreshold: body.depositthreshold === null || body.depositthreshold === undefined || body.depositthreshold === ""
        ? 0
        : Number(body.depositthreshold),
      ...this.depositFields(body),
      business: { id: businessid } as any,
      isActive: body.isActive !== false,
      isArchived: false,
    };
    const store = await this.storeRepository.save(payload);
    return this.storeRepository.findOne({
      where: { id: store.id },
      relations: ["business"],
    });
  }

  async updateStore(id: number, body: any) {
    const current = await this.storeRepository.findOne({ where: { id } });
    if (!current) {
      throw new Error("Store not found");
    }
    const type = parseStoreType(body.storetype);   // only when sent: the cash-policy screen saves a store without it
    const values = {
      location: body.location,
      ...(type ? { storetype: type } : {}),
      // the amount and the schedule change only when they are sent (the Store Master form no longer carries them)
      ...(body.depositthreshold === undefined ? {} : { depositthreshold: body.depositthreshold === null || body.depositthreshold === "" ? 0 : Number(body.depositthreshold) }),
      ...this.depositFields(body, current),
      isActive: body.isActive === undefined ? current.isActive : !!body.isActive,
      isArchived: body.isArchived === undefined ? current.isArchived : !!body.isArchived,
    };
    await this.storeRepository.update(id, values);
    return this.storeRepository.findOne({
      where: { id },
      relations: ["business"],
    });
  }

  /** the deposit schedule parts of a request, checked as a whole against what the store already has */
  private depositFields(body: any, current?: Store) {
    const given = parseDepositInput(body);
    if (!Object.keys(given).length) return {};
    const rule: DepositRule = {
      threshold: 0,
      schedule: (given.schedule ?? current?.depositschedule ?? "none") as any,
      weekdays: given.weekdays ?? current?.depositweekdays ?? [],
      monthdays: given.monthdays ?? current?.depositmonthdays ?? [],
    };
    checkDepositRule(rule);
    return {
      depositschedule: rule.schedule,
      // days that do not belong to the chosen schedule are not kept
      depositweekdays: rule.schedule === "weekly" ? rule.weekdays : [],
      depositmonthdays: rule.schedule === "monthly" ? rule.monthdays : [],
    };
  }

  private ruleOf(store: Store | null | undefined): DepositRule {
    return {
      threshold: Number(store?.depositthreshold || 0),
      schedule: (store?.depositschedule || "none") as any,
      weekdays: store?.depositweekdays || [],
      monthdays: store?.depositmonthdays || [],
    };
  }

  /**
   * Where each store stands on its bank deposit: balance, whether a deposit is due, why (the amount or a deposit day), since
   * when, and the next deposit day. This is what the in-app reminders and notifications read.
   */
  async getDepositStatuses(userid: number) {
    const user = await this.userRepository.findOne({ where: { id: userid }, relations: ["role"] });
    const assigned = await this.userStoreRepository.find({ where: { userid } as any });
    const stores = await this.storeRepository.createQueryBuilder("store")
      .where("store.active = true and store.archive = false")
      .andWhere("store.business_id = :b", { b: user?.businessid ?? -1 })
      .orderBy("store.id", "ASC").getMany();
    const mine = isOwnerRole(user?.role?.name) || !assigned.length ? stores : stores.filter((s) => assigned.some((a: any) => a.storeid === s.id));
    return this.depositStatusOf(mine);
  }

  /** the deposit position of every active store of a business (the alert engine's view; no person's scope applied) */
  async depositStatusesForBusiness(businessId: number) {
    const stores = await this.storeRepository.createQueryBuilder("store")
      .where("store.active = true and store.archive = false")
      .andWhere("store.business_id = :b", { b: businessId })
      .orderBy("store.id", "ASC").getMany();
    return this.depositStatusOf(stores);
  }

  private async depositStatusOf(mine: Store[]) {
    const rows = await this.manager.query(
      `select store_id, coalesce(sum(deposit), 0)::float - coalesce(sum(withdraw), 0)::float as balance,
              to_char(max(trans_date) filter (where category = 'BANK_DEPOSIT'), 'YYYY-MM-DD') as last_deposit
         from store_cash_accounts group by store_id`);
    const by = new Map<number, any>(rows.map((r: any) => [r.store_id, r]));
    const today = this.today();
    return mine.map((s) => {
      const r = by.get(s.id);
      const rule = this.ruleOf(s);
      const balance = Math.round((r?.balance ?? 0) * 100) / 100;
      return { storeid: s.id, location: String(s.location).trim(), balance, lastdeposit: r?.last_deposit ?? null, rule: { ...rule }, description: describeDepositRule(rule), ...evaluateDeposit(rule, balance, r?.last_deposit ?? null, today) };
    });
  }

  async removeStore(id: number, userid: any) {
    await this.storeRepository.update(id, {
      isActive: false,
      isArchived: true,
    });
    return { success: true };
  }

  /** WS-9: a shift/ledger action against a given store requires the caller to actually be
   * assigned to it - Business Head is the one role that oversees every store in the business
   * and bypasses this (Store Head does not: they're scoped to their own store(s), same as the
   * role that already gates *which* actions they can take). */
  private async assertUserAssignedToStore(userid: number | null | undefined, storeid: number | null | undefined) {
    if (!storeid) {
      return;
    }
    if (!userid) {
      throw new ForbiddenException("You are not assigned to this store.");
    }
    const caller = await this.userRepository.findOne({ where: { id: userid }, relations: ["role"] });
    if (isOwnerRole(caller?.role?.name)) {
      return;
    }
    const assignment = await this.userStoreRepository.findOne({ where: { userid, storeid } as any });
    if (!assignment) {
      throw new ForbiddenException("You are not assigned to this store.");
    }
  }

  private async getCallerForStoreManagement(userid: number) {
    const caller = await this.userRepository.findOne({ where: { id: userid }, relations: ["role"] });
    if (!caller) {
      throw new UnauthorizedException();
    }
    if (!isOwnerRole(caller.role?.name)) {
      throw new ForbiddenException("Only a Business Head can manage stores");
    }
    if (!caller.businessid) {
      throw new ForbiddenException("No business linked to your account");
    }
    return caller;
  }

  async createStoreScoped(body: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    await this.platform.assertRoom("stores");
    const payload = {
      location: body.location,
      storetype: parseStoreType(body.storetype) ?? "pharmacy",
      depositthreshold: body.depositthreshold === null || body.depositthreshold === undefined || body.depositthreshold === ""
        ? 0
        : Number(body.depositthreshold),
      ...this.depositFields(body),
      business: { id: caller.businessid } as any,
      isActive: body.isActive !== false,
      isArchived: false,
    };
    const store = await this.storeRepository.save(payload);
    return this.storeRepository.findOne({
      where: { id: store.id },
      relations: ["business"],
    });
  }

  async updateStoreScoped(id: number, body: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const current = await this.storeRepository.findOne({ where: { id }, relations: ["business"] });
    if (!current) {
      throw new Error("Store not found");
    }
    if (current.business?.id !== caller.businessid) {
      throw new ForbiddenException("You can only manage stores in your own business");
    }
    return this.updateStore(id, body);
  }

  async removeStoreScoped(id: number, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const current = await this.storeRepository.findOne({ where: { id }, relations: ["business"] });
    if (!current) {
      throw new Error("Store not found");
    }
    if (current.business?.id !== caller.businessid) {
      throw new ForbiddenException("You can only manage stores in your own business");
    }
    return this.removeStore(id, userid);
  }

  async findTemplates(query: any) {
    const storeid = await this.resolveStoreId(query.storeid);
    const qb = this.templateRepository.createQueryBuilder("template")
      .leftJoinAndSelect("template.store", "store")
      .leftJoinAndSelect("store.business", "business")
      .leftJoinAndSelect("template.assigneduser", "assigneduser");
    if (storeid) {
      qb.where("template.store_id = :storeid", { storeid });
    }
    qb.orderBy("template.active", "DESC")
      .addOrderBy("template.id", "DESC");
    const templates = await qb.getMany();
    // a default opener who has left, or who no longer works at the store, is marked rather than silently used
    return Promise.all(templates.map(async (t) => ({
      ...t,
      assigneestatus: !t.assigneduserid ? null : ((await this.canOpenFor(t.storeid, t.assigneduserid)) ? "ok" : "gone"),
    })));
  }

  /** a template's default opener (or a shift's): an active person who works at the store, an owner (who works at all of them), never the shared counter login */
  private async canOpenFor(storeid: number, userid: number | null | undefined): Promise<boolean> {
    if (!userid) return false;
    const [u] = await this.manager.query(
      `select u.id from app_user u join app_role r on r.id = u.role_id
        where u.id = $1 and u.active and not u.archive and r.name <> all($3::text[])
          and (r.name in ('Business Head', 'Owner-operator')
               or exists (select 1 from user_stores us where us.user_id = u.id and us.store_id = $2 and us.active and not us.archive))`,
      [userid, storeid, NOT_A_PERSON]);
    return !!u;
  }

  private async assertDefaultOpener(storeid: number, userid: number | null) {
    if (userid && !(await this.canOpenFor(storeid, userid))) {
      throw new BadRequestException("Choose someone who works at this store (not the shared counter login).");
    }
  }

  async saveTemplate(body: any, userid: any) {
    const storeid = Number(body.storeid || await this.resolveStoreId(body.storeid));
    if (!storeid) {
      throw new Error("Store is required");
    }
    const assigneduserid = body.assigneduserid ? Number(body.assigneduserid) : null;
    await this.assertDefaultOpener(storeid, assigneduserid);
    // the bank deposit rule belongs to the store, not to a shift template
    const payload = {
      storeid,
      name: body.name,
      starttime: body.starttime,
      endtime: body.endtime,
      active: body.active !== false,
      assigneduserid,
    };
    return this.templateRepository.save(payload);
  }

  async updateTemplate(id: number, body: any, userid: any) {
    const current = await this.templateRepository.findOne({ where: { id } });
    if (!current) throw new NotFoundException("Template not found.");
    const assigneduserid = body.assigneduserid ? Number(body.assigneduserid) : null;
    // an unchanged default that has since gone stays as it was (it is marked on the list); a new choice must be valid
    if (assigneduserid !== current.assigneduserid) await this.assertDefaultOpener(current.storeid, assigneduserid);
    const values = {
      name: body.name,
      starttime: body.starttime,
      endtime: body.endtime,
      active: body.active !== false,
      assigneduserid,
    };
    await this.templateRepository.update(id, values);
    return this.templateRepository.findOne({ where: { id } });
  }

  /**
   * Is the store already open? True when a shift is open in it, or one has been opened earlier today (a handover, a later shift, a second
   * person's drawer): the door, the terminals and yesterday's deposit are then somebody's done. The page picks the checklist from this.
   */
  async openingContext(query: any, userid?: number) {
    const storeid = await this.resolveStoreId(query.storeid);
    if (!storeid) return { storealreadyopen: false, reason: null, previous: null };
    const rows = await this.manager.query(
      `select s.id, s.name, s.status, s.close_type, u.full_name as assigned, tu.full_name as handover_to
         from store_shifts s
         left join app_user u on u.id = s.assigned_user_id
         left join app_user tu on tu.id = s.handover_to_user_id
        where s.store_id = $1 and s.archive = false and (s.status = 'OPEN' or s.shift_date = $2::date)
        order by (s.status = 'OPEN') desc, s.opened_on desc nulls last, s.id desc limit 5`, [storeid, this.today()]);
    const first = rows[0];
    if (!first) return { storealreadyopen: false, reason: null, previous: null };
    const reason = first.status === 'OPEN' ? 'OPEN_SHIFT' : first.close_type === 'HANDOVER' ? 'HANDOVER' : 'EARLIER_TODAY';
    return {
      storealreadyopen: true, reason,
      previous: { name: first.name, status: first.status, assigned: first.assigned || null, closetype: first.close_type || null, handoverto: first.handover_to || null },
    };
  }

  // ------------------------------------------------------------------ the checklists
  /** the lists in force for a store (its own, its business's, or the standard): what the page asks a person to tick */
  async checklistsFor(query: any) {
    const storeid = await this.resolveStoreId(query.storeid);
    const out: any = {};
    for (const kind of CHECKLIST_KINDS) {
      out[kind] = storeid ? await effectiveChecklist(this.manager, storeid, kind) : { items: DEFAULT_CHECKLISTS[kind], source: 'default' };
    }
    return out;
  }

  /** for the editor: each list at one scope (the business's, or one store's), with what it falls back to */
  async checklistConfig(query: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const storeScope = query.scope !== 'business';
    const store = storeScope ? await this.ownStore(userid, Number(query.storeid)) : null;
    const rows = await this.manager.query(
      `select store_id, kind, items from shift_checklist where business_id = $1 and (store_id is null or store_id = $2)`, [caller.businessid, store?.id ?? 0]);
    const lists: any = {};
    for (const kind of CHECKLIST_KINDS) {
      const own = rows.find((r: any) => r.kind === kind && (storeScope ? r.store_id !== null : r.store_id === null));
      const biz = rows.find((r: any) => r.kind === kind && r.store_id === null);
      lists[kind] = {
        own: !!own,
        items: own ? own.items : (storeScope && biz ? biz.items : DEFAULT_CHECKLISTS[kind]),
        inheritedfrom: storeScope && biz ? 'business' : 'default',
        standard: DEFAULT_CHECKLISTS[kind],
      };
    }
    return { scope: storeScope ? 'store' : 'business', storeid: store?.id ?? null, lists, assistant: { configured: this.assistant.configured, model: (await this.assistant.model()) || null } };
  }

  /** the items now on each list, for the scope being edited: the assistant avoids repeating them */
  private async currentChecklistLabels(query: any, userid: number) {
    const cfg = await this.checklistConfig(query, userid);
    const existing: any = {};
    for (const kind of CHECKLIST_KINDS) existing[kind] = (cfg.lists[kind].items || []).map((i: any) => i.label);
    return { existing, storeId: cfg.storeid as number | null };
  }

  /** what the last 30 days suggest for the checklists (worded by the assistant if it is on and ai is not 'false') */
  async checklistSuggestions(query: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const { existing, storeId } = await this.currentChecklistLabels(query, userid);
    return this.assistant.fromData({ businessId: Number(caller.businessid), storeId, existing, useAi: String(query.ai) !== 'false' });
  }

  /** checklist items for a situation the owner describes */
  async checklistDraft(body: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const { existing } = await this.currentChecklistLabels(body || {}, userid);
    return this.assistant.fromSituation({ businessId: Number(caller.businessid), existing, instruction: body?.instruction });
  }

  async saveChecklist(body: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    if (!isChecklistKind(body?.kind)) throw new BadRequestException('Choose which checklist this is.');
    const items = normalizeChecklistItems(body?.items);
    const storeId = body?.scope === 'business' ? null : (await this.ownStore(userid, Number(body?.storeid))).id;
    await this.manager.query(
      `insert into shift_checklist (business_id, store_id, kind, items, updated_by) values ($1, $2, $3, $4::jsonb, $5)
       on conflict (business_id, coalesce(store_id, 0), kind) do update set items = excluded.items, updated_on = now(), updated_by = excluded.updated_by`,
      [caller.businessid, storeId, body.kind, JSON.stringify(items), userid]);
    return { kind: body.kind, items };
  }

  /** take a store's list back to the business's (or the business's back to the standard one) */
  async resetChecklist(query: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    if (!isChecklistKind(query?.kind)) throw new BadRequestException('Choose which checklist this is.');
    const storeId = query?.scope === 'business' ? null : (await this.ownStore(userid, Number(query?.storeid))).id;
    await this.manager.query(`delete from shift_checklist where business_id = $1 and coalesce(store_id, 0) = coalesce($2::int, 0) and kind = $3`, [caller.businessid, storeId, query.kind]);
    return { kind: query.kind, reset: true };
  }

  async findShifts(query: any, userid?: number) {
    const storeid = await this.resolveStoreId(query.storeid);
    const qb = this.shiftRepository.createQueryBuilder("shift")
      .leftJoinAndSelect("shift.store", "store")
      .leftJoinAndSelect("store.business", "business")
      .leftJoinAndSelect("shift.template", "template")
      .leftJoinAndSelect("shift.assigneduser", "assigneduser")
      .leftJoinAndSelect("shift.openedby", "openedby")
      .leftJoinAndSelect("shift.closedby", "closedby");
    if (storeid) {
      qb.where("shift.store_id = :storeid", { storeid });
    }

    if (query.status) {
      qb.andWhere("shift.status = :status", { status: String(query.status).toUpperCase() });
    }
    if (query.fromdate && query.todate) {
      qb.andWhere("shift.shift_date >= CAST(:fromdate AS date) AND shift.shift_date <= CAST(:todate AS date)", {
        fromdate: query.fromdate,
        todate: query.todate,
      });
    }
    if (query.shiftid) {
      qb.andWhere("shift.id = :shiftid", { shiftid: Number(query.shiftid) });
    }
    // "mine" is a person's own drawer: what a staff-based store shows at the counter and in the header
    if (query.mine === "true" || query.mine === true) {
      qb.andWhere("shift.assigned_user_id = :mine", { mine: userid || 0 });
    }

    const shifts = await qb.orderBy("shift.shift_date", "DESC").addOrderBy("shift.id", "DESC").getMany();
    const items: any[] = [];
    for (const shift of shifts) {
      const stats = await this.getShiftStats(shift.id);
      items.push({ ...shift, ...stats });
    }
    return items;
  }

  async createShift(body: any, userid: any) {
    const storeid = Number(body.storeid || await this.resolveStoreId(body.storeid));
    if (!storeid) {
      throw new Error("Store is required");
    }
    await this.assertUserAssignedToStore(userid, storeid);
    const profile = await loadStoreProfile(this.manager, storeid);
    const staffBased = profile?.shiftmode === "staff";
    // Staff-based: the drawer belongs to the person opening it (a manager may open one for somebody else).
    let assigneduserid: number | null = body.assigneduserid ? Number(body.assigneduserid) : null;
    if (staffBased) {
      if (!assigneduserid || (assigneduserid !== userid && !(await this.isManager(userid)))) assigneduserid = userid || null;
      const mine = await this.shiftRepository.findOne({ where: { storeid, status: "OPEN", assigneduserid } as any });
      if (mine) throw new ConflictException("This person already has an open shift here. Close it before opening another.");
    } else {
      const existingOpen = await this.shiftRepository.findOne({ where: { storeid, status: "OPEN" } });
      if (existingOpen) {
        throw new ConflictException("This store already has an open shift. Close it before opening another.");
      }
    }
    const template = body.templateid ? await this.templateRepository.findOne({ where: { id: Number(body.templateid) } }) : null;

    // Opening float: prefer the denomination breakdown; fall back to a plain number. A silent
    // zero float used to be allowed - now it needs an explicit confirmation, same guard shape
    // as the empty-drawer-count check on close below.
    const openingDenoms = normalizeDenominations(body.openingdenominations);
    const openingcash = openingDenoms ? denominationTotal(openingDenoms) : Number(body.openingcash || 0);
    if (openingcash <= 0 && body.allowZero !== true) {
      throw new BadRequestException("Enter the opening float before opening the shift.");
    }
    // WS-7: only validated when the caller actually sends a checklist (the POS card always does).
    // the opening list depends on whether the store is already open; found before this shift exists
    const openingKind: ChecklistKind = (await this.openingContext({ storeid }, userid)).storealreadyopen ? 'OPENING_OPEN_STORE' : 'OPENING';
    if (body.openingchecklist !== undefined) {
      const checklistError = validateChecklist(await requiredChecklistKeys(this.manager, storeid, openingKind), body.openingchecklist);
      if (checklistError) {
        throw new BadRequestException(checklistError);
      }
    }

    const shift = await this.shiftRepository.save({
      storeid,
      templateid: template ? template.id : null,
      assigneduserid: staffBased ? assigneduserid : (assigneduserid || ((await this.canOpenFor(storeid, template?.assigneduserid)) ? template!.assigneduserid : null)),
      shiftdate: body.shiftdate || this.today(),
      name: body.name || template?.name || "Shift",
      starttime: body.starttime || template?.starttime || "09:00",
      endtime: body.endtime || template?.endtime || "18:00",
      status: "OPEN",
      openingcash,
      expectedcash: openingcash,
      openingdenominations: openingDenoms,
      openingchecklist: Array.isArray(body.openingchecklist) ? body.openingchecklist : null,
      counteddenominations: null,
      countedcash: null,
      variance: null,
      // the shift carries the store's amount (the deposit rule is the store's)
      depositthreshold: Number(body.depositthreshold ?? (await this.storeRepository.findOne({ where: { id: storeid } }))?.depositthreshold ?? 0),
      openedon: new Date(),
      closedon: null,
      notes: body.notes || null,
      openedby: userid ? { id: userid } as any : null,
    });

    if (Array.isArray(body.openingchecklist)) {
      await this.recordChecklist(shift.id, storeid, 'OPEN', openingKind, body.openingchecklist, body.openingchecklistat, userid, shift.assigneduserid ?? null);
    }
    await this.syncShiftTotals(shift.id);
    return this.shiftRepository.findOne({
      where: { id: shift.id },
      relations: ["store", "template", "assigneduser", "openedby", "closedby"],
    });
  }

  /**
   * What was ticked: the list in force at that moment (each item with its wording), which of its items were ticked and when, and who did it
   * (the person at the counter, and the login they were signed in as). Kept as it was, so a checklist changed later does not rewrite the past.
   */
  private async recordChecklist(shiftId: number, storeId: number, phase: 'OPEN' | 'CLOSE', kind: ChecklistKind, submitted: any, ticks: any, userid: number | null | undefined, operatorId: number | null) {
    const list = (await effectiveChecklist(this.manager, storeId, kind)).items;
    const now = new Date();
    const when = (v: any) => { const d = new Date(v); return isNaN(d.getTime()) || Math.abs(d.getTime() - now.getTime()) > 86400000 ? now : d; };
    const ticked: string[] = Array.isArray(submitted) ? submitted.map(String) : [];
    const items = list.map((i) => ticked.includes(i.key)
      ? { key: i.key, label: i.label, ticked: true, at: (ticks && typeof ticks === 'object' && ticks[i.key] ? when(ticks[i.key]) : now).toISOString() }
      : { key: i.key, label: i.label, ticked: false, at: null });
    await this.manager.query(
      `insert into shift_checklist_log (shift_id, phase, kind, items, done_by, operator_id, done_on) values ($1, $2, $3, $4::jsonb, $5, $6, now())
       on conflict (shift_id, phase) do update set kind = excluded.kind, items = excluded.items, done_by = excluded.done_by, operator_id = excluded.operator_id, done_on = now()`,
      [shiftId, phase, kind, JSON.stringify(items), userid ?? null, operatorId ?? null]);
  }

  /** the checklists of a shift as they were ticked, with who and when */
  async shiftChecklists(shiftId: number) {
    return this.manager.query(
      `select l.phase, l.kind, l.items, l.done_on as doneon, u.full_name as doneby, o.full_name as operator
         from shift_checklist_log l left join app_user u on u.id = l.done_by left join app_user o on o.id = l.operator_id
        where l.shift_id = $1 order by case l.phase when 'OPEN' then 0 else 1 end`, [shiftId]);
  }

  async assignShift(id: number, body: any, userid?: number) {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new Error("Shift not found");
    }
    await this.assertUserAssignedToStore(userid, shift.storeid);
    const assigneduserid = body.assigneduserid === null || body.assigneduserid === undefined || body.assigneduserid === ""
      ? null
      : Number(body.assigneduserid);
    await this.shiftRepository.update(id, { assigneduserid });
    return this.shiftRepository.findOne({
      where: { id },
      relations: ["store", "template", "assigneduser", "openedby", "closedby"],
    });
  }

  async closeShift(id: number, body: any, userid: any) {
    const shift = await this.shiftRepository.findOne({ where: { id } });
    if (!shift) {
      throw new Error("Shift not found");
    }
    await this.assertUserAssignedToStore(userid, shift.storeid);
    if (shift.status === "CLOSED") {
      throw new BadRequestException("This shift is already closed.");
    }

    // Drawer count: prefer the denomination breakdown; fall back to a plain
    // number; reject an empty count unless the caller explicitly allows zero.
    const countedDenoms = normalizeDenominations(body.counteddenominations);
    let countedcash: number;
    if (countedDenoms) {
      countedcash = denominationTotal(countedDenoms);
    } else if (body.countedcash !== null && body.countedcash !== undefined && body.countedcash !== "" && Number(body.countedcash) > 0) {
      countedcash = Number(body.countedcash);
    } else if (body.allowZero === true) {
      countedcash = 0;
    } else {
      throw new BadRequestException("Enter the drawer count before closing the shift.");
    }
    const profile = await loadStoreProfile(this.manager, shift.storeid);
    const staffBased = profile?.shiftmode === 'staff';
    if (staffBased && shift.assigneduserid && shift.assigneduserid !== userid && !(await this.isManager(userid))) {
      throw new ForbiddenException('Each person closes their own shift.');
    }
    if (staffBased && body.closetype === 'HANDOVER') {
      throw new BadRequestException('A handover is for a shared till. In a staff-based store each person closes their own shift.');
    }
    const closeType = body.closetype === 'HANDOVER' ? 'HANDOVER' : 'END_OF_DAY';
    // WS-7: only validated when the caller actually sends a checklist (the shift page always does).
    if (body.closingchecklist !== undefined) {
      const checklistError = validateChecklist(await requiredChecklistKeys(this.manager, shift.storeid, closeType === 'HANDOVER' ? 'HANDOVER' : 'CLOSING'), body.closingchecklist);
      if (checklistError) {
        throw new BadRequestException(checklistError);
      }
    }

    // Staff-based: the drawer's owner closed it. Time-based: whoever the counter says was serving.
    const closedOperatorId = staffBased ? (shift.assigneduserid || userid || null)
      : (body.closedoperatorid ? Number(body.closedoperatorid)
        : (body.operatorid ? Number(body.operatorid) : (shift.assigneduserid || null)));
    const accountableUserId = await findAccountableUser(this.manager, shift.storeid, profile?.accountablerole || 'auto');

    // A handover names who takes the drawer; they must work at this store and be someone other than the person handing over.
    let handoverTo: number | null = null;
    if (closeType === 'HANDOVER') {
      handoverTo = Number(body.handovertoid) || null;
      if (!handoverTo) throw new BadRequestException('Choose the staff member taking over the shift.');
      if (handoverTo === closedOperatorId || handoverTo === userid) throw new BadRequestException('Hand the shift over to someone else.');
      const [taker] = await this.manager.query(
        `select u.id from app_user u join app_role r on r.id = u.role_id
          where u.id = $1 and u.active and not u.archive and r.name not in ('Site Admin', 'Counter')
            and (r.name in ('Business Head', 'Owner-operator') or exists (select 1 from user_stores us where us.user_id = u.id and us.store_id = $2 and us.active and not us.archive))`, [handoverTo, shift.storeid]);
      if (!taker) throw new BadRequestException('That staff member does not work at this store.');
    }

    // Digital takings: what the system recorded per provider against what the terminal shows.
    let closingDigital: any[] | null = null;
    if (body.closingdigital !== undefined) {
      const system = await this.manager.query(
        `select coalesce(nullif(btrim(digi_provider), ''), 'OTHER') as provider, coalesce(sum(digi_amount), 0)::float as amount
           from sale where shift_id = $1 and status = 'COMPLETE' and active = true and coalesce(digi_amount, 0) > 0 group by 1`, [id]);
      const given = new Map<string, number>();
      for (const g of Array.isArray(body.closingdigital) ? body.closingdigital : []) {
        const n = Number(g?.counted);
        if (!g?.provider || !Number.isFinite(n) || n < 0) throw new BadRequestException('Digital totals must be zero or more.');
        given.set(String(g.provider), Math.round(n * 100) / 100);
      }
      for (const s of system) {
        if (!given.has(s.provider)) throw new BadRequestException(`Enter the ${s.provider} total from the terminal.`);
      }
      const providers = Array.from(new Set([...system.map((s: any) => s.provider), ...given.keys()]));
      closingDigital = providers.map(p => {
        const sys = Math.round((system.find((s: any) => s.provider === p)?.amount || 0) * 100) / 100;
        const counted = given.get(p) ?? 0;
        return { provider: p, system: sys, counted, variance: Math.round((counted - sys) * 100) / 100 };
      });
    }

    await this.shiftRepository.update(id, {
      status: "CLOSED",
      countedcash,
      counteddenominations: countedDenoms,
      closingchecklist: Array.isArray(body.closingchecklist) ? body.closingchecklist : null,
      closetype: closeType,
      handovertouserid: handoverTo,
      closingdigital: closingDigital,
      closedoperatorid: closedOperatorId,
      accountableuserid: accountableUserId,
      closedon: new Date(),
      closedby: userid ? { id: userid } as any : null,
      notes: body.notes || shift.notes,
    } as any);
    await this.syncShiftTotals(id);

    // On a handover the counted drawer is the incoming person's float and their shift opens straight away.
    let nextShiftId: number | null = null;
    if (closeType === 'HANDOVER') {
      const next = await this.shiftRepository.save({
        storeid: shift.storeid,
        templateid: shift.templateid,
        assigneduserid: handoverTo,
        shiftdate: this.today(),
        name: shift.name,
        starttime: shift.starttime,
        endtime: shift.endtime,
        status: "OPEN",
        openingcash: countedcash,
        expectedcash: countedcash,
        openingdenominations: countedDenoms,
        openingchecklist: null,
        depositthreshold: shift.depositthreshold,
        openedon: new Date(),
        handoverfromshiftid: id,
        openedby: userid ? { id: userid } as any : null,
      } as any);
      nextShiftId = (next as any).id;
      await this.syncShiftTotals(nextShiftId as number);
    }
    if (Array.isArray(body.closingchecklist)) {
      await this.recordChecklist(id, shift.storeid, 'CLOSE', closeType === 'HANDOVER' ? 'HANDOVER' : 'CLOSING', body.closingchecklist, body.closingchecklistat, userid, closedOperatorId);
    }
    const closed = await this.shiftRepository.findOne({
      where: { id },
      relations: ["store", "template", "openedby", "closedby"],
    });
    return { ...(closed as any), nextshiftid: nextShiftId };
  }

  /** What the person closing sees: takings by tender, the digital totals to match, and the cash drawer's expenses. */
  async getShiftSummary(shiftId: number) {
    const shift = await this.shiftRepository.findOne({ where: { id: shiftId }, relations: ['store', 'assigneduser'] });
    if (!shift) throw new NotFoundException('Shift not found.');
    const stats = await this.getShiftStats(shiftId);
    const [t] = await this.manager.query(
      `select count(*)::int as bills, coalesce(sum(cash_amount), 0)::float as cash, coalesce(sum(digi_amount), 0)::float as digital,
              coalesce(sum(credit_amount), 0)::float as store_credit, coalesce(sum(staff_credit_amount), 0)::float as staff_credit, coalesce(sum(total), 0)::float as total
         from sale where shift_id = $1 and status = 'COMPLETE' and active = true`, [shiftId]);
    const digital = await this.manager.query(
      `select coalesce(nullif(btrim(digi_provider), ''), 'OTHER') as provider, count(*)::int as bills, coalesce(sum(digi_amount), 0)::float as amount
         from sale where shift_id = $1 and status = 'COMPLETE' and active = true and coalesce(digi_amount, 0) > 0 group by 1 order by 1`, [shiftId]);
    const expenses = await this.manager.query(
      `select id, trans_date, description, expense_category, withdraw::float as amount, (coalesce(trim(receipt_path), '') <> '') as has_receipt
         from store_cash_accounts where shift_id = $1 and category = 'EXPENSE' order by id`, [shiftId]);
    const [out] = await this.manager.query(
      `select coalesce(sum(withdraw) filter (where category = 'REFUND'), 0)::float as refunds, coalesce(sum(withdraw) filter (where category = 'BANK_DEPOSIT'), 0)::float as deposits
         from store_cash_accounts where shift_id = $1`, [shiftId]);
    const profile = await loadStoreProfile(this.manager, shift.storeid);
    const accountableId = shift.accountableuserid || await findAccountableUser(this.manager, shift.storeid, profile?.accountablerole || 'auto');
    const [accountable] = accountableId ? await this.manager.query(`select full_name from app_user where id = $1`, [accountableId]) : [];
    return {
      profile, accountableuserid: accountableId, accountable: accountable?.full_name || null,
      shift: { id: shift.id, name: shift.name, status: shift.status, storeid: shift.storeid, store: (shift as any).store?.location, assigneduserid: shift.assigneduserid,
               assigned: (shift as any).assigneduser?.fullname || null, openingcash: Number(shift.openingcash), expectedcash: stats.expectedcash, openedon: shift.openedon },
      bills: t.bills, total: t.total, cash: t.cash, digital: t.digital, storeCredit: t.store_credit, staffCredit: t.staff_credit,
      digitalByProvider: digital, expenses, expensesTotal: expenses.reduce((s: number, e: any) => s + e.amount, 0),
      refunds: out.refunds, deposits: out.deposits, expected: stats.expectedcash,
      checklists: await this.shiftChecklists(shiftId),
    };
  }

  async findLedger(query: any) {
    const storeid = await this.resolveStoreId(query.storeid);
    const qb = this.cashAccountRepository.createQueryBuilder("ledger")
      .leftJoinAndSelect("ledger.store", "store")
      .leftJoinAndSelect("store.business", "business")
      .leftJoinAndSelect("ledger.shift", "shift");
    if (storeid) {
      qb.where("ledger.store_id = :storeid", { storeid });
    }

    if (query.shiftid) {
      qb.andWhere("ledger.shift_id = :shiftid", { shiftid: Number(query.shiftid) });
    }
    if (query.category) {
      qb.andWhere("ledger.category = :category", { category: query.category });
    }
    if (query.fromdate && query.todate) {
      qb.andWhere("ledger.trans_date >= CAST(:fromdate AS date) AND ledger.trans_date <= CAST(:todate AS date)", {
        fromdate: query.fromdate,
        todate: query.todate,
      });
    }
    return qb.orderBy("ledger.trans_date", "DESC").addOrderBy("ledger.id", "DESC").getMany();
  }

  async saveLedger(body: any, userid: any) {
    const storeid = Number(body.storeid || await this.resolveStoreId(body.storeid));
    if (!storeid) {
      throw new Error("Store is required");
    }
    await this.assertUserAssignedToStore(userid, storeid);
    let shiftid = body.shiftid ? Number(body.shiftid) : null;
    const category = body.category || "ADJUSTMENT";
    let deposit = Number(body.deposit || 0);
    let withdraw = Number(body.withdraw || 0);
    if (category === "BANK_DEPOSIT" && withdraw === 0 && deposit > 0) {
      withdraw = deposit;
      deposit = 0;
    }
    if (category === "BANK_DEPOSIT") {
      shiftid = null;
    } else if (!shiftid && storeid) {
      // time-based: the store's one OPEN shift; staff-based: the caller's own drawer
      const openShift = await this.findOpenShiftFor(storeid, userid);
      shiftid = openShift ? openShift.id : null;
    }

    const record = await this.cashAccountRepository.save({
      transdate: body.transdate || this.today(),
      category,
      description: body.description || "",
      deposit,
      withdraw,
      referenceno: category === "BANK_DEPOSIT" ? (body.referenceno || null) : null,
      expensecategory: category === "EXPENSE" ? (body.expensecategory || null) : null,
      receiptpath: category === "EXPENSE" ? (body.receiptpath || null) : null,
      store: { id: storeid } as any,
      shift: shiftid ? ({ id: shiftid } as any) : null,
    });

    if (shiftid) {
      await this.syncShiftTotals(shiftid);
    }
    return this.cashAccountRepository.findOne({
      where: { id: record.id },
      relations: ["store", "shift"],
    });
  }

  /** WS-2: expense-by-category rollup for the Cash screen. Defaults to the current calendar month. */
  async getExpenseSummary(query: any) {
    const storeid = await this.resolveStoreId(query.storeid);
    const now = new Date();
    const fromdate = query.fromdate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const todate = query.todate || this.today();
    const qb = this.cashAccountRepository.createQueryBuilder("ledger")
      .select("coalesce(ledger.expensecategory, 'MISC')", "category")
      .addSelect("coalesce(sum(ledger.withdraw), 0)", "total")
      .where("ledger.category = 'EXPENSE'")
      .andWhere("ledger.trans_date >= CAST(:fromdate AS date) AND ledger.trans_date <= CAST(:todate AS date)", { fromdate, todate });
    if (storeid) {
      qb.andWhere("ledger.store_id = :storeid", { storeid });
    }
    const rows = await qb.groupBy("coalesce(ledger.expensecategory, 'MISC')").orderBy("total", "DESC").getRawMany();
    return rows.map((row: any) => ({ category: row.category, total: Number(row.total || 0) }));
  }

  async getDashboard(query: any, userid?: any) {
    const storeid = await this.resolveStoreId(query.storeid);
    const store = storeid ? await this.storeRepository.createQueryBuilder("store")
      .leftJoinAndSelect("store.business", "business")
      .where("store.id = :storeid", { storeid })
      .getOne() : null;
    // time-based: the store's one OPEN shift; staff-based: the caller's own
    const openShift = storeid ? await this.findOpenShiftFor(storeid, userid) : await this.shiftRepository.createQueryBuilder("shift")
      .leftJoinAndSelect("shift.template", "template")
      .leftJoinAndSelect("shift.assigneduser", "assigneduser")
      .where("shift.status = 'OPEN'")
      .orderBy("shift.shift_date", "DESC")
      .addOrderBy("shift.id", "DESC")
      .getOne();

    const shifts = await this.findShifts({ storeid, fromdate: query.fromdate, todate: query.todate });
    const ledger = await this.findLedger({ storeid, fromdate: query.fromdate, todate: query.todate });
    const balanceQb = this.cashAccountRepository.createQueryBuilder("ledger")
      .select("COALESCE(SUM(ledger.deposit), 0)", "deposit")
      .addSelect("COALESCE(SUM(ledger.withdraw), 0)", "withdraw");
    if (storeid) {
      balanceQb.where("ledger.store_id = :storeid", { storeid });
    }
    const balanceRaw = await balanceQb.getRawOne();
    const cashbalance = Number(balanceRaw?.deposit || 0) - Number(balanceRaw?.withdraw || 0);
    const depositthreshold = Number(store?.depositthreshold || 0);
    const lastDepositQb = this.cashAccountRepository.createQueryBuilder("ledger")
      .where("ledger.category = 'BANK_DEPOSIT'")
      .orderBy("ledger.trans_date", "DESC")
      .addOrderBy("ledger.id", "DESC");
    if (storeid) {
      lastDepositQb.andWhere("ledger.store_id = :storeid", { storeid });
    }
    const lastDeposit = await lastDepositQb.getOne();
    // due by the amount or by a deposit day, whichever came first
    const rule = this.ruleOf(store);
    const deposit = storeid ? evaluateDeposit(rule, cashbalance, lastDeposit ? (typeof lastDeposit.transdate === "string" ? lastDeposit.transdate : new Date(lastDeposit.transdate as any).toISOString()).slice(0, 10) : null, this.today()) : null;
    const depositdue = !!deposit?.due;
    const depositexcess = deposit?.excess ?? 0;
    return {
      storeid,
      store,
      profile: storeid ? await loadStoreProfile(this.manager, storeid) : null,
      openShift,
      shifts,
      ledger,
      templates: await this.findTemplates({ storeid }),
      cashbalance,
      depositthreshold,
      depositdue,
      depositexcess,
      deposit: deposit ? { ...deposit, rule, description: describeDepositRule(rule) } : null,
      lastDeposit,
    };
  }

  async getStoreContext(userid: number) {
    const user = await this.userRepository.createQueryBuilder("u")
      .leftJoinAndSelect("u.role", "role")
      .where("u.id = :id", { id: userid })
      .getOne();
    const storesQb = this.storeRepository.createQueryBuilder("store")
      .leftJoinAndSelect("store.business", "business")
      .leftJoin("store.userassignments", "assignment", "assignment.userid = :userid", { userid })
      .leftJoinAndSelect("store.userassignments", "allassignment")
      .leftJoinAndSelect("allassignment.user", "assigneduser")
      .where("store.active = true")
      .andWhere("store.archive = false");
    if (user?.businessid) {
      storesQb.andWhere("store.business_id = :businessid", { businessid: user.businessid });
    }
    const stores = await storesQb
      .distinct(true)
      .orderBy("store.id", "ASC")
      .getMany();
    const assignments = await this.userStoreRepository.createQueryBuilder("assignment")
      .leftJoinAndSelect("assignment.store", "store")
      .where("assignment.userid = :userid", { userid })
      .andWhere("store.active = true")
      .andWhere("store.archive = false")
      .orderBy("assignment.isprimary", "DESC")
      .addOrderBy("assignment.id", "ASC")
      .getMany();
    // a business with one store has nothing to switch between, however its people are assigned
    const [count] = user?.businessid
      ? await this.manager.query(`select count(*)::int as n from stores where business_id = $1 and active and not archive`, [user.businessid])
      : [{ n: stores.length }];
    const totalstores = count?.n ?? stores.length;
    if (assignments.length) {
      const selected = assignments.find((row) => row.isprimary) || assignments[0];
      return {
        totalstores,
        stores: assignments.map((row) => row.store),
        selectedstoreid: selected?.storeid || null,
        allstores: false,
        user,
      };
    }
    return {
      totalstores,
      stores,
      selectedstoreid: null,
      allstores: true,
      user,
    };
  }

  private async resolveStoreId(storeid: any) {
    if (storeid === null || storeid === undefined || storeid === "") {
      return null;
    }
    if (storeid) {
      return Number(storeid);
    }
    return null;
  }

  async getShiftReport(shiftId: number) {
    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId },
      relations: ['store', 'store.business', 'template', 'assigneduser', 'openedby', 'closedby'],
    });
    if (!shift) throw new Error('Shift not found');

    const stats = await this.getShiftStats(shiftId);

    const [salesRow] = await this.manager.query(`
      SELECT
        COUNT(s.id)::int AS bill_count,
        COALESCE(SUM(s.cash_amount), 0) AS cash_sales,
        COALESCE(SUM(s.digi_amount), 0) AS digi_sales,
        COALESCE(SUM(s.total), 0) AS net_sales
      FROM sale s
      WHERE s.shift_id = $1 AND s.status = 'COMPLETE' AND s.active = true
    `, [shiftId]);

    const [returnsRow] = await this.manager.query(`
      SELECT
        COUNT(DISTINCT sri.id)::int AS return_count,
        COALESCE(SUM(sri.qty * si.price), 0) AS return_value
      FROM sale_return_item sri
      JOIN sale_item si ON si.id = sri.sale_item_id
      JOIN sale s ON s.id = si.sale_id
      WHERE s.shift_id = $1 AND s.active = true
    `, [shiftId]);

    const staffBreakdown = await this.manager.query(`
      SELECT
        au.id AS staff_id,
        au.full_name AS staff_name,
        COUNT(s.id)::int AS bill_count,
        COALESCE(SUM(s.cash_amount), 0) AS cash_sales,
        COALESCE(SUM(s.digi_amount), 0) AS digi_sales,
        COALESCE(SUM(s.total), 0) AS net_sales
      FROM sale s
      LEFT JOIN app_user au ON au.id = s.acting_user_id
      WHERE s.shift_id = $1 AND s.status = 'COMPLETE' AND s.active = true
      GROUP BY au.id, au.full_name
      ORDER BY net_sales DESC
    `, [shiftId]);

    const ledger = await this.cashAccountRepository.find({
      where: { shiftid: shiftId },
      order: { transdate: 'ASC', id: 'ASC' },
    });

    const [owner] = shift.accountableuserid ? await this.manager.query(`select full_name from app_user where id = $1`, [shift.accountableuserid]) : [];
    return {
      shift: { ...shift, ...stats },
      accountable: owner?.full_name || null,
      sales: salesRow,
      returns: returnsRow,
      staff: staffBreakdown,
      ledger,
      checklists: await this.shiftChecklists(shiftId),
    };
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private async getShiftStats(shiftid: number) {
    const raw = await this.cashAccountRepository.createQueryBuilder("ledger")
      .select("COALESCE(SUM(ledger.deposit), 0)", "deposit")
      .addSelect("COALESCE(SUM(ledger.withdraw), 0)", "withdraw")
      .addSelect("COALESCE(SUM(CASE WHEN ledger.category = 'SALE' THEN ledger.deposit ELSE 0 END), 0)", "salescash")
      .addSelect("COALESCE(SUM(CASE WHEN ledger.category IN ('EXPENSE', 'REFUND', 'BANK_DEPOSIT') THEN ledger.withdraw ELSE 0 END), 0)", "outcash")
      .where("ledger.shift_id = :shiftid", { shiftid })
      .getRawOne();

    const deposit = Number(raw?.deposit || 0);
    const withdraw = Number(raw?.withdraw || 0);
    const salescash = Number(raw?.salescash || 0);
    const outcash = Number(raw?.outcash || 0);
    const shift = await this.shiftRepository.findOne({ where: { id: shiftid } });
    const expectedcash = Number(shift?.openingcash || 0) + deposit - withdraw;
    const variance = shift?.countedcash === null || shift?.countedcash === undefined ? null : Number(shift.countedcash) - expectedcash;
    return { deposit, withdraw, salescash, outcash, expectedcash, variance };
  }

  private async syncShiftTotals(shiftid: number) {
    const stats = await this.getShiftStats(shiftid);
    await this.shiftRepository.update(shiftid, {
      expectedcash: stats.expectedcash,
      variance: stats.variance,
    });
  }

  async findUsers(query: any) {
    const storeid = query?.storeid ? Number(query.storeid) : null;
    const qb = this.userRepository.createQueryBuilder("u")
      .leftJoinAndSelect("u.role", "role")
      .innerJoin("u.storeassignments", "assignment")
      .innerJoin("assignment.store", "store")
      .where("u.isActive = true and u.isArchived = false and role.isLocked = false")
      .andWhere("role.name NOT IN (:...notpeople)", { notpeople: NOT_A_PERSON });   // a shared counter login is not somebody who serves
    if (storeid) {
      qb.andWhere("store.id = :storeid", { storeid });
    }
    return qb
      .select(['u.id as id', 'u.fullname as fullname', 'u.email as email', 'role.name as role'])
      .distinct(true)
      .orderBy("u.fullname", "ASC")
      .getRawMany();
  }

  async findBusinesses() {
    return this.businessRepository.createQueryBuilder("business")
      .where("business.isActive = true")
      .andWhere("business.isArchived = false")
      .orderBy("business.name", "ASC")
      .getMany();
  }

  private async getDefaultBusinessId() {
    const business = await this.businessRepository.createQueryBuilder("business")
      .where("business.isActive = true")
      .andWhere("business.isArchived = false")
      .orderBy("business.id", "ASC")
      .getOne();
    return business?.id || null;
  }
}

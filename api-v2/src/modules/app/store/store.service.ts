import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Store } from "src/entities/store.entity";
import { StoreCashAccount } from "src/entities/store-cash-account.entity";
import { StoreShift } from "src/entities/store-shift.entity";
import { StoreShiftTemplate } from "src/entities/store-shift-template.entity";
import { AppUser } from "src/entities/appuser.entity";
import { UserStore } from "src/entities/user-store.entity";
import { Business } from "src/entities/business.entity";
import { denominationTotal, normalizeDenominations } from "./denominations";
import { CLOSING_CHECKLIST_KEYS, OPENING_CHECKLIST_KEYS, validateChecklist } from "./shift-checklist";

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
  ) {}

  async findStores() {
    return this.storeRepository.createQueryBuilder("store")
      .leftJoinAndSelect("store.business", "business")
      .where("store.active = true")
      .andWhere("store.archive = false")
      .orderBy("store.id", "ASC")
      .getMany();
  }

  async createStore(body: any, userid: any) {
    const businessid = body.businessid ? Number(body.businessid) : await this.getDefaultBusinessId();
    if (!businessid) {
      throw new Error("Business is required");
    }
    const payload = {
      location: body.location,
      depositthreshold: body.depositthreshold === null || body.depositthreshold === undefined || body.depositthreshold === ""
        ? 0
        : Number(body.depositthreshold),
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
    const values = {
      location: body.location,
      depositthreshold: body.depositthreshold === null || body.depositthreshold === undefined || body.depositthreshold === ""
        ? 0
        : Number(body.depositthreshold),
      isActive: body.isActive === undefined ? current.isActive : !!body.isActive,
      isArchived: body.isArchived === undefined ? current.isArchived : !!body.isArchived,
    };
    await this.storeRepository.update(id, values);
    return this.storeRepository.findOne({
      where: { id },
      relations: ["business"],
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
    if (caller?.role?.name === "Business Head") {
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
    if (caller.role?.name !== "Business Head") {
      throw new ForbiddenException("Only a Business Head can manage stores");
    }
    if (!caller.businessid) {
      throw new ForbiddenException("No business linked to your account");
    }
    return caller;
  }

  async createStoreScoped(body: any, userid: number) {
    const caller = await this.getCallerForStoreManagement(userid);
    const payload = {
      location: body.location,
      depositthreshold: body.depositthreshold === null || body.depositthreshold === undefined || body.depositthreshold === ""
        ? 0
        : Number(body.depositthreshold),
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
    return qb.getMany();
  }

  async saveTemplate(body: any, userid: any) {
    const storeid = Number(body.storeid || await this.resolveStoreId(body.storeid));
    if (!storeid) {
      throw new Error("Store is required");
    }
    const payload = {
      storeid,
      name: body.name,
      starttime: body.starttime,
      endtime: body.endtime,
      depositthreshold: Number(body.depositthreshold || 0),
      active: body.active !== false,
      assigneduserid: body.assigneduserid ? Number(body.assigneduserid) : null,
    };
    return this.templateRepository.save(payload);
  }

  async updateTemplate(id: number, body: any, userid: any) {
    const values = {
      name: body.name,
      starttime: body.starttime,
      endtime: body.endtime,
      depositthreshold: Number(body.depositthreshold || 0),
      active: body.active !== false,
      assigneduserid: body.assigneduserid ? Number(body.assigneduserid) : null,
    };
    await this.templateRepository.update(id, values);
    return this.templateRepository.findOne({ where: { id } });
  }

  async findShifts(query: any) {
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
    const existingOpen = await this.shiftRepository.findOne({ where: { storeid, status: "OPEN" } });
    if (existingOpen) {
      throw new ConflictException("This store already has an open shift. Close it before opening another.");
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
    if (body.openingchecklist !== undefined) {
      const checklistError = validateChecklist(OPENING_CHECKLIST_KEYS, body.openingchecklist);
      if (checklistError) {
        throw new BadRequestException(checklistError);
      }
    }

    const shift = await this.shiftRepository.save({
      storeid,
      templateid: template ? template.id : null,
      assigneduserid: body.assigneduserid ? Number(body.assigneduserid) : (template?.assigneduserid || null),
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
      depositthreshold: Number(body.depositthreshold || template?.depositthreshold || 0),
      openedon: new Date(),
      closedon: null,
      notes: body.notes || null,
      openedby: userid ? { id: userid } as any : null,
    });

    await this.syncShiftTotals(shift.id);
    return this.shiftRepository.findOne({
      where: { id: shift.id },
      relations: ["store", "template", "assigneduser", "openedby", "closedby"],
    });
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
    // WS-7: only validated when the caller actually sends a checklist (the POS card always does).
    if (body.closingchecklist !== undefined) {
      const checklistError = validateChecklist(CLOSING_CHECKLIST_KEYS, body.closingchecklist);
      if (checklistError) {
        throw new BadRequestException(checklistError);
      }
    }

    const closedOperatorId = body.closedoperatorid ? Number(body.closedoperatorid)
      : (body.operatorid ? Number(body.operatorid) : (shift.assigneduserid || null));

    await this.shiftRepository.update(id, {
      status: "CLOSED",
      countedcash,
      counteddenominations: countedDenoms,
      closingchecklist: Array.isArray(body.closingchecklist) ? body.closingchecklist : null,
      closedoperatorid: closedOperatorId,
      closedon: new Date(),
      closedby: userid ? { id: userid } as any : null,
      notes: body.notes || shift.notes,
    } as any);
    await this.syncShiftTotals(id);
    return this.shiftRepository.findOne({
      where: { id },
      relations: ["store", "template", "openedby", "closedby"],
    });
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
      // one OPEN shift per store — attach the entry to it regardless of assignee
      const openShift = await this.shiftRepository.createQueryBuilder("shift")
        .where("shift.store_id = :storeid", { storeid })
        .andWhere("shift.status = 'OPEN'")
        .orderBy("shift.shift_date", "DESC")
        .addOrderBy("shift.id", "DESC")
        .getOne();
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
    // one OPEN shift per store — return it regardless of who is assigned
    const openShiftQb = this.shiftRepository.createQueryBuilder("shift")
      .leftJoinAndSelect("shift.template", "template")
      .leftJoinAndSelect("shift.assigneduser", "assigneduser")
      .where("shift.status = 'OPEN'")
      .orderBy("shift.shift_date", "DESC")
      .addOrderBy("shift.id", "DESC");
    if (storeid) {
      openShiftQb.andWhere("shift.store_id = :storeid", { storeid });
    }
    const openShift = await openShiftQb.getOne();

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
    const depositdue = depositthreshold > 0 ? cashbalance >= depositthreshold : false;
    const depositexcess = depositdue ? cashbalance - depositthreshold : 0;
    const lastDepositQb = this.cashAccountRepository.createQueryBuilder("ledger")
      .where("ledger.category = 'BANK_DEPOSIT'")
      .orderBy("ledger.trans_date", "DESC")
      .addOrderBy("ledger.id", "DESC");
    if (storeid) {
      lastDepositQb.andWhere("ledger.store_id = :storeid", { storeid });
    }
    const lastDeposit = await lastDepositQb.getOne();
    return {
      storeid,
      store,
      openShift,
      shifts,
      ledger,
      templates: await this.findTemplates({ storeid }),
      cashbalance,
      depositthreshold,
      depositdue,
      depositexcess,
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
    if (assignments.length) {
      const selected = assignments.find((row) => row.isprimary) || assignments[0];
      return {
        stores: assignments.map((row) => row.store),
        selectedstoreid: selected?.storeid || null,
        allstores: false,
        user,
      };
    }
    return {
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

    return {
      shift: { ...shift, ...stats },
      sales: salesRow,
      returns: returnsRow,
      staff: staffBreakdown,
      ledger,
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
      .where("u.isActive = true and u.isArchived = false and role.isLocked = false");
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

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { Denoms, firstShortfall, holdingsToDenoms, holdingsTotal, readRequest, reservedByPending, vaultHoldings } from './vault-math';

type Caller = { id: number; role: string | null; businessid: number | null };

const money = (n: number) => `Rs ${Number(n).toLocaleString('en-IN')}`;

/**
 * The store vault: cash kept apart from the shift drawer until it is banked. Every movement is a row in store_vault_movements and the
 * balance (by face value) is worked out from the confirmed rows, so nothing is ever overwritten. Money enters from a shift close (drop),
 * leaves by a bank deposit or as change for a drawer, and a count records any difference without hiding it in a shift's variance.
 */
@Injectable()
export class VaultService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- access

  private async caller(userid: number, m: EntityManager = this.manager): Promise<Caller> {
    const [u] = await m.query(`select u.id, u.business_id as businessid, r.name as role from app_user u left join app_role r on r.id = u.role_id where u.id = $1`, [userid || 0]);
    if (!u) throw new ForbiddenException('Sign in again.');
    return u;
  }

  /** the store, checked to be in the caller's business and (unless an owner) one they are assigned to */
  private async store(m: EntityManager, storeid: number, c: Caller, opts: { lock?: boolean } = {}) {
    const [s] = await m.query(
      `select id, location, business_id as businessid, vault_enabled as enabled, float_amount as floatamount, float_denominations as floatdenominations,
              vault_drop_confirm_limit as confirmlimit
         from stores where id = $1 ${opts.lock ? 'for update' : ''}`, [storeid]);
    if (!s) throw new NotFoundException('Store not found.');
    if (c.businessid && s.businessid && Number(c.businessid) !== Number(s.businessid)) throw new ForbiddenException('That store belongs to another business.');
    if (!isOwnerRole(c.role)) {
      const [a] = await m.query(`select 1 from user_stores where user_id = $1 and store_id = $2 and active and not archive`, [c.id, storeid]);
      if (!a) throw new ForbiddenException('You are not assigned to this store.');
    }
    return s;
  }

  private needVault(s: any) {
    if (!s.enabled) throw new BadRequestException(`${String(s.location).trim()} does not keep a vault. A Business Head can switch it on in the store's cash settings.`);
  }

  private needManager(c: Caller, what: string) {
    if (!isManagerRole(c.role)) throw new ForbiddenException(`Only a Store Head or Business Head can ${what}.`);
  }

  private needOwner(c: Caller, what: string) {
    if (!isOwnerRole(c.role)) throw new ForbiddenException(`Only a Business Head can ${what}.`);
  }

  // ---------------------------------------------------------------- reading

  private async rows(m: EntityManager, storeid: number) {
    return m.query(`select direction, amount::float as amount, denominations, status from store_vault_movements where store_id = $1 and status <> 'REJECTED'`, [storeid]);
  }

  /** the vault's position: what is in it by face value, what waits for a second person, the float and the last count */
  async getState(storeid: number, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'see the vault');
    const s = await this.store(this.manager, storeid, c);
    const rows = await this.rows(this.manager, storeid);
    const held = vaultHoldings(rows);
    const pending = await this.manager.query(this.movementSql(`m.store_id = $1 and m.status = 'PENDING'`, 'order by m.created_on'), [storeid]);
    const [lastCount] = await this.manager.query(
      `select c.id::text as id, c.expected::float as expected, c.counted::float as counted, c.variance::float as variance, c.counted_on as countedon, u.full_name as countedby
         from store_vault_counts c left join app_user u on u.id = c.counted_by where c.store_id = $1 order by c.counted_on desc, c.id desc limit 1`, [storeid]);
    return {
      storeid, location: String(s.location).trim(), enabled: !!s.enabled,
      float: { amount: Number(s.floatamount || 0), denominations: s.floatdenominations || [] },
      confirmlimit: Number(s.confirmlimit || 0),
      balance: holdingsTotal(held), denominations: holdingsToDenoms(held),
      pending, lastcount: lastCount || null,
    };
  }

  private movementSql(where: string, tail = '', limit = '') {
    return `select m.id::text as id, m.store_id as storeid, m.shift_id as shiftid, m.move_type as movetype, m.direction, m.amount::float as amount, m.denominations,
                   m.status, m.reference_no as referenceno, m.reason, m.notes, m.created_on as createdon, m.confirmed_on as confirmedon,
                   m.actor_id as actorid, a.full_name as actor, m.confirmed_by as confirmedby, cb.full_name as confirmer
              from store_vault_movements m
              join app_user a on a.id = m.actor_id left join app_user cb on cb.id = m.confirmed_by
             where ${where} ${tail} ${limit}`;
  }

  async getMovements(storeid: number, q: any, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'see the vault history');
    await this.store(this.manager, storeid, c);
    const args: any[] = [storeid];
    const where = ['m.store_id = $1'];
    if (q?.from) { args.push(q.from); where.push(`m.created_on >= $${args.length}::date`); }
    if (q?.to) { args.push(q.to); where.push(`m.created_on < ($${args.length}::date + 1)`); }
    if (q?.type) { args.push(String(q.type).toUpperCase()); where.push(`m.move_type = $${args.length}`); }
    if (q?.status) { args.push(String(q.status).toUpperCase()); where.push(`m.status = $${args.length}`); }
    const limit = Math.min(Math.max(parseInt(q?.limit, 10) || 100, 1), 500);
    return this.manager.query(this.movementSql(where.join(' and '), 'order by m.created_on desc, m.id desc', `limit ${limit}`), args);
  }

  // ---------------------------------------------------------------- writing

  private async insertMovement(m: EntityManager, v: {
    storeid: number; shiftid?: number | null; type: string; direction: 'IN' | 'OUT'; amount: number; denominations: Denoms; status: string;
    actor: number; reference?: string | null; reason?: string | null; notes?: string | null;
  }) {
    const [row] = await m.query(
      `insert into store_vault_movements (store_id, shift_id, move_type, direction, amount, denominations, status, actor_id, reference_no, reason, notes)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) returning id::text as id`,
      [v.storeid, v.shiftid ?? null, v.type, v.direction, v.amount, JSON.stringify(v.denominations), v.status, v.actor, v.reference ?? null, v.reason ?? null, v.notes ?? null]);
    return row.id as string;
  }

  private cleanText(v: any, max: number): string | null {
    const t = typeof v === 'string' ? v.trim() : '';
    return t ? t.slice(0, max) : null;
  }

  private request(body: any, what: string) {
    const r = readRequest(body?.denominations);
    if (!r || r.amount <= 0) throw new BadRequestException(`Count the ${what} by note and coin: enter how many of each.`);
    return r;
  }

  private needCover(request: Denoms, rows: any[], ignorePendingOf?: Denoms) {
    const held = vaultHoldings(rows);
    const reserved = reservedByPending(rows);
    if (ignorePendingOf) for (const p of ignorePendingOf) reserved.set(p.d, (reserved.get(p.d) || 0) - p.n);
    const short = firstShortfall(request, held, reserved);
    if (short) throw new BadRequestException(`The vault has ${short.available} of Rs ${short.d}, but ${short.wanted} were asked for.`);
  }

  /** the opening balance of a vault that has never been used: counted once by a Business Head */
  async opening(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    this.needOwner(c, 'set the opening balance of a vault');
    const r = this.request(body, 'opening cash');
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      const [used] = await m.query(`select count(*)::int as n from store_vault_movements where store_id = $1 and status <> 'REJECTED'`, [storeid]);
      if (used.n > 0) throw new ConflictException('This vault already has movements. Use a count and an adjustment to correct it.');
      const id = await this.insertMovement(m, { storeid, type: 'OPENING', direction: 'IN', amount: r.amount, denominations: r.denominations, status: 'CONFIRMED', actor: c.id, notes: this.cleanText(body?.notes, 500) });
      await this.audit.record({ userId: c.id, action: 'vault.opening', entityType: 'store_vault', entityId: storeid, summary: `${String(s.location).trim()}: opening vault balance ${money(r.amount)}`, details: { denominations: r.denominations } });
      return { id, amount: r.amount };
    });
  }

  /** cash put into the vault from a shift close. Above the store's limit it waits for a second person. */
  async drop(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    const r = this.request(body, 'cash for the vault');
    const shiftid = body?.shiftid ? Number(body.shiftid) : null;
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      if (shiftid) {
        const [sh] = await m.query(`select store_id from store_shifts where id = $1`, [shiftid]);
        if (!sh || Number(sh.store_id) !== storeid) throw new BadRequestException('That shift does not belong to this store.');
      }
      const limit = Number(s.confirmlimit || 0);
      const status = limit > 0 && r.amount > limit ? 'PENDING' : 'CONFIRMED';
      let id: string;
      try {
        id = await this.insertMovement(m, { storeid, shiftid, type: 'DROP_IN', direction: 'IN', amount: r.amount, denominations: r.denominations, status, actor: c.id, notes: this.cleanText(body?.notes, 500) });
      } catch (e: any) {
        if (e?.code === '23505') throw new ConflictException('This shift has already put its cash into the vault.');
        throw e;
      }
      await this.audit.record({ userId: c.id, action: 'vault.drop', entityType: 'store_vault', entityId: storeid, summary: `${String(s.location).trim()}: ${money(r.amount)} to the vault${status === 'PENDING' ? ' (waiting for confirmation)' : ''}`, details: { movement: id, shiftid, denominations: r.denominations } });
      return { id, amount: r.amount, status };
    });
  }

  /**
   * Cash put into the vault from a drawer during the shift, without closing it (a manager lifts surplus out of a busy till). The cash leaves the drawer
   * at once, so the shift's expected cash falls with it; the movement is not tied to the shift (that would use up the one drop a shift makes when it
   * closes), and the cash-book row carries the shift. Above the store's limit the vault waits for a second person to confirm, as with any drop.
   */
  async dropNow(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'put cash into the vault from a drawer');
    const r = this.request(body, 'cash for the vault');
    const shiftid = Number(body?.shiftid);
    if (!shiftid) throw new BadRequestException('Choose the shift whose drawer the cash comes from.');
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      const [sh] = await m.query(`select id, store_id, status, expected_cash::float as expected, name from store_shifts where id = $1 for update`, [shiftid]);
      if (!sh || Number(sh.store_id) !== storeid) throw new BadRequestException('That shift does not belong to this store.');
      if (sh.status !== 'OPEN') throw new BadRequestException('That shift is closed. Cash is put into the vault from an open shift.');
      if (r.amount > Number(sh.expected) + 0.005) throw new BadRequestException(`The drawer is expected to hold only ${money(sh.expected)}, so ${money(r.amount)} cannot be taken out of it.`);
      const limit = Number(s.confirmlimit || 0);
      const status = limit > 0 && r.amount > limit ? 'PENDING' : 'CONFIRMED';
      const id = await this.insertMovement(m, { storeid, shiftid: null, type: 'DROP_IN', direction: 'IN', amount: r.amount, denominations: r.denominations, status, actor: c.id,
        reference: `shift:${shiftid}`, reason: 'Put in during the shift', notes: this.cleanText(body?.notes, 500) });
      await m.query(
        `insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, store_id, shift_id, holder, vault_movement_id)
         values (current_date, 'VAULT_DROP', 'Put in the vault during the shift', 0, $1, $2, $3, 'DRAWER', $4)`, [r.amount, storeid, shiftid, id]);
      await this.shiftMoved(m, shiftid, -r.amount);
      await this.audit.record({ userId: c.id, action: 'vault.drop_now', entityType: 'store_vault', entityId: storeid,
        summary: `${String(s.location).trim()}: ${money(r.amount)} from the drawer of shift ${shiftid} to the vault${status === 'PENDING' ? ' (waiting for confirmation)' : ''}`, details: { movement: id, shiftid, denominations: r.denominations } });
      return { id, amount: r.amount, status };
    });
  }

  /** the drawer of an open shift holds `by` more (or less): its expected cash, and the variance if it was counted, move with it */
  private async shiftMoved(m: EntityManager, shiftid: number, by: number) {
    await m.query(
      `update store_shifts set expected_cash = expected_cash + $2, variance = case when counted_cash is null then null else counted_cash - (expected_cash + $2) end, updated_on = now() where id = $1`, [shiftid, by]);
  }

  /** cash taken from the vault to the bank. A deposit above the limit waits for a second person; the cash book row is posted once it is confirmed. */
  async deposit(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'bank the vault cash');
    const r = this.request(body, 'cash for the bank');
    const reference = this.cleanText(body?.referenceno, 40);
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      this.needCover(r.denominations, await this.rows(m, storeid));
      const limit = Number(s.confirmlimit || 0);
      const status = limit > 0 && r.amount > limit ? 'PENDING' : 'CONFIRMED';
      const id = await this.insertMovement(m, { storeid, type: 'BANK_DEPOSIT_OUT', direction: 'OUT', amount: r.amount, denominations: r.denominations, status, actor: c.id, reference, notes: this.cleanText(body?.notes, 500) });
      if (status === 'CONFIRMED') await this.postBankDeposit(m, storeid, id, r.amount, reference, body?.transdate);
      await this.audit.record({ userId: c.id, action: 'vault.deposit', entityType: 'store_vault', entityId: storeid, summary: `${String(s.location).trim()}: ${money(r.amount)} to the bank${status === 'PENDING' ? ' (waiting for confirmation)' : ''}`, details: { movement: id, reference, denominations: r.denominations } });
      return { id, amount: r.amount, status };
    });
  }

  private async postBankDeposit(m: EntityManager, storeid: number, movementId: string, amount: number, reference: string | null, transdate?: string) {
    await m.query(
      `insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, reference_no, store_id, shift_id, holder, vault_movement_id)
       values (coalesce($1::date, current_date), 'BANK_DEPOSIT', 'Banked from the vault', 0, $2, $3, $4, null, 'VAULT', $5)`,
      [transdate && /^\d{4}-\d{2}-\d{2}$/.test(transdate) ? transdate : null, amount, reference, storeid, movementId]);
  }

  /** small notes and coins given to a drawer's float */
  async change(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'give change from the vault');
    const r = this.request(body, 'change');
    const shiftid = body?.shiftid ? Number(body.shiftid) : null;
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      this.needCover(r.denominations, await this.rows(m, storeid));
      const id = await this.insertMovement(m, { storeid, shiftid, type: 'CHANGE_TO_DRAWER', direction: 'OUT', amount: r.amount, denominations: r.denominations, status: 'CONFIRMED', actor: c.id, notes: this.cleanText(body?.notes, 500) });
      await this.audit.record({ userId: c.id, action: 'vault.change', entityType: 'store_vault', entityId: storeid, summary: `${String(s.location).trim()}: ${money(r.amount)} change to a drawer`, details: { movement: id, shiftid, denominations: r.denominations } });
      return { id, amount: r.amount, status: 'CONFIRMED' };
    });
  }

  /** a second person confirms a waiting drop or deposit */
  async confirm(movementId: string, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'confirm a vault movement');
    return this.manager.transaction(async (m) => {
      const [mv] = await m.query(`select id::text as id, store_id, move_type, amount::float as amount, denominations, status, actor_id, reference_no from store_vault_movements where id = $1 for update`, [movementId]);
      if (!mv) throw new NotFoundException('Movement not found.');
      const s = await this.store(m, mv.store_id, c, { lock: true });
      if (mv.status !== 'PENDING') throw new ConflictException(`That movement is already ${String(mv.status).toLowerCase()}.`);
      if (Number(mv.actor_id) === c.id) throw new ForbiddenException('A second person must confirm this; you made it.');
      if (mv.move_type === 'BANK_DEPOSIT_OUT') this.needCover(mv.denominations, await this.rows(m, mv.store_id), mv.denominations);
      await m.query(`update store_vault_movements set status = 'CONFIRMED', confirmed_by = $2, confirmed_on = now() where id = $1`, [movementId, c.id]);
      if (mv.move_type === 'BANK_DEPOSIT_OUT') await this.postBankDeposit(m, mv.store_id, mv.id, mv.amount, mv.reference_no);
      await this.audit.record({ userId: c.id, action: 'vault.confirm', entityType: 'store_vault', entityId: mv.store_id, summary: `${String(s.location).trim()}: ${money(mv.amount)} ${mv.move_type === 'DROP_IN' ? 'drop' : 'deposit'} confirmed`, details: { movement: mv.id } });
      return { id: mv.id, status: 'CONFIRMED' };
    });
  }

  /** a waiting movement is turned down (by a second person) or withdrawn (by the one who made it) */
  async reject(movementId: string, body: any, userid: number) {
    const c = await this.caller(userid);
    const why = this.cleanText(body?.reason, 200);
    if (!why) throw new BadRequestException('Say why it is being turned down.');
    return this.manager.transaction(async (m) => {
      const [mv] = await m.query(`select id::text as id, store_id, move_type, amount::float as amount, status, actor_id from store_vault_movements where id = $1 for update`, [movementId]);
      if (!mv) throw new NotFoundException('Movement not found.');
      const s = await this.store(m, mv.store_id, c, { lock: true });
      if (mv.status !== 'PENDING') throw new ConflictException(`That movement is already ${String(mv.status).toLowerCase()}.`);
      const own = Number(mv.actor_id) === c.id;
      if (!own) this.needManager(c, 'turn down a vault movement');
      await m.query(`update store_vault_movements set status = 'REJECTED', reason = $2, confirmed_by = $3, confirmed_on = now() where id = $1`, [movementId, why, own ? null : c.id]);
      const [took] = mv.move_type === 'DROP_IN' ? await m.query(`select shift_id, withdraw::float as amount from store_cash_accounts where vault_movement_id = $1 and category = 'VAULT_DROP' limit 1`, [movementId]) : [];
      if (took?.shift_id) {
        await m.query(
          `insert into store_cash_accounts (trans_date, category, description, deposit, withdraw, store_id, shift_id, holder, vault_movement_id)
           values (current_date, 'VAULT_DROP', 'Vault drop turned down: cash back in the drawer', $1, 0, $2, $3, 'DRAWER', $4)`, [took.amount, mv.store_id, took.shift_id, movementId]);
        await this.shiftMoved(m, Number(took.shift_id), Number(took.amount));
      }
      await this.audit.record({ userId: c.id, action: 'vault.reject', entityType: 'store_vault', entityId: mv.store_id, summary: `${String(s.location).trim()}: ${money(mv.amount)} ${mv.move_type === 'DROP_IN' ? 'drop' : 'deposit'} ${own ? 'withdrawn' : 'turned down'}: ${why}`, details: { movement: mv.id } });
      return { id: mv.id, status: 'REJECTED' };
    });
  }

  /** a count of the vault: the difference from the books is kept as it is, not folded into any shift */
  async count(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    this.needManager(c, 'count the vault');
    const raw = Array.isArray(body?.denominations) ? body.denominations : [];
    const r = raw.length ? readRequest(raw) : { denominations: [] as Denoms, amount: 0 };
    if (!r) throw new BadRequestException('Enter how many of each note and coin you counted.');
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      const held = vaultHoldings(await this.rows(m, storeid));
      const expected = holdingsTotal(held);
      const variance = r.amount - expected;
      const [row] = await m.query(
        `insert into store_vault_counts (store_id, expected, counted, variance, denominations, counted_by, notes) values ($1,$2,$3,$4,$5::jsonb,$6,$7) returning id::text as id`,
        [storeid, expected, r.amount, variance, JSON.stringify(r.denominations), c.id, this.cleanText(body?.notes, 500)]);
      const byFace = new Map<number, number>();
      for (const p of r.denominations) byFace.set(p.d, p.n);
      const faces = new Set<number>([...Array.from(held.keys()), ...Array.from(byFace.keys())]);
      const differences = Array.from(faces).map((d) => ({ d, books: held.get(d) || 0, counted: byFace.get(d) || 0 })).filter((x) => x.books !== x.counted).sort((a, b) => b.d - a.d);
      await this.audit.record({ userId: c.id, action: 'vault.count', entityType: 'store_vault', entityId: storeid, summary: `${String(s.location).trim()}: vault counted ${money(r.amount)}, books ${money(expected)}, variance ${money(variance)}`, details: { count: row.id, differences } });
      return { id: row.id, expected, counted: r.amount, variance, differences };
    });
  }

  /** a correction of the books after a count: a Business Head only, with a reason */
  async adjust(storeid: number, body: any, userid: number) {
    const c = await this.caller(userid);
    this.needOwner(c, 'adjust the vault');
    const reason = this.cleanText(body?.reason, 200);
    if (!reason) throw new BadRequestException('Give the reason for the adjustment.');
    const direction = String(body?.direction || '').toUpperCase();
    if (direction !== 'IN' && direction !== 'OUT') throw new BadRequestException('Say whether cash is being added (IN) or taken out (OUT).');
    const r = this.request(body, 'adjustment');
    return this.manager.transaction(async (m) => {
      const s = await this.store(m, storeid, c, { lock: true });
      this.needVault(s);
      if (direction === 'OUT') this.needCover(r.denominations, await this.rows(m, storeid));
      const id = await this.insertMovement(m, { storeid, type: 'ADJUSTMENT', direction: direction as 'IN' | 'OUT', amount: r.amount, denominations: r.denominations, status: 'CONFIRMED', actor: c.id, reason, notes: this.cleanText(body?.notes, 500) });
      await this.audit.record({ userId: c.id, action: 'vault.adjust', entityType: 'store_vault', entityId: storeid, summary: `${String(s.location).trim()}: vault adjusted ${direction === 'IN' ? '+' : '-'}${money(r.amount)}: ${reason}`, details: { movement: id, denominations: r.denominations } });
      return { id, amount: r.amount, status: 'CONFIRMED' };
    });
  }
}

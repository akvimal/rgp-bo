import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isManagerRole, isOwnerRole } from 'src/core/roles';
import { money } from '../sales/customer-due-rule';
import { NIL_MOBILE, identityProblem, normaliseMobile } from './customer-rules';
import { transferProblem } from './household-rules';

const SAME_BALANCE = `(household_id = (select household_id from customer where id = $1) or customer_id = $1)`;

/**
 * What changes a household after it exists (docs/planning/CUSTOMER_HOUSEHOLDS.md step 5): the number changes, one person is given their own account,
 * two households become one, and a balance is moved on purpose. Balances never move by themselves: a person who leaves takes none with them.
 */
@Injectable()
export class CustomerHouseholdService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  private async role(user: any): Promise<string | undefined> {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    return r?.name;
  }
  private async needManager(user: any, what: string) {
    if (!isManagerRole(await this.role(user))) throw new ForbiddenException(`Only a Store Head or Business Head can ${what}.`);
  }

  private async person(tm: EntityManager, id: number) {
    const [c] = await tm.query(`select id, name, mobile, locality, household_id from customer where id = $1 for update`, [id]);
    if (!c) throw new NotFoundException('Customer not found.');
    if (c.mobile === NIL_MOBILE) throw new BadRequestException('The NIL walk-in customer has no household.');
    if (!c.household_id) throw new BadRequestException('This customer has no household yet.');
    return c;
  }

  /** The numbers a household has had, newest first, and the number it has now. */
  async history(customerId: number) {
    const [me] = await this.manager.query(`select household_id from customer where id = $1`, [customerId]);
    if (!me?.household_id) return { mobile: null, history: [] };
    const [h] = await this.manager.query(`select mobile from household where id = $1`, [me.household_id]);
    const history = await this.manager.query(
      `select mobile, from_on, to_on from household_mobile_history where household_id = $1 order by to_on desc nulls first, id desc`, [me.household_id]);
    return { mobile: h?.mobile ?? null, history };
  }

  /** The household's number changes once, for everyone on it. Consent belongs to the number, so it is asked again; "do not contact" stays. */
  async changeMobile(customerId: number, body: { mobile: any }, user: any) {
    await this.needManager(user, 'change a household number');
    const mobile = normaliseMobile(body?.mobile);
    if (!mobile || mobile === NIL_MOBILE) throw new BadRequestException('Enter the new 10-digit mobile number.');
    const out = await this.manager.transaction(async (tm) => {
      const me = await this.person(tm, customerId);
      const [h] = await tm.query(`select id, mobile from household where id = $1 for update`, [me.household_id]);
      if (h.mobile === mobile) throw new BadRequestException('That is already the household number.');
      const [other] = await tm.query(`select c.name from customer c where c.mobile = $1 and c.household_id is distinct from $2 limit 1`, [mobile, h.id]);
      if (other) throw new ConflictException(`${mobile} is already used by ${other.name}. Merge the two accounts instead of changing the number.`);
      const [held] = await tm.query(`select 1 from household where mobile = $1 and id <> $2`, [mobile, h.id]);
      if (held) throw new ConflictException(`${mobile} already belongs to another account. Merge the two accounts instead of changing the number.`);
      if (h.mobile) await tm.query(`insert into household_mobile_history (household_id, mobile, to_on, changed_by) values ($1, $2, now(), $3)`, [h.id, h.mobile, user.id]);
      // the household first, so every person's update below finds the number already theirs and none of them is split off
      await tm.query(`update household set mobile = $2, contact_consent = null, consent_on = null, consent_by = null, updated_on = now() where id = $1`, [h.id, mobile]);
      await tm.query(`update customer set mobile = $2, contact_consent = null, consent_on = null, consent_by = null where household_id = $1`, [h.id, mobile]);
      return { householdid: h.id, from: h.mobile, to: mobile };
    });
    await this.audit.record({ userId: user.id, action: 'household.mobile_changed', entityType: 'customer', entityId: customerId,
      summary: `Household number changed ${out.from ?? '(none)'} -> ${out.to}; consent to be asked again`, details: out });
    return { ok: true, ...out };
  }

  /**
   * A person who wants their own account: they move to a household of their own, with their own number (or none, with a location). Their bills,
   * documents and refills stay with them; the balances stay with the household they arose in; the new account starts at zero, with no limit
   * and consent to be asked afresh.
   */
  async detach(customerId: number, body: { mobile?: any; locality?: any }, user: any) {
    await this.needManager(user, 'give someone their own account');
    const mobile = normaliseMobile(body?.mobile);
    if (mobile === NIL_MOBILE) throw new BadRequestException('Enter a real mobile number.');
    const out = await this.manager.transaction(async (tm) => {
      const me = await this.person(tm, customerId);
      const [n] = await tm.query(`select count(*)::int as n from customer where household_id = $1 and id <> $2 and active and not archive`, [me.household_id, customerId]);
      if (!n.n) throw new BadRequestException('This person is the only one on their account.');
      const locality = String(body?.locality ?? me.locality ?? '').trim() || null;
      const stop = identityProblem(mobile, me.name, locality);
      if (stop) throw new BadRequestException(stop);
      if (mobile) {
        const [taken] = await tm.query(`select c.name from customer c where c.mobile = $1 and c.id <> $2 limit 1`, [mobile, customerId]);
        if (taken) throw new ConflictException(`${mobile} is already used by ${taken.name}. Merge the two accounts instead.`);
      }
      const before = me.household_id;
      // household_id is cleared so the trigger starts a household for the new number (or for the person alone)
      await tm.query(
        `update customer set household_id = null, mobile = $2, locality = coalesce($3, locality), relationship = 'SELF',
                contact_consent = null, consent_on = null, consent_by = null
          where id = $1`, [customerId, mobile, locality]);
      const [after] = await tm.query(`select household_id from customer where id = $1`, [customerId]);
      return { customerid: customerId, from: before, to: after.household_id, mobile };
    });
    await this.audit.record({ userId: user.id, action: 'household.detached', entityType: 'customer', entityId: customerId,
      summary: `Given their own account (${out.mobile ?? 'no number'}); balances stayed with the household they arose in`, details: out });
    return { ok: true, ...out };
  }

  /** Two households become one (the same family on two numbers). The kept number stays; the other goes into the history; balances add up. */
  async merge(body: { keepcustomerid: number; mergecustomerid: number }, user: any) {
    if (!isOwnerRole(await this.role(user))) throw new ForbiddenException('Only the Business Head merges two accounts.');
    const out = await this.manager.transaction(async (tm) => {
      const a = await this.person(tm, Number(body?.keepcustomerid));
      const b = await this.person(tm, Number(body?.mergecustomerid));
      if (a.household_id === b.household_id) throw new BadRequestException('They are already on the same account.');
      const [ha] = await tm.query(`select * from household where id = $1 for update`, [a.household_id]);
      const [hb] = await tm.query(`select * from household where id = $1 for update`, [b.household_id]);
      if (hb.mobile) await tm.query(`insert into household_mobile_history (household_id, mobile, to_on, changed_by) values ($1, $2, now(), $3)`, [ha.id, hb.mobile, user.id]);
      await tm.query(`update household_mobile_history set household_id = $1 where household_id = $2`, [ha.id, hb.id]);
      // the other household gives up its number (one household per number); a kept household with none takes it
      await tm.query(`update household set mobile = null where id = $1`, [hb.id]);
      const mobile = ha.mobile ?? hb.mobile;
      // the safe answer wins: anyone asked not to be contacted; the kept household's consent stays
      const dnc = !!(ha.do_not_contact || hb.do_not_contact), ro = !!(ha.review_optout || hb.review_optout);
      const limit = Math.max(Number(ha.credit_limit || 0), Number(hb.credit_limit || 0));
      await tm.query(`update household set mobile = $2, do_not_contact = $3, review_optout = $4, credit_limit = $5, updated_on = now() where id = $1`, [ha.id, mobile, dnc, ro, limit]);
      await tm.query(
        `update customer set household_id = $1, mobile = $2, do_not_contact = $3, review_optout = $4,
                contact_consent = $5, consent_on = $6, consent_by = $7, preferred_channel = $8, message_language = $9
          where household_id = $10`,
        [ha.id, mobile, dnc, ro, ha.contact_consent, ha.consent_on, ha.consent_by, ha.preferred_channel, ha.message_language, hb.id]);
      await tm.query(`update customer_credit_entry set household_id = $1 where household_id = $2`, [ha.id, hb.id]);
      await tm.query(`update customer_due_entry set household_id = $1 where household_id = $2`, [ha.id, hb.id]);
      await tm.query(`delete from household where id = $1`, [hb.id]);
      return { kept: ha.id, merged: hb.id, mobile, limit };
    });
    await this.audit.record({ userId: user.id, action: 'household.merged', entityType: 'customer', entityId: Number(body?.keepcustomerid),
      summary: `Two accounts made one (kept ${out.kept}, merged ${out.merged})`, details: out });
    return { ok: true, ...out };
  }

  /** Moves part of what a household owes, or of its store credit, to another household: a pair of adjustment entries with a reason. */
  async transfer(body: { fromcustomerid: number; tocustomerid: number; kind: string; amount: any; reason: string }, user: any) {
    await this.needManager(user, 'move a balance');
    const kind = String(body?.kind || '').toUpperCase();
    const amount = money(Number(body?.amount));
    const reason = String(body?.reason || '').trim();
    const out = await this.manager.transaction(async (tm) => {
      const from = await this.person(tm, Number(body?.fromcustomerid));
      const to = await this.person(tm, Number(body?.tocustomerid));
      const table = kind === 'CREDIT' ? 'customer_credit_entry' : 'customer_due_entry';
      const [bal] = await tm.query(`select coalesce(sum(amount), 0)::float8 as b from ${table} where ${SAME_BALANCE}`, [from.id]);
      const stop = transferProblem(kind, amount, Number(bal?.b || 0), from.household_id === to.household_id, reason);
      if (stop) throw new BadRequestException(stop);
      const note = `Moved ${kind === 'CREDIT' ? 'store credit' : 'dues'} ${amount.toFixed(2)}: ${reason}`;
      await tm.query(`insert into ${table} (customer_id, household_id, kind, amount, note, created_by) values ($1, $2, 'ADJUSTMENT', $3, $4, $5)`,
        [from.id, from.household_id, -amount, `${note} (to ${to.name})`.slice(0, 200), user.id]);
      await tm.query(`insert into ${table} (customer_id, household_id, kind, amount, note, created_by) values ($1, $2, 'ADJUSTMENT', $3, $4, $5)`,
        [to.id, to.household_id, amount, `${note} (from ${from.name})`.slice(0, 200), user.id]);
      return { from: from.id, to: to.id, kind, amount };
    });
    await this.audit.record({ userId: user.id, action: 'household.balance_moved', entityType: 'customer', entityId: out.from,
      summary: `${kind === 'CREDIT' ? 'Store credit' : 'Dues'} ${amount.toFixed(2)} moved to customer ${out.to} (${reason})`, details: out });
    return { ok: true, ...out };
  }
}

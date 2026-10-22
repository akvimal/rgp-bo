import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';

/** A customer's store credit: balance and history for anyone who can see the customer; corrections by the Business Head. */
@Injectable()
export class CustomerCreditService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  async get(customerId: number) {
    const [c] = await this.manager.query(`select id, name, mobile from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    const entries = await this.manager.query(
      `select e.id, e.entry_date, e.kind, e.amount::float as amount, e.note, e.sale_id, e.return_item_id, s.location as store, u.full_name as by_name
         from customer_credit_entry e left join stores s on s.id = e.store_id left join app_user u on u.id = e.created_by
        where e.customer_id = $1 order by e.created_on desc, e.id desc limit 100`, [customerId]);
    const [b] = await this.manager.query(`select coalesce(sum(amount), 0)::float as balance from customer_credit_entry where customer_id = $1`, [customerId]);
    return { customer: c, balance: Math.round(b.balance * 100) / 100, entries };
  }

  async adjust(customerId: number, body: { amount: any; note: string }, user: any) {
    const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (role?.name !== 'Business Head') throw new ForbiddenException('Only the Business Head corrects store credit.');
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount === 0) throw new BadRequestException('Enter the amount to add (positive) or take off (negative).');
    const note = String(body?.note || '').trim();
    if (note.length < 5) throw new BadRequestException('Say why: at least 5 characters.');
    const [c] = await this.manager.query(`select id, name, mobile from customer where id = $1`, [customerId]);
    if (!c) throw new NotFoundException('Customer not found.');
    if (!String(c.mobile || '').trim() || c.mobile === '0000000000') throw new BadRequestException('Store credit needs a named customer with a mobile number.');
    await this.manager.transaction(async tm => {
      await tm.query(`select id from customer where id = $1 for update`, [customerId]);
      const [b] = await tm.query(`select coalesce(sum(amount), 0)::float as balance from customer_credit_entry where customer_id = $1`, [customerId]);
      if (b.balance + amount < -0.005) throw new BadRequestException(`The balance is ${b.balance.toFixed(2)}; it cannot go below zero.`);
      await tm.query(`insert into customer_credit_entry (customer_id, kind, amount, note, created_by) values ($1, 'ADJUSTMENT', $2, $3, $4)`, [customerId, amount, note.slice(0, 200), user.id]);
    });
    await this.audit.record({ userId: user.id, action: 'customercredit.adjusted', entityType: 'customer', entityId: customerId,
      summary: `${c.name}: store credit adjusted by ${amount} (${note})`, details: { amount, note } });
    return this.get(customerId);
  }
}

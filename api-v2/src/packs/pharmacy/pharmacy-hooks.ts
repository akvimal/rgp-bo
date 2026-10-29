import { BadRequestException } from '@nestjs/common';
import { SaleContext, SaleHook } from 'src/core/sale-hooks/sale-hooks';
import { DrugRegisterService } from './drug-register.service';

/**
 * A completed bill that includes a chronic medicine must carry a real customer mobile number: those customers are the ones refill reminders and
 * follow-ups depend on. "NIL" (mobile 0000000000) or no customer does not qualify. This was a rule of billing; it is a rule of the pharmacy pack.
 */
export const chronicMobileHook: SaleHook = {
  name: 'pharmacy.chronic_mobile',
  pack: 'pharmacy',
  module: 'refills',
  async check(ctx: SaleContext) {
    const { sale, customer, manager } = ctx;
    if (String(sale?.status || '').toUpperCase() !== 'COMPLETE') return;
    const productIds = (Array.isArray(sale.items) ? sale.items : [])
      .map((i: any) => Number(i.productid ?? i.product_id)).filter((n: number) => Number.isFinite(n) && n > 0);
    if (!productIds.length) return;
    let mobile: string = String(customer?.mobile ?? '').trim();
    const customerId = customer?.id ?? sale.customerid;
    if (!mobile && customerId) {
      const row = await manager.query(`select mobile from customer where id = $1`, [customerId]);
      mobile = String(row?.[0]?.mobile ?? '').trim();
    }
    if (mobile && mobile !== '0000000000') return;
    const chronic = await manager.query(`select title from product where id = any($1::int[]) and more_props->>'chronic' = 'true' order by title limit 5`, [productIds]);
    if (chronic.length) {
      throw new BadRequestException(`A customer mobile number is required for bills with chronic medicines (${chronic.map((c: any) => c.title).join(', ')}).`);
    }
  },
};

/** the online register of Schedule H, H1 and X drugs: the bill needs the patient and the prescriber, and writes the register line in its own transaction */
export const drugRegisterHook = (register: DrugRegisterService): SaleHook => ({
  name: 'pharmacy.drug_register',
  pack: 'pharmacy',
  module: 'drug_register',
  check: (ctx) => register.check(ctx),
  saved: (ctx) => register.saved(ctx),
});

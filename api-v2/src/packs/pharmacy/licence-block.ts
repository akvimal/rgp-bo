import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from 'src/core/config/config.service';
import { SaleHook } from 'src/core/sale-hooks/sale-hooks';
import { DRUG_LICENCE_TYPES, licenceLapsed } from './licence-rules';

/**
 * The first legal block (RECOGNITION_AND_COMPLIANCE 3.2): a pharmacy whose drug licence has ended cannot make a bill, unless the Business Head has waived
 * the licence item. It is a choice the Business Head makes ("Stop billing when the drug licence has ended", off unless switched on) because stopping the till
 * for a lapse in record keeping, with the licence in fact renewed, would hurt the business more than it protects it.
 */
export function licenceBlockHook(config: ConfigService): SaleHook {
  return {
    name: 'licence-block',
    pack: 'pharmacy',
    async check(ctx) {
      if (!ctx.storeId) return;
      const [st] = await ctx.manager.query(`select business_id from stores where id = $1`, [ctx.storeId]);
      if (!st?.business_id) return;
      const cfg = await config.valuesFor(st.business_id, 'compliance');
      if (cfg.block_expired_licence !== true) return;
      const rows = await ctx.manager.query(
        `select to_char(max(valid_to), 'YYYY-MM-DD') as valid_to from store_license where store_id = $1 and license_type = any($2::text[]) group by license_type`, [ctx.storeId, DRUG_LICENCE_TYPES]);
      const [t] = await ctx.manager.query(`select (now() at time zone 'Asia/Kolkata')::date::text as d`);
      if (!licenceLapsed(rows.map((r: any) => r.valid_to), t.d)) return;
      const [waived] = await ctx.manager.query(
        `select 1 as x from compliance_waiver w join compliance_instance i on i.id = w.instance_id
          where i.store_id = $1 and i.item_key = 'licence' and w.status = 'GRANTED' and w.until >= $2::date limit 1`, [ctx.storeId, t.d]);
      if (waived) return;
      throw new ForbiddenException('This store\'s drug licence has ended, so bills cannot be made. Renew it and add the new dates under Store settings, or ask the Business Head for a waiver.');
    },
  };
}

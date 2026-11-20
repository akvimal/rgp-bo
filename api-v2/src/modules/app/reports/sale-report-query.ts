import { BadRequestException } from '@nestjs/common';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PROPS = 20;
const MAX_TEXT = 200;
/** the most bill lines one search or export returns: the whole result is held in memory (and, for an export, in a workbook) */
export const MAX_REPORT_ROWS = 50000;

export interface SaleReportQuery { sql: string; params: any[]; }

/** a real calendar date in YYYY-MM-DD (not 2026-02-31) */
function isDate(v: any): v is string {
  if (typeof v !== 'string' || !DATE.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const text = (v: any, what: string): string => {
  if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') throw new BadRequestException(`${what} must be text.`);
  const t = String(v);
  if (t.length > MAX_TEXT) throw new BadRequestException(`${what} is too long.`);
  return t;
};

/**
 * The sale report's query. Nothing the caller sends is ever put into the SQL text: dates, the category and the property ids and values all travel as
 * parameters, and `stores` (the stores this person may read, from the server, never from the request) limits the rows. `stores` null is no limit
 * (a platform login with no business); an empty list reads nothing.
 */
export function buildSaleReportQuery(criteria: any, stores: number[] | null): SaleReportQuery {
  if (!criteria || typeof criteria !== 'object' || Array.isArray(criteria)) throw new BadRequestException('criteria is required.');
  if (criteria.report !== 'sale') throw new BadRequestException("report must be 'sale'.");
  if (!isDate(criteria.begin) || !isDate(criteria.end)) throw new BadRequestException('begin and end must be dates (YYYY-MM-DD).');
  if (criteria.begin > criteria.end) throw new BadRequestException('begin must not be after end.');

  const params: any[] = [criteria.begin, criteria.end];
  const where: string[] = [`s.status = 'COMPLETE'`, `s.bill_date between $1::date and ($2::date + 1)`];

  if (stores !== null) {
    params.push(stores);
    where.push(`coalesce(s.store_id, ss.store_id) = any($${params.length}::int[])`);
  }

  if (criteria.shift !== undefined && criteria.shift !== null && criteria.shift !== '') {
    params.push(text(criteria.shift, 'shift'));
    where.push(`ss.name = $${params.length}`);
  }

  const product = criteria.product;
  if (product !== undefined && product !== null) {
    if (typeof product !== 'object' || Array.isArray(product)) throw new BadRequestException('product must be an object.');
    if (product.category !== undefined && product.category !== null && product.category !== '') {
      params.push(text(product.category, 'category'));
      where.push(`p.category = $${params.length}`);
    }
    if (product.props !== undefined && product.props !== null) {
      if (!Array.isArray(product.props)) throw new BadRequestException('props must be a list.');
      if (product.props.length > MAX_PROPS) throw new BadRequestException('Too many product properties.');
      for (const prop of product.props) {
        if (!prop || typeof prop !== 'object') throw new BadRequestException('Each product property needs an id and a value.');
        if (!prop.value) continue;      // an empty (or unticked) value does not filter, as before
        params.push(text(prop.id, 'property id'));
        const idAt = params.length;
        params.push(text(prop.value, 'property value'));
        where.push(`p.more_props->>$${idAt} = $${params.length}`);
      }
    }
  }

  const sql = `
        select s.bill_date, s.bill_no, s.more_props, sh.name || ' (' || to_char(sh.shift_date, 'DD Mon') || ')' as shift, su.full_name as served_by, c."name" || coalesce(' (' || c.mobile || ')', '') as customer, round(s.total) as sale_total,
        p.title as product, (batch || ' (' || to_char(exp_date, 'Mon-YY') || ')') as batch, si.mrp_cost as MRP, si.qty, si.price as price, si.total as item_total
        from sale s
        inner join sale_item si on si.sale_id = s.id
        inner join product p on p.id = si.product_id
        left join customer c on c.id = s.customer_id
        left join store_shifts ss on ss.id = s.shift_id
        left join store_shifts sh on sh.id = s.shift_id
        left join app_user su on su.id = coalesce(s.acting_user_id, s.created_by)
        where ${where.join(' and ')}
        order by s.bill_date desc, s.bill_no desc
        limit ${MAX_REPORT_ROWS + 1}`;     // one more than allowed, so the service can tell that the days asked for hold too much
  return { sql, params };
}

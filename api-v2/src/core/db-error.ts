import { BadRequestException, ConflictException, HttpException, InternalServerErrorException } from '@nestjs/common';

/**
 * Plain words for what the database refuses, so a person never sees "duplicate key value violates unique constraint ...".
 * Known constraints say what the person did wrong; anything else gets a message by kind. Pure: works on the error object
 * (TypeORM's QueryFailedError carries the driver's fields on itself and on `driverError`).
 */
const KNOWN: { [constraint: string]: string } = {
  product_price2_unique: 'This product already has that price starting on that date. Change the price or the date, or leave it as it is.',
  product_un: 'A product with that name already exists.',
  customer_un: 'A customer with that name and mobile number already exists.',
  customer_no_mobile_un: 'A customer with that name and location already exists.',
  vendor_un: 'A vendor with that name already exists.',
  app_user_un: 'That email is already used by another login.',
  app_role_un: 'A role with that name already exists.',
  business_un: 'A business with that name already exists.',
  business_location_un: 'This business already has a store with that name.',
  delivery_partner_un: 'A delivery partner with that name already exists.',
  app_setting_key_un: 'That setting already exists.',
  purchase_invoice_un: 'This vendor already has an invoice with that number.',
  purchase_invoice_challan_un: 'This vendor already has a challan with that number.',
  sale_gst_invoice_uq: 'That tax invoice number is already used. Try again.',
  prescriber_uq: 'A prescriber with that name already exists.',
  stock_audit_no_uq: 'That audit number is already used. Try again.',
};

const field = (s: any) => String(s ?? '').replace(/_/g, ' ').trim();

/** the raw database fields of an error, wherever the library put them */
const parts = (e: any) => ({ code: e?.code ?? e?.driverError?.code, constraint: e?.constraint ?? e?.driverError?.constraint, detail: e?.detail ?? e?.driverError?.detail, column: e?.column ?? e?.driverError?.column, raw: String(e?.message ?? '') });

/** is this something the database said (and so not for people to read as it is) */
export function isDbError(e: any): boolean {
  const { code, raw } = parts(e);
  return (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) || /duplicate key value|violates (foreign key|unique|not-null|check) constraint|invalid input syntax|relation ".*" does not exist|column ".*" (of relation|does not exist)|syntax error at or near/i.test(raw);
}

/** a sentence a person can act on, or null when the error is not the database's */
export function friendlyDbMessage(e: any): string | null {
  if (!isDbError(e)) return null;
  const { code, constraint, detail, column, raw } = parts(e);
  const cname = constraint || (raw.match(/constraint "([^"]+)"/)?.[1] ?? '');
  switch (code) {
    case '23505':
      return KNOWN[cname] ?? 'That already exists. Change what you entered and try again.';
    case '23503':
      // deleting something that is used, or saving something that points at a record that is gone
      return /is still referenced|violates foreign key constraint .* on table/i.test(`${detail ?? ''} ${raw}`) && !/is not present/i.test(detail ?? '')
        ? 'This is still used by other records (bills, stock, payments or history), so it cannot be removed.'
        : 'Something this refers to no longer exists. Reload the page and try again.';
    case '23502':
      return column ? `Please fill in ${field(column)}.` : 'A required value is missing.';
    case '23514':
      return 'One of the values is not allowed. Check what you entered.';
    case '22P02':
    case '22007':
    case '22008':
      return 'One of the values is in the wrong format. Check what you entered.';
    case '22001':
      return 'One of the entries is too long.';
    case '22003':
      return 'One of the numbers is too large.';
    case '40001':
    case '40P01':
      return 'Someone else changed this at the same moment. Please try again.';
    default:
      return 'The change could not be saved. Please check what you entered and try again.';
  }
}

/** the HTTP error for something that failed while doing `doing` ("add the price"): the person's own mistake says so; anything else is ours */
export function userError(e: any, doing: string): HttpException {
  if (e instanceof HttpException) return e;
  const friendly = friendlyDbMessage(e);
  if (friendly) {
    const code = parts(e).code;
    return code === '23505' || code === '40001' || code === '40P01' ? new ConflictException(friendly) : new BadRequestException(friendly);
  }
  return new InternalServerErrorException(`Could not ${doing}. Please try again; if it keeps happening, tell your administrator.`);
}

/** the sentence to show for any error, for lists that report each failure (one price among many) */
export function messageOf(e: any, fallback = 'It could not be done.'): string {
  if (e instanceof HttpException) {
    const r: any = e.getResponse();
    const m = typeof r === 'string' ? r : r?.message;
    return Array.isArray(m) ? m.join(' ') : String(m ?? fallback);
  }
  return friendlyDbMessage(e) ?? (e?.message && !isDbError(e) ? String(e.message).split('\n')[0] : fallback);
}

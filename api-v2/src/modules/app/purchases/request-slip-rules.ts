import { BadRequestException } from '@nestjs/common';

export interface SlipLine { productid?: number; requestedname?: string; qty: number; note?: string }

const words = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ');

/**
 * The lines of a slip, tidied: every line needs a product or a typed name and a whole quantity of at least 1; the same product (or the same typed
 * name) twice becomes one line with the quantities added and the notes joined, so the buyer never sees the same thing twice from one slip.
 */
export function cleanSlipLines(lines: SlipLine[]): SlipLine[] {
  const out: SlipLine[] = [];
  const seen = new Map<string, SlipLine>();
  (lines || []).forEach((l, i) => {
    const productid = l?.productid ? Number(l.productid) : undefined;
    const requestedname = productid ? undefined : words(l?.requestedname) || undefined;
    if (!productid && !requestedname) throw new BadRequestException(`Line ${i + 1}: choose the product, or type its name if it is not in the product list.`);
    const qty = Number(l?.qty);
    if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException(`Line ${i + 1}: the quantity must be a whole number, at least 1.`);
    const note = words(l?.note) || undefined;
    const key = productid ? `p${productid}` : `n${requestedname!.toLowerCase()}`;
    const have = seen.get(key);
    if (have) {
      have.qty += qty;
      if (note && !(have.note || '').includes(note)) have.note = [have.note, note].filter(Boolean).join('; ');
      return;
    }
    const line: SlipLine = { productid, requestedname, qty, note };
    seen.set(key, line);
    out.push(line);
  });
  if (!out.length) throw new BadRequestException('Add at least one product.');
  return out;
}

/** the comment a row of a slip carries: the shared comment, then this line's own note */
export function lineComment(shared: unknown, note: unknown): string | undefined {
  const text = [words(shared), words(note)].filter(Boolean).join(' | ');
  return text ? text.slice(0, 1000) : undefined;
}

/** who may see a request: the person who raised it, or anyone working in the store it was raised for */
export function canSeeRequest(row: { createdby?: number | null; storeid?: number | null }, userId: number, storeIds: number[]): boolean {
  return Number(row.createdby) === Number(userId) || (!!row.storeid && storeIds.includes(Number(row.storeid)));
}

/** a request-only role sees the product, qty and status of its store's requests, but a customer's name and phone only on the requests it raised itself */
export function forRequesterView<T extends { createdby?: number | null }>(rows: T[], userId: number): T[] {
  return rows.map((r: any) => ({
    ...r, vendor: null, vendorid: null, notes: null,
    ...(Number(r.createdby) === Number(userId) ? {} : { customername: null, customerphone: null }),
  }));
}

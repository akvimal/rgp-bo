/**
 * How a business's sale bill is laid out and what it prints, kept apart from the business's other details so a different printer (a line / thermal printer)
 * can get its own profile later without the options moving again. Pure, so it can be tested alone.
 *
 * Stored as one JSON object on the business (`business.bill_layout`); anything missing reads as the default.
 */
export const PRINTERS = ['A4'] as const;
export type Printer = typeof PRINTERS[number];
export const NAME_SUFFIXES = ['NONE', 'R', 'TM'] as const;
export type NameSuffix = typeof NAME_SUFFIXES[number];
export const SUFFIX_MARK: Record<NameSuffix, string> = { NONE: '', R: '®', TM: '™' };
export const MAX_SOCIALS = 8;

export interface Social { label: string; handle: string }
export interface BillLayout {
  /** the printer the layout is for; only A4 for now */
  printer: Printer;
  /** "Amount in words" under the totals (off) */
  showwords: boolean;
  /** a registered or trade-mark sign after the business name */
  namesuffix: NameSuffix;
  /** social handles printed with the website, in this order */
  socials: Social[];
  /** the "Next refill" line (on, where the refills module is on) */
  showrefill: boolean;
}

export const DEFAULT_BILL_LAYOUT: BillLayout = { printer: 'A4', showwords: false, namesuffix: 'NONE', socials: [], showrefill: true };

const text = (v: any, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** what a stored (or sent) layout means, with the defaults filled in; never throws, so a damaged value prints the standard bill */
export function effectiveBillLayout(raw: any): BillLayout {
  const r = raw && typeof raw === 'object' ? raw : {};
  const socials: Social[] = Array.isArray(r.socials)
    ? r.socials.map((s: any) => ({ label: text(s?.label, 20), handle: text(s?.handle, 60) })).filter((s: Social) => s.handle).slice(0, MAX_SOCIALS)
    : [];
  return {
    printer: (PRINTERS as readonly string[]).includes(r.printer) ? r.printer : DEFAULT_BILL_LAYOUT.printer,
    showwords: r.showwords === true,
    namesuffix: (NAME_SUFFIXES as readonly string[]).includes(r.namesuffix) ? r.namesuffix : 'NONE',
    socials,
    showrefill: r.showrefill !== false,
  };
}

/** a layout sent from the settings screen: the same shape, but a wrong value is refused with a message instead of being quietly fixed */
export function checkBillLayout(raw: any): { ok: true; value: BillLayout } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'The bill print settings are not in the expected form.' };
  if (raw.printer !== undefined && !(PRINTERS as readonly string[]).includes(raw.printer)) return { ok: false, error: `Choose a printer: ${PRINTERS.join(', ')}.` };
  if (raw.namesuffix !== undefined && !(NAME_SUFFIXES as readonly string[]).includes(raw.namesuffix)) return { ok: false, error: 'Choose None, registered or trade mark for the sign after the name.' };
  for (const k of ['showwords', 'showrefill']) {
    if (raw[k] !== undefined && typeof raw[k] !== 'boolean') return { ok: false, error: 'Choose yes or no for what the bill prints.' };
  }
  if (raw.socials !== undefined) {
    if (!Array.isArray(raw.socials)) return { ok: false, error: 'The social handles are not in the expected form.' };
    if (raw.socials.length > MAX_SOCIALS) return { ok: false, error: `At most ${MAX_SOCIALS} social handles can be printed.` };
    for (const s of raw.socials) {
      const handle = text(s?.handle, 1000), label = text(s?.label, 1000);
      if (!handle && !label) continue;                                    // an empty row is simply dropped
      if (!handle) return { ok: false, error: 'Each social handle needs the handle or address to print.' };
      if (label.length > 20) return { ok: false, error: 'A social label can be at most 20 characters (for example Instagram).' };
      if (handle.length > 60) return { ok: false, error: 'A social handle can be at most 60 characters.' };
    }
  }
  return { ok: true, value: effectiveBillLayout(raw) };
}

/** the business name as printed: with its registered or trade-mark sign, once */
export function nameWithSuffix(name: string, suffix: NameSuffix | string | null | undefined): string {
  const mark = SUFFIX_MARK[(suffix as NameSuffix) || 'NONE'] ?? '';
  const n = String(name || '').trim();
  if (!mark || !n || n.endsWith(mark)) return n;
  return n + mark;
}

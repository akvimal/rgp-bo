import { ExtractedHeader, ExtractedLine } from './invoice-parser';

/**
 * Does what was read agree with itself? An invoice read from a picture can look fine and still hold one wrong digit, so the read is
 * checked against the figures the invoice prints: its own total, each line's quantity x rate, and the header it needs. The verdict is
 * what the person sees first: reconciled, needs review (and where), or could not be checked. Pure.
 */
export type TieState = 'ok' | 'fail' | 'skip';
export interface TieCheck { key: string; label: string; state: TieState; detail: string; lines?: number[] }
export interface TieOut { status: 'RECONCILED' | 'REVIEW' | 'UNVERIFIED'; headline: string; checks: TieCheck[] }

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function tieOut(parsed: { header: ExtractedHeader; lines: ExtractedLine[] }, linesTotal: number): TieOut {
  const { header, lines } = parsed;
  const checks: TieCheck[] = [];

  // the header the invoice cannot be entered without
  const missing = [!header.invoiceno && 'invoice number', !header.invoicedate && 'invoice date'].filter(Boolean) as string[];
  checks.push(missing.length
    ? { key: 'header', label: 'Invoice number and date', state: 'fail', detail: `Not found: ${missing.join(' and ')}.` }
    : { key: 'header', label: 'Invoice number and date', state: 'ok', detail: `${header.invoiceno}, ${header.invoicedate}.` });

  checks.push(lines.length
    ? { key: 'lines', label: 'Item lines', state: 'ok', detail: `${lines.length} line${lines.length === 1 ? '' : 's'} read.` }
    : { key: 'lines', label: 'Item lines', state: 'fail', detail: 'No item lines were read.' });

  // each line: quantity x rate (less its discount, with or without tax) is the amount the invoice prints for it
  const wrong: number[] = [];
  let checked = 0;
  lines.forEach((l, i) => {
    if (l.amountRead === null || l.amountRead === undefined || !l.qty || l.rate === null || l.rate === undefined) return;
    checked++;
    const base = r2(l.qty * l.rate * (1 - (l.disc ?? 0) / 100));
    const tol = Math.max(1, base * 0.01);
    const taxed = r2(base * (1 + (l.tax ?? 0) / 100));
    const plain = r2(l.qty * l.rate);
    if (Math.abs(base - l.amountRead) > tol && Math.abs(taxed - l.amountRead) > tol && Math.abs(plain - l.amountRead) > tol) wrong.push(i + 1);
  });
  if (wrong.length) checks.push({ key: 'arithmetic', label: 'Quantity x rate = amount', state: 'fail', lines: wrong, detail: `Line${wrong.length === 1 ? '' : 's'} ${wrong.join(', ')} ${wrong.length === 1 ? 'does' : 'do'} not agree with the amount printed. A digit was probably misread.` });
  else if (checked) checks.push({ key: 'arithmetic', label: 'Quantity x rate = amount', state: 'ok', detail: `${checked} of ${lines.length} lines agree with their printed amount.` });
  else checks.push({ key: 'arithmetic', label: 'Quantity x rate = amount', state: 'skip', detail: 'No line amounts were read to check against.' });

  // the lines against the invoice's own total (the printed total includes a rounding of up to 50 paise)
  const printed = header.printedtotal;
  if (printed === null || printed === undefined) {
    checks.push({ key: 'total', label: 'Lines against the printed total', state: 'skip', detail: 'No printed total was found, so the lines cannot be checked against it.' });
  } else if (lines.length) {
    const diff = r2(linesTotal - printed);
    const tol = Math.max(1, printed * 0.002);
    checks.push(Math.abs(diff) <= tol
      ? { key: 'total', label: 'Lines against the printed total', state: 'ok', detail: `The lines come to ${money(linesTotal)} with tax; the invoice says ${money(printed)}.` }
      : { key: 'total', label: 'Lines against the printed total', state: 'fail', detail: `The lines come to ${money(linesTotal)} with tax, the invoice says ${money(printed)}: ${diff > 0 ? 'the lines are' : 'the invoice is'} ${money(Math.abs(diff))} higher. A line may be missing, extra or misread.` });
  }

  // stock that expired in a month before the invoice is dated is a misread expiry (or a vendor to question); the month itself is still good
  if (header.invoicedate) {
    const old = lines.map((l, i) => (l.expdate && l.expdate.slice(0, 7) < header.invoicedate!.slice(0, 7) ? i + 1 : 0)).filter(Boolean);
    if (old.length) checks.push({ key: 'expiry', label: 'Expiry dates', state: 'fail', lines: old, detail: `Line${old.length === 1 ? '' : 's'} ${old.join(', ')} ${old.length === 1 ? 'expires' : 'expire'} before the invoice date.` });
  }

  const failed = checks.filter((c) => c.state === 'fail');
  const total = checks.find((c) => c.key === 'total');
  if (failed.length) return { status: 'REVIEW', headline: `Needs your review: ${failed[0].detail}`, checks };
  if (!total || total.state === 'skip') return { status: 'UNVERIFIED', headline: 'Could not be checked: no printed total was found. Check the lines against the invoice.', checks };
  return { status: 'RECONCILED', headline: `Reconciled: the lines add up to the printed total of ${money(printed as number)}.`, checks };
}

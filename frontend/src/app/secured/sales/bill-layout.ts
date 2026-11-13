/** The sign printed after the business name on the bill (the business chooses it under Settings > Business > Bill print). Same rule as the API's core/bill-layout. */
const MARK: { [k: string]: string } = { NONE: '', R: '®', TM: '™' };

export function nameWithSuffix(name: string, suffix: string | null | undefined): string {
  const mark = MARK[suffix || 'NONE'] ?? '';
  const n = String(name || '').trim();
  if (!mark || !n || n.endsWith(mark)) return n;
  return n + mark;
}

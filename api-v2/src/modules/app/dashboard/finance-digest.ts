/**
 * The owner's Monday money and health digest (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 4.6). Pure: the week's facts go in, a short plain text
 * (for Telegram) and the same as HTML (for e-mail, which the app cannot send yet) come out. It carries profit, so it goes to owners only.
 */
export interface DigestFinding { title: string; severity: string; amount?: number | null; store?: string; recovers?: number }
export interface DigestFacts {
  businessName?: string;
  health: { score: number | null; status: string | null; counts: { critical: number; major: number; minor: number; info: number }; fixFirst: DigestFinding[]; newThisWeek: number; lastWeekScore: number | null };
  month: { label: string; sales: number; runningCost: number; runningPct: number | null; profit: number | null; salesChange: number | null } | null;
  stock: { total: number; expired: number; expiring30: number; dead: number } | null;
  costFlags: string[];
}

const STATUS_TEXT: Record<string, string> = { act: 'Act now', watch: 'Watch', notes: 'A few notes', healthy: 'Healthy' };
const inr = (n: number) => 'Rs ' + Math.round(n).toLocaleString('en-IN');
const sign = (n: number) => (n > 0 ? '+' : '') + (Math.round(n * 10) / 10) + '%';

export function financeDigest(f: DigestFacts): { title: string; body: string; html: string } {
  const h = f.health;
  const status = h.status ? STATUS_TEXT[h.status] || h.status : 'No reading yet';
  const lines: string[] = [];
  const delta = h.score !== null && h.lastWeekScore !== null ? h.score - h.lastWeekScore : null;

  lines.push(`Health: ${status}${h.score !== null ? ` (${h.score}/100` + (delta === null ? ')' : delta === 0 ? ', same as last week)' : `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} from last week)`) : ''}`);
  lines.push(`Open: ${h.counts.critical} critical, ${h.counts.major} major, ${h.counts.minor} minor${h.newThisWeek ? `; ${h.newThisWeek} new this week` : ''}.`);

  if (h.fixFirst.length) {
    lines.push('', 'Fix first:');
    h.fixFirst.slice(0, 5).forEach((x, i) => lines.push(`${i + 1}. ${x.title}${x.store ? ` (${x.store})` : ''}${x.amount ? `, ${inr(x.amount)}` : ''} [${x.severity}]`));
  } else lines.push('', 'Nothing needs fixing first.');

  if (f.month) {
    const m = f.month;
    lines.push('', `${m.label} (before GST):`);
    lines.push(`Sales ${inr(m.sales)}${m.salesChange !== null ? ` (${sign(m.salesChange)} on the month before)` : ''}`);
    lines.push(`Running cost ${inr(m.runningCost)}${m.runningPct !== null ? ` (${m.runningPct}% of sales)` : ''}`);
    if (m.profit !== null) lines.push(`Estimated profit ${inr(m.profit)}`);
  }
  if (f.costFlags.length) { lines.push('', 'Costs above their usual share of sales:'); f.costFlags.forEach((c) => lines.push(`- ${c}`)); }
  if (f.stock && f.stock.total > 0) {
    const bits = [`Stock ${inr(f.stock.total)} at cost`];
    if (f.stock.expired > 0) bits.push(`${inr(f.stock.expired)} expired`);
    if (f.stock.expiring30 > 0) bits.push(`${inr(f.stock.expiring30)} expiring within 30 days`);
    if (f.stock.dead > 0) bits.push(`${inr(f.stock.dead)} with no sale in 90 days`);
    lines.push('', bits.join('; ') + '.');
  }

  const title = `Weekly money and health${f.businessName ? ` - ${f.businessName}` : ''}`;
  const body = lines.join('\n');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<h2>${esc(title)}</h2>` + lines.map((l) => (l === '' ? '' : `<p>${esc(l)}</p>`)).join('');
  return { title, body, html };
}

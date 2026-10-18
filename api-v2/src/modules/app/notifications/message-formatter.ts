import { ConsolidatedDigest, StoreDigest } from "./daily-digest.builder";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function change(now: number, prev: number): string {
  if (!prev) return now ? "new" : "–";
  const pct = ((now - prev) / prev) * 100;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
}

function prettyDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatStoreDaily(d: StoreDigest, date: string): string {
  const lines = [
    `<b>📊 ${esc(d.location)} — ${prettyDate(date)}</b>`,
    "",
    `🛒 Sales: <b>${money(d.sales)}</b> (${change(d.sales, d.prevsales)} vs yesterday)`,
    `🧾 Bills: ${d.bills}${d.bills ? ` · avg ${money(d.sales / d.bills)}` : ""}`,
  ];
  if (d.returns) lines.push(`↩️ Returned units: ${d.returns}`);
  if (d.topproducts.length) {
    lines.push("", "<b>Top sellers</b>");
    d.topproducts.forEach((p, i) => lines.push(`${i + 1}. ${esc(p.name)} × ${p.qty}`));
  }
  lines.push("", `🕒 Shifts closed: ${d.closedshifts}`);
  if (d.openshifts) lines.push(`⚠️ Shifts still open: ${d.openshifts}`);
  return lines.join("\n");
}

export function formatConsolidatedDaily(d: ConsolidatedDigest, date: string): string {
  const total = d.stores.reduce((a, s) => a + s.sales, 0);
  const bills = d.stores.reduce((a, s) => a + s.bills, 0);
  const prev = d.stores.reduce((a, s) => a + s.prevsales, 0);
  const lines = [
    `<b>🏢 All stores — ${prettyDate(date)}</b>`,
    "",
    `🛒 Sales: <b>${money(total)}</b> (${change(total, prev)} vs yesterday) · ${bills} bills`,
  ];
  const selling = d.stores.filter((s) => s.bills > 0).sort((a, b) => b.sales - a.sales);
  selling.forEach((s) => lines.push(`   • ${esc(s.location)}: ${money(s.sales)} (${s.bills})`));
  const idle = d.stores.length - selling.length;
  if (idle) lines.push(`   • ${idle} store(s) with no sales`);
  lines.push("", `📦 Purchases received: <b>${money(d.purchases)}</b> (${d.purchaseinvoices} invoices)`);
  const alerts: string[] = [];
  if (d.pendingapprovals) alerts.push(`⏳ ${d.pendingapprovals} PO(s) awaiting approval`);
  if (d.overdueinvoices) alerts.push(`❗ ${d.overdueinvoices} overdue vendor invoice(s)`);
  const open = d.stores.reduce((a, s) => a + s.openshifts, 0);
  if (open) alerts.push(`⚠️ ${open} shift(s) still open`);
  if (alerts.length) lines.push("", ...alerts);
  return lines.join("\n");
}

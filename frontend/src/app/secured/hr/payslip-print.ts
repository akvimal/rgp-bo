/** A clean page in a new window to print or save as PDF; false when the browser blocked the window. */
export function printPayslip(s: any): boolean {
  if (!s) return false;
  const e = (v: any) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);
  const n = (v: number) => (+v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const earn = (s.earnings || []).map((x: any) => `<tr><td>${e(x.name)}</td><td class="r">${n(x.full)}</td><td class="r">${n(x.paid)}</td></tr>`).join("");
  const ded: [string, number][] = [
    ...(s.deductions || []).map((x: any) => [x.name, x.amount] as [string, number]),
    ["Other deduction", s.extra_deduction], ["Staff credit recovered", s.staff_credit_recovery],
  ];
  const dedRows = ded.filter(d => +d[1] > 0).map(d => `<tr><td>${e(d[0])}</td><td class="r">${n(d[1])}</td></tr>`).join("");
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return false;
  w.document.write(`<html><head><title>Pay stub ${e(s.name)} ${s.period}</title><style>
    body{font-family:Arial,sans-serif;font-size:13px;margin:24px;color:#222} h2{margin:0} .muted{color:#666} table{width:100%;border-collapse:collapse;margin:10px 0}
    td,th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left} .r{text-align:right} .tot td{font-weight:bold;border-top:2px solid #222} .net{font-size:16px}
  </style></head><body>
    <h2>${e(s.business?.name)}</h2><div class="muted">${e(s.business?.address)}</div><hr>
    <h3>Pay stub for ${s.period}</h3>
    <table><tr><td>Name</td><td>${e(s.name)}</td><td>Code</td><td>${e(s.emp_code)}</td></tr>
    <tr><td>Designation</td><td>${e(s.designation)}</td><td>Joined</td><td>${s.join_date}</td></tr>
    <tr><td>Bank</td><td>${e(s.bank_name)} ${e(s.account_no)}</td><td>Days paid</td><td>${s.payable_days} of 30</td></tr></table>
    <table><tr><th>Earnings</th><th class="r">Full month</th><th class="r">Paid</th></tr>${earn}
      ${+s.kpi_incentive ? `<tr><td>Incentive</td><td></td><td class="r">${n(s.kpi_incentive)}</td></tr>` : ""}
      ${+s.adjustment ? `<tr><td>${e(s.adjustment_note || "Adjustment")}</td><td></td><td class="r">${n(s.adjustment)}</td></tr>` : ""}</table>
    <table><tr><th>Deductions</th><th class="r">Amount</th></tr>${dedRows || '<tr><td colspan="2" class="muted">None</td></tr>'}</table>
    <table><tr class="tot net"><td>Net pay</td><td class="r">${n(s.net)}</td></tr></table>
    <p class="muted">Computer generated; no signature needed.</p></body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

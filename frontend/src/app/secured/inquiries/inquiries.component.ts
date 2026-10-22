import { Component, OnInit } from "@angular/core";
import { InquiryApi } from "./inquiry.service";

/** Customer inquiries: record them at the counter, assign and follow them up, close with an outcome. */
@Component({ selector: "app-inquiries", templateUrl: "./inquiries.component.html" })
export class InquiriesComponent implements OnInit {
  rows: any[] = [];
  summary: any = { open: 0, overdue: 0, closed_this_month: 0 };
  opts: any = { stores: [], staff: [], canAssign: false, me: 0 };
  tab: "OPEN" | "OVERDUE" | "MINE" | "CLOSED" = "OPEN";
  search = "";
  message = "";
  error = "";

  form: any = null;
  closing: { id: number; outcome: string; note: string } | null = null;

  readonly kinds: [string, string][] = [["PRODUCT", "Product / availability"], ["PRICE", "Price"], ["MEDICAL", "Medical information"], ["ORDER", "Order request"], ["OTHER", "Other"]];
  readonly outcomes: [string, string][] = [["SOLD", "Sold"], ["ORDERED", "Ordered for the customer"], ["NOT_AVAILABLE", "Not available"], ["REFERRED", "Referred elsewhere"], ["ANSWERED", "Answered"], ["NO_RESPONSE", "No response from customer"], ["DROPPED", "Dropped"]];

  constructor(private api: InquiryApi) {}

  ngOnInit() {
    this.api.get("options").subscribe(o => this.opts = o);
    this.load();
  }

  load() {
    const q: any = {};
    if (this.tab === "CLOSED") q.status = "CLOSED";
    else { q.status = "OPEN"; if (this.tab === "OVERDUE") q.overdue = "true"; if (this.tab === "MINE") q.mine = "true"; }
    if (this.search.trim()) q.q = this.search.trim();
    this.api.get("", q).subscribe(r => this.rows = r, e => this.error = this.api.msg(e));
    this.api.get("summary").subscribe(s => this.summary = s);
  }

  setTab(t: any) { this.tab = t; this.load(); }

  kindLabel(k: string) { return this.kinds.find(x => x[0] === k)?.[1] || k; }
  outcomeLabel(o: string) { return this.outcomes.find(x => x[0] === o)?.[1] || o; }

  add() {
    this.message = this.error = "";
    this.closing = null;
    this.form = { id: 0, store_id: this.opts.stores.length === 1 ? this.opts.stores[0].id : null, kind: "PRODUCT", product_text: "", details: "", customer_name: "", mobile: "", due_on: this.api.tomorrow(), assigned_to: this.opts.me };
  }

  edit(r: any) {
    this.message = this.error = "";
    this.closing = null;
    this.form = { id: r.id, store_id: r.store_id, kind: r.kind, product_text: r.product_text || "", details: r.details, customer_name: r.customer_name || "", mobile: r.mobile || "", due_on: r.due_on, assigned_to: r.assigned_to };
  }

  save() {
    this.message = this.error = "";
    const f = this.form;
    const body: any = { kind: f.kind, product_text: f.product_text, details: f.details, customer_name: f.customer_name, mobile: f.mobile, due_on: f.due_on };
    if (!f.id) { body.store_id = f.store_id; body.assigned_to = f.assigned_to; }
    const req = f.id ? this.api.put(String(f.id), body) : this.api.post("", body);
    req.subscribe(() => {
      const reassign = f.id && this.opts.canAssign && f.assigned_to !== this.rows.find(r => r.id === f.id)?.assigned_to;
      const done = () => { this.message = f.id ? "Inquiry saved." : "Inquiry recorded."; this.form = null; this.load(); };
      reassign ? this.api.post(`${f.id}/assign`, { assigned_to: f.assigned_to }).subscribe(done, e => this.error = this.api.msg(e)) : done();
    }, e => this.error = this.api.msg(e));
  }

  startClose(r: any) { this.message = this.error = ""; this.form = null; this.closing = { id: r.id, outcome: "ANSWERED", note: "" }; }

  confirmClose() {
    const c = this.closing!;
    this.api.post(`${c.id}/close`, { outcome: c.outcome, closing_note: c.note }).subscribe(
      () => { this.message = "Inquiry closed."; this.closing = null; this.load(); }, e => this.error = this.api.msg(e));
  }

  reopen(r: any) {
    this.api.post(`${r.id}/reopen`).subscribe(() => { this.message = "Inquiry reopened."; this.load(); }, e => this.error = this.api.msg(e));
  }
}

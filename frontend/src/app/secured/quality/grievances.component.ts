import { Component, OnInit } from "@angular/core";
import { GrievancesService } from "./grievances.service";

const CATEGORIES = [
  { value: "SERVICE", label: "Service / behaviour" },
  { value: "PRODUCT_QUALITY", label: "Product quality / expiry" },
  { value: "WRONG_ITEM", label: "Wrong item given" },
  { value: "PRICING", label: "Pricing / billing" },
  { value: "STOCK", label: "Medicine not available" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "OTHER", label: "Other" },
];
const SOURCES = [
  { value: "COUNTER", label: "At the counter" },
  { value: "PHONE", label: "Phone call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "DELIVERY", label: "On delivery" },
  { value: "OTHER", label: "Other" },
];

@Component({
  selector: "app-grievances",
  templateUrl: "./grievances.component.html"
})
export class GrievancesComponent implements OnInit {
  readonly categories = CATEGORIES;
  readonly sources = SOURCES;
  readonly severities = ["HIGH", "MEDIUM", "LOW"];
  readonly statuses = [
    { value: "ACTIVE", label: "Open + in progress" },
    { value: "", label: "All" },
    { value: "OPEN", label: "Open" },
    { value: "IN_PROGRESS", label: "In progress" },
    { value: "RESOLVED", label: "Resolved" },
    { value: "CLOSED", label: "Closed" },
  ];

  filter: any = { status: "ACTIVE", category: "", severity: "", storeid: "", aboutuserid: "", overdue: false, q: "" };
  summary: any = null;
  rows: any[] = [];
  people: any[] = [];
  stores: any[] = [];
  loading = false;
  error = "";

  // new-grievance form
  showForm = false;
  form: any = this.blankForm();
  custQuery = "";
  custResults: any[] = [];
  pickedCustomer: any = null;
  billNo: number | null = null;
  billResults: any[] = [];
  pickedBill: any = null;
  formError = "";
  saving = false;

  // detail
  selected: any = null;
  newNote = "";
  resolution = "";
  showResolve = false;
  detailError = "";

  constructor(private readonly api: GrievancesService) {}

  ngOnInit() {
    this.api.people().subscribe(p => (this.people = p || []), () => {});
    this.api.stores().subscribe(s => { this.stores = s || []; if (this.stores.length === 1) this.form.storeid = this.stores[0].id; }, () => {});
    this.reload();
  }

  reload() {
    this.api.summary().subscribe(s => (this.summary = s), () => {});
    this.load();
  }

  load() {
    this.loading = true;
    this.error = "";
    this.api.list(this.filter).subscribe(
      rows => { this.rows = rows || []; this.loading = false; },
      err => { this.error = err?.error?.message || "Could not load grievances."; this.loading = false; }
    );
  }

  quick(kind: string) {
    this.filter = { status: "ACTIVE", category: "", severity: "", storeid: "", aboutuserid: "", overdue: false, q: "" };
    if (kind === "overdue") this.filter.overdue = true;
    else if (kind === "high") this.filter.severity = "HIGH";
    else if (kind === "OPEN" || kind === "IN_PROGRESS") this.filter.status = kind;
    else if (kind === "resolved") this.filter.status = "RESOLVED";
    this.load();
  }

  filterByPerson(userid: number) {
    this.filter = { status: "", category: "", severity: "", storeid: "", aboutuserid: userid, overdue: false, q: "" };
    this.load();
  }

  // ---- new grievance
  blankForm() {
    return { storeid: "", category: "SERVICE", severity: "MEDIUM", source: "COUNTER", summary: "", description: "", aboutuserid: "", assignedto: "" };
  }

  openForm() {
    this.showForm = true;
    this.formError = "";
    this.form = this.blankForm();
    if (this.stores.length === 1) this.form.storeid = this.stores[0].id;
    this.custQuery = ""; this.custResults = []; this.pickedCustomer = null;
    this.billNo = null; this.billResults = []; this.pickedBill = null;
  }

  searchCustomer() {
    if ((this.custQuery || "").trim().length < 3) { this.custResults = []; return; }
    this.api.customers(this.custQuery).subscribe(r => (this.custResults = r || []), () => {});
  }

  pickCustomer(c: any) { this.pickedCustomer = c; this.custResults = []; this.custQuery = ""; }

  searchBill() {
    if (!this.billNo) { this.billResults = []; return; }
    this.api.bills(this.billNo).subscribe(r => (this.billResults = r || []), () => {});
  }

  pickBill(b: any) {
    this.pickedBill = b; this.billResults = [];
    if (!this.pickedCustomer && b.customer_id) this.pickedCustomer = { id: b.customer_id, name: b.customer_name };
    if (!this.form.storeid && b.store_id) this.form.storeid = b.store_id;
  }

  save() {
    this.formError = "";
    if ((this.form.summary || "").trim().length < 5) { this.formError = "Describe the complaint in a few words."; return; }
    if (this.stores.length > 1 && !this.form.storeid) { this.formError = "Choose the store."; return; }
    const body: any = {
      category: this.form.category, severity: this.form.severity, source: this.form.source,
      summary: this.form.summary.trim(), description: (this.form.description || "").trim() || undefined,
    };
    if (this.form.storeid) body.storeid = +this.form.storeid;
    if (this.form.aboutuserid) body.aboutuserid = +this.form.aboutuserid;
    if (this.form.assignedto) body.assignedto = +this.form.assignedto;
    if (this.pickedCustomer) body.customerid = this.pickedCustomer.id;
    if (this.pickedBill) body.saleid = this.pickedBill.id;
    this.saving = true;
    this.api.create(body).subscribe(
      res => { this.saving = false; this.showForm = false; this.reload(); this.open(res.id); },
      err => { this.saving = false; this.formError = this.msg(err, "Could not save."); }
    );
  }

  // ---- detail
  open(id: number) {
    this.detailError = ""; this.showResolve = false; this.resolution = ""; this.newNote = "";
    this.api.get(id).subscribe(g => (this.selected = g), err => (this.error = this.msg(err, "Could not open.")));
  }

  closeDetail() { this.selected = null; }

  change(body: any) {
    this.detailError = "";
    this.api.update(this.selected.id, body).subscribe(
      g => { this.selected = g; this.showResolve = false; this.resolution = ""; this.reload(); },
      err => (this.detailError = this.msg(err, "Could not update."))
    );
  }

  resolve() { this.change({ status: "RESOLVED", resolution: this.resolution }); }

  addNote() {
    if ((this.newNote || "").trim().length < 2) return;
    this.api.addNote(this.selected.id, this.newNote).subscribe(
      g => { this.selected = g; this.newNote = ""; },
      err => (this.detailError = this.msg(err, "Could not add the note."))
    );
  }

  label(list: any[], value: string) { return list.find(x => x.value === value)?.label || value; }

  sevClass(s: string) { return s === "HIGH" ? "bg-danger" : s === "MEDIUM" ? "bg-warning text-dark" : "bg-secondary"; }
  statusClass(s: string) { return s === "OPEN" ? "bg-primary" : s === "IN_PROGRESS" ? "bg-info text-dark" : s === "RESOLVED" ? "bg-success" : "bg-secondary"; }

  private msg(err: any, fallback: string): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m.join(" ") : m || fallback;
  }
}

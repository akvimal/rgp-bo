import { Component, OnInit } from "@angular/core";
import { AuditService } from "./audit.service";

@Component({
  selector: "app-audit-log",
  templateUrl: "./audit-log.component.html"
})
export class AuditLogComponent implements OnInit {
  readonly pageSize = 50;
  readonly actionGroups = [
    { value: "", label: "All activity" },
    { value: "auth.login", label: "Sign-ins" },
    { value: "auth.login_failed", label: "Failed sign-ins" },
    { value: "sale.edit", label: "Bill edits" },
    { value: "sale.on_behalf", label: "Billed on behalf" },
    { value: "sale.acting_blocked", label: "Blocked as other user" },
    { value: "http.", label: "Other changes" },
  ];

  filter: any = { from: this.daysAgo(7), to: "", userid: "", action: "", offset: 0, limit: this.pageSize };
  users: any[] = [];
  rows: any[] = [];
  total = 0;
  loading = false;
  error = "";
  expanded: number | null = null;

  constructor(private readonly audit: AuditService) {}

  ngOnInit() {
    this.audit.users().subscribe(u => (this.users = u || []), () => {});
    this.load();
  }

  load(resetPage = false) {
    if (resetPage) this.filter.offset = 0;
    this.loading = true;
    this.error = "";
    this.audit.search(this.filter).subscribe(
      res => { this.rows = res.rows; this.total = res.total; this.loading = false; },
      err => { this.error = err?.error?.message || "Could not load the audit log."; this.loading = false; }
    );
  }

  get page() { return Math.floor(this.filter.offset / this.pageSize) + 1; }
  get pages() { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  go(delta: number) {
    const next = this.filter.offset + delta * this.pageSize;
    if (next < 0 || next >= this.total) return;
    this.filter.offset = next;
    this.load();
  }

  toggle(id: number) { this.expanded = this.expanded === id ? null : id; }

  badge(action: string): string {
    if (action === "auth.login_failed" || action === "sale.acting_blocked") return "bg-danger";
    if (action === "sale.edit" || action === "sale.on_behalf") return "bg-warning text-dark";
    if (action.startsWith("auth.")) return "bg-success";
    return "bg-secondary";
  }

  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

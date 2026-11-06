import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/**
 * Copy the business setup (business details, stores with shifts, staff logins) out to a file and back in. JSON is the full format;
 * Excel is the same thing laid out for typing. Importing is a preview first, then one all-or-nothing apply. Nothing is deleted, and each
 * new login gets a temporary password that is shown here once and kept nowhere.
 */
@Component({ templateUrl: "./config-transfer.component.html" })
export class ConfigTransferComponent {
  private readonly api = `${environment.apiHost}/config-profile`;

  profile: any = null;
  fileName = "";
  preview: any = null;
  result: any = null;
  busy = false;
  error = "";
  problems: string[] = [];

  constructor(private http: HttpClient) {}

  // ---- export
  download(path: string, filename: string, json = false) {
    this.error = "";
    this.http.get(`${this.api}/${path}`, { responseType: "blob" }).subscribe(
      (blob: Blob) => this.save(blob, filename),
      err => this.fail(err, "Could not download the file."));
  }

  private save(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- import
  reset() { this.profile = null; this.fileName = ""; this.preview = null; this.result = null; this.error = ""; this.problems = []; }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    this.reset();
    this.fileName = file.name;
    if (/\.xlsx$/i.test(file.name)) {
      const form = new FormData();
      form.append("file", file);
      this.busy = true;
      this.http.post(`${this.api}/read-xlsx`, form).subscribe(
        (p: any) => { this.profile = p; this.runPreview(); },
        err => this.fail(err, "Could not read the Excel file."));
    } else if (/\.json$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        try { this.profile = JSON.parse(String(reader.result)); } catch { this.error = "This is not a valid JSON file."; return; }
        this.runPreview();
      };
      reader.readAsText(file);
    } else {
      this.error = "Choose a .json or .xlsx file.";
    }
  }

  private runPreview() {
    this.busy = true;
    this.http.post(`${this.api}/preview`, this.profile).subscribe(
      (r: any) => { this.busy = false; this.preview = r; },
      err => this.fail(err, "Could not check the file."));
  }

  get canApply(): boolean { return !!this.preview && !this.busy && !this.preview.blockers.length && this.preview.changes > 0; }

  apply() {
    if (!this.canApply) return;
    this.busy = true; this.error = ""; this.problems = [];
    this.http.post(`${this.api}/apply`, this.profile).subscribe(
      (r: any) => { this.busy = false; this.result = r; this.preview = null; this.profile = null; },
      err => this.fail(err, "Nothing was changed."));
  }

  private fail(err: any, fallback: string) {
    this.busy = false;
    const body = err?.error;
    // an error answered to a blob download arrives as a blob; the text is not worth reading here
    this.problems = Array.isArray(body?.errors) ? body.errors : [];
    const m = body?.message;
    this.error = (Array.isArray(m) ? m.join(" ") : typeof m === "string" ? m : "") || fallback;
  }

  // ---- the temporary passwords
  copyPasswords() {
    const text = this.result.created.map((c: any) => `${c.email}\t${c.password}`).join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }

  downloadPasswords() {
    const csv = ["email,name,role,temporary password"].concat(this.result.created.map((c: any) => [c.email, c.fullName, c.role, c.password].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\r\n");
    this.save(new Blob([csv], { type: "text/csv" }), "new-logins.csv");
  }

  actionLabel(a: string): string { return a === "create" ? "New" : a === "update" ? "Changed" : a === "skip" ? "Skipped" : "No change"; }
  actionClass(a: string): string { return a === "create" ? "bg-success" : a === "update" ? "bg-primary" : a === "skip" ? "bg-warning text-dark" : "bg-secondary"; }
}

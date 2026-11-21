import { Component, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";

/** one upload section: the chosen file(s), what the preview found, and where it is */
interface Section { files: File[]; name: string; version: string; preview: any; busy: boolean; error: string; done: string; mapping: any }
const blank = (name = ""): Section => ({ files: [], name, version: "", preview: null, busy: false, error: "", done: "", mapping: null });

/**
 * Loads and refreshes the reference data behind Check brand and the price comparison: the brand dictionary (the CDCI files), the PMBI Jan Aushadhi price list
 * (its PDF) and other sellers' price lists (CSV or Excel, one list per seller). Each upload is shown first (what was found, what it would replace) and only
 * written when applied. A list with the same name is replaced; other lists stay. The Business Head only (the server checks as well).
 */
@Component({
  selector: "app-reference-data",
  template: `
    <div class="page-head"><h1>Reference data</h1></div>
    <p class="text-muted small">The brand dictionary (what a brand contains) and the price lists the shop compares its prices with. Upload a new file to refresh any of them.</p>
    <div *ngIf="error" class="alert alert-danger py-2">{{error}}</div>

    <!-- what is loaded now -->
    <div class="hist-card mb-4" data-testid="ref-loaded">
      <div class="hist-card-head">Loaded now</div>
      <table class="table table-sm mb-0">
        <thead><tr><th>List</th><th>Version</th><th class="text-end">Items</th><th class="text-end">Can be matched</th><th class="text-end">With selling price</th><th>Loaded</th><th></th></tr></thead>
        <tbody>
          <tr data-testid="ref-brands">
            <td><strong>Brand dictionary</strong><div class="small text-muted" *ngIf="status?.brands">{{status.brands.name}}</div></td>
            <td>{{status?.brands?.version || ''}}</td><td class="text-end">{{status?.brands ? (status.brands.loaded | number) : 'not loaded'}}</td><td class="text-end"></td><td class="text-end"></td>
            <td class="small">{{status?.brands?.importedOn | date:'dd MMM yyyy'}} <span *ngIf="status?.brands?.importedBy">by {{status.brands.importedBy}}</span></td><td></td>
          </tr>
          <tr *ngFor="let l of status?.lists" data-testid="ref-list">
            <td><strong>{{l.name}}</strong><div class="small text-muted">{{l.kind === 'PMBI' ? 'Jan Aushadhi (PDF)' : 'Other seller'}}</div></td>
            <td>{{l.version || ''}}</td><td class="text-end">{{l.rows | number}}</td><td class="text-end">{{l.matchable | number}}</td><td class="text-end">{{l.withSellingPrice | number}}</td>
            <td class="small">{{l.importedOn | date:'dd MMM yyyy'}} <span *ngIf="l.importedBy">by {{l.importedBy}}</span></td>
            <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" (click)="remove(l)" data-testid="ref-remove">Remove</button></td>
          </tr>
          <tr *ngIf="status && !status.lists.length"><td colspan="7" class="text-muted small">No price lists are loaded yet.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- other sellers: CSV or Excel -->
    <div class="hist-card mb-4" data-testid="ref-sheet">
      <div class="hist-card-head">Another seller's price list (CSV or Excel)</div>
      <div class="hist-card-body">
        <div class="small text-muted mb-2">One list per seller. The file needs a heading row with at least a product name and a price (MRP, selling price, or both). A composition column lets the list be matched with your products; without one, the brand dictionary is used where the product name is one of its brands.</div>
        <div class="row g-2 align-items-end">
          <div class="col-md-3"><label class="form-label">List name</label><input class="form-control" maxlength="200" [(ngModel)]="sheet.name" placeholder="e.g. Apollo Pharmacy" data-testid="ref-sheet-name"></div>
          <div class="col-md-3"><label class="form-label">Version / date (optional)</label><input class="form-control" maxlength="60" [(ngModel)]="sheet.version"></div>
          <div class="col-md-4"><label class="form-label">File</label><input type="file" class="form-control" accept=".csv,.tsv,.txt,.xlsx" (change)="pick(sheet, $event)" data-testid="ref-sheet-file"></div>
          <div class="col-md-2"><button type="button" class="btn btn-outline-primary w-100" (click)="previewSheet()" [disabled]="sheet.busy || !sheet.files.length || !sheet.name.trim()" data-testid="ref-sheet-preview">Preview</button></div>
        </div>
        <ng-container *ngTemplateOutlet="feedback; context: {s: sheet}"></ng-container>
        <div *ngIf="sheet.preview" class="mt-3" data-testid="ref-sheet-result">
          <div class="fw-semibold small mb-1">Which column is which</div>
          <div class="row g-2">
            <div class="col-6 col-md-3" *ngFor="let f of sheet.preview.fields">
              <label class="form-label small mb-0">{{f.label}}</label>
              <select class="form-select form-select-sm" [(ngModel)]="sheet.mapping[f.key]" (ngModelChange)="previewSheet(true)" [attr.data-testid]="'ref-map-' + f.key">
                <option [ngValue]="null">(none)</option>
                <option *ngFor="let h of sheet.preview.headers" [ngValue]="h">{{h}}</option>
              </select>
            </div>
          </div>
          <div class="mt-2 small">
            <strong>{{sheet.preview.rows | number}}</strong> product(s) of {{sheet.preview.lines | number}} line(s) can be loaded:
            {{sheet.preview.matchable | number}} with a composition and strength to match on<span *ngIf="sheet.preview.fromDictionary"> ({{sheet.preview.fromDictionary | number}} from the brand dictionary)</span>,
            {{sheet.preview.withSellingPrice | number}} with a selling price.
            <span *ngIf="sheet.preview.replaces" class="text-danger"> This replaces the list "{{sheet.preview.replaces.name}}" ({{sheet.preview.replaces.rows | number}} items).</span>
          </div>
          <table class="table table-sm small mt-2 mb-1" *ngIf="sheet.preview.sample?.length">
            <thead><tr><th>Product</th><th>Composition read</th><th>Pack</th><th class="text-end">MRP</th><th class="text-end">Sells at</th></tr></thead>
            <tbody><tr *ngFor="let r of sheet.preview.sample"><td>{{r.name}}</td><td>{{r.composition || 'none found'}}</td><td>{{r.unitSize}}</td><td class="text-end">{{r.mrp | number:'1.2-2'}}</td><td class="text-end">{{r.sellPrice | number:'1.2-2'}}</td></tr></tbody>
          </table>
          <ng-container *ngTemplateOutlet="problems; context: {p: sheet.preview}"></ng-container>
          <button type="button" class="btn btn-primary mt-2" (click)="applySheet()" [disabled]="sheet.busy || !sheet.preview.canApply" data-testid="ref-sheet-apply">{{sheet.preview.replaces ? 'Replace the list' : 'Load the list'}}</button>
        </div>
      </div>
    </div>

    <!-- PMBI Jan Aushadhi -->
    <div class="hist-card mb-4" data-testid="ref-pmbi">
      <div class="hist-card-head">PMBI Jan Aushadhi price list (PDF)</div>
      <div class="hist-card-body">
        <div class="small text-muted mb-2">The published product list (Sr. No., Drug Code, Generic Name, Unit Size, MRP). Products with an MRP of 0 are left out.</div>
        <div class="row g-2 align-items-end">
          <div class="col-md-3"><label class="form-label">List name</label><input class="form-control" maxlength="200" [(ngModel)]="pmbi.name"></div>
          <div class="col-md-3"><label class="form-label">Version / date (optional)</label><input class="form-control" maxlength="60" [(ngModel)]="pmbi.version"></div>
          <div class="col-md-4"><label class="form-label">PDF</label><input type="file" class="form-control" accept=".pdf,application/pdf" (change)="pick(pmbi, $event)" data-testid="ref-pmbi-file"></div>
          <div class="col-md-2"><button type="button" class="btn btn-outline-primary w-100" (click)="previewPmbi()" [disabled]="pmbi.busy || !pmbi.files.length" data-testid="ref-pmbi-preview">Preview</button></div>
        </div>
        <ng-container *ngTemplateOutlet="feedback; context: {s: pmbi}"></ng-container>
        <div *ngIf="pmbi.preview" class="mt-3" data-testid="ref-pmbi-result">
          <div class="small"><strong>{{pmbi.preview.rows | number}}</strong> products read from {{pmbi.preview.pages}} pages; {{pmbi.preview.matchable | number}} with a composition and strength to match on; {{pmbi.preview.leftOutZeroMrp | number}} left out (MRP 0).
            <span *ngIf="pmbi.preview.replaces" class="text-danger"> This replaces the list "{{pmbi.preview.replaces.name}}" ({{pmbi.preview.replaces.rows | number}} items).</span></div>
          <ng-container *ngTemplateOutlet="problems; context: {p: pmbi.preview}"></ng-container>
          <button type="button" class="btn btn-primary mt-2" (click)="applyPmbi()" [disabled]="pmbi.busy || !pmbi.preview.canApply" data-testid="ref-pmbi-apply">{{pmbi.preview.replaces ? 'Replace the list' : 'Load the list'}}</button>
        </div>
      </div>
    </div>

    <!-- brand dictionary -->
    <div class="hist-card mb-4" data-testid="ref-cdci">
      <div class="hist-card-head">Brand dictionary (Common Drug Codes for India files)</div>
      <div class="hist-card-body">
        <div class="small text-muted mb-2">Choose the unzipped files together: BrandMaster.txt and GenericMaster.txt are needed, with DrugFormMaster.txt and SupplierMaster.txt. The new files replace the dictionary; nothing else changes. Licence: CC BY 4.0, NRCeS / C-DAC.</div>
        <div class="row g-2 align-items-end">
          <div class="col-md-3"><label class="form-label">Version / date (optional)</label><input class="form-control" maxlength="60" [(ngModel)]="cdci.version" placeholder="e.g. 2026-08-31"></div>
          <div class="col-md-7"><label class="form-label">Files</label><input type="file" multiple class="form-control" accept=".txt" (change)="pick(cdci, $event, true)" data-testid="ref-cdci-file"></div>
          <div class="col-md-2"><button type="button" class="btn btn-outline-primary w-100" (click)="previewCdci()" [disabled]="cdci.busy || !cdci.files.length" data-testid="ref-cdci-preview">Preview</button></div>
        </div>
        <ng-container *ngTemplateOutlet="feedback; context: {s: cdci}"></ng-container>
        <div *ngIf="cdci.preview" class="mt-3" data-testid="ref-cdci-result">
          <div class="small"><strong>{{cdci.preview.usable | number}}</strong> brands can be loaded (of {{cdci.preview.brandRows | number}}; {{cdci.preview.leftOutNoGeneric | number}} have no generic in the files); {{cdci.preview.withStrength | number}} with a strength.
            <span *ngIf="cdci.preview.replaces" class="text-danger"> This replaces the dictionary now loaded ({{cdci.preview.replaces.loaded | number}} brands).</span></div>
          <button type="button" class="btn btn-primary mt-2" (click)="applyCdci()" [disabled]="cdci.busy || !cdci.preview.canApply" data-testid="ref-cdci-apply">Replace the dictionary</button>
        </div>
      </div>
    </div>

    <ng-template #feedback let-s="s">
      <div class="small text-muted mt-2" *ngIf="s.busy">Working... a large file can take a minute.</div>
      <div class="alert alert-danger py-1 small mt-2 mb-0" *ngIf="s.error">{{s.error}}</div>
      <div class="alert alert-success py-1 small mt-2 mb-0" *ngIf="s.done" data-testid="ref-done">{{s.done}}</div>
    </ng-template>
    <ng-template #problems let-p="p">
      <details class="small mt-1" *ngIf="p.problems?.length">
        <summary class="text-danger">{{p.problems.length + (p.moreProblems || 0)}} problem(s)</summary>
        <div *ngFor="let t of p.problems">{{t}}</div>
        <div *ngIf="p.moreProblems">and {{p.moreProblems}} more</div>
      </details>
    </ng-template>`
})
export class ReferenceDataComponent implements OnInit {
  private readonly api = `${environment.apiHost}/reference-data`;
  status: any = null;
  error = "";
  sheet = blank();
  pmbi = blank("PMBI Jan Aushadhi");
  cdci = blank();

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadStatus(); }

  loadStatus() {
    this.http.get<any>(`${this.api}/status`).subscribe(s => this.status = s, e => this.error = this.message(e, "Could not load what is loaded now."));
  }

  private message(e: any, fallback: string) { const m = e?.error?.message; return Array.isArray(m) ? m.join(" ") : (m || fallback); }

  pick(s: Section, ev: Event, many = false) {
    const input = ev.target as HTMLInputElement;
    s.files = Array.from(input.files || []).slice(0, many ? 8 : 1);
    s.preview = null; s.error = ""; s.done = ""; s.mapping = null;
  }

  private form(s: Section, extra: { [k: string]: any } = {}, many = false) {
    const f = new FormData();
    s.files.forEach(file => f.append(many ? "files" : "file", file));
    if (s.name.trim()) f.append("name", s.name.trim());
    if (s.version.trim()) f.append("version", s.version.trim());
    Object.keys(extra).forEach(k => { if (extra[k] !== undefined && extra[k] !== null) f.append(k, extra[k]); });
    return f;
  }

  /** runs a preview or an apply and keeps the section's state in step */
  private run(s: Section, path: string, body: FormData, ok: (r: any) => void) {
    s.busy = true; s.error = ""; s.done = "";
    this.http.post<any>(`${this.api}/${path}`, body).subscribe(
      r => { s.busy = false; ok(r); },
      e => { s.busy = false; s.error = this.message(e, "That did not work."); });
  }

  // ---- another seller's list
  previewSheet(keepMapping = false) {
    this.run(this.sheet, "sheet/preview", this.form(this.sheet, { mapping: keepMapping && this.sheet.mapping ? JSON.stringify(this.sheet.mapping) : undefined }), r => {
      this.sheet.preview = r;
      if (!keepMapping || !this.sheet.mapping) this.sheet.mapping = { ...r.mapping };
    });
  }
  applySheet() {
    this.run(this.sheet, "sheet/apply", this.form(this.sheet, { mapping: JSON.stringify(this.sheet.mapping || {}) }), r => {
      this.sheet.done = `Loaded ${r.rows} products as "${this.sheet.name.trim()}".`; this.sheet.preview = null; this.sheet.files = []; this.status = r.status;
    });
  }

  // ---- PMBI
  previewPmbi() { this.run(this.pmbi, "pmbi/preview", this.form(this.pmbi), r => this.pmbi.preview = r); }
  applyPmbi() {
    this.run(this.pmbi, "pmbi/apply", this.form(this.pmbi), r => { this.pmbi.done = `Loaded ${r.rows} products.`; this.pmbi.preview = null; this.pmbi.files = []; this.status = r.status; });
  }

  // ---- brand dictionary
  previewCdci() { this.run(this.cdci, "brands/preview", this.form(this.cdci, {}, true), r => this.cdci.preview = r); }
  applyCdci() {
    this.run(this.cdci, "brands/apply", this.form(this.cdci, {}, true), r => { this.cdci.done = `Loaded ${r.rows} brands.`; this.cdci.preview = null; this.cdci.files = []; this.status = r.status; });
  }

  remove(l: any) {
    if (!window.confirm(`Remove the list "${l.name}" (${l.rows} items)? It can be loaded again from its file.`)) return;
    this.http.delete<any>(`${this.api}/lists/${l.id}`).subscribe(s => this.status = s, e => this.error = this.message(e, "Could not remove the list."));
  }
}

import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { saveAs } from "file-saver";
import { FileUploadService } from "src/app/secured/documents/file-upload.service";
import { DisposalService } from "../disposal.service";

/**
 * One out-pass: what is going, why and how, who made and approved it, and the next step: approve or reject it (a Store Head or Business Head), then confirm
 * that the goods were handed over or destroyed (that is when the stock drops). A scheduled drug confirmed by someone who is not a manager needs a witness.
 */
@Component({
    template: `
    <div class="mt-2" *ngIf="p" data-testid="pass-detail">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <h5 class="m-0" data-testid="pass-no">{{p.pass_no}}</h5>
        <span class="badge" [ngClass]="badge(p.status)" data-testid="pass-status">{{statusText(p.status)}}</span>
        <span class="small text-muted">{{p.store}}</span>
        <span class="ms-auto"><button type="button" class="btn btn-outline-secondary btn-sm" (click)="print()" data-testid="pass-print"><i class="bi bi-printer me-1"></i>Print</button>
          <a routerLink=".." class="btn btn-outline-secondary btn-sm ms-1">All out-passes</a></span>
      </div>
      <div class="alert alert-danger py-2" *ngIf="error" data-testid="pass-detail-error">{{error}}</div>
      <div class="alert alert-info py-2 small" *ngIf="p.status === 'APPROVED'">Approved: the quantities below are held (still on the books, not saleable). The stock drops when you confirm the goods were handed over or destroyed.</div>
      <div class="alert alert-warning py-2 small" *ngIf="p.decision_note && (p.status === 'REJECTED' || p.status === 'CANCELLED')">{{p.decision_note}}</div>

      <div class="row g-2 small mb-2">
        <div class="col-6 col-md-3"><div class="text-muted">Why</div><b>{{p.reason_label}}</b></div>
        <div class="col-6 col-md-3"><div class="text-muted">How</div><b>{{p.method_label}}</b><span *ngIf="p.agency"> - {{p.agency}}</span></div>
        <div class="col-6 col-md-3"><div class="text-muted">Made by</div><b>{{p.prepared_by_name}}</b> <span class="text-muted ms-1">{{p.prepared_on | date:'dd MMM yyyy'}}</span></div>
        <div class="col-6 col-md-3"><div class="text-muted">Approved by</div><b>{{p.approved_by_name || '-'}}</b></div>
        <div class="col-6 col-md-3" *ngIf="p.confirmed_by_name"><div class="text-muted">Handed over by</div><b>{{p.confirmed_by_name}}</b> <span class="text-muted">{{p.handed_on | date:'dd MMM yyyy'}}</span></div>
        <div class="col-6 col-md-3" *ngIf="p.witness_name"><div class="text-muted">Witness</div><b>{{p.witness_name}}</b></div>
        <div class="col-12" *ngIf="p.notes"><span class="text-muted">Notes:</span> {{p.notes}}</div>
      </div>

      <table class="table table-sm align-middle" data-testid="pass-lines">
        <thead class="table-light"><tr><th>Product</th><th>Batch</th><th>Expiry</th><th class="text-end">Qty</th><th class="text-end">At cost</th><th class="text-end">GST on cost</th><th class="text-end">At MRP</th><th>Register</th></tr></thead>
        <tbody>
          <tr *ngFor="let l of p.lines" data-testid="pass-detail-line">
            <td>{{l.title}} <span class="badge bg-danger" *ngIf="l.schedule">{{l.schedule}}</span></td><td>{{l.batch}}</td><td>{{l.exp_date | date:'MMM-yy'}}</td>
            <td class="text-end">{{l.qty}}</td><td class="text-end">{{l.cost_value | number:'1.2-2'}}</td><td class="text-end">{{l.tax_value | number:'1.2-2'}}</td><td class="text-end">{{l.mrp_value | number:'1.2-2'}}</td>
            <td class="small"><span *ngIf="l.reg_serial" data-testid="pass-reg">{{l.reg_schedule}} no. {{l.reg_serial}}</span></td>
          </tr>
          <tr class="fw-semibold"><td colspan="3">Total</td><td class="text-end">{{p.totals.qty}}</td><td class="text-end">{{p.totals.cost | number:'1.2-2'}}</td><td class="text-end">{{p.totals.tax | number:'1.2-2'}}</td><td class="text-end">{{p.totals.mrp | number:'1.2-2'}}</td><td></td></tr>
        </tbody>
      </table>

      <div class="d-flex flex-wrap gap-2" *ngIf="p.can.approve || p.can.cancel">
        <button type="button" class="btn btn-success btn-sm" *ngIf="p.can.approve" [disabled]="busy" (click)="approve()" data-testid="pass-approve">Approve</button>
        <button type="button" class="btn btn-outline-danger btn-sm" *ngIf="p.can.reject" (click)="rejecting = !rejecting" data-testid="pass-reject-open">Reject</button>
        <button type="button" class="btn btn-outline-secondary btn-sm" *ngIf="p.can.cancel" [disabled]="busy" (click)="cancel()" data-testid="pass-cancel">Cancel this out-pass</button>
      </div>
      <div class="row g-2 align-items-end mt-1" *ngIf="rejecting">
        <div class="col-md-6"><label class="form-label small mb-0">Why is it rejected? *</label><input class="form-control form-control-sm" maxlength="200" [(ngModel)]="note" data-testid="pass-reject-note"></div>
        <div class="col-auto"><button type="button" class="btn btn-danger btn-sm" [disabled]="busy" (click)="reject()" data-testid="pass-reject-go">Reject</button></div>
      </div>

      <div class="border rounded p-3 mt-3" *ngIf="p.status === 'APPROVED'" data-testid="pass-confirm-box">
        <div class="fw-semibold mb-2">The goods have been handed over or destroyed</div>
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label small mb-0">Day they left</label><input type="date" class="form-control form-control-sm" [max]="today" [(ngModel)]="handedOn" data-testid="pass-handed-on"></div>
          <div class="col-md-4" *ngIf="p.witness_needed"><label class="form-label small mb-0">Witness (another staff member) *</label>
            <select class="form-select form-select-sm" [(ngModel)]="witnessId" data-testid="pass-witness"><option [ngValue]="null">Choose</option><option *ngFor="let w of witnesses" [ngValue]="w.id">{{w.name}}</option></select>
            <div class="form-text">A scheduled drug (H, H1, X) confirmed by someone who is not a Store Head or Business Head needs a witness.</div></div>
          <div class="col-md-5"><label class="form-label small mb-0">Photo or receipt <span class="text-muted">(optional)</span></label><input type="file" class="form-control form-control-sm" accept=".pdf,.jpg,.jpeg,.png" (change)="upload($event)"><div class="small text-success" *ngIf="evidence">Attached</div></div>
          <div class="col-12"><button type="button" class="btn btn-primary" [disabled]="busy" (click)="confirm()" data-testid="pass-confirm">Confirm: stock drops by {{p.totals.qty}} unit{{p.totals.qty === 1 ? '' : 's'}}</button></div>
        </div>
      </div>
    </div>`
})
export class DisposalDetailComponent implements OnInit {
    p: any = null;
    error = "";
    busy = false;
    rejecting = false;
    note = "";
    handedOn = "";
    witnessId: number | null = null;
    witnesses: any[] = [];
    evidence = "";
    readonly today = new Date().toISOString().slice(0, 10);

    constructor(private route: ActivatedRoute, private service: DisposalService, private files: FileUploadService) {}

    ngOnInit() { this.route.params.subscribe(p => this.load(+p["id"])); }

    private load(id: number) {
        this.error = ""; this.rejecting = false; this.note = ""; this.witnessId = null; this.evidence = ""; this.handedOn = this.today;
        this.service.get(id).subscribe((p: any) => {
            this.p = p;
            if (p.status === "APPROVED" && p.witness_needed) this.service.witnesses(p.store_id).subscribe((w: any) => this.witnesses = w || [], () => this.witnesses = []);
        }, (e: any) => this.error = this.service.msg(e, "That out-pass could not be loaded."));
    }

    private run(call: any) {
        this.busy = true; this.error = "";
        call.subscribe((p: any) => { this.busy = false; this.load(p.id); }, (e: any) => { this.busy = false; this.error = this.service.msg(e); });
    }

    approve() { this.run(this.service.approve(this.p.id)); }
    reject() { this.run(this.service.reject(this.p.id, this.note)); }
    cancel() { this.run(this.service.cancel(this.p.id)); }
    confirm() { this.run(this.service.confirm(this.p.id, { handed_on: this.handedOn, witness_id: this.witnessId, evidence_path: this.evidence || undefined })); }

    upload(event: any) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        this.files.upload(file, `disposal=${this.p.id}-${Date.now()}`).subscribe((r: any) => this.evidence = r?.path || "", () => this.error = "Could not upload the file.");
    }

    print() { this.service.pdf(this.p.id).subscribe((b: Blob) => saveAs(b, `${this.p.pass_no}.pdf`), () => this.error = "The out-pass could not be printed."); }

    statusText(s: string) { return ({ DRAFT: "Waiting for approval", APPROVED: "Approved: goods not handed over", CONFIRMED: "Handed over", REJECTED: "Rejected", CANCELLED: "Cancelled" } as any)[s] || s; }
    badge(s: string) { return s === "CONFIRMED" ? "bg-success" : s === "APPROVED" ? "bg-warning text-dark" : s === "DRAFT" ? "bg-info text-dark" : "bg-secondary"; }
}

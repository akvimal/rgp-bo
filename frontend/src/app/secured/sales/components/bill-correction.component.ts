import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { SaleService } from "../sales.service";

/**
 * Correct a completed bill's payment (cash / digital), who served and its prescription detail, in the shift it was rung in.
 * Two steps: "Review" asks the server what would change and shows the warnings; "Save correction" (with a reason) makes the change.
 */
@Component({
  selector: 'app2-bill-correction',
  templateUrl: 'bill-correction.component.html'
})
export class BillCorrectionComponent implements OnInit {
  @Input() saleId = 0;
  /** the bill's customer, so the prescription panel can offer what is on record for them */
  @Input() customer: any = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();

  methods = ['UPI', 'Card', 'Wallet', 'Other'];
  loading = true;
  busy = false;
  error = '';
  info: any = null;

  cash = 0;
  digital = 0;
  method = '';
  refno = '';
  servedBy: number | null = null;
  detail: any = {};
  docs: any[] = [];
  reason = '';

  /** the answer of the review step: what would change and the warnings, until the person saves or goes back */
  review: { changes: string[]; warnings: string[] } | null = null;

  constructor(private service: SaleService) {}

  ngOnInit() {
    this.service.correctionInfo(this.saleId).subscribe({
      next: (i: any) => {
        this.info = i; this.loading = false;
        this.cash = +i.cash || 0; this.digital = +i.digital || 0; this.method = i.digimethod || ''; this.refno = i.digirefno || '';
        this.servedBy = i.servedby; this.detail = { ...(i.scheduledetail || {}) }; this.docs = [...(i.documents || [])];
      },
      error: (e: any) => { this.loading = false; this.error = e?.error?.message || 'The bill could not be loaded.'; }
    });
  }

  /** what the customer paid in all: cash and digital move against each other */
  get paid(): number { return Math.round(((+this.info?.cash || 0) + (+this.info?.digital || 0)) * 100) / 100; }

  onCash() { this.cash = Math.max(0, +this.cash || 0); this.digital = Math.max(0, Math.round((this.paid - this.cash) * 100) / 100); }
  onDigital() { this.digital = Math.max(0, +this.digital || 0); this.cash = Math.max(0, Math.round((this.paid - this.digital) * 100) / 100); }
  allTo(kind: 'cash' | 'digital') { if (kind === 'cash') { this.cash = this.paid; this.digital = 0; } else { this.cash = 0; this.digital = this.paid; } }

  private body(ack: boolean) {
    return {
      cashamt: this.cash, digiamt: this.digital, digimethod: this.digital > 0 ? this.method : null, digirefno: this.digital > 0 ? this.refno : null,
      actinguserid: this.servedBy, ...(this.info?.scheduled?.length ? { scheduledetail: this.detail, documents: this.docs } : {}),
      reason: this.reason.trim(), ack
    };
  }

  doReview() {
    this.error = ''; this.busy = true;
    this.service.correctBill(this.saleId, this.body(false)).subscribe({
      next: (r: any) => { this.busy = false; this.review = { changes: r.changes, warnings: r.warnings }; },
      error: (e: any) => { this.busy = false; this.error = e?.error?.message || 'The bill could not be checked.'; }
    });
  }

  save() {
    this.error = '';
    if (this.reason.trim().length < 3) { this.error = 'Say why the bill is being corrected.'; return; }
    this.busy = true;
    this.service.correctBill(this.saleId, this.body(true)).subscribe({
      next: (r: any) => { this.busy = false; this.saved.emit(r); },
      error: (e: any) => { this.busy = false; this.error = e?.error?.message || 'The correction could not be saved.'; }
    });
  }

  onUploaded(doc: any) { if (doc) this.docs = [...this.docs, doc]; }
  onDetached(id: number) { this.docs = this.docs.filter((d: any) => +d.id !== +id); }
}

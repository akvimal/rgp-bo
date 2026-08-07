import { Component, OnInit } from "@angular/core";
import { StoreContextService } from "src/app/@core/store-context.service";
import { CashService } from "../../cash/cash.service";

@Component({
  templateUrl: './shifts.component.html'
})
export class ShiftsComponent implements OnInit {
  stores:any[] = [];
  users:any[] = [];
  templates:any[] = [];
  shifts:any[] = [];
  selectedStoreId:number | null = null;
  message:string = '';
  shiftForm:any = {
    storeid: '',
    templateid: '',
    assigneduserid: '',
    shiftdate: new Date().toISOString().slice(0, 10),
    openingcash: 0,
    notes: ''
  };

  showReportModal = false;
  reportLoading = false;
  shiftReport:any = null;
  countedCash:number | null = null;
  closing = false;

  constructor(private cashService:CashService, private storeContext: StoreContextService) {}

  ngOnInit(): void {
    this.storeContext.stores$.subscribe((stores:any) => {
      this.stores = stores || [];
    });
    this.storeContext.selectedStoreId$.subscribe((selected:any) => {
      this.selectedStoreId = selected;
      this.loadUsers();
    });
  }

  loadUsers() {
    this.cashService.getUsers().subscribe((users:any) => {
      this.users = users || [];
      this.refresh();
    });
  }

  syncForms() {
    this.shiftForm.storeid = this.selectedStoreId;
  }

  refresh() {
    this.syncForms();
    this.cashService.getTemplates(this.selectedStoreId).subscribe((templates:any) => {
      this.templates = templates || [];
    });
    this.cashService.getShifts(this.selectedStoreId).subscribe((shifts:any) => {
      this.shifts = shifts || [];
    });
  }

  saveShift() {
    this.message = '';
    this.syncForms();
    if (!this.selectedStoreId) {
      this.message = 'Select a store in the header to open a shift.';
      return;
    }
    const payload = {
      ...this.shiftForm,
      openingcash: Number(this.shiftForm.openingcash || 0),
      assigneduserid: this.shiftForm.assigneduserid || null
    };
    this.cashService.createShift(payload).subscribe(() => {
      this.shiftForm.templateid = '';
      this.shiftForm.assigneduserid = '';
      this.shiftForm.openingcash = 0;
      this.shiftForm.notes = '';
      this.refresh();
    }, err => this.message = err?.error?.message || 'Unable to open shift');
  }

  assignShift(shift:any, event:any) {
    this.cashService.assignShift(shift.id, { assigneduserid: event.target.value || null }).subscribe(() => this.refresh());
  }

  viewReport(shift:any) {
    this.shiftReport = null;
    this.countedCash = null;
    this.closing = shift.status === 'OPEN';
    this.showReportModal = true;
    this.reportLoading = true;
    this.cashService.getShiftReport(shift.id).subscribe(
      (report:any) => { this.shiftReport = report; this.reportLoading = false; },
      () => { this.reportLoading = false; }
    );
  }

  confirmClose() {
    if (!this.shiftReport || this.countedCash === null) return;
    const shiftId = this.shiftReport.shift.id;
    this.cashService.closeShift(shiftId, { countedcash: this.countedCash, notes: this.shiftReport.shift.notes || '' })
      .subscribe(() => {
        this.showReportModal = false;
        this.refresh();
      }, err => this.message = err?.error?.message || 'Unable to close shift');
  }

  get expectedCash(): number {
    return Number(this.shiftReport?.shift?.expectedcash || 0);
  }

  get variance(): number | null {
    if (this.countedCash === null || this.countedCash === undefined) return null;
    return Number(this.countedCash) - this.expectedCash;
  }
}

import { Component, OnInit } from "@angular/core";
import { ConfirmationService } from "primeng/api";
import { StoreContextService } from "src/app/@core/store-context.service";
import { ShiftContextService } from "src/app/@core/shift-context.service";
import { CashService } from "../../cash/cash.service";
import { DenominationRow, suggestVaultDrop } from "src/app/shared/denominations";
import { EXPENSE_CATEGORIES } from "../../cash/expense-categories";

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
    notes: ''
  };
  openingDenoms:DenominationRow[] = [];
  openingTotal = 0;

  showReportModal = false;
  reportLoading = false;
  shiftReport:any = null;
  countedDenoms:DenominationRow[] = [];
  countedTotal = 0;
  closing = false;

  constructor(
    private cashService:CashService,
    private storeContext: StoreContextService,
    private shiftContext: ShiftContextService,
    private confirmation: ConfirmationService,
  ) {}

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
    this.shiftContext.refresh(this.selectedStoreId);
  }

  saveShift() {
    this.message = '';
    this.syncForms();
    if (!this.selectedStoreId) {
      this.message = 'Select a store in the header to open a shift.';
      return;
    }
    if (this.openingTotal <= 0) {
      this.confirmation.confirm({
        header: 'Open with no float?',
        message: 'No opening cash has been counted. Open this shift with a &#8377;0 float?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Open with &#8377;0',
        rejectLabel: 'Cancel',
        accept: () => this.submitShift(true),
      });
      return;
    }
    this.submitShift(false);
  }

  private submitShift(allowZero: boolean) {
    const payload = {
      ...this.shiftForm,
      openingdenominations: this.openingDenoms,
      openingcash: this.openingTotal,
      assigneduserid: this.shiftForm.assigneduserid || null,
      allowZero,
    };
    this.cashService.createShift(payload).subscribe(() => {
      this.shiftForm.templateid = '';
      this.shiftForm.assigneduserid = '';
      this.shiftForm.notes = '';
      this.openingDenoms = [];
      this.openingTotal = 0;
      this.refresh();
    }, err => this.message = err?.error?.message || 'Unable to open shift');
  }

  assignShift(shift:any, event:any) {
    this.cashService.assignShift(shift.id, { assigneduserid: event.target.value || null }).subscribe(() => this.refresh());
  }

  // ---- the vault drop at the end of the day (stores that keep a vault): the surplus over the float goes in, or a reason is given
  vault:any = null;
  dropRows:DenominationRow[] = [];
  dropTotal = 0;
  dropSkipReason = '';
  closeError = '';
  closeBusy = false;

  get vaultOn(): boolean { return !!this.vault?.enabled && !this.vault?.dropped; }
  get surplus(): number { return Math.max(0, this.countedTotal - Number(this.vault?.floatamount || 0)); }
  get dropOverCount(): boolean { return this.dropRows.some(r => Number(r.n) > (this.countedDenoms.find(c => c.d === r.d)?.n || 0)); }
  get dropNeedsConfirm(): boolean { return Number(this.vault?.confirmlimit || 0) > 0 && this.dropTotal > Number(this.vault.confirmlimit); }
  fillDrop() { this.dropRows = suggestVaultDrop(this.countedDenoms, Number(this.vault?.floatamount || 0), this.vault?.floatdenominations); }
  get vaultReady(): boolean {
    if (!this.vaultOn || this.surplus <= 0) return true;
    if (this.dropTotal > 0) return !this.dropOverCount;
    return this.dropSkipReason.trim().length > 0;
  }

  /** an expense paid from this shift's drawer that was not recorded on the day (a manager closing someone else's shift adds it before counting) */
  readonly categories = EXPENSE_CATEGORIES;
  expenseForm:any = null;
  expenseError = '';

  addExpense() { this.expenseError = ''; this.expenseForm = { amount: null, expensecategory: this.categories[0]?.value || '', description: '' }; }

  saveExpense() {
    const f = this.expenseForm; const shift = this.shiftReport?.shift;
    if (!f || !shift) return;
    if (!(Number(f.amount) > 0)) { this.expenseError = 'Enter the amount paid out.'; return; }
    if (!String(f.description || '').trim()) { this.expenseError = 'Say what it was for.'; return; }
    this.expenseError = '';
    this.cashService.saveLedger({ storeid: shift.storeid, shiftid: shift.id, category: 'EXPENSE', withdraw: Number(f.amount), expensecategory: f.expensecategory, description: f.description })
      .subscribe(() => {
        this.expenseForm = null;
        // the expected cash moves with it: read the report again, keeping what has been counted
        this.cashService.getShiftReport(shift.id).subscribe((r:any) => this.shiftReport = r, () => {});
      }, (e:any) => { const m = e?.error?.message; this.expenseError = Array.isArray(m) ? m.join(' ') : (m || 'Could not record the expense.'); });
  }

  /** why the shift detail could not be opened (blank when it opened) */
  reportError = '';

  viewReport(shift:any) {
    this.shiftReport = null;
    this.countedDenoms = [];
    this.countedTotal = 0;
    this.closing = shift.status === 'OPEN';
    this.showReportModal = true;
    this.reportLoading = true;
    this.reportError = '';
    this.expenseForm = null; this.expenseError = '';
    this.vault = null; this.dropRows = []; this.dropTotal = 0; this.dropSkipReason = ''; this.closeError = ''; this.closeBusy = false;
    if (shift.status === 'OPEN') this.cashService.getShiftSummary(shift.id).subscribe((s:any) => this.vault = s?.vault || null, () => {});
    this.cashService.getShiftReport(shift.id).subscribe(
      (report:any) => { this.shiftReport = report; this.reportLoading = false; },
      (err:any) => {
        this.reportLoading = false;
        // never an empty dialog: say what went wrong (a missing right, a shift that is gone, or a fault)
        const m = err?.error?.message;
        const server = Array.isArray(m) ? m.join(' ') : (typeof m === 'string' ? m : '');
        this.reportError = err?.status === 403 ? 'You do not have access to this shift.'
          : err?.status === 404 ? 'This shift could not be found.'
          : err?.status === 0 ? 'Cannot reach the server. Check the connection and try again.'
          : (server || 'The shift could not be opened. Please try again, and tell your administrator if it keeps happening.');
      }
    );
  }

  confirmClose() {
    if (!this.shiftReport || !this.countedDenoms.length) return;
    const shiftId = this.shiftReport.shift.id;
    if (!this.vaultReady) { this.closeError = this.dropOverCount ? 'The vault cash has more of a note than the drawer count.' : 'Put the surplus in the vault, or say why it stays in the drawer.'; return; }
    this.closeError = ''; this.closeBusy = true;
    this.cashService.closeShift(shiftId, {
      counteddenominations: this.countedDenoms, notes: this.shiftReport.shift.notes || '',
      ...(this.vaultOn && this.surplus > 0 ? (this.dropTotal > 0 ? { vaultdrop: { denominations: this.dropRows } } : { vaultdropskipreason: this.dropSkipReason.trim() }) : {})
    }).subscribe(() => {
        this.closeBusy = false;
        this.showReportModal = false;
        this.refresh();
      }, err => {
        // said inside the dialog, where the person is looking (a message at the foot of the page hides behind it)
        this.closeBusy = false;
        const m = err?.error?.message;
        this.closeError = Array.isArray(m) ? m.join(' ') : (m || 'Unable to close the shift.');
      });
  }

  reportDenoms = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

  /** what a recorded checklist is called on the report */
  checklistTitle(kind:string): string {
    return ({ OPENING: 'Opening the store', OPENING_OPEN_STORE: 'Taking up the shift (store already open)', CLOSING: 'Closing the store', HANDOVER: 'Handing over the shift' } as any)[kind] || kind;
  }

  denomCount(rows:any[], d:number): number {
    const row = (rows || []).find((r:any) => Number(r?.d) === d);
    return row ? Number(row.n) || 0 : 0;
  }

  get expectedCash(): number {
    return Number(this.shiftReport?.shift?.expectedcash || 0);
  }

  get variance(): number | null {
    if (!this.countedDenoms.length) return null;
    return this.countedTotal - this.expectedCash;
  }
}

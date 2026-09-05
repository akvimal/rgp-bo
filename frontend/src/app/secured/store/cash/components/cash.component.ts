import { Component, OnInit } from "@angular/core";
import { StoreContextService } from "src/app/@core/store-context.service";
import { CashService } from "../cash.service";
import { FileUploadService } from "src/app/secured/documents/file-upload.service";
import { EXPENSE_CATEGORIES } from "../expense-categories";

@Component({
    templateUrl: './cash.component.html'
})
export class CashComponent implements OnInit {
    stores:any[] = [];
    selectedStore:any = { depositthreshold: 0, location: '' };
    selectedStoreId:number | null = null;
    dashboard:any = { openShift: null };
    ledger:any[] = [];
    loading:boolean = false;
    message:string = '';
    expenseCategories = EXPENSE_CATEGORIES;
    expenseSummary:any[] = [];
    ledgerForm:any = {
      storeid: '',
      shiftid: '',
      transdate: new Date().toISOString().slice(0, 10),
      category: 'EXPENSE',
      description: '',
      deposit: 0,
      withdraw: 0,
      referenceno: '',
      expensecategory: '',
      receiptpath: ''
    };

    constructor(private cashService:CashService, private storeContext: StoreContextService, private fileUploadService: FileUploadService){}

    ngOnInit(): void {
      this.storeContext.stores$.subscribe((stores:any) => {
        this.stores = stores || [];
        this.selectedStore = this.stores.find((store:any) => store.id === this.selectedStoreId) || this.selectedStore;
      });
      this.storeContext.selectedStoreId$.subscribe((selected:any) => {
        this.selectedStoreId = selected;
        this.selectedStore = this.stores.find((store:any) => store.id === this.selectedStoreId) || { depositthreshold: 0, location: '' };
        this.refresh();
      });
    }

    refresh() {
      this.loading = true;
      this.ledgerForm.storeid = this.selectedStoreId;
      this.cashService.getDashboard(this.selectedStoreId).subscribe((data:any) => {
        this.dashboard = data || { openShift: null };
        this.ledger = this.dashboard.ledger || [];
        this.ledgerForm.shiftid = this.dashboard.openShift?.id || '';
        this.selectedStore = this.dashboard.store || this.selectedStore;
        this.loading = false;
      }, () => this.loading = false);
      this.cashService.getExpenseSummary(this.selectedStoreId).subscribe((data:any) => {
        this.expenseSummary = data || [];
      }, () => this.expenseSummary = []);
    }

    onReceiptSelected(event:any) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      this.fileUploadService.upload(file, `expense=${this.selectedStoreId || 'na'}-${Date.now()}`).subscribe((res:any) => {
        this.ledgerForm.receiptpath = res?.path || '';
      }, () => this.message = 'Unable to upload the receipt.');
    }

    saveLedger() {
      this.message = '';
      this.ledgerForm.storeid = this.selectedStoreId;
      if (!this.selectedStoreId) {
        this.message = 'Select a store in the header to add cash movements.';
        return;
      }
      let deposit = Number(this.ledgerForm.deposit || 0);
      let withdraw = Number(this.ledgerForm.withdraw || 0);
      if (this.ledgerForm.category === 'BANK_DEPOSIT' && withdraw === 0 && deposit > 0) {
        withdraw = deposit;
        deposit = 0;
      }
      const payload = {
        ...this.ledgerForm,
        deposit,
        withdraw
      };
      this.cashService.saveLedger(payload).subscribe(() => {
        this.ledgerForm.description = '';
        this.ledgerForm.deposit = 0;
        this.ledgerForm.withdraw = 0;
        this.ledgerForm.referenceno = '';
        this.ledgerForm.expensecategory = '';
        this.ledgerForm.receiptpath = '';
        this.refresh();
      }, err => this.message = err?.error?.message || 'Unable to save cash movement');
    }

    openShiftLabel() {
      return this.dashboard?.openShift ? `${this.dashboard.openShift.name} (${this.dashboard.openShift.shiftdate})` : 'No open shift';
    }

    currentCashBalance() {
      return Number(this.dashboard?.cashbalance || 0);
    }

    depositThreshold() {
      return Number(this.dashboard?.depositthreshold || this.selectedStore?.depositthreshold || 0);
    }

    depositDue() {
      return !!this.dashboard?.depositdue;
    }

    depositExcess() {
      return Number(this.dashboard?.depositexcess || 0);
    }
}

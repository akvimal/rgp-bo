import { Component, OnInit } from "@angular/core";
import { CashService } from "src/app/secured/store/cash/cash.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
  templateUrl: './store-settings.component.html'
})
export class StoreSettingsComponent implements OnInit {
  stores:any[] = [];
  businesses:any[] = [];
  users:any[] = [];
  templates:any[] = [];
  selectedStoreId:any = '';
  selectedStore:any = { depositthreshold: 0, location: '' };
  message:string = '';
  savingPolicy:boolean = false;
  savingStore:boolean = false;
  activeTab:'master' | 'policy' | 'templates' = 'master';
  storeForm:any = {
    id: null,
    businessid: '',
    location: '',
    depositthreshold: 0,
    isActive: true
  };
  templateForm:any = {
    id: null,
    storeid: '',
    name: 'Morning',
    starttime: '09:00',
    endtime: '17:00',
    depositthreshold: 10000,
    assigneduserid: '',
    active: true
  };

  constructor(private cashService: CashService, private confirm: ConfirmService) {}

  ngOnInit(): void {
    this.cashService.getUsers().subscribe((users:any) => this.users = users || []);
    this.cashService.getBusinesses().subscribe((businesses:any) => this.businesses = businesses || []);
    this.refreshStoreList();
  }

  selectTab(tab:'master' | 'policy' | 'templates') {
    this.activeTab = tab;
    if (tab !== 'master') {
      this.refreshSelectedStore();
    }
  }

  refreshStoreList() {
    this.cashService.getStores().subscribe((stores:any) => {
      this.stores = stores || [];
      if (!this.selectedStoreId && this.stores.length) {
        this.selectedStoreId = this.stores[0].id;
      }
      this.refreshSelectedStore();
      if (this.storeForm.id) {
        const match = this.stores.find((store:any) => store.id === this.storeForm.id);
        if (match) {
          this.editStore(match);
        }
      }
    });
  }

  refreshSelectedStore() {
    this.selectedStore = this.stores.find((store:any) => store.id === Number(this.selectedStoreId)) || { depositthreshold: 0, location: '' };
    if (!this.selectedStore?.id) {
      return;
    }
    this.templateForm.storeid = this.selectedStore.id;
    this.cashService.getTemplates(this.selectedStore.id).subscribe((templates:any) => {
      this.templates = templates || [];
    });
  }

  saveStore() {
    this.message = '';
    this.savingStore = true;
    const payload = {
      businessid: this.storeForm.businessid || null,
      location: this.storeForm.location,
      depositthreshold: Number(this.storeForm.depositthreshold || 0),
      isActive: this.storeForm.isActive !== false
    };
    const req = this.storeForm.id ? this.cashService.updateStore(this.storeForm.id, payload) : this.cashService.createStore(payload);
    req.subscribe(() => {
      this.savingStore = false;
      this.storeForm = { id: null, businessid: '', location: '', depositthreshold: 0, isActive: true };
      this.refreshStoreList();
    }, err => {
      this.savingStore = false;
      this.message = err?.error?.message || 'Unable to save store';
    });
  }

  editStore(row:any) {
    this.storeForm = {
      id: row.id,
      businessid: row.business?.id || '',
      location: row.location,
      depositthreshold: row.depositthreshold,
      isActive: row.isActive !== false
    };
  }

  removeStore(row:any) {
    this.confirm.confirmDelete(row?.location, () => {
      this.cashService.deleteStore(row.id).subscribe(() => {
        this.refreshStoreList();
      }, err => this.message = err?.error?.message || 'Unable to archive store');
    }, { entity: 'store', verb: 'Archive' });
  }

  savePolicy() {
    this.message = '';
    this.savingPolicy = true;
    const selected = this.selectedStore;
    this.cashService.updateStore(this.selectedStore.id, {
      location: selected.location || '',
      depositthreshold: Number(selected.depositthreshold || 0)
    }).subscribe((store:any) => {
      this.selectedStore = store || this.selectedStore;
      const index = this.stores.findIndex((row:any) => row.id === store.id);
      if (index > -1) {
        this.stores[index] = store;
      }
      this.savingPolicy = false;
      this.refreshSelectedStore();
    }, err => {
      this.savingPolicy = false;
      this.message = err?.error?.message || 'Unable to save store policy';
    });
  }

  saveTemplate() {
    this.message = '';
    const payload = {
      ...this.templateForm,
      depositthreshold: Number(this.templateForm.depositthreshold || 0),
      assigneduserid: this.templateForm.assigneduserid || null
    };
    const req = payload.id ? this.cashService.updateTemplate(payload.id, payload) : this.cashService.saveTemplate(payload);
    req.subscribe(() => {
      this.templateForm.id = null;
      this.templateForm.name = 'Morning';
      this.templateForm.starttime = '09:00';
      this.templateForm.endtime = '17:00';
      this.templateForm.assigneduserid = '';
      this.refreshSelectedStore();
    }, err => this.message = err?.error?.message || 'Unable to save template');
  }

  editTemplate(row:any) {
    this.templateForm = {
      id: row.id,
      storeid: this.selectedStore?.id || '',
      name: row.name,
      starttime: row.starttime,
      endtime: row.endtime,
      depositthreshold: row.depositthreshold,
      assigneduserid: row.assigneduser?.id || row.assigneduserid || '',
      active: row.active
    };
  }
}

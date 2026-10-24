import { Component, OnInit } from "@angular/core";
import { CashService } from "src/app/secured/store/cash/cash.service";
import { ConfirmService } from "src/app/shared/confirm.service";
import { BusinessesService } from "../businesses/businesses.service";
import { AuthService } from "src/app/@core/auth/auth.service";

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
  readonly weekdays = [{ n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' }, { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }, { n: 6, label: 'Sat' }, { n: 0, label: 'Sun' }];
  /** the days of the month as typed ("1, 15, last") */
  monthDaysText = '';
  message:string = '';
  savingPolicy:boolean = false;
  savingStore:boolean = false;
  activeTab:'details' | 'cash' | 'checklists' | 'returns' = 'details';

  // the checklists a person ticks when a shift is opened, handed over or closed
  readonly checklistKinds = [
    { kind: 'OPENING', title: 'Opening the store', hint: 'The first shift of the day' },
    { kind: 'OPENING_OPEN_STORE', title: 'Taking up a shift while the store is open', hint: 'A handover, a later shift, or a second person' },
    { kind: 'CLOSING', title: 'Closing the store', hint: 'The end of the day' },
    { kind: 'HANDOVER', title: 'Handing over to the next person', hint: 'The store stays open' },
  ];
  ckScope:'store' | 'business' = 'store';
  ck:any = null;
  ckDraft:{[kind:string]:any[]} = {};
  ckMessage = '';
  ckError = '';
  ckBusy = false;

  // suggestions for the lists: from the last 30 days, or from a situation described
  ckFacts:any[] = [];
  ckSuggestions:any[] = [];
  ckAssistNote = '';
  ckAssistError = '';
  ckAssistBusy = false;
  ckAsked = false;
  ckSituation = '';
  profile:any = null;
  profileSaving:boolean = false;
  profileMessage:string = '';
  profileError:string = '';
  readonly licenceTypes = [
    { key: 'RETAIL_20_21', label: 'Retail drug licence (Form 20 / 21)' },
    { key: 'WHOLESALE_20B_21B', label: 'Wholesale drug licence (Form 20B / 21B)' },
    { key: 'FSSAI', label: 'FSSAI' },
    { key: 'OTHER', label: 'Other' },
  ];
  licStoreId:any = '';
  lic:any = null;
  licMessage:string = '';
  licError:string = '';
  licSaving:boolean = false;
  storeForm:any = {
    id: null,
    businessid: '',
    location: '',
    storetype: 'pharmacy',
    isActive: true
  };
  templateForm:any = {
    id: null,
    storeid: '',
    name: 'Morning',
    starttime: '09:00',
    endtime: '17:00',
    assigneduserid: '',
    active: true
  };

  constructor(private cashService: CashService, private confirm: ConfirmService, private businessService: BusinessesService, private auth: AuthService) {}

  ngOnInit(): void {
    this.cashService.getBusinesses().subscribe((businesses:any) => {
      this.businesses = businesses || [];
      if (this.businesses.length === 1) this.storeForm.businessid = this.businesses[0].id;
    });
    this.refreshStoreList();
  }

  rrRows:any[] = [];
  rrError = '';

  loadRules() {
    this.rrError = '';
    this.cashService.getReturnRules().subscribe((rows:any) => this.rrRows = rows, err => this.rrError = err?.error?.message || 'Unable to load the return rules');
  }

  saveRule(row:any, rule:string|null) {
    this.rrError = '';
    const before = row.rule;
    row.rule = rule;
    this.cashService.saveReturnRule(row.category, rule).subscribe(() => {}, err => { row.rule = before; this.rrError = err?.error?.message || 'Unable to save'; });
  }

  selectTab(tab:'details' | 'cash' | 'checklists' | 'returns') {
    this.activeTab = tab;
    if (tab === 'returns') this.loadRules();
    this.refreshSelectedStore();
  }

  /** how many stores the hosted plan allows (null: no limit, as on a standalone install) */
  get storeLimit():number|null {
    const n = Number(this.auth.platform?.limits?.stores);
    return this.auth.platform && Number.isFinite(n) ? n : null;
  }

  /** a new store would go past the plan's limit */
  get atStoreLimit():boolean {
    return this.storeLimit !== null && this.stores.filter((s:any) => s.isActive !== false && !s.isArchived).length >= this.storeLimit;
  }

  get limitNote():string {
    const n = this.storeLimit || 0;
    return `Your ${this.auth.platform?.plan || 'current'} plan allows ${n} ${n === 1 ? 'store' : 'stores'}, and ${n === 1 ? 'it is' : 'they are'} in use. Ask your provider to change the plan to add another.`;
  }

  /** a business with one business has nothing to choose: the Business box is for the platform admin */
  get showBusinessSelect():boolean { return this.businesses.length > 1; }

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

  loadProfile() {
    this.profile = null;
    this.profileMessage = this.profileError = '';
    if (!this.selectedStoreId) return;
    this.cashService.getStoreProfile(this.selectedStoreId).subscribe((p:any) => this.profile = p, err => this.profileError = err?.error?.message || 'Unable to load the store profile');
  }

  saveProfile() {
    this.profileMessage = this.profileError = '';
    this.profileSaving = true;
    const p = this.profile;
    this.cashService.saveStoreProfile(p.storeid, {
      shiftmode: p.shiftmode, till: p.tillsetting, accountablerole: p.accountablerole,
      operatorrequired: !!p.operatorrequired, operatorholdminutes: Number(p.operatorholdminutes), approvalmode: p.approvalmodesetting,
      cashrefundlimit: p.cashrefundlimit === null || p.cashrefundlimit === '' || p.cashrefundlimit === undefined ? null : Number(p.cashrefundlimit),
    }).subscribe((r:any) => { this.profileSaving = false; this.profile = r; this.profileMessage = 'Saved.'; },
      err => { this.profileSaving = false; this.profileError = err?.error?.message || 'Unable to save'; });
  }

  // ------------------------------------------------------------ checklists
  loadChecklists(keepMessage = false) {
    if (!keepMessage) { this.ckFacts = []; this.ckSuggestions = []; this.ckAssistNote = this.ckAssistError = ''; this.ckAsked = false; }
    this.ck = null;
    if (!keepMessage) this.ckMessage = this.ckError = '';
    if (this.ckScope === 'store' && !this.selectedStoreId) return;
    this.cashService.getChecklistConfig(this.ckScope, this.selectedStoreId).subscribe((c:any) => {
      this.ck = c;
      this.ckDraft = {};
      this.checklistKinds.forEach(k => this.ckDraft[k.kind] = (c.lists[k.kind].items || []).map((i:any) => ({ ...i })));
    }, err => this.ckError = err?.error?.message || 'Unable to load the checklists');
  }

  kindTitle(kind:string):string { return this.checklistKinds.find(k => k.kind === kind)?.title || kind; }

  private ckAssistFail(err:any, fallback:string) {
    this.ckAssistBusy = false;
    const m = err?.error?.message;
    this.ckAssistError = Array.isArray(m) ? m.join(' ') : (m || fallback);
  }

  /** what the last 30 days show, as suggested items; the assistant words them when it is on */
  ckSuggest() {
    this.ckAssistError = this.ckAssistNote = '';
    this.ckAssistBusy = true;
    this.cashService.getChecklistSuggestions(this.ckScope, this.selectedStoreId).subscribe({
      next: (r:any) => {
        this.ckAssistBusy = false; this.ckAsked = true;
        this.ckFacts = r.facts || [];
        this.ckSuggestions = (r.suggestions || []).map((s:any) => ({ ...s, added: false }));
        this.ckAssistNote = r.note || '';
      },
      error: (err:any) => this.ckAssistFail(err, 'Unable to look at the last 30 days'),
    });
  }

  /** items for a situation described in a sentence or two */
  ckDescribe() {
    this.ckAssistError = this.ckAssistNote = '';
    this.ckAssistBusy = true;
    this.cashService.draftChecklist({ scope: this.ckScope, storeid: this.selectedStoreId || undefined, instruction: this.ckSituation }).subscribe({
      next: (r:any) => {
        this.ckAssistBusy = false; this.ckAsked = true;
        this.ckFacts = [];
        this.ckSuggestions = (r.suggestions || []).map((s:any) => ({ ...s, added: false }));
      },
      error: (err:any) => this.ckAssistFail(err, 'The assistant could not suggest items'),
    });
  }

  /** puts a suggestion into the draft of its list; it is saved with that list's Save */
  ckAddSuggestion(s:any) {
    const draft = this.ckDraft[s.list];
    if (!draft) return;
    const norm = (t:string) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!draft.some((i:any) => norm(i.label) === norm(s.label))) draft.push({ key: '', label: s.label });
    s.added = true;
    this.ckError = '';
    this.ckMessage = `Added to "${this.kindTitle(s.list)}". Press Save on that list to keep it.`;
  }

  ckSource(kind:string):string {
    const l = this.ck?.lists?.[kind];
    if (!l) return '';
    if (l.own) return this.ckScope === 'store' ? "This store's own list" : "The business's list";
    return this.ckScope === 'store' && l.inheritedfrom === 'business' ? "The business's list" : 'Standard list';
  }

  ckMove(kind:string, i:number, d:number) {
    const a = this.ckDraft[kind], j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
  }

  ckRemove(kind:string, i:number) { this.ckDraft[kind].splice(i, 1); }

  ckAdd(kind:string) { this.ckDraft[kind].push({ key: '', label: '' }); }

  ckSave(kind:string) {
    this.ckMessage = this.ckError = '';
    const items = this.ckDraft[kind].filter((i:any) => String(i.label || '').trim());
    this.ckBusy = true;
    this.cashService.saveChecklist({ scope: this.ckScope, storeid: this.selectedStoreId || undefined, kind, items }).subscribe({
      next: () => { this.ckBusy = false; this.ckMessage = 'Saved.'; this.loadChecklists(true); },
      error: (err:any) => { this.ckBusy = false; const m = err?.error?.message; this.ckError = Array.isArray(m) ? m.join(' ') : (m || 'Unable to save the checklist'); },
    });
  }

  ckReset(kind:string) {
    this.ckMessage = this.ckError = '';
    this.cashService.resetChecklist(this.ckScope, this.selectedStoreId, kind).subscribe({
      next: () => { this.ckMessage = this.ckScope === 'store' ? "This store now uses the business's list." : 'The standard list is back.'; this.loadChecklists(true); },
      error: (err:any) => this.ckError = err?.error?.message || 'Unable to change the checklist',
    });
  }

  refreshSelectedStore() {
    this.selectedStore = this.stores.find((store:any) => store.id === Number(this.selectedStoreId)) || { depositthreshold: 0, location: '' };
    if (this.activeTab === 'checklists') {
      this.loadChecklists();
      return;
    }
    if (this.activeTab === 'cash') {
      this.loadProfile();
    }
    if (!this.selectedStore?.id) {
      return;
    }
    if (this.activeTab === 'details') {
      this.openLicences(this.selectedStore.id);
    }
    this.selectedStore = { ...this.selectedStore, depositschedule: this.selectedStore.depositschedule || 'none', depositweekdays: [...(this.selectedStore.depositweekdays || [])] };
    this.monthDaysText = (this.selectedStore.depositmonthdays || []).map((d:number) => d === 0 ? 'last' : String(d)).join(', ');
    this.templateForm.storeid = this.selectedStore.id;
    this.cashService.getUsers(this.selectedStore.id).subscribe((users:any) => this.users = users || [], () => this.users = []);
    this.cashService.getTemplates(this.selectedStore.id).subscribe((templates:any) => {
      this.templates = templates || [];
    });
  }

  openLicences(id:any) {
    this.licStoreId = id;
    this.licMessage = '';
    this.licError = '';
    this.lic = null;
    if (!id) return;
    this.cashService.getStoreLicenses(id).subscribe(
      (r:any) => this.lic = r,
      err => this.licError = err?.error?.message || 'Unable to load the licences');
  }

  /** one-store shops have the same address as the business: fill it in from there */
  useBusinessAddress() {
    this.businessService.getMine().subscribe((b:any) => {
      if (!this.lic) return;
      this.lic.address = b?.address || '';
      this.lic.pincode = b?.pincode || '';
    }, () => {});
  }

  addLicence() {
    this.lic.licenses.push({ licensetype: 'RETAIL_20_21', number: '', validfrom: '', validto: '', notes: '' });
  }

  removeLicence(i:number) {
    this.lic.licenses.splice(i, 1);
  }

  saveLicences() {
    this.licMessage = '';
    this.licError = '';
    this.licSaving = true;
    const body = {
      address: this.lic.address || '', pincode: this.lic.pincode || '', phone: this.lic.phone || '',
      licenses: this.lic.licenses.map((l:any) => ({ licensetype: l.licensetype, number: l.number, validfrom: l.validfrom || null, validto: l.validto || null, notes: l.notes || '' })),
    };
    this.cashService.saveStoreLicenses(this.licStoreId, body).subscribe(
      (r:any) => { this.licSaving = false; this.lic = r; this.licMessage = 'Licences and address saved.'; this.refreshStoreList(); },
      err => { this.licSaving = false; this.licError = err?.error?.message || 'Unable to save the licences'; });
  }

  licenceBadge(status:string) {
    return status === 'VALID' ? 'bg-success' : status === 'EXPIRING' ? 'bg-warning text-dark' : status === 'EXPIRED' ? 'bg-danger' : 'bg-light text-dark border';
  }

  licenceLabel(status:string) {
    return status === 'VALID' ? 'Licence valid' : status === 'EXPIRING' ? 'Licence expiring' : status === 'EXPIRED' ? 'Licence expired' : 'No licence on file';
  }

  saveStore() {
    this.message = '';
    this.savingStore = true;
    const payload = {
      businessid: this.storeForm.businessid || null,
      location: this.storeForm.location,
      storetype: this.storeForm.storetype || 'pharmacy',
      isActive: this.storeForm.isActive !== false
    };
    const req = this.storeForm.id ? this.cashService.updateStore(this.storeForm.id, payload) : this.cashService.createStore(payload);
    req.subscribe(() => {
      this.savingStore = false;
      this.storeForm = { id: null, businessid: '', location: '', storetype: 'pharmacy', isActive: true };
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
      storetype: row.storetype || 'pharmacy',
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

  weekdayOn(n:number):boolean { return (this.selectedStore.depositweekdays || []).includes(n); }

  toggleWeekday(n:number, on:boolean) {
    const cur:number[] = this.selectedStore.depositweekdays || [];
    this.selectedStore.depositweekdays = on ? Array.from(new Set([...cur, n])) : cur.filter(d => d !== n);
  }

  /** "1, 15, last" -> [1, 15, 0]; anything else is dropped (the server refuses a number out of range) */
  parseMonthDays(text:string):number[] {
    return Array.from(new Set(String(text || '').split(/[,\s]+/).filter(Boolean).map(t => /^last$/i.test(t) ? 0 : Number(t)).filter(n => Number.isInteger(n))));
  }

  private rule(s:any) {
    return {
      threshold: Number(s?.depositthreshold || 0), schedule: s?.depositschedule || 'none',
      weekdays: s?.depositweekdays || [], monthdays: s?.depositmonthdays || [],
    };
  }

  private words(r:any):string {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const parts:string[] = [];
    if (r.threshold > 0) parts.push('₹' + Number(r.threshold).toLocaleString('en-IN'));
    if (r.schedule === 'daily') parts.push('every day');
    if (r.schedule === 'weekly' && r.weekdays.length) parts.push([...r.weekdays].sort((a:number, b:number) => ((a + 6) % 7) - ((b + 6) % 7)).map((d:number) => names[d]).join(', '));
    if (r.schedule === 'monthly' && r.monthdays.length) parts.push('day ' + [...r.monthdays].sort((x:number, y:number) => (x || 99) - (y || 99)).map((d:number) => d === 0 ? 'last' : d).join(', '));
    return parts.join(' or ');
  }

  /** one line for the store list: the amount and/or the schedule */
  depositSummary(store:any):string { return this.words(this.rule(store)) || '-'; }

  /** the rule as the screen has it now, in a sentence */
  get policySummary():string {
    const r:any = this.rule(this.selectedStore);
    if (r.schedule === 'monthly') r.monthdays = this.parseMonthDays(this.monthDaysText);
    const w = this.words(r);
    return w ? `A deposit is due at ${w}, whichever comes first.` : 'No deposit reminder is set.';
  }

  savePolicy() {
    this.message = '';
    this.savingPolicy = true;
    const selected = this.selectedStore;
    this.cashService.updateStore(this.selectedStore.id, {
      location: selected.location || '',
      depositthreshold: Number(selected.depositthreshold || 0),
      depositschedule: selected.depositschedule || 'none',
      depositweekdays: selected.depositschedule === 'weekly' ? (selected.depositweekdays || []) : [],
      depositmonthdays: selected.depositschedule === 'monthly' ? this.parseMonthDays(this.monthDaysText) : []
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
      assigneduserid: row.assigneduser?.id || row.assigneduserid || '',
      active: row.active
    };
  }
}

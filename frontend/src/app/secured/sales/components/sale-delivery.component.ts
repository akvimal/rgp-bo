import { Component } from "@angular/core";
import { SaleDeliveryService } from "../sale-delivery.service";
import { SaleDelivery } from "../models/sale-delivery.model";
import { DeliveryPartnersService } from "../../settings/delivery-partners/delivery-partners.service";
import { OperatorContextService } from "src/app/@core/operator-context.service";
import { COST_WAYS, CostChoice, DIGITAL_MODES, buildCostPaid, choiceOf, costLabel, costProblem, deliveredByKind, nowLocalInput, receiverSummary, wallClock } from "../delivery-editor";

@Component({
    selector:'app-sale-delivery',
    templateUrl: 'sale-delivery.component.html'
})
export class SaleDeliveryComponent {

    deliveries:SaleDelivery[] = []
    editingDelivery:SaleDelivery = {}
    showEditor = false
    showNew = false
    useSaleCustomer = false
    currentMonthLabel = ''
    summary = {
        total: 0,
        pending: 0,
        delivered: 0,
        failed: 0,
        charge: 0,
        cost: 0
    }
    monthSummary = {
        total: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        charge: 0,
        cost: 0,
        successRate: 0,
        failureRate: 0
    }
    deliveryPartners: any[] = []

    // ---- the Manage dialog
    /** the people at the delivery's store, for "delivered by" */
    staff: any[] = []
    deliveredByKind: 'staff' | 'courier' = 'staff'
    receiverOpen = false
    moreOpen = false
    confirmOpen = false
    saving = false
    saveError = ''
    /** a note after saving that the person should see (a payment waiting for approval, a likely duplicate) */
    notice = ''
    costChoice: CostChoice = { via: '', mode: '', ref: '', linkKind: '', linkId: null, adopt: false }
    /** the entries already recorded that could be this delivery's cost */
    candidates: any[] = []
    /** the drawer a cash payment comes from (the person's own), and the other open shifts a Store Head or above can choose */
    cashShift: any = null
    otherShifts: any[] = []
    /** the person at the counter, for who confirmed it */
    operatorName = ''
    readonly costWays = COST_WAYS
    readonly digitalModes = DIGITAL_MODES
    readonly costLabel = costLabel
    readonly receiverSummary = receiverSummary

    // ---- costs already recorded separately, linked to their deliveries in one go
    suggestions: any = null
    showSuggestions = false
    picked: { [key: string]: boolean } = {}
    linking = false
    linkMessage = ''

    constructor(
        private service:SaleDeliveryService,
        private deliveryPartnerService: DeliveryPartnersService,
        private operators: OperatorContextService
    ){}

    ngOnInit(){
        this.currentMonthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date());
        this.deliveryPartnerService.findAll().subscribe((data: any) => this.deliveryPartners = data);
        this.operators.selectedOperatorName$.subscribe((n: string) => this.operatorName = n || '');
        this.loadDeliveries();
        this.loadSuggestions();
    }

    /** a delivery bill from an earlier day that nobody has marked delivered (or failed or cancelled) */
    isLate(i:SaleDelivery):boolean {
        const day = String(i.bookeddate || i.sale?.billdate || '').slice(0, 10);
        const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
        return (i.status || 'Pending') === 'Pending' && !!day && day < today;
    }

    loadDeliveries(){
        this.service.findAll().subscribe((result:any) => {
            this.deliveries = result;
            this.recalculateSummary();
        });
    }

    recalculateSummary(){
        this.summary = this.deliveries.reduce((acc:any, item:SaleDelivery) => {
            const status = (item.status || 'Pending').toLowerCase();
            acc.total += 1;
            acc.charge += +(item.charges || 0);
            acc.cost += +(item.actualcost || 0);

            if(status === 'delivered'){
                acc.delivered += 1;
            } else if(status === 'failed'){
                acc.failed += 1;
            } else {
                acc.pending += 1;
            }

            return acc;
        }, {
            total: 0,
            pending: 0,
            delivered: 0,
            failed: 0,
            charge: 0,
            cost: 0
        });

        const now = new Date();
        const currentMonthDeliveries = this.deliveries.filter((item: SaleDelivery) => {
            const sourceDate = item.deliveredat || item.deliverydate || item.sale?.billdate || item.bookeddate;
            if(!sourceDate){
                return false;
            }

            const date = new Date(sourceDate);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });

        const monthSummary = currentMonthDeliveries.reduce((acc:any, item:SaleDelivery) => {
            const status = (item.status || 'Pending').toLowerCase();
            acc.total += 1;
            acc.charge += +(item.charges || 0);
            acc.cost += +(item.actualcost || 0);

            if(status === 'delivered'){
                acc.delivered += 1;
            } else if(status === 'failed'){
                acc.failed += 1;
            } else {
                acc.pending += 1;
            }

            return acc;
        }, {
            total: 0,
            delivered: 0,
            failed: 0,
            pending: 0,
            charge: 0,
            cost: 0,
            successRate: 0,
            failureRate: 0
        });

        monthSummary.successRate = monthSummary.total ? Math.round((monthSummary.delivered / monthSummary.total) * 100) : 0;
        monthSummary.failureRate = monthSummary.total ? Math.round((monthSummary.failed / monthSummary.total) * 100) : 0;
        this.monthSummary = monthSummary;
    }

    editDelivery(delivery:SaleDelivery){
        const customer = delivery.sale?.customer || {};
        this.editingDelivery = {
            ...delivery,
            receivername: delivery.receivername || customer.name || '',
            receiverphone: delivery.receiverphone || customer.mobile || '',
            receiveraddress: delivery.receiveraddress || customer.address || '',
            deliverymethod: delivery.deliverymethod || 'Staff Delivery',
            status: delivery.status || 'Pending',
            paymentmode: delivery.paymentmode || 'Prepaid',
            collectionstatus: delivery.collectionstatus || 'Pending',
            confirmed: !!delivery.confirmed,
            chargevia: delivery.chargevia || '',
            chargemethod: delivery.chargemethod || 'UPI',
            // times as they were typed (a datetime box cannot show the stored form), and the day to deliver defaults to today
            deliveredat: wallClock(delivery.deliveredat),
            confirmedat: wallClock(delivery.confirmedat),
            deliverydate: String(delivery.deliverydate || nowLocalInput()).slice(0, 10)
        };
        this.useSaleCustomer = !!customer.name
            && this.editingDelivery.receivername === (customer.name || '')
            && this.editingDelivery.receiverphone === (customer.mobile || '');
        this.deliveredByKind = deliveredByKind(this.editingDelivery);
        this.receiverOpen = false;
        this.moreOpen = +(delivery.charges || 0) > 0 && !delivery.chargevia; // a charge with no word on how it was paid opens the details
        this.confirmOpen = false;
        this.saveError = '';
        this.costChoice = { via: choiceOf(delivery), mode: delivery.costpaidmode || '', ref: delivery.costpaidref || '', linkKind: '', linkId: null, adopt: false };
        this.candidates = [];
        this.cashShift = null;
        this.otherShifts = [];
        this.staff = [];
        this.showEditor = true;
        if(delivery.storeid) this.service.storeStaff(+delivery.storeid).subscribe((u: any) => this.staff = u || [], () => this.staff = []);
        if(delivery.saleid) this.service.cashShifts(+delivery.saleid).subscribe((r: any) => { this.cashShift = r?.shift || null; this.otherShifts = r?.shifts || []; this.costChoice.shiftId = this.cashShift ? null : (this.otherShifts.length ? this.otherShifts[0].id : null); }, () => { this.cashShift = null; this.otherShifts = []; });
        if(delivery.saleid) this.service.costCandidates(+delivery.saleid).subscribe((r: any) => this.candidates = r?.candidates || [], () => this.candidates = []);
    }

    closeEditor(){
        this.showEditor = false;
        this.editingDelivery = {};
        this.useSaleCustomer = false;
        this.saveError = '';
    }

    onUseSaleCustomerChange(){
        if(this.useSaleCustomer){
            const customer = this.editingDelivery.sale?.customer || {};
            this.editingDelivery.receivername = customer.name || '';
            this.editingDelivery.receiverphone = customer.mobile || '';
            this.editingDelivery.receiveraddress = customer.address || '';
        }
    }

    onStatusChange(){
        if(this.editingDelivery.status !== 'Failed'){
            this.editingDelivery.failurereason = '';
        }
        if(this.editingDelivery.status === 'Delivered' && !this.editingDelivery.deliveredat){
            this.editingDelivery.deliveredat = nowLocalInput();
        }
    }

    /** the one action most deliveries need: delivered now, confirmed by the person at the counter */
    markDelivered(){
        this.editingDelivery.status = 'Delivered';
        this.editingDelivery.deliveredat = this.editingDelivery.deliveredat || nowLocalInput();
        this.editingDelivery.confirmed = true;
        // the person at the counter; left empty, the server puts the person who is logged in
        this.editingDelivery.confirmedby = this.editingDelivery.confirmedby || this.operatorName || '';
        this.editingDelivery.confirmedat = this.editingDelivery.confirmedat || nowLocalInput();
        this.editingDelivery.failurereason = '';
    }

    markFailed(){
        this.editingDelivery.status = 'Failed';
        this.editingDelivery.failurereason = this.editingDelivery.failurereason || 'Customer unavailable';
    }

    staffHas(name: string): boolean { return this.staff.some((u: any) => u.fullname === name); }

    setDeliveredBy(kind: 'staff' | 'courier'){
        this.deliveredByKind = kind;
        this.editingDelivery.deliverymethod = kind === 'courier' ? 'Courier' : 'Staff Delivery';
    }

    /** who confirmed it, in words, for the line that replaces three boxes */
    get confirmedLine(): string {
        const d = this.editingDelivery;
        if(!d.confirmed) return 'Not confirmed yet. Marking it delivered confirms it, by you.';
        return `Confirmed by ${d.confirmedby || 'you'}${d.confirmedat ? ' at ' + String(d.confirmedat).replace('T', ' ') : ''}`;
    }

    // ---------------------------------------------------------------- what the delivery cost, and how it was paid
    pickCostWay(key: string){
        if(this.editingDelivery.costlocked) return;
        this.costChoice = { ...this.costChoice, via: key, mode: key === 'DIGITAL' ? (this.costChoice.mode || 'UPI') : this.costChoice.mode, linkId: key === 'LINK' ? this.costChoice.linkId : null, adopt: key === 'LINK' ? this.costChoice.adopt : false };
    }

    /** an entry already recorded is chosen as this delivery's cost: its amount is the cost */
    chooseCandidate(c: any){
        this.costChoice = { ...this.costChoice, via: 'LINK', linkKind: c.kind, linkId: c.id, adopt: Number(this.editingDelivery.actualcost) !== Number(c.amount) };
        this.editingDelivery.actualcost = c.amount;
    }

    /** likely matches shown while a new cash or digital payment is being chosen: link one instead, so the cost is not counted twice */
    get likelyMatches(): any[] {
        const via = this.costChoice.via;
        if(via !== 'CASH' && via !== 'DIGITAL') return [];
        return this.candidates.filter((c: any) => c.exact && !this.editingDelivery.costlocked);
    }

    get costIssue(): string {
        return costProblem(this.costChoice, this.editingDelivery.actualcost);
    }

    /** an amount, delivered, and no way yet: gently asks */
    get costUnsaid(): boolean {
        return Number(this.editingDelivery.actualcost) > 0 && !this.costChoice.via && !this.editingDelivery.costlocked;
    }

    /** lets go of a linked entry (it stays where it is) */
    unlinkCost(){
        this.costChoice = { ...this.costChoice, via: 'UNPAID', linkId: null };
        this.editingDelivery.costlocked = false;
        this.saveDelivery();
    }

    saveDelivery(){
        const issue = this.costIssue;
        if(issue){ this.saveError = issue; return; }
        const d: any = { ...this.editingDelivery };
        if(this.deliveredByKind === 'courier'){ d.deliverymethod = 'Courier'; d.deliveryby = d.deliveryby || ''; }
        else { d.deliverymethod = 'Staff Delivery'; d.courierpartner = ''; }
        // a cost that cannot change any more is not sent again (only letting go of a linked entry is)
        const costpaid = this.editingDelivery.costlocked ? undefined : buildCostPaid(this.costChoice);
        if(costpaid) d.costpaid = costpaid;
        this.saving = true; this.saveError = '';
        this.service.save(d).subscribe((res: any) => {
            this.saving = false;
            this.notice = res?.costwarning || '';
            this.closeEditor();
            this.loadDeliveries();
            this.loadSuggestions();
        }, (err: any) => {
            this.saving = false;
            const m = err?.error?.message;
            this.saveError = (Array.isArray(m) ? m.join(' ') : m) || 'The delivery could not be saved.';
        });
    }

    // ---------------------------------------------------------------- costs recorded separately, linked in one go
    loadSuggestions(){
        this.service.costSuggestions().subscribe((r: any) => {
            this.suggestions = r || null;
            this.picked = {};
            (r?.pairs || []).forEach((p: any) => this.picked[this.pairKey(p)] = true);
        }, () => this.suggestions = null);
    }

    pairKey(p: any){ return `${p.saleid}:${p.kind}:${p.entryid}`; }

    get pickedCount(): number { return (this.suggestions?.pairs || []).filter((p: any) => this.picked[this.pairKey(p)]).length; }

    linkSelected(){
        const links = (this.suggestions?.pairs || []).filter((p: any) => this.picked[this.pairKey(p)]).map((p: any) => ({ saleid: p.saleid, kind: p.kind, entryid: p.entryid }));
        if(!links.length) return;
        this.linking = true; this.linkMessage = '';
        this.service.linkCosts(links).subscribe((r: any) => {
            this.linking = false;
            this.linkMessage = `Linked ${r.linked} delivery cost${r.linked === 1 ? '' : 's'} to the expenses already recorded.` + (r.skipped?.length ? ` ${r.skipped.length} could not be linked.` : '');
            this.loadDeliveries();
            this.loadSuggestions();
            if(!(this.suggestions?.pairs || []).length) this.showSuggestions = false;
        }, (e: any) => { this.linking = false; this.linkMessage = e?.error?.message || 'The costs could not be linked.'; });
    }

    get monthMargin(): number {
        return (this.monthSummary.charge || 0) - (this.monthSummary.cost || 0);
    }

    statusClass(status:string): string {
        switch((status || '').toLowerCase()){
            case 'delivered': return 'bg-success';
            case 'failed': return 'bg-danger';
            case 'cancelled': return 'bg-secondary';
            case 'assigned': return 'bg-info text-dark';
            default: return 'bg-warning text-dark';
        }
    }
}

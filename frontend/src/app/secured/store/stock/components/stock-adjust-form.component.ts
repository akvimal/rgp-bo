import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { StockService } from "../stock.service";
import { AdjustmentPlan, Direction, adjustmentPlan, needsComment, reasonLabel, reasonsFor } from "../reason-codes";
import { StoreContextService } from "src/app/@core/store-context.service";

/**
 * Remove or add stock for one batch. The person says which, then how many (always a positive number), then why: the reasons offered depend on the
 * direction, the effect is shown in words, and the quantity is sent signed. The server refuses a reason that contradicts the direction.
 */
@Component({
    selector: 'app-stock-adjust-form',
    templateUrl: './stock-adjust-form.component.html',
    styles: [`.adj-step{font-weight:600;margin:.25rem 0 .35rem}.adj-effect{font-size:1.05rem}`]
})
export class StockAdjustFormComponent {

    @Input() item:any = {};
    /** a reason to start from; one that takes stock out (returned to the vendor, expired and so on) also starts the form on Remove */
    @Input() defaultReason:string = '';
    @Output() saved = new EventEmitter();

    direction:Direction | '' = '';
    plan:AdjustmentPlan = { signed: 0, after: 0, problem: '' };
    qtyTouched = false;
    moreOpen = false;
    saving = false;

    qtyAdjustForm:FormGroup = new FormGroup({
        itemid: new FormControl(''),
        reason: new FormControl(''),
        qty: new FormControl(null),
        comments: new FormControl(''),
        auditid: new FormControl(null)
    });

    /** the audits this adjustment can be made for: counting now, or counted and not yet signed off, at the selected store */
    audits:any[] = [];

    constructor(private service: StockService, private storeContext: StoreContextService){
        this.service.auditsForAdjust().subscribe((rows:any[]) => {
            const store = this.storeContext.selectedStoreId;
            this.audits = (rows || []).filter((a:any) => (!store || a.store_id === store) && (a.status === 'IN_PROGRESS' || (a.status === 'DONE' && !a.certified_on)));
        }, () => this.audits = []);
    }

    auditNo(n:number):string { return n ? `SA-${String(n).padStart(4, '0')}` : ''; }

    ngOnChanges(changes:SimpleChanges){
        if(changes.item && changes.item.currentValue){
            this.qtyAdjustForm.reset();
            this.qtyAdjustForm.controls['itemid'].setValue(this.item['item_id']);
            this.qtyTouched = false; this.moreOpen = false; this.saving = false;
            this.direction = ['RETURNED_TO_VENDOR', 'DAMAGED', 'EXPIRED', 'SHRINKAGE'].includes(this.defaultReason) ? 'REMOVE' : '';
            this.qtyAdjustForm.controls['reason'].setValue(this.direction ? this.defaultReason : '');
            this.refresh();
        }
    }

    get reasons() { return reasonsFor(this.direction); }
    get absQty():number { return Math.abs(this.plan.signed); }
    get reasonText():string { return reasonLabel(this.qtyAdjustForm.value.reason); }
    get commentRequired():boolean { return needsComment(this.qtyAdjustForm.value.reason); }

    /** everything is in place: a direction, a sensible quantity, a reason that belongs to the direction, and a comment where one is needed */
    get ready():boolean {
        const v = this.qtyAdjustForm.value;
        if(this.plan.problem || !this.plan.signed) return false;
        if(!v.reason || !this.reasons.some(r => r.value === v.reason)) return false;
        return !this.commentRequired || String(v.comments || '').trim().length >= 3;
    }

    get saveLabel():string {
        if(!this.direction) return 'Choose remove or add';
        if(!this.plan.signed) return this.direction === 'REMOVE' ? 'Remove stock' : 'Add stock';
        return `${this.direction === 'REMOVE' ? 'Remove' : 'Add'} ${this.absQty} unit${this.absQty === 1 ? '' : 's'}`;
    }

    setDirection(d:Direction){
        if(this.direction === d) return;
        this.direction = d;
        // a reason that does not belong to the other direction is cleared, so it cannot contradict what is being done
        if(!this.reasons.some(r => r.value === this.qtyAdjustForm.value.reason)) this.qtyAdjustForm.controls['reason'].setValue('');
        this.refresh();
    }

    onQtyChange(){ this.qtyTouched = true; this.refresh(); }

    private refresh(){
        this.plan = adjustmentPlan(this.direction, this.qtyAdjustForm.value.qty, this.item?.balance);
    }

    onQtyAdjSubmit(){
        if(!this.ready) return;
        const value = this.qtyAdjustForm.value;
        this.saving = true;
        // Post against the store currently selected in the header - not wherever this batch
        // was originally received - so an adjustment made after a transfer lands on the store
        // it is actually happening at.
        this.service.updateQty({...value, qty: this.plan.signed, auditid: value.auditid || undefined, reasoncode: value.reason, storeid: this.storeContext.selectedStoreId})
            .subscribe(data => {
                this.saving = false;
                this.saved.emit(data);
            }, () => this.saving = false);
    }
}

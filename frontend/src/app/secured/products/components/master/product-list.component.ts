import { Component } from "@angular/core";
import { ProductsService } from "../../products.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    templateUrl: 'product-list.component.html'
})
export class ProductListComponent {

    products:any;
    loading = false;
    criteria:any = {active:true, title: ''};

    /** fill the dosage form of products that have none from their titles: a preview, then the owner applies it */
    formsPanel = false;
    forms:any = null;
    formsBusy = false;
    formsMessage = '';
    formsError = '';

    openForms(){
        this.formsPanel = true; this.formsMessage = this.formsError = ''; this.forms = null; this.formsBusy = true;
        this.service.fillDosageForms(false).subscribe({
            next: r => { this.forms = r; this.formsBusy = false; },
            error: e => { this.formsBusy = false; this.formsError = e?.error?.message || 'The preview could not be made.'; }
        });
    }
    applyForms(){
        this.formsBusy = true; this.formsError = '';
        this.service.fillDosageForms(true).subscribe({
            next: r => { this.formsBusy = false; this.formsMessage = `Filled the dosage form of ${r.filled} products.`; this.forms = null; this.fetchList(); },
            error: e => { this.formsBusy = false; this.formsError = e?.error?.message || 'Could not fill the dosage forms.'; }
        });
    }

    /** fill the composition of products that have none from the brand dictionary: a proposal to look through, then the ticked ones are filled */
    compPanel = false;
    comp:any = null;
    compBusy = false;
    compMessage = '';
    compError = '';
    compPicked: { [id:number]: boolean } = {};

    get compChosen(): number[] { return (this.comp?.rows || []).filter((r:any) => this.compPicked[r.id]).map((r:any) => r.id); }
    compAll(on:boolean){ (this.comp?.rows || []).forEach((r:any) => this.compPicked[r.id] = on); }

    openComp(){
        this.compPanel = true; this.compMessage = this.compError = ''; this.comp = null; this.compBusy = true; this.compPicked = {};
        this.service.fillCompositions(false).subscribe({
            next: r => { this.comp = r; this.compBusy = false; (r.rows || []).forEach((x:any) => this.compPicked[x.id] = true); },
            error: e => { this.compBusy = false; this.compError = e?.error?.message || 'The proposal could not be made.'; }
        });
    }
    applyComp(){
        const ids = this.compChosen;
        if(!ids.length) return;
        this.compBusy = true; this.compError = '';
        this.service.fillCompositions(true, ids).subscribe({
            next: r => {
                this.compBusy = false; this.fetchList();
                // the proposal is made again, so the rest (when more were found than were shown) can be done next
                const message = `Filled the composition of ${r.filled} products.`;
                this.openComp(); this.compMessage = message;
            },
            error: e => { this.compBusy = false; this.compError = e?.error?.message || 'Could not fill the compositions.'; }
        });
    }

    constructor(
        private service:ProductsService,
        private confirm:ConfirmService){}

    ngOnInit(){
        this.fetchList()
    }

    selectCategory(event:any){
        this.fetchList();
    }

    archive(product:any){
        this.confirm.confirmDelete(product?.title, () => {
            this.service.update(product.id, {isArchived:true}).subscribe(() => this.fetchList());
        }, { entity: 'product', verb: 'Archive', consequence: 'It will be hidden from lists; stock history is kept.' });
    }

    changeActive(id:number, flag:boolean, title?:string){
        if (flag) {
            this.service.update(id, {isActive:true}).subscribe(() => this.fetchList());
            return;
        }
        this.confirm.confirmDelete(title, () => {
            this.service.update(id, {isActive:false}).subscribe(() => this.fetchList());
        }, { entity: 'product', verb: 'Deactivate', reversible: true, consequence: 'It will no longer be offered at the counter or on new orders. Stock and history are kept, and you can activate it again.' });
    }

    fetchList(){
        this.loading = true;
        this.service.findByCriteria2(this.criteria).subscribe(data => { this.products = data; this.loading = false; }, () => this.loading = false);
    }

    propsUpdate(event:any){
        
        const props = event.props.filter((p:any) => p.value !== '')
        this.criteria = {...this.criteria, category:event.category, props};
        this.fetchList();
    }

    filter(){
        
        this.fetchList();
    }
}
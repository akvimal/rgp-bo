import { Component } from "@angular/core";
import { ProductsService } from "../../products.service";
import { ConfirmService } from "src/app/shared/confirm.service";

@Component({
    templateUrl: 'product-list.component.html'
})
export class ProductListComponent {

    products:any;
    criteria:any = {active:true, title: ''};

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
        this.service.findByCriteria2(this.criteria).subscribe(data => this.products = data);
    }

    propsUpdate(event:any){
        
        const props = event.props.filter((p:any) => p.value !== '')
        this.criteria = {...this.criteria, category:event.category, props};
        this.fetchList();
        console.log(this.criteria);
    }

    filter(){
        console.log('filter called',this.criteria);
        
        this.fetchList();
    }
}
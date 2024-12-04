import { Component } from "@angular/core";
import { ProductsService } from "../../products.service";

@Component({
    templateUrl: 'product-list.component.html'
})
export class ProductListComponent {

    products:any;
    criteria:any = {active:true, title: ''};

    constructor( 
        private service:ProductsService){}

    ngOnInit(){ 
        this.fetchList()
    }

    selectCategory(event:any){
        this.fetchList();
    }
      
    archive(id:number){
        this.service.update(id, {isArchived:true}).subscribe(data => this.fetchList());
    }

    changeActive(id:number, flag:boolean){
        this.service.update(id, {isActive:flag}).subscribe(data => this.fetchList());
    }

    fetchList(){
        this.service.findByCriteria2(this.criteria).subscribe(data => this.products = data);
    }

    propsUpdate(event:any){
        const props = event.props.filter((p:any) => p.value !== '')
        this.criteria = {...this.criteria, category:event.category, props};
    }

    filter(){
        this.fetchList();
    }
}
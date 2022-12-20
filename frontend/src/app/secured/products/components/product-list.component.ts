import { Component, ViewChild } from "@angular/core";
import { Table } from "primeng/table";
import { ProductsService } from "../products.service";
import { PropsService } from "../props.service";

@Component({
    templateUrl: 'product-list.component.html'
})
export class ProductListComponent {

    products:any;
    category:any = '';

    @ViewChild('dt') dt: Table | undefined;

    constructor(private service:ProductsService,private propsService:PropsService){}

    ngOnInit(){ 
        this.fetchList()
    }
    
    clear(table: Table) {
        table.clear();
    }

    applyFilterGlobal($event:any, stringVal:any) {
        this.dt?.filterGlobal(($event.target as HTMLInputElement).value, stringVal);
    }

    selectCategory(event:any){
        this.fetchList();
    }
      
    delete(id:number){
        this.service.remove(id).subscribe(data => this.fetchList() )
    }

    fetchList(){
        this.service.findAll(this.category && {category:this.category}).subscribe((data:any) => {
            this.products = [...data].map(p => {
                let attrs:any[] = [];
                for (const [key, value] of Object.entries(p.props)) {
                    attrs.push({key:key.toUpperCase(),value});
                }
                return {...p,attrs};
            });
        });
    }
}
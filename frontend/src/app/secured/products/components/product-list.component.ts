import { Component, ViewChild } from "@angular/core";
import { Table } from "primeng/table";
import { ProductsService } from "../products.service";
import { PropsService } from "../props.service";

@Component({
    templateUrl: 'product-list.component.html'
})
export class ProductListComponent {

    products:any;
    propHeads:{id:string,label:string}[] = [];
    category:any;

    @ViewChild('dt') dt: Table | undefined;

    constructor(private service:ProductsService,private propsService:PropsService){
        this.propsService.fetch().subscribe((d:any) => {
            this.propHeads = d.map((c:any)=>{return {id:c.id,label:c.label}})
        });            
    }

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
                this.propsService.fetch().forEach((c:any) => {
                    if(p.props) {
                        c.forEach((i:any) => {
                            attrs.push({label: i.label, value:p.props[i.id]});
                        });
                    }
                });
                return {...p, attrs};
            });
        });
    }
}
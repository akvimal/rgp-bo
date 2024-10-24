import { Component, ViewChild } from "@angular/core";
import { Table } from "primeng/table";
import { Observable } from "rxjs";
import { ConfigService } from "src/app/shared/config.service";
import { ProductsService } from "../products.service";
import { PropsService } from "../props.service";

@Component({
    templateUrl: 'product-list.component.html'
})
export class ProductListComponent {

    products:any;
    category:any = '';
    productProps$?:Observable<any>;

    @ViewChild('dt') dt: Table | undefined;

    constructor(private service:ProductsService,
        private configService:ConfigService){}

    ngOnInit(){ 
        this.productProps$ = this.configService.props;
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
                if(p.props){
                    for (const [key, value] of Object.entries(p.props)) {
                        if(value !== null) {
                            if(Array.isArray(value)) {
                                const items = value.map(d => d.code);
                                attrs.push({key,value:items.join(', ')});
                            }
                            else
                                attrs.push({key,value});
                        }
                    }
                }
                return {...p,attrs,showProps:false};
            });
        });
    }

    toggleProps(prod:any,event:any){
        this.products.forEach((p:any) => {
            if(p.id === prod.id){
                p.showProps = !p.showProps
            }
        });
        event.preventDefault()
    }
}
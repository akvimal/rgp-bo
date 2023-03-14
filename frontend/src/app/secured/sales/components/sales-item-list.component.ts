import { HttpClient } from "@angular/common/http";
import { Component, Input } from "@angular/core";
import { SaleItem } from "../sale-item.model";
import { SaleService } from "../sales.service";
import {saveAs as importedSaveAs} from "file-saver";

@Component({
    selector: 'app-sale-items',
    templateUrl: './sales-item-list.component.html'
})
export class SalesItemListComponent {
    
  @Input() category:any;
  @Input() props:any;   
  items:SaleItem[] = [];

  criteria:{category:string, props:any[], product:string,fromdate:string,todate:string} 
    = {category:'', props:[], product:'',fromdate:'',todate:''}

  constructor(private service:SaleService, private httpClient: HttpClient){}

  ngOnInit(){
    if(this.category){
      this.criteria.category = this.category;
      this.criteria.props = [...this.props];
    }
    this.fetchSaleItems();
  }

  isH1DrugFilter(){
    const present = this.criteria.props.filter(p => (p.id === 'schedule' && p.value === 'H1'));
    return present.length > 0;
  }

    fetchFilterProps(event:any){
      this.criteria.props = []
      this.httpClient.get("/assets/props.json").subscribe((data:any) => {
        const catProps = data.find((d:any) => d.category === this.criteria.category);
        if(catProps){
          const props = catProps.props.filter((p:any) => p.filter)
          props.forEach((pr:any) => {
            this.criteria.props.push({...pr,value:''})
          })
        }});
        this.fetchSaleItems();
    }

    fetchSaleItems(){
         this.service.findAllItems(this.criteria).subscribe((data:any) => this.items = data);
    }

      clearFilter(){
        this.criteria.product = '';
        this.criteria.category = '';
        this.criteria.fromdate='';
        this.criteria.todate ='';
        this.criteria.props = [];
        
        this.fetchSaleItems();
      }

      downloadh1(){
        this.httpClient.post("http://localhost:3000/download/h1schedule", 
        this.criteria,
        {responseType: "blob"}).subscribe((data:any) => {
          const blob = new Blob([data]);
          importedSaveAs(blob, `h1schedule.pdf`);
        });
      }
}
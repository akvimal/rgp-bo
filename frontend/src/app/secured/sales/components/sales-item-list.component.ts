import { Component, Input } from "@angular/core";
import { SaleItem } from "../models/sale-item.model";
import { SaleService } from "../sales.service";
import { saveAs as importedSaveAs } from "file-saver";
import { PropsService } from "src/app/shared/props.service";
import { Observable } from "rxjs";
import { DateUtilService } from "../../date-util.service";

@Component({
  selector: 'app-sale-items',
  templateUrl: './sales-item-list.component.html'
})
export class SalesItemListComponent {

  @Input() category: any;
  props: any;
  items: SaleItem[] = [];
  productProps$?:Observable<any>;

  criteria: { category: string, props: any[], product: string, fromdate: string, todate: string }
    = { category: '', props: [], product: '', fromdate: '', todate: '' }

  constructor(private service: SaleService, private propService:PropsService, private dateService:DateUtilService) { }

  ngOnInit() {
    
    if (this.category) {
      this.criteria.category = this.category; 
    }
    this.productProps$ = this.propService.productProps$;
    this.setDefaultCriteria();
    this.fetchSaleItems();
  }

  setDefaultCriteria(){
    this.criteria.todate = this.dateService.getFormatDate(new Date());
    this.criteria.fromdate = this.dateService.parseDate(new Date());
    this.criteria.product = '';
    this.criteria.category = '';
    this.criteria.props = [];
  }

  fetchFilterProps(event: any) {
    this.criteria.props = [];
    this.propService.productProps$.subscribe(data => {
      const catProps = data.find((d: any) => d.category === this.criteria.category);
      if (catProps) {
        const props = catProps.props.filter((p: any) => p.filter)
        props.forEach((pr: any) => {
          this.criteria.props.push({ ...pr, value: '' })
        })
      }
    });
    this.fetchSaleItems();
  }

  fetchSaleItems() {
    const obj = this.removeNullAndEmpty(this.criteria);
    this.service.findAllItems({...obj
      // , todate: this.dateService.getOtherDate(new Date(this.criteria.todate),1)
    }).subscribe((data: any) => this.items = data);
  }

  removeNullAndEmpty(obj:any){
    let newarr:any[] = []
    const arr = Object.entries(obj);
    
    arr.forEach(a => {
      if(typeof a[1] == 'string' && a[1] !== ''){
        newarr.push(a)
      } 
    });

    const newobj:any = {}
    for (const key of newarr) {
      newobj[key[0]] = key[1];
    }

    let categProps = []
    if(obj.props){
      categProps = obj.props.filter((p:any) => p.value !== '');
    }
    newobj['props'] = categProps;
    return newobj;
  }

  clearFilter() {
    this.setDefaultCriteria();
    this.fetchSaleItems();
  }

  download() {
    const obj = this.removeNullAndEmpty(this.criteria);
    this.service.download({...obj, sign:true
      // todate: this.dateService.getOtherDate(new Date(this.criteria.todate),1)
    }).subscribe((data: any) => {
        importedSaveAs(new Blob([data]), 'salereport.pdf');
    });
  }

}


import { Component } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ReportService } from "../reports.service";
import { saveAs as importedSaveAs } from "file-saver";
import { DateUtilService } from "../../date-util.service";

interface Column {
    field: string;
    header: string;
    type?: string;
    filter?: boolean;
    width?:string;
}

@Component({
    templateUrl: 'reports.component.html'
})
export class ReportsComponent {

    data!: any[];
    cols!: Column[];

    form = new FormGroup({
        report: new FormControl('sale'),
        begin: new FormControl(''),
        end: new FormControl('')
    });
    product:any;

    constructor(private service:ReportService, private dateService: DateUtilService){}
    
    ngOnInit(){
        
        // this.cols = [
        //     { field: 'bill_date', header: 'Bill Date', type: 'date'},
        //     { field: 'bill_no', header: 'Bill No'},
        //     { field: 'customer', header: 'Customer'},
        //     // { field: 'customer_mobile', header: 'Customer Phone', filter:true},
        //     { field: 'sale_total', header: 'Sale Total', type: 'numeric' },
        //     { field: 'product', header: 'Product', filter:true},
        //     { field: 'batch', header: 'Batch'},
        //     // { field: 'exp_date', header: 'Expiry'},
        //     // { field: 'mrp', header: 'MRP', type: 'numeric'},
        //     { field: 'qty', header: 'Qty', type: 'numeric'},
        //     { field: 'price', header: 'Price', type: 'numeric'},
        //     { field: 'item_total', header: 'Item Total', type: 'numeric'}
        //     // { field: 'sale_person', header: 'Sale Person' },
        // ];
        const today = this.dateService.getFormatDate(new Date());
        this.form.controls['begin'].setValue(today);
        this.form.controls['end'].setValue(today);
    }

    propsUpdate(event:any,entity:string){
        this.product = entity == 'product' && event.values;
    }

    onSubmit(action:string){
        let criteria = {...this.form.value};

        if(criteria.begin !== '' || criteria.end !== '') {

            if(criteria.begin === '' && criteria.end !== '') criteria.begin = criteria.end;
            if(criteria.begin !== '' && criteria.end === '') criteria.end = criteria.begin;

            if(this.product)
            criteria = {...criteria, product: this.product}
            
            this.service.search({action, criteria}).subscribe((result:any) => {
                // console.log(result);
                if(action == 'export'){
                    importedSaveAs(new Blob([result]), 'salereport.xlsx');
                }
                else if(action == 'search'){
                    console.log(result);
                    this.data = result;
                }
            });
        }
    }

}
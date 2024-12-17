import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { map } from 'rxjs/operators';
import { saveAs as importedSaveAs } from "file-saver";

import { PurchaseOrderService } from "../purchase-order.service";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";

@Component({
    selector: 'app-purchase-order-view',
    templateUrl: 'purchase-order-view.component.html'
})
export class PurchaseOrderViewComponent {
    
    order:any;
    availrequests:any;
    displayForm:boolean = false;

    form:FormGroup = new FormGroup({
        requestid: new FormControl('',Validators.required),
        // qty: new FormControl(''),
        // comments: new FormControl('')
    });

    constructor(private route:ActivatedRoute, 
        private service:PurchaseOrderService, 
        private reqService:PurchaseIntentService) {}

    ngOnInit() {
        this.route.params.pipe(map(p => p.id)).subscribe(id => {
            this.fetchOrder(+id);
            this.fetchAvailRequests();
        });
        
    }

    fetchOrder(id:number){
        this.service.findById(id).subscribe(data => this.order = data);
    }

    fetchAvailRequests(){
        this.reqService.findAllByCriteria({status:'NEW'}).subscribe((data:any) => {
            this.availrequests = data;
        });
    }

    onAdd() {
        this.displayForm = true;
    }

    onProceed() {
        this.service.update(this.order.id, {
            status: 'SUBMITTED'
        }).subscribe(data => {
            this.fetchOrder(this.order.id);
        });
    }

    delete(id:number){
        this.reqService.removeOrder(id).subscribe(data => {
            this.fetchOrder(this.order.id);
            this.displayForm = false; 
        });
    }

    onSave() {
        this.reqService.update(this.form.value.requestid, {
            status: 'PENDING',
            orderid: this.order.id
        }).subscribe(data => {
            this.fetchOrder(this.order.id);
            this.displayForm = false; 
        });
    }

    onDownload() {
        this.service.download(this.order.id).subscribe((data: any) => {
            const blob = new Blob([data]);
            importedSaveAs(blob, `PO-${this.order.id}.pdf`);
          });
    }
}
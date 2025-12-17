import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { map, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { saveAs as importedSaveAs } from "file-saver";

import { PurchaseOrderService } from "../purchase-order.service";
import { PurchaseIntentService } from "src/app/secured/store/intent/purchase-intent.service";
import { ProductsService } from "../../../products/products.service";

@Component({
    selector: 'app-purchase-order-view',
    templateUrl: 'purchase-order-view.component.html'
})
export class PurchaseOrderViewComponent {

    order:any;
    displayForm:boolean = false;

    // Product search
    productSearchControl = new FormControl('');
    productSuggestions: any[] = [];
    selectedProduct: any = null;

    form:FormGroup = new FormGroup({
        qty: new FormControl(1, [Validators.required, Validators.min(1)]),
        comments: new FormControl('')
    });

    constructor(private route:ActivatedRoute,
        private service:PurchaseOrderService,
        private reqService:PurchaseIntentService,
        private productsService: ProductsService) {}

    ngOnInit() {
        this.route.params.pipe(map(p => p.id)).subscribe(id => {
            this.fetchOrder(+id);
        });
        this.setupProductSearch();
    }

    fetchOrder(id:number){
        this.service.findById(id).subscribe(data => this.order = data);
    }

    setupProductSearch() {
        this.productSearchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap(term => {
                    if (!term || term.length < 2) {
                        return of([]);
                    }
                    return this.productsService.search(term);
                })
            )
            .subscribe({
                next: (results: any) => {
                    this.productSuggestions = Array.isArray(results) ? results : [];
                },
                error: () => {
                    this.productSuggestions = [];
                }
            });
    }

    onProductSelect(product: any) {
        this.selectedProduct = product;
        this.productSearchControl.setValue('');
        this.productSuggestions = [];
    }

    onAdd() {
        this.displayForm = true;
        this.selectedProduct = null;
        this.form.reset({ qty: 1 });
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
        });
    }

    onSave() {
        if (!this.selectedProduct || !this.form.valid) {
            return;
        }

        // Create a purchase request for the selected product
        const requestData = {
            productid: this.selectedProduct.id,
            orderid: this.order.id,
            qty: this.form.value.qty,
            status: 'PENDING',
            comments: this.form.value.comments || `Product: ${this.selectedProduct.title}`
        };

        this.reqService.save(requestData).subscribe({
            next: () => {
                this.fetchOrder(this.order.id);
                this.displayForm = false;
                this.selectedProduct = null;
                this.form.reset({ qty: 1 });
            },
            error: (err) => {
                console.error('Failed to add item:', err);
            }
        });
    }

    onDownload() {
        this.service.download(this.order.id).subscribe((data: any) => {
            const blob = new Blob([data]);
            importedSaveAs(blob, `PO-${this.order.id}.pdf`);
          });
    }

    getStatusClass(status: string): string {
        const statusMap: any = {
            'NEW': 'bg-primary',
            'PENDING': 'bg-warning',
            'SUBMITTED': 'bg-info',
            'APPROVED': 'bg-success',
            'RECEIVED': 'bg-success',
            'CANCELLED': 'bg-danger'
        };
        return statusMap[status] || 'bg-secondary';
    }
}
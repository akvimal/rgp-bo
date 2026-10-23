import { Component, OnDestroy } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { NavigationEnd, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import { VendorsService } from "src/app/secured/purchases/vendors/vendors.service";
import { PurchaseOrderService } from "../purchase-order.service";
import { PO_STATUS_FILTERS, poStatus } from "../po-status";

@Component({
    selector: 'app-purchase-order',
    templateUrl: './purchase-order.component.html',
    styleUrls: ['./purchase-order.component.scss']
})
export class PurchaseOrderComponent implements OnDestroy {

    orders: any[] = [];
    /** the orders as shown: filtered, with the words and flags the list needs */
    rows: any[] = [];
    vendors: any = [];
    displayForm: boolean = false;
    searchTerm: string = '';
    statusFilter: string = 'ALL';
    statusFilters = PO_STATUS_FILTERS;
    hasDetail: boolean = false;
    activeOrderId: number | null = null;
    private subs = new Subscription();

    form: FormGroup = new FormGroup({
        vendorid: new FormControl('', Validators.required),
        expecteddate: new FormControl(''),
        comments: new FormControl('')
    });

    constructor(private service: PurchaseOrderService,
        private vendorService: VendorsService,
        private router: Router) { }

    ngOnInit() {
        this.load();
        this.vendorService.findUsable().subscribe(data => this.vendors = data);
        this.updateActiveOrderId();
        this.subs.add(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.updateActiveOrderId()));
        // an order changed beside this list (submitted, edited, deleted): show it as it is now
        this.subs.add(this.service.changed$.subscribe(() => this.load()));
    }

    ngOnDestroy() { this.subs.unsubscribe(); }

    private updateActiveOrderId() {
        const match = this.router.url.match(/\/purchases\/orders\/(\d+)/);
        this.activeOrderId = match ? +match[1] : null;
    }

    load() {
        this.service.findAll().subscribe((data: any) => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            this.orders = (data || []).map((o: any) => {
                const s = poStatus(o);
                const expected = o.expecteddate ? new Date(o.expecteddate) : null;
                return {
                    ...o,
                    vendorname: o.vendor?.name || 'Unnamed Vendor',
                    statuslabel: s.label, statuscls: s.cls, statushint: s.hint,
                    // expected before today, sent to the vendor, and not all of it has arrived
                    overdue: o.status === 'SUBMITTED' && !!expected && expected < today && (+o.receivedqty || 0) < (+o.orderedqty || 0)
                };
            });
            this.applyFilters();
        });
    }

    /** the list is rebuilt when a filter changes, not on every screen refresh */
    applyFilters() {
        const search = `${this.searchTerm || ''}`.trim().toLowerCase();
        this.rows = this.orders.filter((order: any) => {
            const matchesSearch = !search || [
                order.vendorname, order.ponumber, order.id, order.statuslabel, order.comments, order.expecteddate
            ].some((value: any) => `${value || ''}`.toLowerCase().includes(search));
            const matchesStatus = this.statusFilter === 'ALL' || `${order.status || ''}` === this.statusFilter;
            return matchesSearch && matchesStatus;
        });
    }

    open(order: any) {
        this.router.navigate(['/secure/purchases/orders', order.id]);
    }

    add() {
        this.displayForm = true;
        this.form.reset({ vendorid: '', expecteddate: '', comments: '' });
    }

    /** a new order opens straight away, so its items can be added */
    onSave() {
        this.service.save({ ...this.form.value, expecteddate: this.form.value.expecteddate || null } as any).subscribe((data: any) => {
            this.displayForm = false;
            this.load();
            if (data?.id) this.router.navigate(['/secure/purchases/orders', data.id]);
        });
    }
}

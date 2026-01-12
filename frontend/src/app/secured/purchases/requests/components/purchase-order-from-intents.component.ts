import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { VendorsService } from "src/app/secured/purchases/vendors/vendors.service";
import { IntentService } from "src/app/secured/sales/intent/intent.service";
import { PurchaseOrderService } from "../purchase-order.service";
import { SalesIntent } from "src/app/secured/sales/intent/intent.model";

@Component({
    selector: 'app-purchase-order-from-intents',
    templateUrl: './purchase-order-from-intents.component.html',
    styles: [`
        .intent-card {
            cursor: pointer;
            transition: all 0.2s;
            border-left: 4px solid transparent;
        }
        .intent-card.selected {
            border-left-color: #0d6efd;
            background-color: #e7f1ff;
        }
        .intent-card:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .badge-priority {
            font-size: 0.75rem;
            padding: 0.25rem 0.5rem;
        }
        .intent-type {
            font-size: 0.875rem;
            color: #6c757d;
        }
    `]
})
export class PurchaseOrderFromIntentsComponent implements OnInit {

    pendingIntents: SalesIntent[] = [];
    selectedIntentIds: Set<number> = new Set();
    vendors: any[] = [];
    loading: boolean = false;
    errorMessage: string | null = null;
    successMessage: string | null = null;

    form: FormGroup = new FormGroup({
        vendorid: new FormControl('', Validators.required),
        comments: new FormControl('')
    });

    constructor(
        private intentService: IntentService,
        private vendorService: VendorsService,
        private poService: PurchaseOrderService,
        private router: Router
    ) {}

    ngOnInit() {
        this.loadPendingIntents();
        this.loadVendors();
    }

    loadPendingIntents() {
        this.loading = true;
        this.intentService.getPendingForPO().subscribe({
            next: (data) => {
                this.pendingIntents = data;
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load pending intents: ' + error.message;
                this.loading = false;
            }
        });
    }

    loadVendors() {
        this.vendorService.findAll().subscribe({
            next: (data: any) => this.vendors = data,
            error: (error) => console.error('Failed to load vendors:', error)
        });
    }

    toggleIntentSelection(intentId: number) {
        if (this.selectedIntentIds.has(intentId)) {
            this.selectedIntentIds.delete(intentId);
        } else {
            this.selectedIntentIds.add(intentId);
        }
    }

    isSelected(intentId: number): boolean {
        return this.selectedIntentIds.has(intentId);
    }

    selectAll() {
        this.pendingIntents.forEach(intent => {
            if (intent.id) {
                this.selectedIntentIds.add(intent.id);
            }
        });
    }

    clearSelection() {
        this.selectedIntentIds.clear();
    }

    getSelectedCount(): number {
        return this.selectedIntentIds.size;
    }

    getTotalQuantity(): number {
        return this.pendingIntents
            .filter(intent => intent.id && this.selectedIntentIds.has(intent.id))
            .reduce((sum, intent) => sum + intent.requestedqty, 0);
    }

    onCreatePO() {
        if (!this.form.valid) {
            this.errorMessage = 'Please select a vendor';
            return;
        }

        if (this.selectedIntentIds.size === 0) {
            this.errorMessage = 'Please select at least one intent';
            return;
        }

        this.loading = true;
        this.errorMessage = null;

        const payload = {
            vendorid: parseInt(this.form.value.vendorid),
            intentIds: Array.from(this.selectedIntentIds),
            comments: this.form.value.comments
        };

        this.poService.createFromIntents(payload).subscribe({
            next: (result: any) => {
                this.successMessage = `Purchase Order created successfully with ${this.selectedIntentIds.size} intents`;
                this.loading = false;

                // Navigate to the created PO
                setTimeout(() => {
                    this.router.navigate(['/secure/purchases/orders', result.id]);
                }, 1500);
            },
            error: (error) => {
                this.errorMessage = 'Failed to create PO: ' + (error.error?.message || error.message);
                this.loading = false;
            }
        });
    }

    getPriorityBadgeClass(priority: string): string {
        switch (priority) {
            case 'URGENT': return 'bg-danger';
            case 'HIGH': return 'bg-warning';
            case 'MEDIUM': return 'bg-info';
            case 'LOW': return 'bg-secondary';
            default: return 'bg-secondary';
        }
    }

    getTypeBadgeClass(type: string): string {
        switch (type) {
            case 'LOW_STOCK': return 'bg-warning';
            case 'CUSTOMER_REQUEST': return 'bg-primary';
            case 'MARKET_DEMAND': return 'bg-success';
            case 'OTHER': return 'bg-secondary';
            default: return 'bg-secondary';
        }
    }
}

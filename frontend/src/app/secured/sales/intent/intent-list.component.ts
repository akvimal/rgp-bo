import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IntentService } from './intent.service';
import { SalesIntent } from './intent.model';

@Component({
    selector: 'app-intent-list',
    templateUrl: './intent-list.component.html'
})
export class IntentListComponent implements OnInit {
    intents: SalesIntent[] = [];
    filteredIntents: SalesIntent[] = [];
    loading: boolean = false;
    errorMessage: string = '';

    // Filter options
    statusFilter: string = '';
    typeFilter: string = '';
    priorityFilter: string = '';
    fulfillmentFilter: string = '';

    // Filter values
    statusOptions = ['', 'PENDING', 'IN_PO', 'FULFILLED', 'CANCELLED'];
    typeOptions = ['', 'CUSTOMER_REQUEST', 'LOW_STOCK', 'MARKET_DEMAND', 'OTHER'];
    priorityOptions = ['', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    fulfillmentOptions = ['', 'NOT_STARTED', 'PO_CREATED', 'GOODS_RECEIVED', 'CUSTOMER_NOTIFIED', 'DELIVERED'];

    constructor(
        private intentService: IntentService,
        private router: Router
    ) {}

    ngOnInit() {
        this.loadIntents();
    }

    loadIntents() {
        this.loading = true;
        this.errorMessage = '';

        const filters: any = {};
        if (this.statusFilter) filters.status = this.statusFilter;
        if (this.typeFilter) filters.intenttype = this.typeFilter;
        if (this.priorityFilter) filters.priority = this.priorityFilter;
        if (this.fulfillmentFilter) filters.fulfillmentstatus = this.fulfillmentFilter;

        this.intentService.findAll(filters).subscribe({
            next: (data) => {
                this.intents = data;
                this.filteredIntents = data;
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load intents: ' + error.message;
                this.loading = false;
            }
        });
    }

    applyFilters() {
        this.loadIntents();
    }

    clearFilters() {
        this.statusFilter = '';
        this.typeFilter = '';
        this.priorityFilter = '';
        this.fulfillmentFilter = '';
        this.loadIntents();
    }

    createNew() {
        this.router.navigate(['/secure/sales/intent/new']);
    }

    edit(id: number) {
        this.router.navigate(['/secure/sales/intent/edit', id]);
    }

    view(id: number) {
        this.router.navigate(['/secure/sales/intent/view', id]);
    }

    delete(id: number) {
        if (!confirm('Are you sure you want to delete this intent?')) {
            return;
        }

        this.intentService.delete(id).subscribe({
            next: () => {
                alert('Intent deleted successfully');
                this.loadIntents();
            },
            error: (error) => {
                alert('Failed to delete intent: ' + error.error?.message || error.message);
            }
        });
    }

    cancel(id: number) {
        const reason = prompt('Enter cancellation reason (optional):');

        this.intentService.cancel(id, reason || undefined).subscribe({
            next: () => {
                alert('Intent cancelled successfully');
                this.loadIntents();
            },
            error: (error) => {
                alert('Failed to cancel intent: ' + error.error?.message || error.message);
            }
        });
    }

    getStatusBadgeClass(status?: string): string {
        switch (status) {
            case 'PENDING': return 'badge bg-warning';
            case 'IN_PO': return 'badge bg-info';
            case 'FULFILLED': return 'badge bg-success';
            case 'CANCELLED': return 'badge bg-danger';
            default: return 'badge bg-secondary';
        }
    }

    getPriorityBadgeClass(priority?: string): string {
        switch (priority) {
            case 'URGENT': return 'badge bg-danger';
            case 'HIGH': return 'badge bg-warning';
            case 'MEDIUM': return 'badge bg-info';
            case 'LOW': return 'badge bg-secondary';
            default: return 'badge bg-secondary';
        }
    }

    getTypeBadgeClass(type?: string): string {
        switch (type) {
            case 'CUSTOMER_REQUEST': return 'badge bg-primary';
            case 'LOW_STOCK': return 'badge bg-warning';
            case 'MARKET_DEMAND': return 'badge bg-info';
            case 'OTHER': return 'badge bg-secondary';
            default: return 'badge bg-secondary';
        }
    }

    formatType(type: string): string {
        return type.replace(/_/g, ' ');
    }

    formatStatus(status: string): string {
        return status.replace(/_/g, ' ');
    }
}

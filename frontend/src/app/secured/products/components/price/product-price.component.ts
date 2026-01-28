import { Component } from "@angular/core";
import { ProductPrice } from "../../product-price.model";
import { ProductsService } from "../../products.service";

@Component({
    templateUrl: 'product-price.component.html'
})
export class ProductPriceComponent {

    criteria = {active:true,title:''}
    statusFilter: string = 'active'; // 'all', 'active', 'inactive'
    productid=0;

    products:any[] = [];
    allProducts:any[] = []; // Store all products for client-side filtering
    filteredProducts:any[] = []; // Products after all filters applied
    showPriceChange:boolean = false;
    loading = false;
    error: string | null = null;

    // Advanced filters
    selectedCategories: string[] = [];
    availableCategories: string[] = [];
    stockStatusFilter: string = 'all'; // 'all', 'out', 'low', 'in'
    marginMin: number | null = null;
    marginMax: number | null = null;
    discountMin: number | null = null;
    discountMax: number | null = null;
    priceAgeFilter: string = 'all'; // 'all', 'recent', 'month', 'quarter', 'stale'
    showAdvancedFilters = false;

    // Column visibility
    columnVisibility = {
        category: true,
        stock: true,
        ptr: true,
        price: true,
        margin: true,
        discount: true,
        mrp: true,
        priceAge: true,
        updated: true
    };
    showColumnToggle = false;

    // Pricing alerts
    pricingAlerts = {
        belowPTR: [] as any[],
        negativeMargin: [] as any[],
        highDiscount: [] as any[],
        stalePrice: [] as any[]
    };

    // Multi-select for bulk operations
    selectedProducts: Set<number> = new Set();
    selectAll: boolean = false;
    showBulkAdjustDialog: boolean = false;
    bulkAdjustment = {
        type: 'percentage', // 'percentage' or 'fixed'
        operation: 'increase', // 'increase' or 'decrease'
        value: 0,
        reason: '',
        effectiveDate: ''
    };

    // Quick view
    expandedProductId: number | null = null;
    priceHistory: any[] = [];
    loadingHistory: boolean = false;

    constructor(private service:ProductsService){}

    ngOnInit(){
       this.loadColumnVisibility();
       this.filter();
    }

    loadColumnVisibility() {
        const saved = localStorage.getItem('productPriceColumnVisibility');
        if (saved) {
            this.columnVisibility = JSON.parse(saved);
        }
    }

    saveColumnVisibility() {
        localStorage.setItem('productPriceColumnVisibility', JSON.stringify(this.columnVisibility));
    }

    filter(){
        this.loading = true;
        this.error = null;

        // Update criteria based on status filter
        if (this.statusFilter === 'all') {
            // For 'all', we need to fetch both active and inactive
            // We'll do two queries and merge, or modify backend to support null active filter
            this.criteria.active = true;
        } else {
            this.criteria.active = this.statusFilter === 'active';
        }

        this.service.findAllPrices(this.criteria).subscribe({
            next: (data:any) => {
                this.allProducts = data;
                this.extractCategories(data);
                this.applyAdvancedFilters();
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading prices:', error);
                this.error = 'Failed to load pricing data. Please try again.';
                this.loading = false;
            }
        });
    }

    extractCategories(products: any[]) {
        const categorySet = new Set<string>();
        products.forEach(p => {
            if (p.category) {
                categorySet.add(p.category);
            }
        });
        this.availableCategories = Array.from(categorySet).sort();
    }

    applyAdvancedFilters() {
        let filtered = [...this.allProducts];

        // Category filter
        if (this.selectedCategories.length > 0) {
            filtered = filtered.filter(p =>
                p.category && this.selectedCategories.includes(p.category)
            );
        }

        // Stock status filter
        if (this.stockStatusFilter !== 'all') {
            filtered = filtered.filter(p => {
                const stock = p.current_stock || 0;
                switch(this.stockStatusFilter) {
                    case 'out': return stock === 0;
                    case 'low': return stock > 0 && stock < 20;
                    case 'in': return stock >= 20;
                    default: return true;
                }
            });
        }

        // Margin range filter
        if (this.marginMin !== null) {
            filtered = filtered.filter(p => (p.margin || 0) >= this.marginMin!);
        }
        if (this.marginMax !== null) {
            filtered = filtered.filter(p => (p.margin || 0) <= this.marginMax!);
        }

        // Discount range filter
        if (this.discountMin !== null) {
            filtered = filtered.filter(p => (p.discount || 0) >= this.discountMin!);
        }
        if (this.discountMax !== null) {
            filtered = filtered.filter(p => (p.discount || 0) <= this.discountMax!);
        }

        // Price age filter
        if (this.priceAgeFilter !== 'all') {
            filtered = filtered.filter(p => {
                const days = p.price_age_days || 0;
                switch(this.priceAgeFilter) {
                    case 'recent': return days < 30;
                    case 'month': return days >= 30 && days < 90;
                    case 'quarter': return days >= 90 && days < 180;
                    case 'stale': return days >= 180;
                    default: return true;
                }
            });
        }

        this.filteredProducts = filtered;
        this.products = filtered;
        this.calculatePricingAlerts();
    }

    onAdvancedFilterChange() {
        this.applyAdvancedFilters();
    }

    clearAdvancedFilters() {
        this.selectedCategories = [];
        this.stockStatusFilter = 'all';
        this.marginMin = null;
        this.marginMax = null;
        this.discountMin = null;
        this.discountMax = null;
        this.priceAgeFilter = 'all';
        this.applyAdvancedFilters();
    }

    toggleColumn(column: string) {
        (this.columnVisibility as any)[column] = !(this.columnVisibility as any)[column];
        this.saveColumnVisibility();
    }

    hasActiveFilters(): boolean {
        return this.selectedCategories.length > 0 ||
               this.stockStatusFilter !== 'all' ||
               this.marginMin !== null ||
               this.marginMax !== null ||
               this.discountMin !== null ||
               this.discountMax !== null ||
               this.priceAgeFilter !== 'all';
    }

    onStatusFilterChange(status: string) {
        this.statusFilter = status;
        this.filter();
    }

    calculatePricingAlerts() {
        this.pricingAlerts = {
            belowPTR: [],
            negativeMargin: [],
            highDiscount: [],
            stalePrice: []
        };

        this.products.forEach(product => {
            // Below PTR check
            if (product.price < product.ptr) {
                this.pricingAlerts.belowPTR.push(product);
            }

            // Negative margin check
            if (product.margin < 0) {
                this.pricingAlerts.negativeMargin.push(product);
            }

            // High discount check (>30%)
            if (product.discount > 30) {
                this.pricingAlerts.highDiscount.push(product);
            }

            // Stale price check (>180 days)
            if (product.price_age_days && product.price_age_days > 180) {
                this.pricingAlerts.stalePrice.push(product);
            }
        });
    }

    getMarginBadgeClass(margin: number): string {
        if (margin < 0) return 'badge bg-danger';
        if (margin < 10) return 'badge bg-danger';
        if (margin < 25) return 'badge bg-warning text-dark';
        return 'badge bg-success';
    }

    getDiscountBadgeClass(discount: number): string {
        if (discount > 20) return 'badge bg-danger';
        if (discount >= 10) return 'badge bg-warning text-dark';
        return 'badge bg-primary';
    }

    getStockBadgeClass(stock: number): string {
        if (stock === 0) return 'badge bg-danger';
        if (stock < 20) return 'badge bg-warning text-dark';
        return 'badge bg-success';
    }

    getStockStatusText(stock: number): string {
        if (stock === 0) return 'Out of Stock';
        if (stock < 20) return 'Low Stock';
        return 'In Stock';
    }

    getPriceTrendIcon(trend: string): string {
        if (trend === 'up') return 'bi-arrow-up-circle text-success';
        if (trend === 'down') return 'bi-arrow-down-circle text-danger';
        return 'bi-dash-circle text-muted';
    }

    getPriceAgeBadgeClass(days: number): string {
        if (!days) return 'badge bg-secondary';
        if (days < 30) return 'badge bg-success';
        if (days < 90) return 'badge bg-info';
        if (days < 180) return 'badge bg-warning text-dark';
        return 'badge bg-danger';
    }

    formatPriceAge(days: number): string {
        if (!days) return 'N/A';
        if (days < 30) return `${Math.floor(days)}d`;
        if (days < 365) return `${Math.floor(days / 30)}mo`;
        return `${Math.floor(days / 365)}y`;
    }

    onRowEditInit(product: ProductPrice) {
    //  console.log('onRowEditInit',product);
    }

    onRowEditSave(product: ProductPrice) {
        console.log('onRowEditSave',product);
        if(product['price_id']){ //update price
            console.log('update price');
            this.service.updatePrice(product).subscribe(data => {
                console.log(data);
            })
        }
        else { //add new price to the rpduct
            console.log('add price');
            this.service.addPrice(product).subscribe(data => {
                console.log(data);
            })
        }
    }

    onRowEditCancel(product: ProductPrice, index: number) {
        // console.log('onRowEditCancel',product);
        // console.log('index: ',index);
    }

    changePrice(productid:number){
        this.productid=productid;
        this.showPriceChange = true;
    }

    changed(event:any){
        console.log(event);
        this.showPriceChange = false;
        this.filter(); // Refresh data after price change
    }

    hasAlerts(): boolean {
        return this.pricingAlerts.belowPTR.length > 0 ||
               this.pricingAlerts.negativeMargin.length > 0 ||
               this.pricingAlerts.highDiscount.length > 0 ||
               this.pricingAlerts.stalePrice.length > 0;
    }

    // Multi-select operations
    toggleProductSelection(productId: number) {
        if (this.selectedProducts.has(productId)) {
            this.selectedProducts.delete(productId);
        } else {
            this.selectedProducts.add(productId);
        }
        this.updateSelectAllState();
    }

    toggleSelectAll() {
        if (this.selectAll) {
            // Deselect all
            this.selectedProducts.clear();
            this.selectAll = false;
        } else {
            // Select all visible products
            this.products.forEach(p => this.selectedProducts.add(p.id));
            this.selectAll = true;
        }
    }

    updateSelectAllState() {
        this.selectAll = this.products.length > 0 &&
                         this.products.every(p => this.selectedProducts.has(p.id));
    }

    isProductSelected(productId: number): boolean {
        return this.selectedProducts.has(productId);
    }

    getSelectedCount(): number {
        return this.selectedProducts.size;
    }

    clearSelection() {
        this.selectedProducts.clear();
        this.selectAll = false;
    }

    // Bulk price adjustment
    openBulkAdjustDialog() {
        if (this.selectedProducts.size === 0) {
            alert('Please select at least one product');
            return;
        }

        const today = new Date();
        this.bulkAdjustment.effectiveDate = today.toISOString().split('T')[0];
        this.showBulkAdjustDialog = true;
    }

    calculateBulkPreview(): any[] {
        const selectedProductData = this.products.filter(p => this.selectedProducts.has(p.id));
        return selectedProductData.map(p => {
            let newPrice = p.price;
            if (this.bulkAdjustment.type === 'percentage') {
                const change = (p.price * this.bulkAdjustment.value) / 100;
                newPrice = this.bulkAdjustment.operation === 'increase' ?
                           p.price + change : p.price - change;
            } else {
                newPrice = this.bulkAdjustment.operation === 'increase' ?
                           p.price + this.bulkAdjustment.value :
                           p.price - this.bulkAdjustment.value;
            }

            // Ensure price stays within PTR and MRP bounds
            newPrice = Math.max(p.ptr, Math.min(p.mrp, newPrice));

            const newMargin = ((newPrice - p.ptr) / p.ptr) * 100;
            const newDiscount = ((p.mrp - newPrice) / p.mrp) * 100;

            return {
                ...p,
                oldPrice: p.price,
                newPrice: newPrice,
                newMargin: newMargin,
                newDiscount: newDiscount,
                priceChange: newPrice - p.price
            };
        });
    }

    applyBulkAdjustment() {
        if (!this.bulkAdjustment.reason || this.bulkAdjustment.value <= 0) {
            alert('Please provide a reason and valid adjustment value');
            return;
        }

        const preview = this.calculateBulkPreview();
        const confirmMessage = `Apply bulk price adjustment to ${preview.length} products?\n\n` +
                              `Type: ${this.bulkAdjustment.type}\n` +
                              `Operation: ${this.bulkAdjustment.operation} by ${this.bulkAdjustment.value}${this.bulkAdjustment.type === 'percentage' ? '%' : ''}\n` +
                              `Reason: ${this.bulkAdjustment.reason}`;

        if (!confirm(confirmMessage)) {
            return;
        }

        this.loading = true;
        let completedCount = 0;
        let errorCount = 0;

        preview.forEach(item => {
            const priceData = {
                id: item.id,
                sale: item.newPrice,
                date: this.bulkAdjustment.effectiveDate,
                reason: this.bulkAdjustment.reason,
                comments: `Bulk adjustment: ${this.bulkAdjustment.operation} ${this.bulkAdjustment.value}${this.bulkAdjustment.type === 'percentage' ? '%' : ''}`
            };

            this.service.addPrice(priceData).subscribe({
                next: () => {
                    completedCount++;
                    if (completedCount + errorCount === preview.length) {
                        this.finalizeBulkAdjustment(completedCount, errorCount);
                    }
                },
                error: (err) => {
                    console.error(`Error updating product ${item.id}:`, err);
                    errorCount++;
                    if (completedCount + errorCount === preview.length) {
                        this.finalizeBulkAdjustment(completedCount, errorCount);
                    }
                }
            });
        });
    }

    finalizeBulkAdjustment(successCount: number, errorCount: number) {
        this.loading = false;
        this.showBulkAdjustDialog = false;

        let message = `Bulk adjustment complete!\n`;
        message += `✓ ${successCount} products updated successfully\n`;
        if (errorCount > 0) {
            message += `✗ ${errorCount} products failed to update`;
        }

        alert(message);

        this.clearSelection();
        this.filter(); // Refresh data
    }

    cancelBulkAdjustment() {
        this.showBulkAdjustDialog = false;
        this.bulkAdjustment = {
            type: 'percentage',
            operation: 'increase',
            value: 0,
            reason: '',
            effectiveDate: ''
        };
    }

    // Quick price history view
    togglePriceHistory(productId: number) {
        if (this.expandedProductId === productId) {
            this.expandedProductId = null;
            this.priceHistory = [];
        } else {
            this.expandedProductId = productId;
            this.loadPriceHistory(productId);
        }
    }

    loadPriceHistory(productId: number) {
        this.loadingHistory = true;
        this.service.findPricesById(productId).subscribe({
            next: (data: any) => {
                this.priceHistory = data.history || [];
                this.loadingHistory = false;
            },
            error: (error) => {
                console.error('Error loading price history:', error);
                this.priceHistory = [];
                this.loadingHistory = false;
            }
        });
    }

    isHistoryExpanded(productId: number): boolean {
        return this.expandedProductId === productId;
    }

    // Advanced metrics
    calculateProfitPerUnit(product: any): number {
        return product.price - product.ptr;
    }

    calculatePotentialRevenue(product: any): number {
        return product.price * (product.current_stock || 0);
    }

    calculateInventoryValue(product: any): number {
        return product.ptr * (product.current_stock || 0);
    }
}
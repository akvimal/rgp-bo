import { Component } from "@angular/core";
import { ProductsService } from "../../products.service";
import { ConfirmationService, MessageService } from "primeng/api";

@Component({
    templateUrl: 'product-list.component.html',
    providers: [ConfirmationService, MessageService]
})
export class ProductListComponent {

    products: any;
    criteria: any = { active: true, title: '' };
    statusFilter: string = 'active'; // 'all', 'active', 'inactive'
    loading: boolean = false;
    categories: string[] = [];
    selectedCategory: string | null = null;

    // Column visibility
    columns = {
        code: false,
        hsn: false,
        brand: false,
        stock: true,
        price: true,
        margin: true
    };
    showColumnToggles: boolean = false;

    // Stock status filter options
    stockStatuses = [
        { label: 'All Stock Levels', value: null },
        { label: 'In Stock', value: 'instock' },
        { label: 'Low Stock', value: 'lowstock' },
        { label: 'Out of Stock', value: 'outofstock' }
    ];
    selectedStockStatus: string | null = null;

    // Bulk operations
    selectedProducts: Set<number> = new Set();
    selectAll: boolean = false;

    // Quick view modal
    showQuickView: boolean = false;
    quickViewProduct: any = null;

    // Advanced filters
    showAdvancedFilters: boolean = false;
    dateRangeFrom: Date | null = null;
    dateRangeTo: Date | null = null;
    priceMin: number | null = null;
    priceMax: number | null = null;
    marginMin: number | null = null;
    marginMax: number | null = null;

    constructor(
        private service: ProductsService,
        private confirmationService: ConfirmationService,
        private messageService: MessageService
    ) { }

    ngOnInit() {
        this.loadCategories();
        this.fetchList();
    }

    /**
     * Load categories for dropdown filter
     */
    loadCategories() {
        this.service.getCategories().subscribe({
            next: (data) => {
                this.categories = data;
            },
            error: (error) => {
                console.error('Error loading categories:', error);
            }
        });
    }

    /**
     * Handle category filter change
     */
    onCategoryChange(category: string | null) {
        if (category) {
            this.criteria.category = category;
        } else {
            delete this.criteria.category;
        }
        this.filter();
    }

    /**
     * Toggle column visibility panel
     */
    toggleColumns() {
        this.showColumnToggles = !this.showColumnToggles;
    }

    /**
     * Get stock badge class based on stock level
     */
    getStockBadgeClass(product: any): string {
        if (!product.currentStock || product.currentStock === 0) {
            return 'badge bg-danger';
        }
        // Low stock threshold: less than 20 units
        if (product.currentStock < 20) {
            return 'badge bg-warning text-dark';
        }
        return 'badge bg-success';
    }

    /**
     * Get stock status text
     */
    getStockStatusText(product: any): string {
        if (!product.currentStock || product.currentStock === 0) {
            return 'Out of Stock';
        }
        if (product.currentStock < 20) {
            return 'Low Stock';
        }
        return 'In Stock';
    }

    /**
     * Filter products by stock status
     */
    filterByStockStatus() {
        // Stock filtering will be done client-side for Phase 2
        this.filter();
    }

    /**
     * Get filtered products based on stock status and advanced filters
     */
    get filteredProducts() {
        if (!this.products) return [];

        let filtered = this.products;

        // Apply stock status filter if selected
        if (this.selectedStockStatus) {
            filtered = filtered.filter((product: any) => {
                const stock = product.currentStock || 0;
                switch (this.selectedStockStatus) {
                    case 'outofstock':
                        return stock === 0;
                    case 'lowstock':
                        return stock > 0 && stock < 20;
                    case 'instock':
                        return stock >= 20;
                    default:
                        return true;
                }
            });
        }

        // Apply date range filter
        if (this.dateRangeFrom || this.dateRangeTo) {
            filtered = filtered.filter((product: any) => {
                const updateDate = new Date(product.updatedon);
                if (this.dateRangeFrom && updateDate < this.dateRangeFrom) return false;
                if (this.dateRangeTo && updateDate > this.dateRangeTo) return false;
                return true;
            });
        }

        // Apply price range filter
        if (this.priceMin !== null || this.priceMax !== null) {
            filtered = filtered.filter((product: any) => {
                const price = product.salePrice || 0;
                if (this.priceMin !== null && price < this.priceMin) return false;
                if (this.priceMax !== null && price > this.priceMax) return false;
                return true;
            });
        }

        // Apply margin range filter
        if (this.marginMin !== null || this.marginMax !== null) {
            filtered = filtered.filter((product: any) => {
                const margin = product.margin || 0;
                if (this.marginMin !== null && margin < this.marginMin) return false;
                if (this.marginMax !== null && margin > this.marginMax) return false;
                return true;
            });
        }

        return filtered;
    }

    /**
     * Handle status filter radio button change
     */
    onStatusFilterChange() {
        switch (this.statusFilter) {
            case 'all':
                delete this.criteria.active;
                break;
            case 'active':
                this.criteria.active = true;
                break;
            case 'inactive':
                this.criteria.active = false;
                break;
        }
        this.filter();
    }

    selectCategory(event: any) {
        this.fetchList();
    }

    /**
     * Confirm before archiving product
     */
    confirmArchive(product: any) {
        this.confirmationService.confirm({
            message: `Are you sure you want to archive "${product.title}"? This action cannot be easily undone.`,
            header: 'Confirm Archive',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.archive(product.id);
            }
        });
    }

    /**
     * Archive product
     */
    archive(id: number) {
        this.loading = true;
        this.service.update(id, { isArchived: true }).subscribe({
            next: (data) => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'Product archived successfully'
                });
                this.fetchList();
            },
            error: (error) => {
                this.loading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to archive product'
                });
            }
        });
    }

    /**
     * Confirm before deactivating product
     */
    confirmDeactivate(product: any) {
        this.confirmationService.confirm({
            message: `Are you sure you want to deactivate "${product.title}"? It will no longer be available for sale.`,
            header: 'Confirm Deactivate',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.changeActive(product.id, false);
            }
        });
    }

    /**
     * Change product active status
     */
    changeActive(id: number, flag: boolean) {
        this.loading = true;
        this.service.update(id, { isActive: flag }).subscribe({
            next: (data) => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: `Product ${flag ? 'activated' : 'deactivated'} successfully`
                });
                this.fetchList();
            },
            error: (error) => {
                this.loading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: `Failed to ${flag ? 'activate' : 'deactivate'} product`
                });
            }
        });
    }

    /**
     * Fetch product list
     */
    fetchList() {
        this.loading = true;
        this.service.findByCriteria2(this.criteria).subscribe({
            next: (data) => {
                this.products = data;
                this.loading = false;
            },
            error: (error) => {
                this.loading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'Failed to load products'
                });
            }
        });
    }

    /**
     * Update properties filter
     */
    propsUpdate(event: any) {
        const props = event.props.filter((p: any) => p.value !== '');
        this.criteria = { ...this.criteria, category: event.category, props };
        this.fetchList();
    }

    /**
     * Apply filters
     */
    filter() {
        this.fetchList();
    }

    /**
     * Check if any filters are active
     */
    hasActiveFilters(): boolean {
        return !!(this.criteria.title || this.criteria.category ||
                 (this.criteria.props && this.criteria.props.length > 0) ||
                 this.statusFilter !== 'active' ||
                 this.selectedStockStatus ||
                 this.hasAdvancedFilters());
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.criteria = { active: true, title: '' };
        this.statusFilter = 'active';
        this.selectedCategory = null;
        this.selectedStockStatus = null;
        this.clearAdvancedFilters();
        this.fetchList();
    }

    /**
     * Toggle advanced filters visibility
     */
    toggleAdvancedFilters() {
        this.showAdvancedFilters = !this.showAdvancedFilters;
    }

    /**
     * Clear advanced filters
     */
    clearAdvancedFilters() {
        this.dateRangeFrom = null;
        this.dateRangeTo = null;
        this.priceMin = null;
        this.priceMax = null;
        this.marginMin = null;
        this.marginMax = null;
    }

    /**
     * Check if advanced filters are active
     */
    hasAdvancedFilters(): boolean {
        return !!(this.dateRangeFrom || this.dateRangeTo ||
                 this.priceMin !== null || this.priceMax !== null ||
                 this.marginMin !== null || this.marginMax !== null);
    }

    /**
     * Toggle select all products
     */
    toggleSelectAll() {
        if (this.selectAll) {
            // Select all visible products
            this.filteredProducts.forEach((product: any) => {
                this.selectedProducts.add(product.id);
            });
        } else {
            // Deselect all
            this.selectedProducts.clear();
        }
    }

    /**
     * Toggle individual product selection
     */
    toggleProductSelection(productId: number) {
        if (this.selectedProducts.has(productId)) {
            this.selectedProducts.delete(productId);
            this.selectAll = false;
        } else {
            this.selectedProducts.add(productId);
            // Check if all visible products are selected
            this.selectAll = this.filteredProducts.every((p: any) => this.selectedProducts.has(p.id));
        }
    }

    /**
     * Check if product is selected
     */
    isProductSelected(productId: number): boolean {
        return this.selectedProducts.has(productId);
    }

    /**
     * Get count of selected products
     */
    get selectedCount(): number {
        return this.selectedProducts.size;
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedProducts.clear();
        this.selectAll = false;
    }

    /**
     * Open quick view modal for product
     */
    openQuickView(product: any) {
        this.quickViewProduct = product;
        this.showQuickView = true;
    }

    /**
     * Close quick view modal
     */
    closeQuickView() {
        this.showQuickView = false;
        this.quickViewProduct = null;
    }

    /**
     * Bulk activate products
     */
    bulkActivate() {
        if (this.selectedProducts.size === 0) return;

        this.confirmationService.confirm({
            message: `Are you sure you want to activate ${this.selectedProducts.size} product(s)?`,
            header: 'Confirm Bulk Activate',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.executeBulkOperation(true);
            }
        });
    }

    /**
     * Bulk deactivate products
     */
    bulkDeactivate() {
        if (this.selectedProducts.size === 0) return;

        this.confirmationService.confirm({
            message: `Are you sure you want to deactivate ${this.selectedProducts.size} product(s)? They will no longer be available for sale.`,
            header: 'Confirm Bulk Deactivate',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.executeBulkOperation(false);
            }
        });
    }

    /**
     * Execute bulk activate/deactivate operation
     */
    private executeBulkOperation(activateFlag: boolean) {
        this.loading = true;
        const productIds = Array.from(this.selectedProducts);
        let completedCount = 0;
        let errorCount = 0;

        productIds.forEach(id => {
            this.service.update(id, { isActive: activateFlag }).subscribe({
                next: () => {
                    completedCount++;
                    if (completedCount + errorCount === productIds.length) {
                        this.finalizeBulkOperation(completedCount, errorCount, activateFlag);
                    }
                },
                error: () => {
                    errorCount++;
                    if (completedCount + errorCount === productIds.length) {
                        this.finalizeBulkOperation(completedCount, errorCount, activateFlag);
                    }
                }
            });
        });
    }

    /**
     * Finalize bulk operation and show results
     */
    private finalizeBulkOperation(successCount: number, errorCount: number, activateFlag: boolean) {
        this.loading = false;
        this.clearSelection();
        this.fetchList();

        if (errorCount === 0) {
            this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: `${successCount} product(s) ${activateFlag ? 'activated' : 'deactivated'} successfully`
            });
        } else {
            this.messageService.add({
                severity: 'warn',
                summary: 'Partial Success',
                detail: `${successCount} succeeded, ${errorCount} failed`
            });
        }
    }
}
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IntentService } from './intent.service';
import { SalesIntent, SalesIntentItem, CreateSalesIntentDto, UpdateSalesIntentDto } from './intent.model';
import { ProductsService } from '../../products/products.service';

@Component({
    selector: 'app-intent-form',
    templateUrl: './intent-form.component.html'
})
export class IntentFormComponent implements OnInit {
    intent: SalesIntent = {
        intenttype: 'CUSTOMER_REQUEST',
        priority: 'MEDIUM',
        productname: '',
        requestedqty: 1
    };

    form: FormGroup = new FormGroup({
        id: new FormControl(''),
        intenttype: new FormControl('CUSTOMER_REQUEST', Validators.required),
        priority: new FormControl('MEDIUM', Validators.required),
        productname: new FormControl('', Validators.maxLength(100)),
        requestedqty: new FormControl(1, Validators.min(1)),
        customername: new FormControl('', Validators.maxLength(100)),
        customermobile: new FormControl('', [Validators.maxLength(15), Validators.pattern('^[0-9]*$')]),
        advanceamount: new FormControl(0, [Validators.min(0)]),
        estimatedcost: new FormControl(0, [Validators.min(0)]),
        requestnotes: new FormControl(''),
        internalnotes: new FormControl('')
    });

    errorMessage: string = '';
    loading: boolean = false;
    isEditMode: boolean = false;
    isViewMode: boolean = false;

    // Product selection mode
    productEntryMode: 'existing' | 'manual' = 'existing';

    // Type ahead for products
    products: any[] = [];
    filteredProducts: any[] = [];
    selectedProduct: any = null;
    productSearchTerm: string = '';

    // Type ahead for customers
    customers: any[] = [];
    selectedCustomer: any = null;

    // Items management for multi-product support
    intentItems: SalesIntentItem[] = [];
    currentItem: SalesIntentItem = this.getEmptyItem();

    typeOptions = ['CUSTOMER_REQUEST', 'LOW_STOCK', 'MARKET_DEMAND', 'OTHER'];
    priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private intentService: IntentService,
        private productsService: ProductsService
    ) {}

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        const mode = this.route.snapshot.url[this.route.snapshot.url.length - 2]?.path;

        this.isViewMode = mode === 'view';
        this.isEditMode = !!id && mode === 'edit';

        // Load all products for selection
        this.loadProducts();

        if (id) {
            this.loadIntent(parseInt(id));
        }

        if (this.isViewMode) {
            this.form.disable();
        }
    }

    loadProducts() {
        this.productsService.findByCriteria2({ active: true }).subscribe({
            next: (data: any) => {
                this.products = data;
                this.filteredProducts = data;
                console.log('Loaded products:', this.products.length);
            },
            error: (error) => {
                console.error('Failed to load products:', error);
            }
        });
    }

    searchProducts(event: any) {
        const searchTerm = event.target.value.toLowerCase();
        this.productSearchTerm = searchTerm;

        if (!searchTerm) {
            this.filteredProducts = this.products;
            return;
        }

        this.filteredProducts = this.products.filter(p =>
            p.title.toLowerCase().includes(searchTerm) ||
            (p.product_code && p.product_code.toLowerCase().includes(searchTerm))
        );
    }

    selectProduct(product: any) {
        this.selectedProduct = product;
        this.form.patchValue({
            productname: product.title
        });
        this.productSearchTerm = '';
        this.filteredProducts = this.products;
    }

    clearProductSelection() {
        this.selectedProduct = null;
        this.form.patchValue({
            productname: ''
        });
    }

    toggleProductEntryMode(mode: 'existing' | 'manual') {
        this.productEntryMode = mode;

        if (mode === 'manual') {
            // Clear selected product when switching to manual mode
            this.selectedProduct = null;
        } else {
            // Clear manual entry when switching to existing product mode
            this.form.patchValue({
                productname: ''
            });
        }
    }

    getEmptyItem(): SalesIntentItem {
        return {
            productname: '',
            requestedqty: 1,
            estimatedcost: 0
        };
    }

    addItem() {
        const productname = this.form.value.productname;
        const requestedqty = this.form.value.requestedqty;
        const estimatedcost = this.form.value.estimatedcost;

        if (!productname || !requestedqty || requestedqty < 1) {
            this.errorMessage = 'Please fill product details before adding';
            return;
        }

        // Create the item
        const item: SalesIntentItem = {
            productname: productname,
            requestedqty: requestedqty,
            estimatedcost: estimatedcost || 0,
            prodid: this.selectedProduct?.id || undefined
        };

        this.intentItems.push(item);

        // Clear the form fields for next product
        this.form.patchValue({
            productname: '',
            requestedqty: 1,
            estimatedcost: 0
        });
        this.selectedProduct = null;
        this.productSearchTerm = '';
        this.errorMessage = '';
    }

    removeItem(index: number) {
        this.intentItems.splice(index, 1);
    }

    editItem(index: number) {
        const item = this.intentItems[index];

        // Populate form with item data
        this.form.patchValue({
            productname: item.productname,
            requestedqty: item.requestedqty,
            estimatedcost: item.estimatedcost || 0
        });

        // If item has a prodid, try to find and select the product
        if (item.prodid) {
            this.selectedProduct = this.products.find(p => p.id === item.prodid);
        }

        // Remove the item from the list (user will re-add it)
        this.intentItems.splice(index, 1);
    }

    getTotalEstimatedCost(): number {
        return this.intentItems.reduce(
            (sum, item) => sum + ((item.estimatedcost || 0) * item.requestedqty),
            0
        );
    }

    loadIntent(id: number) {
        this.loading = true;
        this.intentService.findOne(id).subscribe({
            next: (data) => {
                this.intent = data;
                this.populateForm(data);
                this.loading = false;
            },
            error: (error) => {
                this.errorMessage = 'Failed to load intent: ' + error.message;
                this.loading = false;
            }
        });
    }

    populateForm(data: SalesIntent) {
        this.form.patchValue({
            id: data.id,
            intenttype: data.intenttype,
            priority: data.priority,
            productname: data.productname || '',
            requestedqty: data.requestedqty || 1,
            customername: data.customername || '',
            customermobile: data.customermobile || '',
            advanceamount: data.advanceamount || 0,
            estimatedcost: data.estimatedcost || 0,
            requestnotes: data.requestnotes || '',
            internalnotes: data.internalnotes || ''
        });

        // Load items if available (NEW multi-product support)
        if (data.items && data.items.length > 0) {
            this.intentItems = [...data.items];
        }

        this.selectedProduct = data.product;
        this.selectedCustomer = data.customer;
    }

    submit() {
        if (!this.form.valid) {
            this.errorMessage = 'Please fill all required fields correctly';
            return;
        }

        // Validate: must have at least one product (either in items array or in form)
        const hasItemsInArray = this.intentItems.length > 0;
        const hasProductInForm = this.form.value.productname && this.form.value.requestedqty > 0;

        if (!hasItemsInArray && !hasProductInForm) {
            this.errorMessage = 'Please add at least one product to the intent';
            return;
        }

        const formData = this.form.value;

        // Prepare DTO
        const dto: CreateSalesIntentDto | UpdateSalesIntentDto = {
            intenttype: formData.intenttype,
            priority: formData.priority,
            customername: formData.customername || undefined,
            customermobile: formData.customermobile || undefined,
            advanceamount: formData.advanceamount || 0,
            requestnotes: formData.requestnotes || undefined,
            internalnotes: formData.internalnotes || undefined,
            customerid: this.selectedCustomer?.id || undefined,

            // NEW: Send items array if products were added
            items: hasItemsInArray ? this.intentItems : undefined,

            // OLD: Backward compatibility - if no items array, send old format
            productname: !hasItemsInArray ? formData.productname : undefined,
            requestedqty: !hasItemsInArray ? formData.requestedqty : undefined,
            estimatedcost: !hasItemsInArray ? formData.estimatedcost : undefined,
            prodid: !hasItemsInArray && this.selectedProduct?.id ? this.selectedProduct.id : undefined
        };

        this.loading = true;
        this.errorMessage = '';

        if (this.isEditMode && formData.id) {
            // Update existing intent
            this.intentService.update(formData.id, dto as UpdateSalesIntentDto).subscribe({
                next: () => {
                    alert('Intent updated successfully');
                    this.gotoList();
                },
                error: (error) => {
                    this.errorMessage = 'Failed to update intent: ' + (error.error?.message || error.message);
                    this.loading = false;
                }
            });
        } else {
            // Create new intent
            this.intentService.create(dto as CreateSalesIntentDto).subscribe({
                next: () => {
                    alert('Intent created successfully');
                    this.gotoList();
                },
                error: (error) => {
                    this.errorMessage = 'Failed to create intent: ' + (error.error?.message || error.message);
                    this.loading = false;
                }
            });
        }
    }

    reset() {
        this.form.reset({
            intenttype: 'CUSTOMER_REQUEST',
            priority: 'MEDIUM',
            requestedqty: 1,
            advanceamount: 0,
            estimatedcost: 0
        });
        this.selectedProduct = null;
        this.selectedCustomer = null;
        this.errorMessage = '';
    }

    gotoList() {
        this.router.navigate(['/secure/sales/intent']);
    }

    formatType(type: string): string {
        return type.replace(/_/g, ' ');
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
}

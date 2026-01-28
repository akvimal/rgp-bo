import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Invoice } from "../invoice.model";
import { InvoiceService } from "../invoices.service";
import { ProductsService } from "../../../products/products.service";

@Component({
    templateUrl: './invoice-items.component.html'
})
export class InvoiceItemsComponent {

    invoice: Invoice = {};
    items:any;
    itemid:any;
    displayEditItem:boolean = false;
    itemSelected:boolean = false;
    allVerified:boolean = false;
    feedback:string = '';
    // grn:string = '';
    grosstotal:number = 0;
    taxtotal:number = 0;
    disctotal:number = 0;
    nettotal:number = 0;

    // Item verification
    displayRejectDialog:boolean = false;
    selectedItemForReject:any = null;
    rejectionReason:string = '';
    verificationSummary:any = null;

    // OCR extracted items with product mapping
    ocrExtractedItems:any[] = [];
    showOcrImportSection:boolean = false;
    allProducts:any[] = [];

    // Product mapping state
    itemProductMappings: Map<number, any> = new Map(); // index -> selected product
    showQuickAddProduct:boolean = false;
    selectedOcrItemForProductAdd:any = null;

    constructor(
        private route:ActivatedRoute,
        private invService: InvoiceService,
        private productService: ProductsService
    ){}

    ngOnInit(){
        this.fetchItems(this.route.snapshot.paramMap.get('id'));
        this.checkForOcrExtractedItems();
    }

    /**
     * Check sessionStorage for OCR extracted items
     */
    checkForOcrExtractedItems() {
        const pendingItems = sessionStorage.getItem('pendingInvoiceItems');
        if (pendingItems) {
            try {
                this.ocrExtractedItems = JSON.parse(pendingItems);
                console.log('Found OCR extracted items in sessionStorage:', this.ocrExtractedItems);

                // Log each item's expiry status
                this.ocrExtractedItems.forEach((item: any, index: number) => {
                    console.log(`OCR Item ${index + 1}:`, {
                        productName: item.productName,
                        batch: item.batch,
                        expiryDate: item.expiryDate,
                        expiry: item.expiry,
                        quantity: item.quantity,
                        rate: item.rate
                    });
                });

                if (this.ocrExtractedItems && this.ocrExtractedItems.length > 0) {
                    this.showOcrImportSection = true;

                    // Load all products for matching
                    this.loadProductsAndMatch();
                }
            } catch (error) {
                console.error('Error parsing OCR extracted items:', error);
            }
        }
    }

    /**
     * Load all products and attempt fuzzy matching
     */
    loadProductsAndMatch() {
        this.productService.findAll({}).subscribe({
            next: (products: any) => {
                this.allProducts = products;
                console.log('Loaded products for matching:', products.length);

                // Attempt auto-matching for each OCR item
                this.ocrExtractedItems.forEach((item, index) => {
                    const suggestedProduct = this.findBestProductMatch(item.productName);
                    if (suggestedProduct) {
                        item.suggestedProduct = suggestedProduct;
                        item.suggestedMatch = true;
                        console.log(`Auto-matched "${item.productName}" → "${suggestedProduct.title}"`);
                    } else {
                        item.suggestedMatch = false;
                        console.log(`No match found for "${item.productName}"`);
                    }

                    // Map expiryDate to expiry for UI binding
                    if (item.expiryDate) {
                        item.expiry = item.expiryDate;
                        console.log(`Mapped expiry date for "${item.productName}": ${item.expiry}`);
                    }

                    // Initialize total for each item
                    this.recalculateOcrItemTotal(index);
                });
            },
            error: (error) => {
                console.error('Error loading products:', error);
            }
        });
    }

    /**
     * Find best matching product using fuzzy search
     */
    findBestProductMatch(ocrProductName: string): any | null {
        console.log('🔍 Finding match for OCR product:', ocrProductName);
        console.log('Available products:', this.allProducts.length);

        if (!ocrProductName || !this.allProducts || this.allProducts.length === 0) {
            console.log('❌ No products available or OCR name empty');
            return null;
        }

        // Clean the search term - remove extra spaces, special characters
        const searchTerm = ocrProductName.toLowerCase().trim().replace(/\s+/g, ' ');
        console.log('Cleaned search term:', searchTerm);

        // Try exact match first
        let match = this.allProducts.find((p: any) => {
            const productTitle = p.title?.toLowerCase().trim().replace(/\s+/g, ' ');
            return productTitle === searchTerm;
        });
        if (match) {
            console.log('✅ Exact match found:', match.title);
            return match;
        }

        // Try partial match (contains) - more flexible
        match = this.allProducts.find((p: any) => {
            const productTitle = p.title?.toLowerCase().trim().replace(/\s+/g, ' ');
            const isMatch = productTitle?.includes(searchTerm) || searchTerm.includes(productTitle);
            if (isMatch) {
                console.log(`✅ Partial match: "${productTitle}" ↔ "${searchTerm}"`);
            }
            return isMatch;
        });
        if (match) return match;

        // Try fuzzy match - remove common words and match significant parts
        const commonWords = ['tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules', 'mg', 'ml', 'gm'];
        const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));

        console.log('Search words (filtered):', searchWords);

        if (searchWords.length > 0) {
            const matches = this.allProducts.map((p: any) => {
                const productTitle = p.title?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
                const titleWords = productTitle.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));

                // Count matching words
                const matchCount = searchWords.filter(sw =>
                    titleWords.some(tw =>
                        tw.includes(sw) ||
                        sw.includes(tw) ||
                        this.levenshteinDistance(sw, tw) <= 2 // Allow 2 character differences
                    )
                ).length;

                return { product: p, matchCount, totalWords: searchWords.length };
            }).filter(m => m.matchCount > 0);

            // Sort by best match (highest match count)
            matches.sort((a, b) => b.matchCount - a.matchCount);

            if (matches.length > 0) {
                const bestMatch = matches[0];
                const matchPercent = (bestMatch.matchCount / bestMatch.totalWords) * 100;
                console.log(`✅ Fuzzy match: "${bestMatch.product.title}" (${bestMatch.matchCount}/${bestMatch.totalWords} words = ${matchPercent.toFixed(0)}%)`);

                // Require at least 50% word match
                if (matchPercent >= 50) {
                    return bestMatch.product;
                }
            }
        }

        console.log('❌ No match found for:', ocrProductName);
        return null;
    }

    /**
     * Calculate Levenshtein distance between two strings
     * (number of single-character edits needed to change one word into another)
     */
    levenshteinDistance(str1: string, str2: string): number {
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix: number[][] = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        return matrix[len1][len2];
    }

    /**
     * Recalculate total for an OCR item when quantity or rate changes
     */
    recalculateOcrItemTotal(itemIndex: number) {
        const item = this.ocrExtractedItems[itemIndex];
        const qty = item.quantity || 0;
        const rate = item.rate || 0;
        const taxpcnt = item.taxPercent || 0;
        const discpcnt = 0; // Discount not captured from OCR

        // Calculate total: (qty * rate) * (1 + tax%)
        const ptrcost = qty * rate;
        const discountAmount = ptrcost * (discpcnt / 100);
        const amountAfterDiscount = ptrcost - discountAmount;
        const taxAmount = amountAfterDiscount * (taxpcnt / 100);
        const total = amountAfterDiscount + taxAmount;

        item.total = Math.round(total * 100) / 100;
        console.log(`Recalculated total for item ${itemIndex}:`, item.total);
    }

    /**
     * Select product for an OCR item
     */
    onProductSelected(itemIndex: number, event: any) {
        const productId = event.target.value;
        const product = this.allProducts.find(p => p.id == productId);

        if (product) {
            this.itemProductMappings.set(itemIndex, product);
            this.ocrExtractedItems[itemIndex].selectedProduct = product;
            console.log(`Item ${itemIndex} mapped to product:`, product.title);
        }
    }

    /**
     * Open Quick Add Product dialog
     */
    openQuickAddProduct(item: any, itemIndex: number) {
        this.selectedOcrItemForProductAdd = { ...item, itemIndex };
        this.showQuickAddProduct = true;
    }

    /**
     * Handle product created from Quick Add
     */
    onProductCreated(product: any) {
        console.log('New product created:', product);

        // Add to products list
        this.allProducts.push(product);

        // Map to the OCR item
        const itemIndex = this.selectedOcrItemForProductAdd.itemIndex;
        this.itemProductMappings.set(itemIndex, product);
        this.ocrExtractedItems[itemIndex].selectedProduct = product;

        // Close dialog
        this.showQuickAddProduct = false;
        this.selectedOcrItemForProductAdd = null;

        alert(`✅ Product "${product.title}" created and mapped successfully!`);
    }

    /**
     * Check if all items are mapped to products
     */
    allItemsMapped(): boolean {
        return this.ocrExtractedItems.every((item, index) =>
            item.selectedProduct || item.suggestedProduct
        );
    }

    /**
     * Import all OCR extracted items as invoice items
     */
    importOcrItems() {
        if (!this.ocrExtractedItems || this.ocrExtractedItems.length === 0) {
            alert('No OCR extracted items to import');
            return;
        }

        // Check if all items are mapped
        const unmappedItems = this.ocrExtractedItems.filter((item, index) =>
            !item.selectedProduct && !item.suggestedProduct
        );

        if (unmappedItems.length > 0) {
            alert(`Please map all products before importing.\n\n${unmappedItems.length} item(s) are not mapped yet.`);
            return;
        }

        console.log('Starting sequential import of OCR items...');

        // Process items sequentially to avoid database serialization conflicts
        let created = 0;
        let failed = 0;
        let currentIndex = 0;

        const processNextItem = () => {
            if (currentIndex >= this.ocrExtractedItems.length) {
                // All items processed
                this.onImportComplete(created, failed);
                return;
            }

            const item = this.ocrExtractedItems[currentIndex];
            const product = item.selectedProduct || item.suggestedProduct;

            // Calculate required fields using edited values
            const qty = item.quantity || 1;
            const ptrvalue = item.rate || 0;
            const mrpcost = item.mrp || 0;
            const taxpcnt = item.taxPercent || 0;
            const discpcnt = 0;

            // ptrcost = rate * quantity (total before discount)
            const ptrcost = ptrvalue * qty;

            // Calculate total: (ptrcost - discount) + tax
            const discountAmount = ptrcost * (discpcnt / 100);
            const amountAfterDiscount = ptrcost - discountAmount;
            const taxAmount = amountAfterDiscount * (taxpcnt / 100);
            const total = amountAfterDiscount + taxAmount;

            // Convert expiry from YYYY-MM to date (last day of month)
            let expdate = null;
            if (item.expiry) {
                const [year, month] = item.expiry.split('-');
                // Set to last day of the month
                const expiryDate = new Date(parseInt(year), parseInt(month), 0);
                expdate = expiryDate.toISOString().split('T')[0];
            }

            const invoiceItem: any = {
                invoiceid: this.invoice.id,
                productid: product.id,
                qty: qty,
                freeqty: 0,
                batch: item.batch || 'N/A',
                ptrvalue: ptrvalue,
                ptrcost: ptrcost, // Required field
                mrpcost: mrpcost,
                taxpcnt: taxpcnt,
                discpcnt: discpcnt,
                total: Math.round(total * 100) / 100, // Required field
                expdate: expdate, // Use edited expiry date
                itemtype: 'REGULAR',
                status: 'NEW'
            };

            console.log(`[${currentIndex + 1}/${this.ocrExtractedItems.length}] Creating invoice item for ${product.title}`);

            this.invService.saveItem(invoiceItem).subscribe({
                next: () => {
                    created++;
                    console.log(`✅ Created invoice item for: ${product.title}`);
                    currentIndex++;
                    processNextItem(); // Process next item
                },
                error: (error) => {
                    failed++;
                    console.error(`❌ Failed to create item for ${product.title}:`, error);
                    console.error('Error details:', {
                        status: error.status,
                        message: error.error?.message || error.message,
                        validation: error.error?.message || 'No validation details'
                    });
                    currentIndex++;
                    processNextItem(); // Continue with next item even if this one failed
                }
            });
        };

        // Start processing from first item
        processNextItem();
    }

    /**
     * Handle import completion
     */
    onImportComplete(created: number, failed: number) {
        // Clear OCR data
        this.dismissOcrImport();

        // Refresh items list
        this.fetchItems(this.invoice.id);

        // Show result
        if (failed === 0) {
            alert(`✅ Successfully imported ${created} items!\n\nItems are now ready for verification.`);
        } else {
            alert(`⚠️ Import completed with issues:\n\n✅ Created: ${created}\n❌ Failed: ${failed}\n\nPlease check console for details.`);
        }
    }

    /**
     * Dismiss OCR import section
     */
    dismissOcrImport() {
        this.showOcrImportSection = false;
        sessionStorage.removeItem('pendingInvoiceItems');
        this.ocrExtractedItems = [];
    }

    fetchItems(id:any){
        this.nettotal = 0;
        this.grosstotal = 0;
        this.disctotal = 0;
        this.taxtotal = 0;

        this.invService.find(id).subscribe((inv:any) => { 
            this.invoice = inv;
            this.items = inv.items.map((i:any) => {
                // this.grosstotal += +i.total;
                // console.log(`qty: ${i.qty}, ptrvalue: ${i.ptrvalue}, discpcnt: ${i.discpcnt}, taxpcnt: ${i.taxpcnt}`);
                this.grosstotal += i.ptrvalue*i.qty;
                this.disctotal += i.ptrvalue*i.qty*(i.discpcnt/100);
                this.taxtotal += ((i.ptrvalue*i.qty)-(i.ptrvalue*i.qty*(i.discpcnt/100))) *(i.taxpcnt/100);
                // console.log(`taxtotal: ${this.taxtotal}`);
                
                return {...i, selected:false}
            });
            this.nettotal = this.grosstotal - this.disctotal + this.taxtotal;
            
            if(this.items) {
                this.itemSelected =  this.items.filter((i:any) => i.selected).length > 0;
                const verifiedItems = this.items.filter((i:any) => i.status === 'VERIFIED');
                this.allVerified = this.items.length > 0 && verifiedItems.length === this.items.length;
            }
        });
    }

    selectItem(event:any,id:any){
        this.items && this.items.forEach((i:any) => {
            if(i.id === id) 
                i.selected = event.target.checked;
        });

        if(this.items) {
            this.itemSelected = this.items.filter((i:any) => i.selected).length > 0;
        }
    }

    removeItems(){
        if(this.items) {
            const ids = this.items.map((i:any) => {
                if(i.selected) return i.id;
            })
            
            this.invService.removeItems({invoiceid: this.invoice.id, ids}).subscribe(data => this.fetchItems(this.invoice.id));
        }
    }

    /**
     * Verify a single item (used from template)
     */
    verifySingleItem(itemId: number){
        this.invService.verifyItem(itemId).subscribe({
            next: () => {
                this.fetchItems(this.invoice.id);
            },
            error: (err) => {
                console.error(`Failed to verify item ${itemId}:`, err);
            }
        });
    }

    /**
     * Verify selected items individually
     */
    verifyItems(){
        if(this.items) {
            const selectedItems = this.items.filter((i:any) => i.selected);
            let completed = 0;

            selectedItems.forEach((item:any) => {
                this.invService.verifyItem(item.id).subscribe({
                    next: () => {
                        completed++;
                        if(completed === selectedItems.length) {
                            this.fetchItems(this.invoice.id);
                        }
                    },
                    error: (err) => {
                        console.error(`Failed to verify item ${item.id}:`, err);
                        completed++;
                        if(completed === selectedItems.length) {
                            this.fetchItems(this.invoice.id);
                        }
                    }
                });
            });
        }
    }

    /**
     * Verify all items in invoice at once
     */
    verifyAllItems(){
        if(this.invoice.id) {
            this.invService.verifyAllItems(this.invoice.id).subscribe({
                next: (response: any) => {
                    console.log('Bulk verification result:', response);
                    this.fetchItems(this.invoice.id);
                },
                error: (err) => {
                    console.error('Failed to verify all items:', err);
                }
            });
        }
    }

    /**
     * Show reject dialog for an item
     */
    showRejectDialog(item: any){
        this.selectedItemForReject = item;
        this.rejectionReason = '';
        this.displayRejectDialog = true;
    }

    /**
     * Reject item with reason
     */
    rejectItem(){
        if(this.selectedItemForReject && this.rejectionReason.trim()) {
            this.invService.rejectItem(this.selectedItemForReject.id, this.rejectionReason).subscribe({
                next: () => {
                    this.displayRejectDialog = false;
                    this.selectedItemForReject = null;
                    this.rejectionReason = '';
                    this.fetchItems(this.invoice.id);
                },
                error: (err) => {
                    console.error('Failed to reject item:', err);
                }
            });
        }
    }

    /**
     * Cancel reject dialog
     */
    cancelReject(){
        this.displayRejectDialog = false;
        this.selectedItemForReject = null;
        this.rejectionReason = '';
    }

    /**
     * Get verification status summary
     */
    loadVerificationStatus(){
        if(this.invoice.id) {
            this.invService.getVerificationStatus(this.invoice.id).subscribe({
                next: (status) => {
                    this.verificationSummary = status;
                },
                error: (err) => {
                    console.error('Failed to load verification status:', err);
                }
            });
        }
    }

    updateFeedback(event:any){
        this.feedback = event.target.value;
    }
    
    confirmInvoice(){
        this.invService.confirm([this.invoice.id],{status:'COMPLETE',comments:this.feedback}).subscribe(data => {
            this.fetchItems(this.invoice.id);
        });
    }

    onItemAdd(event:any){
        this.fetchItems(this.invoice.id);
    }

    onPaid(event:any){
        this.fetchItems(event);
    }
    
    showItemEdit(itemid:any){
        this.itemid = itemid;
        this.displayEditItem = true;
    }

    closeEditItem(){
        this.fetchItems(this.invoice.id);
        this.displayEditItem = false;
    }

    updateItemType(itemId: any, event: any) {
        const newType = event.target.value;
        const updateData: any = { itemtype: newType };

        // Clear returnreason and challanref when changing type
        if (newType === 'REGULAR') {
            updateData.returnreason = null;
            updateData.challanref = null;
        } else if (newType === 'RETURN') {
            updateData.challanref = null;
        } else if (newType === 'SUPPLIED') {
            updateData.returnreason = null;
        }

        this.invService.updateItems([itemId], updateData).subscribe(() => {
            this.fetchItems(this.invoice.id);
        });
    }

    updateItemField(itemId: any, field: string, event: any) {
        const value = event.target.value;
        const updateData: any = {};
        updateData[field] = value;

        this.invService.updateItems([itemId], updateData).subscribe(() => {
            // Update local item without full refresh
            const item = this.items.find((i: any) => i.id === itemId);
            if (item) {
                item[field] = value;
            }
        });
    }

    /**
     * Calculate item total with discount and tax applied
     * Formula: (Rate × Qty) - Discount + Tax
     */
    calculateItemTotal(item: any): number {
        const gross = item.ptrvalue * item.qty;
        const discount = gross * (item.discpcnt / 100);
        const amountAfterDiscount = gross - discount;
        const tax = amountAfterDiscount * (item.taxpcnt / 100);
        const total = amountAfterDiscount + tax;
        return total;
    }

    /**
     * Handle tax credit update
     */
    onTaxUpdated(event: any) {
        // Refresh invoice to get updated tax status
        this.fetchItems(this.invoice.id);
    }

    /**
     * Handle lifecycle update (when invoice is closed/reopened)
     */
    onLifecycleUpdated(event: any) {
        // Refresh invoice to get updated lifecycle status
        this.fetchItems(this.invoice.id);
    }
}
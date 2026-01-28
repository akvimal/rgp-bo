import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";

import { InvoiceItem } from "./invoice-item.model";
import { Invoice, VendorPayment, TaxCredit, InvoiceLifecycleSummary, ItemVerificationStatus } from "./invoice.model";
import { environment } from "./../../../../environments/environment";

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {

    apiurl = environment.apiHost;

    constructor(private http:HttpClient){}

    find(id:any){
        return this.http.get(`${this.apiurl}/purchases/${id}`);
    }

    findAll(){
        return this.http.get(`${this.apiurl}/purchases`);
    }

    save(invoice:Invoice){
        return this.http.post(`${this.apiurl}/purchases`,invoice);
    }

    confirm(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchases/confirm`,{ids,values});
    }

    update(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchases`,{ids,values});
    }

    remove(id:number){
        return this.http.delete(`${this.apiurl}/purchases/${id}`);//
    }

    //////
    
    findItem(id:any){
        return this.http.get(`${this.apiurl}/purchaseitems/${id}`);
    }

    findItemsByProduct(productid:any){
        return this.http.get(`${this.apiurl}/purchaseitems/product/${productid}`);
    }

    findItemSalePrice(productid:any,batch:any){
        return this.http.post(`${this.apiurl}/purchaseitems/saleprice`,{productid,batch});
    }

    saveItem(item:InvoiceItem){
        console.log('item to be saved:',item);
        
        const obj:any ={}
        for (const [key, value] of Object.entries(item)) {
            if(value !== ''){
                obj[key] = value
            }
          }
        return this.http.post(`${this.apiurl}/purchaseitems`,obj);
    }

    updateItems(ids:any, values:any){
        return this.http.put(`${this.apiurl}/purchaseitems`,{ids,values});
    }

    removeItems(ids:any){
        return this.http.delete(`${this.apiurl}/purchaseitems`,{body:ids});
    }

    /**
     * Get product with auto-populated tax rate from HSN code
     * @param productId - Product ID to lookup
     */
    getProductWithTaxRate(productId: number){
        return this.http.get(`${this.apiurl}/products/${productId}/with-tax`);
    }

    // ========================================
    // Phase 3: Invoice Lifecycle Management
    // ========================================

    /**
     * Get comprehensive lifecycle summary for an invoice
     * Includes payment status, tax status, item verification, closure validation
     */
    getLifecycleSummary(invoiceId: number) {
        return this.http.get<InvoiceLifecycleSummary>(`${this.apiurl}/purchases/${invoiceId}/lifecycle-summary`);
    }

    /**
     * Validate if an invoice can be closed
     * Returns validation result with any blocking reasons
     */
    validateClosure(invoiceId: number) {
        return this.http.get(`${this.apiurl}/purchases/${invoiceId}/validate-closure`);
    }

    /**
     * Close an invoice (marks lifecycle as CLOSED)
     * Requires all items verified, payments complete, tax filed
     */
    closeInvoice(invoiceId: number, closureNotes: string) {
        return this.http.post(`${this.apiurl}/purchases/${invoiceId}/close`, { closureNotes });
    }

    /**
     * Reopen a closed invoice
     */
    reopenInvoice(invoiceId: number) {
        return this.http.post(`${this.apiurl}/purchases/${invoiceId}/reopen`, {});
    }

    // ========================================
    // Item Verification Workflow
    // ========================================

    /**
     * Verify a single invoice item
     * Updates status to VERIFIED and records verifier/timestamp
     */
    verifyItem(itemId: number) {
        return this.http.post(`${this.apiurl}/purchaseitems/${itemId}/verify`, {});
    }

    /**
     * Reject an invoice item with reason
     * Updates status to REJECTED and stores reason in comments
     */
    rejectItem(itemId: number, reason: string) {
        return this.http.post(`${this.apiurl}/purchaseitems/${itemId}/reject`, { reason });
    }

    /**
     * Bulk verify all items in an invoice
     * Verifies all items with status NEW
     */
    verifyAllItems(invoiceId: number) {
        return this.http.post(`${this.apiurl}/purchaseitems/invoice/${invoiceId}/verify-all`, {});
    }

    /**
     * Get verification status summary for an invoice
     * Returns counts of verified/rejected/pending items
     */
    getVerificationStatus(invoiceId: number) {
        return this.http.get<ItemVerificationStatus>(`${this.apiurl}/purchaseitems/invoice/${invoiceId}/verification-status`);
    }

    // ========================================
    // Phase 3: Payment Management
    // ========================================

    /**
     * Get all payments for an invoice
     */
    getPayments(invoiceId: number) {
        return this.http.get<VendorPayment[]>(`${this.apiurl}/purchases/${invoiceId}/payments`);
    }

    /**
     * Create a new payment for an invoice
     * Payment status auto-calculated by backend
     */
    createPayment(invoiceId: number, payment: VendorPayment) {
        return this.http.post<VendorPayment>(`${this.apiurl}/purchases/${invoiceId}/payments`, payment);
    }

    /**
     * Quick payment - Mark invoice as paid with simplified flow (Issue #61)
     * Creates a payment for the outstanding amount
     */
    createQuickPayment(invoiceId: number, paymentMode: string, paymentDate?: Date) {
        return this.http.post<VendorPayment>(
            `${this.apiurl}/purchases/${invoiceId}/quick-payment`,
            {
                paymentMode,
                paymentDate: paymentDate ? paymentDate.toISOString() : undefined
            }
        );
    }

    /**
     * Update an existing payment
     */
    updatePayment(paymentId: number, payment: Partial<VendorPayment>) {
        return this.http.put<VendorPayment>(`${this.apiurl}/purchases/payments/${paymentId}`, payment);
    }

    /**
     * Delete a payment
     */
    deletePayment(paymentId: number) {
        return this.http.delete(`${this.apiurl}/purchases/payments/${paymentId}`);
    }

    /**
     * Mark a payment as reconciled
     */
    reconcilePayment(paymentId: number) {
        return this.http.put(`${this.apiurl}/purchases/payments/${paymentId}/reconcile`, {});
    }

    /**
     * Get payment summary for an invoice
     */
    getPaymentSummary(invoiceId: number) {
        return this.http.get(`${this.apiurl}/purchases/${invoiceId}/payments/summary`);
    }

    // ========================================
    // Phase 3: Tax Credit Management
    // ========================================

    /**
     * Get tax credit for an invoice (returns single object or null)
     */
    getTaxCredits(invoiceId: number) {
        return this.http.get<TaxCredit | null>(`${this.apiurl}/purchases/${invoiceId}/tax-credits`);
    }

    /**
     * Create a new tax credit record
     */
    createTaxCredit(invoiceId: number, taxCredit: TaxCredit) {
        return this.http.post<TaxCredit>(`${this.apiurl}/purchases/${invoiceId}/tax-credits`, taxCredit);
    }

    /**
     * Update an existing tax credit
     */
    updateTaxCredit(taxCreditId: number, taxCredit: Partial<TaxCredit>) {
        return this.http.put<TaxCredit>(`${this.apiurl}/purchases/tax-credits/${taxCreditId}`, taxCredit);
    }

    /**
     * Delete a tax credit record
     */
    deleteTaxCredit(taxCreditId: number) {
        return this.http.delete(`${this.apiurl}/purchases/tax-credits/${taxCreditId}`);
    }

    /**
     * Mark tax as filed by vendor
     */
    markTaxFiled(taxCreditId: number) {
        return this.http.put(`${this.apiurl}/purchases/tax-credits/${taxCreditId}/filed`, {});
    }

    /**
     * Mark tax as reflected in GSTR-2A
     */
    markTaxReflectedIn2A(taxCreditId: number) {
        return this.http.put(`${this.apiurl}/purchases/tax-credits/${taxCreditId}/reflected-2a`, {});
    }

    /**
     * Mark tax as claimed in return
     */
    markTaxClaimed(taxCreditId: number, returnPeriod: string) {
        return this.http.put(`${this.apiurl}/purchases/tax-credits/${taxCreditId}/claimed`, { returnPeriod });
    }

    /**
     * Report a tax mismatch
     */
    reportTaxMismatch(taxCreditId: number, mismatchData: { reason: string, amount: number }) {
        return this.http.put(`${this.apiurl}/purchases/tax-credits/${taxCreditId}/mismatch`, mismatchData);
    }

    /**
     * Resolve a tax mismatch
     */
    resolveTaxMismatch(taxCreditId: number, resolutionNotes: string) {
        return this.http.put(`${this.apiurl}/purchases/tax-credits/${taxCreditId}/resolve-mismatch`, { resolutionNotes });
    }

    // ========================================
    // Invoice Document Upload & OCR
    // ========================================

    /**
     * Upload invoice document and extract data via AI/OCR
     * For new invoices (no invoice ID yet)
     */
    uploadAndExtractDocument(formData: FormData) {
        return this.http.post(`${this.apiurl}/purchases/invoices/documents/upload`, formData);
    }

    /**
     * Upload document and link to existing invoice
     */
    uploadDocumentForInvoice(invoiceId: number, formData: FormData) {
        return this.http.post(`${this.apiurl}/purchases/invoices/${invoiceId}/documents/upload`, formData);
    }

    /**
     * Get all documents for an invoice
     */
    getInvoiceDocuments(invoiceId: number) {
        return this.http.get(`${this.apiurl}/purchases/invoices/${invoiceId}/documents`);
    }

    /**
     * Get extraction preview for a document
     */
    getDocumentExtraction(documentId: number) {
        return this.http.get(`${this.apiurl}/purchases/invoices/documents/${documentId}/extraction`);
    }

    /**
     * Retry extraction on a document
     */
    retryExtraction(documentId: number) {
        return this.http.post(`${this.apiurl}/purchases/invoices/documents/${documentId}/extract`, {});
    }

}
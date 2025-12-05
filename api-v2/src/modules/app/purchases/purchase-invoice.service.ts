import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { ItemType, DocType, PaymentStatus, TaxStatus, LifecycleStatus } from "./enums";

@Injectable()
export class PurchaseInvoiceService {
    private readonly logger = new Logger(PurchaseInvoiceService.name);

    constructor(
        @InjectRepository(PurchaseInvoice) private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
        @InjectRepository(PurchaseInvoiceItem) private readonly purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>,
        @InjectRepository(VendorPayment) private readonly vendorPaymentRepository: Repository<VendorPayment>,
        @InjectEntityManager() private manager: EntityManager
    ) { }

    /**
     * Create new purchase invoice
     */
    async create(dto: CreatePurchaseInvoiceDto, userid: any) {
        try {
            // Calculate tax breakdown if tax amounts provided
            const taxData = this.calculateTaxBreakdown(dto);

            return this.purchaseInvoiceRepository.save({
                ...dto,
                ...taxData,
                createdby: userid,
                paymentstatus: PaymentStatus.UNPAID,
                taxstatus: TaxStatus.PENDING,
                lifecyclestatus: LifecycleStatus.OPEN,
            });
        } catch (error) {
            this.logger.error(`Failed to create invoice: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Create invoice item with validation
     */
    async createItem(dto: CreatePurchaseInvoiceItemDto, userid: any) {
        try {
            // Validate item type specific requirements
            this.validateItemType(dto);

            // Calculate tax breakdown if not provided
            const taxData = this.calculateItemTaxBreakdown(dto);

            return this.purchaseInvoiceItemRepository.save({
                ...dto,
                ...taxData,
                createdby: userid,
                itemtype: dto.itemtype || ItemType.REGULAR,
            });
        } catch (error) {
            this.logger.error(`Failed to create invoice item: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Validate item type specific requirements
     */
    private validateItemType(dto: CreatePurchaseInvoiceItemDto): void {
        const itemType = dto.itemtype || ItemType.REGULAR;

        if (itemType === ItemType.SUPPLIED && !dto.challanref) {
            throw new BadRequestException('Challan reference is required for SUPPLIED items');
        }

        if (itemType === ItemType.RETURN && !dto.returnreason) {
            throw new BadRequestException('Return reason is required for RETURN items');
        }

        if (itemType === ItemType.RETURN && dto.qty < 0) {
            throw new BadRequestException('Return quantity should be positive (will be subtracted automatically)');
        }
    }

    /**
     * Calculate tax breakdown for invoice
     */
    private calculateTaxBreakdown(dto: CreatePurchaseInvoiceDto): Partial<CreatePurchaseInvoiceDto> {
        const result: any = {};

        // If individual tax amounts provided, calculate total
        if (dto.cgstamount || dto.sgstamount || dto.igstamount) {
            result.totaltaxcredit = (dto.cgstamount || 0) + (dto.sgstamount || 0) + (dto.igstamount || 0);
        }

        return result;
    }

    /**
     * Calculate tax breakdown for item
     */
    private calculateItemTaxBreakdown(dto: CreatePurchaseInvoiceItemDto): Partial<CreatePurchaseInvoiceItemDto> {
        const result: any = {};

        // If tax percentage provided but not breakdown, split equally between CGST/SGST
        if (dto.taxpcnt && !dto.cgstpcnt && !dto.sgstpcnt) {
            result.cgstpcnt = dto.taxpcnt / 2;
            result.sgstpcnt = dto.taxpcnt / 2;
            result.igstpcnt = 0;

            // Calculate amounts
            const taxableAmount = dto.ptrvalue * dto.qty * (1 - (dto.discpcnt || 0) / 100);
            result.cgstamount = Math.round((taxableAmount * result.cgstpcnt / 100) * 100) / 100;
            result.sgstamount = Math.round((taxableAmount * result.sgstpcnt / 100) * 100) / 100;
            result.igstamount = 0;
        }

        return result;
    }
    
    async findAll(){
      return await this.manager.query(`select * from invoices_view`);
  }    
  
  async findSalePrice(input){
    return await this.manager.query(`select
    pii.mfr_date, pii.exp_date, pii.batch, p.pack, pii.mrp_cost, pii.sale_price, product_id, tax_pcnt, pii.created_on,
    round(ptr_value::numeric ,2) as ptr_value
    from purchase_invoice_item pii
    inner join product p on p.id = pii.product_id
    where product_id = $1
    and upper(batch) = upper($2)
    order by pii.created_on desc
    limit 1`, [input.productid, input.batch]);
}

    async findByUnique(query:any){
      const qb = this.purchaseInvoiceRepository.createQueryBuilder(`i`)
          .where('i.isActive = :flag', { flag: true });
          if(query.invoiceno){
            qb.andWhere(`i.invoiceno = :iid`, { iid:query.invoiceno });
          }
          if(query.vendorid){
            qb.andWhere(`i.vendorid = :vid`, { vid:query.vendorid });
          }
        return qb.getOne();
  }

    async findById(id:string){
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .innerJoinAndSelect("invoice.vendor", "vendor")
        .leftJoinAndSelect("invoice.items", "items")
        .leftJoinAndSelect("items.product", "product")
          .select(['invoice','vendor.name','items','product'])
          .where('invoice.id = :id', { id })
          .getOne();
    }

    async getGRN(key:string){
      return await this.manager.query(`select generate_grn($1)`, [key]);
    }

    async remove(id:number){
      // Wrap multi-step delete in transaction to prevent orphaned data
      return await this.purchaseInvoiceRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        try {
          // Step 1: Delete related product prices
          await transactionManager.query(`
            delete from product_price where
            item_id in (select id from purchase_invoice_item where invoice_id = $1)`, [id]);

          // Step 2: Delete invoice items
          await transactionManager
            .createQueryBuilder()
            .delete()
            .from(PurchaseInvoiceItem)
            .where("invoiceid = :id", { id })
            .execute();

          // Step 3: Delete invoice header
          return await transactionManager
            .createQueryBuilder()
            .delete()
            .from(PurchaseInvoice)
            .where("id = :id", { id })
            .execute();
        } catch (error) {
          // Transaction will automatically rollback on error
          throw new Error(`Failed to delete purchase invoice: ${error.message}`);
        }
      });
    }

    async findItemById(id:number){
        return this.purchaseInvoiceItemRepository.createQueryBuilder('item')
        .leftJoinAndSelect("item.product", "product")
          .select(['item','product'])
          .where('item.id = :id', { id })
          .getOne();
    }

    async findAllItemsByInvoice(id:number){
        return this.purchaseInvoiceItemRepository.createQueryBuilder('i')
            .where('i.invoiceid = :id', { id })
            .getMany();
    }

    async findAllItems(criteria:any){
      return this.purchaseInvoiceItemRepository.createQueryBuilder('item')
      .innerJoinAndSelect("item.product", "product")
      .select(['item','product'])
      .where("status = :status",{status:criteria.status||'NEW'})
      .getMany();
    }

   async findItemsByProduct(id:number){
      return this.purchaseInvoiceItemRepository.createQueryBuilder('i')
      .innerJoinAndSelect("i.product", "product")
      .select(['i','product'])
      .where('i.productid = :id', { id }).orderBy('i.createdon','DESC')
      .getMany();
    }
      async update(ids:number[], values:any, userid:number){
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .update(PurchaseInvoice, {...values, updatedby: userid})
        .where("id in (:...ids)", { ids })
        .execute();
      }

      async updateItems(ids:number[], values:any, userid:any){
        const obj = {...values, updatedby:userid};
        if(values['status'] && values['status'] == 'VERIFIED'){
          obj['verifiedby'] = userid;
          obj['verifystartdate'] = new Date();
        }
       return await this.purchaseInvoiceItemRepository.createQueryBuilder('items')
        .update(PurchaseInvoiceItem, obj)
        .where("id in (:...ids)", { ids })
        .execute();

      }

      async removeItems(ids:number[]){
          return this.purchaseInvoiceItemRepository.createQueryBuilder('items')
          .delete()
          .from(PurchaseInvoiceItem)
          .where("id in (:...ids)", { ids })
          .execute();
        }

    // ========================================================================
    // LIFECYCLE MANAGEMENT METHODS
    // ========================================================================

    /**
     * Calculate and update payment status based on payments
     */
    async updatePaymentStatus(invoiceId: number): Promise<void> {
        try {
            const invoice = await this.purchaseInvoiceRepository.findOne({ where: { id: invoiceId } });
            if (!invoice) {
                throw new BadRequestException('Invoice not found');
            }

            // Get total payments
            const payments = await this.vendorPaymentRepository
                .createQueryBuilder('payment')
                .where('payment.invoiceid = :invoiceId', { invoiceId })
                .andWhere('payment.paymentstatus = :status', { status: 'COMPLETED' })
                .getMany();

            const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

            // Determine payment status
            let paymentStatus: PaymentStatus;
            if (totalPaid === 0) {
                paymentStatus = PaymentStatus.UNPAID;
            } else if (totalPaid >= invoice.total) {
                paymentStatus = PaymentStatus.PAID;
            } else {
                paymentStatus = PaymentStatus.PARTIAL;
            }

            // Update invoice
            await this.purchaseInvoiceRepository.update(
                { id: invoiceId },
                {
                    paymentstatus: paymentStatus,
                    paidamount: totalPaid
                }
            );

            this.logger.log(`Updated payment status for invoice ${invoiceId}: ${paymentStatus} (₹${totalPaid})`);
        } catch (error) {
            this.logger.error(`Failed to update payment status: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Complete invoice (all items verified)
     */
    async completeInvoice(invoiceId: number, userid: number): Promise<void> {
        try {
            // Verify all items are verified
            const items = await this.findAllItemsByInvoice(invoiceId);
            const unverifiedItems = items.filter(item => item.status !== 'VERIFIED');

            if (unverifiedItems.length > 0) {
                throw new BadRequestException(
                    `Cannot complete invoice. ${unverifiedItems.length} items are not verified`
                );
            }

            // Calculate total tax from items
            const taxTotals = items.reduce((acc, item) => ({
                cgst: acc.cgst + (item.cgstamount || 0),
                sgst: acc.sgst + (item.sgstamount || 0),
                igst: acc.igst + (item.igstamount || 0),
            }), { cgst: 0, sgst: 0, igst: 0 });

            const totalTaxCredit = taxTotals.cgst + taxTotals.sgst + taxTotals.igst;

            // Update invoice status
            await this.purchaseInvoiceRepository.update(
                { id: invoiceId },
                {
                    status: 'COMPLETE',
                    cgstamount: taxTotals.cgst,
                    sgstamount: taxTotals.sgst,
                    igstamount: taxTotals.igst,
                    totaltaxcredit: totalTaxCredit,
                    updatedby: userid,
                }
            );

            this.logger.log(`Invoice ${invoiceId} completed. Tax credit: ₹${totalTaxCredit}`);
        } catch (error) {
            this.logger.error(`Failed to complete invoice: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Check if invoice can be closed
     */
    async canCloseInvoice(invoiceId: number): Promise<{ canClose: boolean; reasons: string[] }> {
        const reasons: string[] = [];

        const invoice = await this.purchaseInvoiceRepository.findOne({
            where: { id: invoiceId },
            relations: ['items']
        });

        if (!invoice) {
            return { canClose: false, reasons: ['Invoice not found'] };
        }

        // Check invoice is complete
        if (invoice.status !== 'COMPLETE') {
            reasons.push('Invoice is not completed');
        }

        // Check payment is complete
        if (invoice.paymentstatus !== PaymentStatus.PAID) {
            reasons.push('Payment is not complete');
        }

        // Check tax is reconciled
        if (invoice.taxstatus !== TaxStatus.RECONCILED) {
            reasons.push('Tax credit is not reconciled');
        }

        return {
            canClose: reasons.length === 0,
            reasons
        };
    }

    /**
     * Close invoice
     */
    async closeInvoice(invoiceId: number, userid: number, notes?: string): Promise<void> {
        try {
            // Check if can close
            const { canClose, reasons } = await this.canCloseInvoice(invoiceId);

            if (!canClose) {
                throw new BadRequestException(
                    `Cannot close invoice: ${reasons.join(', ')}`
                );
            }

            // Close invoice
            await this.purchaseInvoiceRepository.update(
                { id: invoiceId },
                {
                    lifecyclestatus: LifecycleStatus.CLOSED,
                    closedon: new Date(),
                    closedby: userid,
                    closurenotes: notes,
                    updatedby: userid,
                }
            );

            this.logger.log(`Invoice ${invoiceId} closed by user ${userid}`);
        } catch (error) {
            this.logger.error(`Failed to close invoice: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Reopen closed invoice
     */
    async reopenInvoice(invoiceId: number, userid: number): Promise<void> {
        try {
            const invoice = await this.purchaseInvoiceRepository.findOne({
                where: { id: invoiceId }
            });

            if (!invoice) {
                throw new BadRequestException('Invoice not found');
            }

            if (invoice.lifecyclestatus !== LifecycleStatus.CLOSED) {
                throw new BadRequestException('Invoice is not closed');
            }

            await this.purchaseInvoiceRepository.update(
                { id: invoiceId },
                {
                    lifecyclestatus: LifecycleStatus.OPEN,
                    closedon: undefined,
                    closedby: undefined,
                    closurenotes: undefined,
                    updatedby: userid,
                }
            );

            this.logger.log(`Invoice ${invoiceId} reopened by user ${userid}`);
        } catch (error) {
            this.logger.error(`Failed to reopen invoice: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Calculate invoice totals excluding RETURN items
     */
    async calculateInvoiceTotal(invoiceId: number): Promise<number> {
        const items = await this.purchaseInvoiceItemRepository
            .createQueryBuilder('item')
            .where('item.invoiceid = :invoiceId', { invoiceId })
            .andWhere('item.itemtype != :returnType', { returnType: ItemType.RETURN })
            .getMany();

        return items.reduce((sum, item) => sum + (item.total || 0), 0);
    }

    /**
     * Get invoice lifecycle status summary
     */
    async getInvoiceLifecycleSummary(invoiceId: number): Promise<any> {
        const invoice = await this.purchaseInvoiceRepository.findOne({
            where: { id: invoiceId },
            relations: ['items', 'payments']
        });

        if (!invoice) {
            throw new BadRequestException('Invoice not found');
        }

        const items = await this.findAllItemsByInvoice(invoiceId);
        const regularItems = items.filter(i => (i as any).itemtype !== ItemType.RETURN);
        const returnItems = items.filter(i => (i as any).itemtype === ItemType.RETURN);
        const suppliedItems = items.filter(i => (i as any).itemtype === ItemType.SUPPLIED);

        const verifiedItems = items.filter(i => i.status === 'VERIFIED');

        return {
            invoice: {
                id: invoice.id,
                invoiceNo: invoice.invoiceno,
                docType: invoice.doctype,
                status: invoice.status,
                paymentStatus: invoice.paymentstatus,
                taxStatus: invoice.taxstatus,
                lifecycleStatus: invoice.lifecyclestatus,
            },
            items: {
                total: items.length,
                regular: regularItems.length,
                return: returnItems.length,
                supplied: suppliedItems.length,
                verified: verifiedItems.length,
                pending: items.length - verifiedItems.length,
            },
            financial: {
                total: invoice.total,
                paidAmount: invoice.paidamount,
                outstanding: invoice.total - (invoice.paidamount || 0),
                taxCredit: invoice.totaltaxcredit,
            },
            canComplete: items.length > 0 && verifiedItems.length === items.length,
            canClose: invoice.status === 'COMPLETE' &&
                     invoice.paymentstatus === PaymentStatus.PAID &&
                     invoice.taxstatus === TaxStatus.RECONCILED,
        };
    }

    // ========== Payment Management Methods ==========

    /**
     * Create vendor payment and update invoice payment status
     */
    async createPayment(invoiceId: number, paymentData: any, userid: number): Promise<VendorPayment> {
        try {
            // Verify invoice exists
            const invoice = await this.purchaseInvoiceRepository.findOne({
                where: { id: invoiceId }
            });

            if (!invoice) {
                throw new BadRequestException('Invoice not found');
            }

            // Create payment record
            const payment = await this.vendorPaymentRepository.save({
                ...paymentData,
                invoiceid: invoiceId,
                vendorid: invoice.vendorid,
                createdby: userid,
            });

            // Automatically update payment status
            await this.updatePaymentStatus(invoiceId);

            this.logger.log(`Payment ${payment.id} created for invoice ${invoiceId}`);
            return payment;
        } catch (error) {
            this.logger.error(`Failed to create payment: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get all payments for an invoice
     */
    async getPaymentsByInvoice(invoiceId: number): Promise<VendorPayment[]> {
        return this.vendorPaymentRepository
            .createQueryBuilder('payment')
            .where('payment.invoiceid = :invoiceId', { invoiceId })
            .orderBy('payment.paydate', 'DESC')
            .getMany();
    }

    /**
     * Get payment summary for invoice
     */
    async getPaymentSummary(invoiceId: number): Promise<any> {
        const invoice = await this.purchaseInvoiceRepository.findOne({
            where: { id: invoiceId }
        });

        if (!invoice) {
            throw new BadRequestException('Invoice not found');
        }

        const payments = await this.getPaymentsByInvoice(invoiceId);
        const completedPayments = payments.filter(p => p.paymentstatus === 'COMPLETED');
        const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
        const outstanding = invoice.total - totalPaid;

        return {
            invoiceTotal: invoice.total,
            totalPaid,
            outstanding,
            paymentStatus: invoice.paymentstatus,
            paymentCount: payments.length,
            completedPaymentCount: completedPayments.length,
            payments: payments.map(p => ({
                id: p.id,
                date: p.paydate,
                amount: p.amount,
                type: p.paymenttype,
                mode: p.paymode,
                status: p.paymentstatus,
                transactionRef: p.transref,
                utrNo: p.utrno,
                reconciled: p.reconciled,
            })),
        };
    }

    /**
     * Reconcile payment
     */
    async reconcilePayment(paymentId: number, reconciled: boolean, notes: string, userid: number): Promise<void> {
        try {
            const payment = await this.vendorPaymentRepository.findOne({
                where: { id: paymentId }
            });

            if (!payment) {
                throw new BadRequestException('Payment not found');
            }

            await this.vendorPaymentRepository.update(
                { id: paymentId },
                {
                    reconciled,
                    notes: notes || payment.notes,
                    updatedby: userid,
                }
            );

            this.logger.log(`Payment ${paymentId} reconciliation status updated to ${reconciled}`);
        } catch (error) {
            this.logger.error(`Failed to reconcile payment: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Update payment details
     */
    async updatePayment(paymentId: number, updateData: any, userid: number): Promise<void> {
        try {
            const payment = await this.vendorPaymentRepository.findOne({
                where: { id: paymentId }
            });

            if (!payment) {
                throw new BadRequestException('Payment not found');
            }

            await this.vendorPaymentRepository.update(
                { id: paymentId },
                {
                    ...updateData,
                    updatedby: userid,
                }
            );

            // If payment status changed, update invoice payment status
            if (updateData.paymentstatus !== undefined) {
                await this.updatePaymentStatus(payment.invoiceid);
            }

            this.logger.log(`Payment ${paymentId} updated`);
        } catch (error) {
            this.logger.error(`Failed to update payment: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Delete payment
     */
    async deletePayment(paymentId: number): Promise<void> {
        try {
            const payment = await this.vendorPaymentRepository.findOne({
                where: { id: paymentId }
            });

            if (!payment) {
                throw new BadRequestException('Payment not found');
            }

            const invoiceId = payment.invoiceid;

            await this.vendorPaymentRepository.delete({ id: paymentId });

            // Update invoice payment status after deletion
            await this.updatePaymentStatus(invoiceId);

            this.logger.log(`Payment ${paymentId} deleted`);
        } catch (error) {
            this.logger.error(`Failed to delete payment: ${error.message}`, error.stack);
            throw error;
        }
    }
}
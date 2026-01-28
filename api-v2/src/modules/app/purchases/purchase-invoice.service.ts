import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { ProductBatch } from "src/entities/product-batch.entity";
import { BatchMovementLog } from "src/entities/batch-movement-log.entity";
import { ItemType, DocType, PaymentStatus, TaxStatus, LifecycleStatus } from "./enums";

@Injectable()
export class PurchaseInvoiceService {
    private readonly logger = new Logger(PurchaseInvoiceService.name);

    constructor(
        @InjectRepository(PurchaseInvoice) private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
        @InjectRepository(PurchaseInvoiceItem) private readonly purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>,
        @InjectRepository(VendorPayment) private readonly vendorPaymentRepository: Repository<VendorPayment>,
        @InjectRepository(Product) private readonly productRepository: Repository<Product>,
        @InjectEntityManager() private manager: EntityManager,
        @InjectRepository(ProductPrice2) private readonly productPriceRepository: Repository<ProductPrice2>,
        @InjectRepository(ProductQtyChange) private readonly productQtyChangeRepository: Repository<ProductQtyChange>,
        @InjectRepository(ProductBatch) private readonly productBatchRepository: Repository<ProductBatch>,
        @InjectRepository(BatchMovementLog) private readonly batchMovementLogRepository: Repository<BatchMovementLog>,
        private dataSource: DataSource
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
     * Fix for issue #58: Store pack size at time of purchase
     * Fix for issue #12: Atomic transaction for item creation, price update, and total recalculation
     */
    async createItem(dto: CreatePurchaseInvoiceItemDto, userid: any, salePrice?: number) {
        // Wrap all operations in SERIALIZABLE transaction to ensure atomicity
        return await this.dataSource.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // Validate item type specific requirements
                this.validateItemType(dto);

                // Calculate tax breakdown if not provided
                const taxData = this.calculateItemTaxBreakdown(dto);

                // Fetch product to get current pack size (Fix for issue #58)
                const product = await transactionManager.findOne(Product, {
                    where: { id: dto.productid }
                });

                if (!product) {
                    throw new BadRequestException(`Product with ID ${dto.productid} not found`);
                }

                // Store pack size at time of purchase to prevent retroactive changes
                const packSize = product.pack || 1;

                // Step 1: Create purchase invoice item
                const item = await transactionManager.save(PurchaseInvoiceItem, {
                    ...dto,
                    ...taxData,
                    packsize: packSize,  // Store current pack size (Fix for issue #58)
                    createdby: userid,
                    itemtype: dto.itemtype || ItemType.REGULAR,
                });

                // Step 2: Update product price if sale price provided
                if (salePrice && salePrice > 0) {
                    // End current prices (set end_date for prices ending on 2099-12-31)
                    const newEffDate = new Date().toISOString().split('T')[0];
                    const endDateForOldPrice = new Date(newEffDate);
                    endDateForOldPrice.setDate(endDateForOldPrice.getDate() - 1);
                    const dateToSet = endDateForOldPrice.toISOString().split('T')[0];

                    await transactionManager.query(
                        `UPDATE product_price2 SET end_date = $1 WHERE product_id = $2 AND end_date = '2099-12-31'`,
                        [dateToSet, dto.productid]
                    );

                    // Add new price record
                    await transactionManager.save(ProductPrice2, {
                        productid: dto.productid,
                        saleprice: salePrice,
                        effdate: newEffDate,
                        enddate: '2099-12-31',
                        reason: 'Purchase',
                        createdby: userid
                    });

                    this.logger.log(`Updated sale price for product ${dto.productid} to ₹${salePrice}`);
                }

                // Step 3: Recalculate invoice totals
                const items = await transactionManager.find(PurchaseInvoiceItem, {
                    where: { invoiceid: item.invoiceid }
                });

                const total = items.reduce((sum, item) => sum + (item.total || 0), 0);

                await transactionManager.update(PurchaseInvoice,
                    { id: item.invoiceid },
                    {
                        total: Math.round(total),
                        updatedby: userid
                    }
                );

                this.logger.log(`Created item ${item.id} for invoice ${item.invoiceid}. New total: ₹${Math.round(total)}`);

                return item;
            } catch (error) {
                // Transaction will automatically rollback on error
                this.logger.error(`Failed to create invoice item (transaction rolled back): ${error.message}`, error.stack);
                throw new BadRequestException(`Failed to create invoice item: ${error.message}`);
            }
        });
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
    
    async findAll(page?: number, limit?: number){
      const query = this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.vendor', 'vendor')
        .leftJoinAndSelect('invoice.store', 'store')
        .loadRelationCountAndMap('invoice.items', 'invoice.items')
        .where('invoice.isActive = :flag', { flag: true })
        .orderBy('invoice.invoicedate', 'DESC')
        .addOrderBy('invoice.createdon', 'DESC');

      // Add pagination if parameters provided
      if (page && limit) {
        const skip = (page - 1) * limit;
        query.skip(skip).take(limit);
      }

      const [data, total] = await query.getManyAndCount();

      return {
        data,
        total,
        page: page || 1,
        limit: limit || total,
        totalPages: limit ? Math.ceil(total / limit) : 1
      };
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

        // Get payment summary
        const paymentSummary = await this.getPaymentSummary(invoiceId);

        return {
            invoice: {
                id: invoice.id,
                invoiceno: invoice.invoiceno,
                doctype: invoice.doctype,
                status: invoice.status,
                paymentstatus: invoice.paymentstatus,
                taxstatus: invoice.taxstatus,
                lifecyclestatus: invoice.lifecyclestatus,
            },
            itemsummary: {
                total: items.length,
                regular: regularItems.length,
                return: returnItems.length,
                supplied: suppliedItems.length,
                verified: verifiedItems.length,
                pending: items.length - verifiedItems.length,
            },
            paymentsummary: {
                totalamount: paymentSummary.totalAmount || invoice.total || 0,
                paidamount: paymentSummary.paidAmount || 0,
                outstandingamount: paymentSummary.outstandingAmount || (invoice.total || 0),
                paymentcount: paymentSummary.paymentCount || 0,
                paymentstatus: invoice.paymentstatus || 'UNPAID',
            },
            taxsummary: {
                totaltaxcredit: invoice.totaltaxcredit || 0,
                taxstatus: invoice.taxstatus || 'PENDING',
                filingstatus: null,
            },
            cancloseinvoice: invoice.status === 'COMPLETE' &&
                             invoice.paymentstatus === PaymentStatus.PAID &&
                             invoice.taxstatus === TaxStatus.RECONCILED,
            closureblockers: [],
        };
    }

    // ========== Payment Management Methods ==========

    /**
     * Create vendor payment and update invoice payment status
     * Issue #124 - Overpayment prevention
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

            // Overpayment Prevention (Issue #124)
            // Calculate current outstanding balance
            const payments = await this.vendorPaymentRepository
                .createQueryBuilder('payment')
                .where('payment.invoiceid = :invoiceId', { invoiceId })
                .andWhere('payment.paymentstatus = :status', { status: 'COMPLETED' })
                .getMany();

            const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
            const outstanding = invoice.total - totalPaid;
            const newPaymentAmount = paymentData.amount || 0;

            // Validate payment amount doesn't exceed outstanding balance
            if (newPaymentAmount > outstanding) {
                const error = `Payment amount (₹${newPaymentAmount.toFixed(2)}) exceeds outstanding balance (₹${outstanding.toFixed(2)}). ` +
                    `This would result in an overpayment of ₹${(newPaymentAmount - outstanding).toFixed(2)}. ` +
                    `Invoice total: ₹${invoice.total.toFixed(2)}, Already paid: ₹${totalPaid.toFixed(2)}`;
                this.logger.error(error);
                throw new BadRequestException(error);
            }

            if (newPaymentAmount <= 0) {
                throw new BadRequestException('Payment amount must be greater than zero');
            }

            this.logger.log(
                `Creating payment for invoice ${invoiceId}: ` +
                `Amount: ₹${newPaymentAmount.toFixed(2)}, ` +
                `Outstanding: ₹${outstanding.toFixed(2)}, ` +
                `Total: ₹${invoice.total.toFixed(2)}`
            );

            // Map frontend field names to entity field names
            const { paymentdate, paymentmode, ...rest } = paymentData;

            // Create payment record
            const payment = await this.vendorPaymentRepository.save({
                ...rest,
                paydate: paymentdate,  // Map paymentdate to paydate
                paymode: paymentmode,   // Map paymentmode to paymode
                invoiceid: invoiceId,
                vendorid: invoice.vendorid,
                createdby: userid,
            });

            // Automatically update payment status
            await this.updatePaymentStatus(invoiceId);

            this.logger.log(
                `Payment ${payment.id} created for invoice ${invoiceId}. ` +
                `New balance: ₹${(outstanding - newPaymentAmount).toFixed(2)}`
            );
            return payment;
        } catch (error) {
            this.logger.error(`Failed to create payment: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Quick payment for marking invoice as paid (Issue #61)
     * Creates a payment record for the outstanding amount
     */
    async createQuickPayment(
        invoiceId: number,
        paymentMode: string,
        paymentDate: Date,
        userid: number
    ): Promise<VendorPayment> {
        try {
            // Get invoice with payment summary
            const invoice = await this.purchaseInvoiceRepository.findOne({
                where: { id: invoiceId }
            });

            if (!invoice) {
                throw new BadRequestException('Invoice not found');
            }

            // Calculate outstanding amount
            const payments = await this.vendorPaymentRepository
                .createQueryBuilder('payment')
                .where('payment.invoiceid = :invoiceId', { invoiceId })
                .andWhere('payment.paymentstatus = :status', { status: 'COMPLETED' })
                .getMany();

            const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
            const outstanding = invoice.total - totalPaid;

            if (outstanding <= 0) {
                throw new BadRequestException('Invoice is already fully paid');
            }

            // Convert Date to string format (YYYY-MM-DD) for PostgreSQL date column
            const paydateStr = paymentDate.toISOString().split('T')[0];

            // Create payment record for outstanding amount
            const payment = await this.vendorPaymentRepository.save({
                invoiceid: invoiceId,
                vendorid: invoice.vendorid,
                amount: outstanding,
                paydate: paydateStr,
                paymode: paymentMode,
                paymenttype: 'FULL',
                paymentstatus: 'COMPLETED',
                createdby: userid,
            });

            // Automatically update payment status
            await this.updatePaymentStatus(invoiceId);

            this.logger.log(`Quick payment ${payment.id} created for invoice ${invoiceId} - Amount: ₹${outstanding}`);
            return payment;
        } catch (error) {
            this.logger.error(`Failed to create quick payment: ${error.message}`, error.stack);
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

    /**
     * Verify item (mark as verified)
     * Fix for issue #14: Auto-create stock record when item is verified
     * Fix for issue #127: Auto-create batch record for expiry tracking
     */
    async verifyItem(itemId: number, userId: number): Promise<void> {
        // Wrap in transaction to ensure atomicity of verification + stock + batch creation
        return await this.dataSource.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                // Get item details with invoice relation
                const item = await transactionManager.findOne(PurchaseInvoiceItem, {
                    where: { id: itemId },
                    relations: ['invoice']
                });

                if (!item) {
                    throw new NotFoundException(`Item with ID ${itemId} not found`);
                }

                if (item.status === 'VERIFIED') {
                    throw new BadRequestException('Item is already verified');
                }

                // Validate expiry date is not in the past
                if (item.expdate && new Date(item.expdate) < new Date()) {
                    throw new BadRequestException(
                        `Cannot verify item: Batch is already expired (expiry: ${item.expdate})`
                    );
                }

                // Check if stock record already exists for this item to prevent duplicates
                const existingStock = await transactionManager.findOne(ProductQtyChange, {
                    where: {
                        itemid: itemId,
                        reason: 'PURCHASE_VERIFIED'
                    }
                });

                if (existingStock) {
                    throw new BadRequestException(
                        `Stock record already exists for this item. ` +
                        `Item may have been verified previously.`
                    );
                }

                // Step 1: Mark item as verified
                await transactionManager.update(PurchaseInvoiceItem,
                    { id: itemId },
                    {
                        status: 'VERIFIED',
                        verifiedby: userId,
                        verifyenddate: new Date(),
                        updatedon: new Date(),
                        updatedby: userId
                    }
                );

                // Step 2: Calculate total quantity received (qty + freeqty) * packsize
                const totalQuantity = (item.qty + (item.freeqty || 0)) * (item.packsize || 1);

                // Step 3: Create stock increase record
                const stockRecord = await transactionManager.save(ProductQtyChange, {
                    itemid: itemId,
                    qty: totalQuantity,
                    price: item.saleprice || 0,
                    reason: 'PURCHASE_VERIFIED',
                    status: 'APPROVED',
                    comments: `Auto-generated from purchase item verification. ` +
                              `Received: ${item.qty} + ${item.freeqty || 0} free, Pack: ${item.packsize || 1}`,
                    createdby: userId
                });

                // Step 4: Create product batch record for expiry tracking (Issue #127)
                const batchNumber = item.batch || `AUTO-${itemId}`;
                const expiryDate = item.expdate || new Date(new Date().setFullYear(new Date().getFullYear() + 2)); // Default 2 years

                const batch = await transactionManager.save(ProductBatch, {
                    productId: item.productid,
                    batchNumber: batchNumber,
                    expiryDate: expiryDate,
                    manufacturedDate: item.mfrdate || null,
                    quantityReceived: totalQuantity,
                    quantityRemaining: totalQuantity,
                    purchaseInvoiceItemId: itemId,
                    vendorId: item.invoice?.vendorid,
                    ptrCost: item.ptrvalue || null,
                    receivedDate: item.invoice?.invoicedate || new Date(),
                    status: 'ACTIVE',
                    createdby: userId
                });

                // Step 5: Log batch movement (immutable audit trail)
                await transactionManager.save(BatchMovementLog, {
                    batchId: batch.id,
                    movementType: 'RECEIVED',
                    quantity: totalQuantity,
                    referenceType: 'PURCHASE_INVOICE',
                    referenceId: item.invoiceid,
                    performedBy: userId,
                    performedAt: new Date(),
                    notes: `Received from vendor. Batch: ${batchNumber}, Expiry: ${expiryDate}`
                });

                this.logger.log(
                    `Item ${itemId} verified by user ${userId}. ` +
                    `Stock: ${totalQuantity} units, Batch: ${batch.id} (${batchNumber}), Expiry: ${expiryDate}`
                );
            } catch (error) {
                // Transaction will automatically rollback on error
                this.logger.error(`Failed to verify item (transaction rolled back): ${error.message}`, error.stack);
                throw error;
            }
        });
    }

    /**
     * Reject item with reason
     */
    async rejectItem(itemId: number, reason: string, userId: number): Promise<void> {
        try {
            const item = await this.purchaseInvoiceItemRepository.findOne({
                where: { id: itemId }
            });

            if (!item) {
                throw new NotFoundException(`Item with ID ${itemId} not found`);
            }

            await this.purchaseInvoiceItemRepository.update(
                { id: itemId },
                {
                    status: 'REJECTED',
                    comments: reason,
                    verifiedby: userId,
                    verifyenddate: new Date(),
                    updatedon: new Date(),
                    updatedby: userId
                }
            );

            this.logger.log(`Item ${itemId} rejected by user ${userId}: ${reason}`);
        } catch (error) {
            this.logger.error(`Failed to reject item: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Verify all items in an invoice
     * Fix for issue #14: Auto-create stock records when items are verified
     * Fix for issue #127: Auto-create batch records for expiry tracking
     */
    async verifyAllItems(invoiceId: number, userId: number): Promise<{ verified: number; alreadyVerified: number; stockCreated: number; batchesCreated: number }> {
        // Wrap in transaction to ensure all-or-nothing verification
        return await this.dataSource.transaction('SERIALIZABLE', async (transactionManager) => {
            try {
                const items = await transactionManager.find(PurchaseInvoiceItem, {
                    where: { invoiceid: invoiceId },
                    relations: ['invoice']
                });

                if (items.length === 0) {
                    throw new NotFoundException(`No items found for invoice ${invoiceId}`);
                }

                let verified = 0;
                let alreadyVerified = 0;
                let stockCreated = 0;
                let batchesCreated = 0;

                // Get invoice details for vendor_id and invoice_date
                const invoice = items[0].invoice;

                for (const item of items) {
                    if (item.status === 'VERIFIED') {
                        alreadyVerified++;
                    } else {
                        // Validate expiry date
                        if (item.expdate && new Date(item.expdate) < new Date()) {
                            this.logger.warn(
                                `Skipping item ${item.id}: Already expired (expiry: ${item.expdate})`
                            );
                            continue;
                        }

                        // Check if stock record already exists
                        const existingStock = await transactionManager.findOne(ProductQtyChange, {
                            where: {
                                itemid: item.id,
                                reason: 'PURCHASE_VERIFIED'
                            }
                        });

                        // Update item status to VERIFIED
                        await transactionManager.update(PurchaseInvoiceItem,
                            { id: item.id },
                            {
                                status: 'VERIFIED',
                                verifiedby: userId,
                                verifyenddate: new Date(),
                                updatedon: new Date(),
                                updatedby: userId
                            }
                        );

                        // Create stock and batch records if don't exist
                        if (!existingStock) {
                            const totalQuantity = (item.qty + (item.freeqty || 0)) * (item.packsize || 1);

                            // Create stock record
                            await transactionManager.save(ProductQtyChange, {
                                itemid: item.id,
                                qty: totalQuantity,
                                price: item.saleprice || 0,
                                reason: 'PURCHASE_VERIFIED',
                                status: 'APPROVED',
                                comments: `Auto-generated from bulk verification. ` +
                                          `Received: ${item.qty} + ${item.freeqty || 0} free, Pack: ${item.packsize || 1}`,
                                createdby: userId
                            });

                            stockCreated++;

                            // Create batch record (Issue #127)
                            const batchNumber = item.batch || `AUTO-${item.id}`;
                            const expiryDate = item.expdate || new Date(new Date().setFullYear(new Date().getFullYear() + 2));

                            const batch = await transactionManager.save(ProductBatch, {
                                productId: item.productid,
                                batchNumber: batchNumber,
                                expiryDate: expiryDate,
                                manufacturedDate: item.mfrdate || null,
                                quantityReceived: totalQuantity,
                                quantityRemaining: totalQuantity,
                                purchaseInvoiceItemId: item.id,
                                vendorId: invoice?.vendorid,
                                ptrCost: item.ptrvalue || null,
                                receivedDate: invoice?.invoicedate || new Date(),
                                status: 'ACTIVE',
                                createdby: userId
                            });

                            // Log batch movement
                            await transactionManager.save(BatchMovementLog, {
                                batchId: batch.id,
                                movementType: 'RECEIVED',
                                quantity: totalQuantity,
                                referenceType: 'PURCHASE_INVOICE',
                                referenceId: invoiceId,
                                performedBy: userId,
                                performedAt: new Date(),
                                notes: `Bulk verification. Batch: ${batchNumber}, Expiry: ${expiryDate}`
                            });

                            batchesCreated++;
                        }

                        verified++;
                    }
                }

                this.logger.log(
                    `Invoice ${invoiceId}: ${verified} items verified, ${alreadyVerified} already verified, ` +
                    `${stockCreated} stock records created, ${batchesCreated} batches created by user ${userId}`
                );

                return { verified, alreadyVerified, stockCreated, batchesCreated };
            } catch (error) {
                // Transaction will automatically rollback on error
                this.logger.error(`Failed to verify all items (transaction rolled back): ${error.message}`, error.stack);
                throw error;
            }
        });
    }

    /**
     * Get verification status for invoice items
     */
    async getItemVerificationStatus(invoiceId: number): Promise<{
        total: number;
        verified: number;
        pending: number;
        rejected: number;
        percentageComplete: number;
    }> {
        try {
            const items = await this.purchaseInvoiceItemRepository.find({
                where: { invoiceid: invoiceId }
            });

            if (items.length === 0) {
                return {
                    total: 0,
                    verified: 0,
                    pending: 0,
                    rejected: 0,
                    percentageComplete: 0
                };
            }

            const total = items.length;
            const verified = items.filter(item => item.status === 'VERIFIED').length;
            const rejected = items.filter(item => item.status === 'REJECTED').length;
            const pending = total - verified - rejected;
            const percentageComplete = Math.round((verified / total) * 100);

            return {
                total,
                verified,
                pending,
                rejected,
                percentageComplete
            };
        } catch (error) {
            this.logger.error(`Failed to get verification status: ${error.message}`, error.stack);
            throw error;
        }
    }
}
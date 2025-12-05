import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PurchaseInvoiceTaxCredit } from "src/entities/purchase-invoice-tax-credit.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { CreateTaxCreditDto, UpdateTaxCreditDto, ReportMismatchDto } from "./dto/create-tax-credit.dto";
import { TaxFilingStatus, TaxStatus } from "./enums";

@Injectable()
export class TaxCreditService {
    private readonly logger = new Logger(TaxCreditService.name);

    constructor(
        @InjectRepository(PurchaseInvoiceTaxCredit)
        private readonly taxCreditRepository: Repository<PurchaseInvoiceTaxCredit>,
        @InjectRepository(PurchaseInvoice)
        private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>
    ) { }

    /**
     * Create tax credit record for invoice
     */
    async create(dto: CreateTaxCreditDto, userid: number): Promise<PurchaseInvoiceTaxCredit> {
        try {
            // Verify invoice exists
            const invoice = await this.purchaseInvoiceRepository.findOne({
                where: { id: dto.invoiceid }
            });

            if (!invoice) {
                throw new BadRequestException('Invoice not found');
            }

            // Check if tax credit already exists for this invoice
            const existing = await this.taxCreditRepository.findOne({
                where: { invoiceid: dto.invoiceid }
            });

            if (existing) {
                throw new BadRequestException('Tax credit record already exists for this invoice');
            }

            // Validate tax amounts match invoice
            const totalTax = (dto.cgstamount || 0) + (dto.sgstamount || 0) + (dto.igstamount || 0);
            if (Math.abs(totalTax - dto.totaltaxcredit) > 0.01) {
                throw new BadRequestException('Total tax credit does not match sum of CGST, SGST, and IGST');
            }

            // Create tax credit record
            const taxCredit = await this.taxCreditRepository.save({
                ...dto,
                createdby: userid,
                filingstatus: dto.filingstatus || TaxFilingStatus.PENDING,
            });

            // Update invoice tax status
            await this.purchaseInvoiceRepository.update(
                { id: dto.invoiceid },
                {
                    taxstatus: TaxStatus.PENDING,
                    totaltaxcredit: dto.totaltaxcredit,
                }
            );

            this.logger.log(`Tax credit ${taxCredit.id} created for invoice ${dto.invoiceid}`);
            return taxCredit;
        } catch (error) {
            this.logger.error(`Failed to create tax credit: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Update tax credit filing status
     */
    async updateFilingStatus(id: number, dto: UpdateTaxCreditDto, userid: number): Promise<void> {
        try {
            const taxCredit = await this.taxCreditRepository.findOne({
                where: { id }
            });

            if (!taxCredit) {
                throw new BadRequestException('Tax credit record not found');
            }

            await this.taxCreditRepository.update(
                { id },
                {
                    ...dto,
                    updatedby: userid,
                }
            );

            // Update invoice tax status based on filing status
            if (dto.filingstatus === TaxFilingStatus.CLAIMED) {
                await this.purchaseInvoiceRepository.update(
                    { id: taxCredit.invoiceid },
                    { taxstatus: TaxStatus.RECONCILED }
                );
            }

            this.logger.log(`Tax credit ${id} filing status updated to ${dto.filingstatus}`);
        } catch (error) {
            this.logger.error(`Failed to update tax credit: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Report tax mismatch
     */
    async reportMismatch(id: number, dto: ReportMismatchDto, userid: number): Promise<void> {
        try {
            const taxCredit = await this.taxCreditRepository.findOne({
                where: { id }
            });

            if (!taxCredit) {
                throw new BadRequestException('Tax credit record not found');
            }

            await this.taxCreditRepository.update(
                { id },
                {
                    hasmismatch: dto.hasmismatch,
                    mismatchreason: dto.mismatchreason,
                    mismatchamount: dto.mismatchamount,
                    mismatchresolved: dto.mismatchresolved || false,
                    mismatchresolutionnotes: dto.mismatchresolutionnotes,
                    updatedby: userid,
                }
            );

            // Update invoice tax status to MISMATCH
            if (dto.hasmismatch) {
                await this.purchaseInvoiceRepository.update(
                    { id: taxCredit.invoiceid },
                    { taxstatus: TaxStatus.MISMATCH }
                );
            }

            this.logger.log(`Tax mismatch reported for tax credit ${id}`);
        } catch (error) {
            this.logger.error(`Failed to report mismatch: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Get tax credit by invoice ID
     */
    async findByInvoice(invoiceId: number): Promise<PurchaseInvoiceTaxCredit> {
        return this.taxCreditRepository.findOne({
            where: { invoiceid: invoiceId }
        });
    }

    /**
     * Get tax credits by filing month
     */
    async findByFilingMonth(gstFilingMonth: string): Promise<PurchaseInvoiceTaxCredit[]> {
        return this.taxCreditRepository
            .createQueryBuilder('tc')
            .where('tc.gstfilingmonth = :gstFilingMonth', { gstFilingMonth })
            .orderBy('tc.createdon', 'DESC')
            .getMany();
    }

    /**
     * Get tax credits by status
     */
    async findByStatus(filingStatus: TaxFilingStatus): Promise<PurchaseInvoiceTaxCredit[]> {
        return this.taxCreditRepository
            .createQueryBuilder('tc')
            .where('tc.filingstatus = :filingStatus', { filingStatus })
            .orderBy('tc.gstfilingmonth', 'DESC')
            .getMany();
    }

    /**
     * Get tax credits with mismatches
     */
    async findWithMismatches(): Promise<PurchaseInvoiceTaxCredit[]> {
        return this.taxCreditRepository
            .createQueryBuilder('tc')
            .where('tc.hasmismatch = :hasmismatch', { hasmismatch: true })
            .andWhere('tc.mismatchresolved = :resolved', { resolved: false })
            .orderBy('tc.createdon', 'DESC')
            .getMany();
    }

    /**
     * Get tax reconciliation summary for period
     */
    async getReconciliationSummary(gstFilingMonth: string): Promise<any> {
        const taxCredits = await this.findByFilingMonth(gstFilingMonth);

        const summary = {
            filingMonth: gstFilingMonth,
            totalInvoices: taxCredits.length,
            totalTaxCredit: taxCredits.reduce((sum, tc) => sum + tc.totaltaxcredit, 0),
            totalCGST: taxCredits.reduce((sum, tc) => sum + (tc.cgstamount || 0), 0),
            totalSGST: taxCredits.reduce((sum, tc) => sum + (tc.sgstamount || 0), 0),
            totalIGST: taxCredits.reduce((sum, tc) => sum + (tc.igstamount || 0), 0),
            byStatus: {} as any,
            mismatches: {
                count: 0,
                totalAmount: 0,
                resolved: 0,
                pending: 0,
            },
        };

        // Count by status
        Object.values(TaxFilingStatus).forEach(status => {
            const count = taxCredits.filter(tc => tc.filingstatus === status).length;
            summary.byStatus[status] = count;
        });

        // Mismatch summary
        const mismatches = taxCredits.filter(tc => tc.hasmismatch);
        summary.mismatches.count = mismatches.length;
        summary.mismatches.totalAmount = mismatches.reduce((sum, tc) => sum + (tc.mismatchamount || 0), 0);
        summary.mismatches.resolved = mismatches.filter(tc => tc.mismatchresolved).length;
        summary.mismatches.pending = mismatches.filter(tc => !tc.mismatchresolved).length;

        return summary;
    }

    /**
     * Delete tax credit record
     */
    async delete(id: number): Promise<void> {
        try {
            const taxCredit = await this.taxCreditRepository.findOne({
                where: { id }
            });

            if (!taxCredit) {
                throw new BadRequestException('Tax credit record not found');
            }

            const invoiceId = taxCredit.invoiceid;

            await this.taxCreditRepository.delete({ id });

            // Reset invoice tax status
            await this.purchaseInvoiceRepository.update(
                { id: invoiceId },
                { taxstatus: TaxStatus.PENDING }
            );

            this.logger.log(`Tax credit ${id} deleted`);
        } catch (error) {
            this.logger.error(`Failed to delete tax credit: ${error.message}`, error.stack);
            throw error;
        }
    }
}

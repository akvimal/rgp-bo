import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Repository } from "typeorm";

@Injectable()
export class VendorPaymentService {
    constructor(
        @InjectRepository(VendorPayment) private readonly paymentRepository: Repository<VendorPayment>,
        @InjectRepository(PurchaseInvoice) private readonly invoiceRepository: Repository<PurchaseInvoice>,
    ) {}

    async create(dto: any, userid: number) {
        const amount = Number(dto.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new BadRequestException('Payment amount must be greater than zero.');
        }

        const invoice = await this.invoiceRepository.findOne({ where: { id: Number(dto.invoiceid) } });
        if (!invoice) {
            throw new NotFoundException('Invoice not found.');
        }
        if (invoice.status !== 'COMPLETE') {
            throw new BadRequestException('Payments can only be recorded against a completed invoice.');
        }

        const paid = await this.sumActivePayments(invoice.id);
        const balance = Number(invoice.total || 0) - paid;
        // a small tolerance for rounding/paise differences
        if (amount > balance + 0.5) {
            throw new BadRequestException(
                `Payment (${amount.toFixed(2)}) exceeds the outstanding balance (${Math.max(0, balance).toFixed(2)}).`);
        }

        return this.paymentRepository.save({
            ...dto,
            amount,
            status: 'RECORDED',
            communicationstatus: dto.communicationstatus || 'Not Sent',
            communicatedat: dto.communicatedat ? new Date(dto.communicatedat) : null,
            acknowledgedat: dto.acknowledgedat ? new Date(dto.acknowledgedat) : null,
            createdby: userid,
            updatedby: userid,
        });
    }

    update(id: number, dto: any, userid: number) {
        return this.paymentRepository.update(id, {
            ...dto,
            communicatedat: dto.communicatedat ? new Date(dto.communicatedat) : null,
            acknowledgedat: dto.acknowledgedat ? new Date(dto.acknowledgedat) : null,
            updatedby: userid,
        });
    }

    /**
     * Reverse a payment instead of editing/deleting it in place: the original
     * row is flagged REVERSED (kept for the audit trail) and a new negative
     * offsetting row is written pointing back at it.
     */
    async reverse(id: number, userid: number, reason?: string) {
        const original = await this.paymentRepository.findOne({ where: { id } });
        if (!original) {
            throw new NotFoundException('Payment not found.');
        }
        if (original.status === 'REVERSED') {
            throw new BadRequestException('This payment is already reversed.');
        }

        await this.paymentRepository.update(id, { status: 'REVERSED', updatedby: userid });
        return this.paymentRepository.save({
            vendorid: original.vendorid,
            invoiceid: original.invoiceid,
            paydate: new Date().toISOString().slice(0, 10),
            amount: -Number(original.amount),
            paymode: original.paymode,
            transref: original.transref,
            status: 'RECORDED',
            reversesid: original.id,
            remarks: reason || `Reversal of payment #${original.id}`,
            createdby: userid,
            updatedby: userid,
        });
    }

    findByInvoice(invoiceid: number) {
        return this.paymentRepository.find({
            where: { invoiceid, isActive: true, isArchived: false },
            order: { paydate: 'DESC', id: 'DESC' },
        });
    }

    private async sumActivePayments(invoiceid: number): Promise<number> {
        const payments = await this.paymentRepository.find({
            where: { invoiceid, isActive: true, isArchived: false },
        });
        return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }
}

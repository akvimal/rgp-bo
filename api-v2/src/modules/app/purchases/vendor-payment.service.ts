import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { AuditService } from "src/core/audit/audit.service";

@Injectable()
export class VendorPaymentService {
    constructor(
        @InjectRepository(VendorPayment) private readonly paymentRepository: Repository<VendorPayment>,
        @InjectRepository(PurchaseInvoice) private readonly invoiceRepository: Repository<PurchaseInvoice>,
        private readonly audit: AuditService,
    ) {}

    async create(dto: any, userid: number) {
        return this.paymentRepository.manager.transaction('SERIALIZABLE', async (tm) => {
            return this.saveOne(tm, dto, userid);
        });
    }

    /**
     * Pay run (WS-2): one payment batch split across several of a vendor's
     * outstanding invoices, sharing a batchref. All-or-nothing - if any line
     * fails validation the whole batch rolls back.
     */
    async payRun(dto: any, userid: number) {
        const vendorid = Number(dto.vendorid);
        const allocations = (Array.isArray(dto.allocations) ? dto.allocations : [])
            .map((a: any) => ({ invoiceid: Number(a?.invoiceid), amount: Number(a?.amount) }))
            .filter((a: any) => a.invoiceid && a.amount > 0);

        if (!vendorid) {
            throw new BadRequestException('Vendor is required.');
        }
        if (!allocations.length) {
            throw new BadRequestException('Select at least one invoice with an amount to pay.');
        }

        const batchref = `PAY-${Date.now()}`;
        return this.paymentRepository.manager.transaction('SERIALIZABLE', async (tm) => {
            const payments: VendorPayment[] = [];
            for (const alloc of allocations) {
                const payment = await this.saveOne(tm, {
                    vendorid,
                    invoiceid: alloc.invoiceid,
                    paydate: dto.paydate,
                    amount: alloc.amount,
                    paymode: dto.paymode,
                    transref: dto.transref,
                    remarks: dto.remarks,
                    batchref,
                }, userid);
                payments.push(payment);
            }
            return {
                batchref,
                count: payments.length,
                total: payments.reduce((sum, p: any) => sum + Number(p.amount || 0), 0),
                payments,
            };
        });
    }

    /**
     * Corrects the details of a recorded payment: mode, reference (UTR / cheque no.), date, remarks and the
     * communication fields. Only what is sent changes. The amount, invoice and vendor can never be changed here:
     * reverse the payment and record the right one instead. Every change is written to the audit log.
     */
    async update(id: number, dto: any, userid: number) {
        const cur = await this.paymentRepository.findOne({ where: { id } });
        if (!cur) throw new NotFoundException('Payment not found.');
        for (const k of ['amount', 'invoiceid', 'vendorid']) {
            if (dto?.[k] !== undefined && Number(dto[k]) !== Number((cur as any)[k])) {
                throw new BadRequestException('The amount, invoice and vendor of a recorded payment cannot be changed. Reverse it and record the right one.');
            }
        }
        if (cur.status === 'REVERSED' || (cur as any).reversesid) {
            throw new BadRequestException('A reversed payment, and the entry that reverses it, cannot be edited.');
        }
        const patch: any = {};
        const text = (k: string, max: number, label: string) => {
            if (dto?.[k] === undefined) return;
            const v = dto[k] === null ? null : String(dto[k]).trim();
            if (v && v.length > max) throw new BadRequestException(`${label} is too long (${max} characters at most).`);
            patch[k] = v || null;
        };
        if (dto?.paymode !== undefined) {
            const m = String(dto.paymode ?? '').trim();
            if (!m) throw new BadRequestException('Choose how it was paid.');
            if (m.length > 30) throw new BadRequestException('Payment mode is too long.');
            patch.paymode = m;
        }
        text('transref', 40, 'The reference');
        text('remarks', 200, 'Remarks');
        text('communicationstatus', 30, 'Communication status');
        text('communicationchannel', 30, 'Communication channel');
        text('acknowledgementreference', 60, 'Acknowledgement reference');
        if (dto?.paydate !== undefined) {
            const d = String(dto.paydate ?? '').slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestException('The payment date must be YYYY-MM-DD.');
            if (d > new Date().toISOString().slice(0, 10)) throw new BadRequestException('The payment date cannot be in the future.');
            patch.paydate = d;
        }
        for (const k of ['communicatedat', 'acknowledgedat']) {
            if (dto?.[k] !== undefined) patch[k] = dto[k] ? new Date(dto[k]) : null;
        }

        const before: any = {}, after: any = {};
        for (const k of Object.keys(patch)) {
            const was = (cur as any)[k];
            const norm = (x: any) => (x instanceof Date ? x.toISOString().slice(0, 10) : x ?? null);
            if (String(norm(was)) !== String(norm(patch[k]))) { before[k] = norm(was); after[k] = norm(patch[k]); }
        }
        if (!Object.keys(after).length) return this.paymentRepository.findOne({ where: { id } });

        await this.paymentRepository.update(id, { ...patch, updatedby: userid });
        await this.audit.record({ userId: userid, action: 'payment.info_updated', entityType: 'vendorpayments', entityId: id,
            summary: `payment #${id} details changed (${Object.keys(after).join(', ')})`, details: { before, after, invoiceid: cur.invoiceid } });
        return this.paymentRepository.findOne({ where: { id } });
    }

    /**
     * Reverse a payment instead of editing/deleting it in place: the original
     * row is flagged REVERSED (kept for the audit trail) and a new negative
     * offsetting row is written pointing back at it.
     */
    async reverse(id: number, userid: number, reason?: string) {
        return this.paymentRepository.manager.transaction('SERIALIZABLE', async (tm) => {
            const original = await tm.findOne(VendorPayment, { where: { id } });
            if (!original) {
                throw new NotFoundException('Payment not found.');
            }
            if (original.status === 'REVERSED') {
                throw new BadRequestException('This payment is already reversed.');
            }

            await tm.update(VendorPayment, id, { status: 'REVERSED', updatedby: userid });
            return tm.save(VendorPayment, {
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
        });
    }

    findByInvoice(invoiceid: number) {
        return this.paymentRepository.find({
            where: { invoiceid, isActive: true, isArchived: false },
            order: { paydate: 'DESC', id: 'DESC' },
        });
    }

    private async saveOne(tm: EntityManager, dto: any, userid: number) {
        const amount = Number(dto.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new BadRequestException('Payment amount must be greater than zero.');
        }

        const invoice = await tm.findOne(PurchaseInvoice, { where: { id: Number(dto.invoiceid) } });
        if (!invoice) {
            throw new NotFoundException(`Invoice ${dto.invoiceid} not found.`);
        }
        if (invoice.status !== 'COMPLETE') {
            throw new BadRequestException(`${invoice.invoiceno}: payments can only be recorded against a completed invoice.`);
        }
        if (invoice.paymentstatus === 'On Hold') {
            throw new BadRequestException(`${invoice.invoiceno} is on hold - clear the hold before paying it.`);
        }

        const paid = await this.sumActivePayments(tm, invoice.id);
        const balance = Number(invoice.total || 0) - paid;
        if (amount > balance + 0.5) {
            throw new BadRequestException(
                `${invoice.invoiceno}: payment (${amount.toFixed(2)}) exceeds the outstanding balance (${Math.max(0, balance).toFixed(2)}).`);
        }

        return tm.save(VendorPayment, {
            vendorid: dto.vendorid,
            invoiceid: dto.invoiceid,
            paydate: dto.paydate,
            amount,
            paymode: dto.paymode,
            transref: dto.transref,
            status: 'RECORDED',
            batchref: dto.batchref || null,
            communicationstatus: dto.communicationstatus || 'Not Sent',
            communicationchannel: dto.communicationchannel || null,
            communicatedat: dto.communicatedat ? new Date(dto.communicatedat) : null,
            acknowledgedat: dto.acknowledgedat ? new Date(dto.acknowledgedat) : null,
            remarks: dto.remarks,
            createdby: userid,
            updatedby: userid,
        });
    }

    private async sumActivePayments(tm: EntityManager, invoiceid: number): Promise<number> {
        const payments = await tm.find(VendorPayment, {
            where: { invoiceid, isActive: true, isArchived: false },
        });
        return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }
}

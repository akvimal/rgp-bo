import { assertStoreLicensed } from "../store/store-guard";
import { assertVendorUsable } from "../vendors/vendor-guard";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { Product } from "src/entities/product.entity";
import { Vendor } from "src/entities/vendor.entity";
import { Business } from "src/entities/business.entity";
import { AuditService } from "src/core/audit/audit.service";
import { isManagerRole } from "src/core/roles";
import { cleanRef, gstPeriodFor } from "./receipt-rules";
import { businessOfUser } from "src/core/business-of-user";
import { classifyChange, DEFAULT_PRICE_APPROVAL_PCT, DEFAULT_PRICE_TOLERANCE_PCT, netRate, percentSetting, unitJump } from "./price-rules";

@Injectable()
export class PurchaseInvoiceService {

    constructor(@InjectRepository(PurchaseInvoice) private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseInvoiceItem) private readonly purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>,
    @InjectRepository(VendorPayment) private readonly vendorPaymentRepository: Repository<VendorPayment>,
    @InjectRepository(PurchaseOrder) private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseRequest) private readonly purchaseRequestRepository: Repository<PurchaseRequest>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(Vendor) private readonly vendorRepository: Repository<Vendor>,
    @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
    @InjectEntityManager() private manager: EntityManager,
    private readonly audit: AuditService) { }

    private getDerivedPaymentStatus(invoice:any, paidAmount:number){
      const total = +(invoice.total || 0);
      const dueDate = invoice.duedate ? new Date(invoice.duedate) : (invoice.invoicedate ? new Date(invoice.invoicedate) : null);
      const isOverdue = !!(dueDate && total - paidAmount > 0 && dueDate < new Date(new Date().toDateString()));

      if(invoice.paymentstatus === 'On Hold'){
        return 'On Hold';
      }

      if(paidAmount <= 0){
        return isOverdue ? 'Overdue' : 'Unpaid';
      }

      if(paidAmount < total){
        return isOverdue ? 'Overdue' : 'Part Paid';
      }

      return 'Paid';
    }

    private mapInvoice(invoice:any){
      const payments = invoice.payments || [];
      const paidamount = payments.reduce((sum:number, payment:any) => sum + +(payment.amount || 0), 0);
      const balanceamount = Math.max(0, +(invoice.total || 0) - paidamount);
      const paymentstatus = this.getDerivedPaymentStatus(invoice, paidamount);

      return {
        ...invoice,
        payments,
        paidamount: Math.round(paidamount * 100) / 100,
        balanceamount: Math.round(balanceamount * 100) / 100,
        paymentstatus,
      };
    }

    /** WS-6: which store this invoice's stock is received into. Falls back to the business's
     * first store when the caller doesn't say - keeps every existing single-store caller working. */
    /** the store that receives an invoice when none is named: the first store of the receiving person's own business (the first store of all only when the person has none) */
    private async resolveDefaultStoreId(userid?: number){
        const businessId = userid ? await businessOfUser(this.manager, Number(userid)) : null;
        if(businessId){
          const own = await this.manager.query(`select id from stores where business_id = $1 and active and not archive order by id asc limit 1`, [businessId]);
          if(own?.[0]?.id) return own[0].id;
        }
        const rows = await this.manager.query(`select id from stores order by id asc limit 1`);
        return rows?.[0]?.id ?? null;
    }

    async create(dto: CreatePurchaseInvoiceDto, userid:any) {
        if(dto.purchaseorderid){
          await this.assertApprovedPurchaseOrder(+dto.purchaseorderid);
        }
        if(!dto.vendorid){
          throw new BadRequestException('Vendor is required.');
        }

        await assertVendorUsable(this.vendorRepository.manager, dto.vendorid, 'receiving an invoice');

        const storeid = dto.storeid || await this.resolveDefaultStoreId(userid);
        if(!storeid){
          throw new BadRequestException('No store is configured to receive this invoice.');
        }

        await assertStoreLicensed(this.vendorRepository.manager, storeid, 'receiving an invoice');

        const vendor = await this.vendorRepository.findOne({ where: { id: +dto.vendorid } });
        // goods can arrive on a delivery challan before the invoice: then only the challan number is known
        const invoiceno = cleanRef(dto.invoiceno);
        const challanno = cleanRef(dto.challanno);
        if(!invoiceno && !challanno){
          throw new BadRequestException(`Enter the invoice number, or the delivery challan number if the invoice has not come yet.`);
        }
        await this.assertNotDuplicate(+dto.vendorid, invoiceno ?? undefined, null);
        await this.assertNotDuplicateChallan(+dto.vendorid, challanno, null);
        const invoicedate = dto.invoicedate || dto.challandate || new Date().toISOString().slice(0, 10);

        let duedate = dto.duedate;
        if(!duedate){
          const termsDays = Number(vendor?.paymenttermsdays || 0);
          const base = new Date(invoicedate);
          base.setDate(base.getDate() + termsDays);
          duedate = base.toISOString().slice(0, 10);
        }

        const gst = await this.deriveInvoiceGstContext(vendor, { ...dto, invoiceno, invoicedate }, storeid);

        return this.purchaseInvoiceRepository.save({
          ...dto,
          invoiceno,
          challanno,
          invoicedate,
          storeid,
          duedate: duedate || invoicedate,
          paymentstatus: dto.paymentstatus || 'Unpaid',
          ...gst,
          createdby:userid
        });
    }

    async createItem(dto: CreatePurchaseInvoiceItemDto, userid:any) {
        // a line needs its expiry, except for a product that never expires (a blade, a thermometer): it carries the "No expiry date" property
        if(!dto.expdate){
          const [p] = await this.manager.query(`select title, coalesce(more_props->>'noexpiry', '') as noexpiry from product where id = $1`, [+dto.productid]);
          if(p && p.noexpiry !== 'true'){
            throw new BadRequestException(`An expiry date is required for ${p.title}. For a product that never expires (like a blade), tick "No expiry date" on the product.`);
          }
        }
        const invoice = await this.purchaseInvoiceRepository.findOne({ where: { id: +dto.invoiceid } });
        const gstLine = this.computeLineGst(+(dto.total || 0), (dto as any).taxpcnt, invoice?.supplytype || 'INTRA');
        // the HSN the vendor printed on the line, else the product's own; it feeds the product's HSN when that is not known (GST > HSN codes)
        const printed = String((dto as any).hsn ?? '').replace(/\s+/g, '');
        let hsn: string | null = /^\d{4}(\d{2}){0,2}$/.test(printed) ? printed : null;
        if(!hsn){
          const [own] = await this.manager.query(`select nullif(btrim(hsn_code), '') as hsn from product where id = $1`, [+dto.productid]);
          hsn = own?.hsn ?? null;
        }
        const saved = await this.purchaseInvoiceItemRepository.save({...dto, hsn, ...gstLine, createdby:userid});
        await this.recomputeInvoiceGstTotals(+dto.invoiceid);
        return saved;
    }

    /** the same invoice number from the same vendor twice is almost always a double entry: say which one it is */
    private async assertNotDuplicate(vendorid: number, invoiceno: string | undefined, exceptId: number | null){
        const no = String(invoiceno ?? '').trim();
        if(!no || !vendorid) return;
        const [dup] = await this.manager.query(
          `select id, gr_no from purchase_invoice where vendor_id = $1 and upper(invoice_no) = upper($2) and id <> $3 limit 1`, [vendorid, no, exceptId ?? 0]);
        if(dup) throw new BadRequestException(`Invoice ${no} from this vendor is already entered${dup.gr_no ? ` (GRN ${dup.gr_no})` : ''}. Open it from the invoice list instead of entering it again.`);
    }

    private async assertNotDuplicateChallan(vendorid: number, challanno: string | null, exceptId: number | null){
        if(!challanno || !vendorid) return;
        const [dup] = await this.manager.query(
          `select id, gr_no from purchase_invoice where vendor_id = $1 and upper(challan_no) = upper($2) and id <> $3 and active and not archive limit 1`, [vendorid, challanno, exceptId ?? 0]);
        if(dup) throw new BadRequestException(`Challan ${challanno} from this vendor is already entered${dup.gr_no ? ` (GRN ${dup.gr_no})` : ''}. Open it from the invoice list and add the invoice number there.`);
    }

    /** GSTIN/place-of-supply/supply-type defaults for a new invoice header (decision #1: one GSTIN per business). */
    private async deriveInvoiceGstContext(vendor: Vendor | null, dto: any, storeid?: number | null){
        // the buyer is the business that owns the receiving store; the first business is used only when the store has none
        const [owner] = storeid ? await this.manager.query(`select business_id from stores where id = $1`, [storeid]) : [];
        const business = (owner?.business_id ? await this.businessRepository.findOne({ where: { id: owner.business_id } as any }) : null)
          ?? await this.businessRepository.findOne({ where: { isActive: true } as any, order: { id: 'ASC' } as any });
        const suppliergstin = dto.suppliergstin || vendor?.gstn || null;
        const placeofsupply = dto.placeofsupply || (suppliergstin ? suppliergstin.substring(0, 2) : null) || business?.statecode || null;
        const buyerstate = business?.statecode || null;
        const supplytype = dto.supplytype || (placeofsupply && buyerstate ? (placeofsupply === buyerstate ? 'INTRA' : 'INTER') : 'INTRA');
        return {
          suppliergstin,
          placeofsupply,
          supplytype,
          invoicetype: dto.invoicetype || 'REGULAR',
          reversecharge: dto.reversecharge ?? false,
          itceligibility: dto.itceligibility || 'INPUTS',
          gstreconstatus: 'UNRECONCILED',
          gstperiod: gstPeriodFor(dto.invoiceno, dto.invoicedate)
        };
    }

    /** Split one line's total into taxable value + CGST/SGST (intra-state) or IGST (inter-state). */
    private computeLineGst(total: number, taxpcnt: any, supplytype: string){
        const pcnt = Number(taxpcnt || 0);
        const taxablevalue = pcnt > 0 ? +(total / (1 + pcnt / 100)).toFixed(2) : +(+total).toFixed(2);
        const taxamount = +(total - taxablevalue).toFixed(2);
        if(supplytype === 'INTER'){
          return { taxablevalue, cgstamount: 0, sgstamount: 0, igstamount: taxamount };
        }
        const half = +(taxamount / 2).toFixed(2);
        return { taxablevalue, cgstamount: half, sgstamount: +(taxamount - half).toFixed(2), igstamount: 0 };
    }

    /** Sums active line GST splits back up to the invoice header, plus the rounding remainder vs `total`. */
    private async recomputeInvoiceGstTotals(invoiceid: number){
        const invoice = await this.purchaseInvoiceRepository.findOne({ where: { id: invoiceid } });
        if(!invoice){
          return;
        }
        const items = await this.purchaseInvoiceItemRepository.find({ where: { invoiceid, isActive: true, isArchived: false } });
        const taxablevalue = +items.reduce((sum, i:any) => sum + +(i.taxablevalue || 0), 0).toFixed(2);
        const cgstamount = +items.reduce((sum, i:any) => sum + +(i.cgstamount || 0), 0).toFixed(2);
        const sgstamount = +items.reduce((sum, i:any) => sum + +(i.sgstamount || 0), 0).toFixed(2);
        const igstamount = +items.reduce((sum, i:any) => sum + +(i.igstamount || 0), 0).toFixed(2);
        const roundoff = +((+(invoice.total || 0)) - (taxablevalue + cgstamount + sgstamount + igstamount)).toFixed(2);
        await this.purchaseInvoiceRepository.update(invoiceid, { taxablevalue, cgstamount, sgstamount, igstamount, roundoff });
    }

    async importOrderItems(invoiceid:number, userid:number){
      const invoice = await this.purchaseInvoiceRepository.findOne({ where: { id: invoiceid, isActive: true, isArchived: false } });
      if(!invoice || !invoice.purchaseorderid){
        return { imported: 0, skipped: 0, message: 'Invoice does not have a linked purchase order.' };
      }

      const order = await this.purchaseOrderRepository.createQueryBuilder('po')
        .leftJoinAndSelect('po.requests', 'requests')
        .leftJoinAndSelect('requests.product', 'product')
        .select(['po.id','po.status','requests','product'])
        .where('po.id = :id', { id: +invoice.purchaseorderid })
        .getOne();

      if(!order){
        return { imported: 0, skipped: 0, message: 'Linked purchase order not found.' };
      }

      const existingItems = await this.purchaseInvoiceItemRepository.find({
        where: { invoiceid, isActive: true, isArchived: false }
      });
      const importedRequestIds = new Set(existingItems.map((item:any) => item.requestid).filter((id:any) => !!id));

      // Batch-fetch latest invoice data for all products upfront to avoid N+1 queries
      const allRequests = order.requests || [];
      const productIds = [...new Set(allRequests.map((r:any) => r.productid).filter(Boolean))];
      const latestDefaults = new Map<number, any>();
      if(productIds.length > 0){
        const latestRows = await this.manager.query(`
          select distinct on (pii.product_id)
            pii.product_id,
            pii.batch,
            pii.exp_date,
            pii.mfr_date,
            pii.ptr_value,
            pii.ptr_cost,
            pii.mrp_cost,
            pii.disc_pcnt,
            pii.tax_pcnt,
            pii.sale_price
          from purchase_invoice_item pii
          inner join purchase_invoice pi on pi.id = pii.invoice_id
          where pii.product_id = any($1::int[])
            and pii.active = true
            and pii.archive = false
            and pi.active = true
            and pi.archive = false
          order by pii.product_id, pi.invoice_date desc, pii.created_on desc
        `, [productIds]);
        for(const row of latestRows){
          latestDefaults.set(+row.product_id, row);
        }
      }

      let imported = 0;
      let skipped = 0;

      for(const request of allRequests){
        if(request.id && importedRequestIds.has(request.id)){
          skipped++;
          continue;
        }

        // a request still waiting to be linked to a product has nothing to import
        if(!request.productid){
          skipped++;
          continue;
        }

        const product = request.product;
        const defaults = latestDefaults.get(request.productid) || {};
        const qty = +(request.orderedqty || request.qty || 0);
        const ptrvalue = +(defaults.ptr_value ?? 0);
        const discpcnt = +(defaults.disc_pcnt ?? 0);
        const taxpcnt = +(defaults.tax_pcnt ?? product?.taxpcnt ?? 0);
        const mrpcost = +(defaults.mrp_cost ?? 0);
        const saleprice = +(defaults.sale_price ?? 0);
        const ptrcost = +(defaults.ptr_cost ?? +(ptrvalue * (1 + (taxpcnt / 100))).toFixed(2));
        const total = +(qty * ptrvalue * (1 - (discpcnt / 100))).toFixed(2);
        const gstLine = this.computeLineGst(total, taxpcnt, invoice.supplytype || 'INTRA');

        await this.purchaseInvoiceItemRepository.save({
          invoiceid,
          productid: request.productid,
          requestid: request.id,
          batch: defaults.batch ?? null,
          expdate: defaults.exp_date ?? null,
          mfrdate: defaults.mfr_date ?? null,
          hsn: product?.hsn ?? null,
          ptrvalue,
          ptrcost,
          mrpcost,
          discpcnt,
          taxpcnt,
          saleprice,
          qty,
          freeqty: 0,
          total,
          ...gstLine,
          comments: request.comments || `Imported from PO #${order.id}`,
          status: 'NEW',
          createdby: userid,
          updatedby: userid
        });
        imported++;
      }

      const items = await this.findAllItemsByInvoice(invoiceid);
      const total = items.reduce((sum:number, item:any) => sum + +(item.total || 0), 0);
      await this.update([invoiceid], { total: Math.round(total * 100) / 100 }, userid);
      await this.recomputeInvoiceGstTotals(invoiceid);

      return {
        imported,
        skipped,
        message: imported > 0 ? `Imported ${imported} PO item(s).` : 'No new PO items were imported.'
      };
    }
    
    async findAll(page = 1, limit = 50, vendorId?: number): Promise<{ data: any[]; total: number; page: number; limit: number }> {
      const safePage = Math.max(1, page);
      const safeLimit = Math.min(200, Math.max(1, limit));

      const [invoices, total] = await this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .innerJoinAndSelect("invoice.vendor", "vendor")
        .leftJoinAndSelect("invoice.items", "items")
        .leftJoinAndSelect("invoice.payments", "payments")
        .select(['invoice', 'vendor.id', 'vendor.name', 'payments', 'items.id'])
        .where(vendorId ? 'invoice.vendorid = :vendorId' : '1 = 1', { vendorId })
        .orderBy('invoice.invoicedate', 'DESC')
        .skip((safePage - 1) * safeLimit)
        .take(safeLimit)
        .getManyAndCount();

      const data = invoices.map((invoice: any) => {
        const mapped = this.mapInvoice(invoice);
        return {
          id: mapped.id,
          vendor_id: mapped.vendorid,
          invoice_no: mapped.invoiceno,
          invoice_date: mapped.invoicedate,
          due_date: mapped.duedate,
          business_name: mapped.vendor?.name,
          status: mapped.status,
          payment_status: mapped.paymentstatus,
          items: mapped.items?.length || 0,
          total: mapped.total,
          paid_amount: mapped.paidamount,
          balance_amount: mapped.balanceamount,
          is_overdue: mapped.paymentstatus === 'Overdue'
        };
      });
      return { data, total, page: safePage, limit: safeLimit };
  }

  async findOutstanding(query: { vendorid?: string | number }) {
    const qb = this.purchaseInvoiceRepository.createQueryBuilder('invoice')
      .innerJoinAndSelect("invoice.vendor", "vendor")
      .leftJoinAndSelect("invoice.payments", "payments")
      .select(['invoice', 'vendor.id', 'vendor.name', 'payments'])
      .where('invoice.isActive = :flag', { flag: true })
      // a draft invoice has not been received, so nothing is owed on it yet (and a payment against it is refused)
      .andWhere("invoice.status = 'COMPLETE'")
      // goods received on a challan are not owed until the vendor's invoice number is entered
      .andWhere('invoice.invoiceno is not null')
      .orderBy('invoice.invoicedate', 'DESC');

    if (query.vendorid) {
      qb.andWhere('invoice.vendorid = :vid', { vid: +query.vendorid });
    }

    const invoices = await qb.getMany();
    return invoices
      .map((invoice: any) => this.mapInvoice(invoice))
      .filter((inv: any) => +(inv.balanceamount || 0) > 0)
      .map((mapped: any) => ({
        id: mapped.id,
        vendor_id: mapped.vendorid,
        invoice_no: mapped.invoiceno,
        invoice_date: mapped.invoicedate,
        due_date: mapped.duedate,
        business_name: mapped.vendor?.name,
        status: mapped.status,
        payment_status: mapped.paymentstatus,
        total: mapped.total,
        paid_amount: mapped.paidamount,
        balance_amount: mapped.balanceamount,
        is_overdue: mapped.paymentstatus === 'Overdue'
      }));
  }
  
  /**
   * WS-2 vendor payables rollup: every vendor with an outstanding balance,
   * with an ageing breakdown by days past due. Backs the Payables screen's
   * vendor list and the pay-run dialog.
   */
  async findPayablesSummary() {
    const outstanding = await this.findOutstanding({});
    const today = new Date(new Date().toDateString());
    const byVendor = new Map<number, any>();

    for (const inv of outstanding) {
      const key = inv.vendor_id;
      if (!byVendor.has(key)) {
        byVendor.set(key, {
          vendor_id: key,
          vendor_name: inv.business_name,
          invoice_count: 0,
          total_outstanding: 0,
          total_overdue: 0,
          on_hold_count: 0,
          oldest_due_date: null as string | null,
          ageing: { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 },
        });
      }
      const row = byVendor.get(key);
      const balance = Number(inv.balance_amount || 0);

      row.invoice_count += 1;
      row.total_outstanding += balance;
      if (inv.is_overdue) {
        row.total_overdue += balance;
      }
      if (inv.payment_status === 'On Hold') {
        row.on_hold_count += 1;
      }
      if (inv.due_date && (!row.oldest_due_date || inv.due_date < row.oldest_due_date)) {
        row.oldest_due_date = inv.due_date;
      }

      const dueDate = inv.due_date ? new Date(inv.due_date) : today;
      const ageDays = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
      if (ageDays <= 30) row.ageing.d0_30 += balance;
      else if (ageDays <= 60) row.ageing.d31_60 += balance;
      else if (ageDays <= 90) row.ageing.d61_90 += balance;
      else row.ageing.d90_plus += balance;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    return Array.from(byVendor.values())
      .map((row) => ({
        ...row,
        total_outstanding: round2(row.total_outstanding),
        total_overdue: round2(row.total_overdue),
        ageing: {
          d0_30: round2(row.ageing.d0_30),
          d31_60: round2(row.ageing.d31_60),
          d61_90: round2(row.ageing.d61_90),
          d90_plus: round2(row.ageing.d90_plus),
        },
      }))
      .sort((a, b) => b.total_outstanding - a.total_outstanding);
  }

  async findSalePrice(input){
    return await this.manager.query(`select
    pii.mfr_date, pii.exp_date, pii.batch, p.pack, pii.mrp_cost, pii.sale_price, pii.product_id, pii.tax_pcnt, pii.created_on,
    round(pii.ptr_value::numeric ,2) as ptr_value
    from purchase_invoice_item pii
    inner join product p on p.id = pii.product_id
    where pii.product_id = $1
    and upper(pii.batch) = upper($2)
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
        const invoice = await this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .innerJoinAndSelect("invoice.vendor", "vendor")
        .leftJoinAndSelect("invoice.items", "items")
        .leftJoinAndSelect("items.product", "product")
        .leftJoinAndSelect("invoice.payments", "payments")
          .select(['invoice','vendor','items','product','payments'])
          .where('invoice.id = :id', { id })
          .orderBy('payments.paydate', 'DESC')
          .addOrderBy('payments.id', 'DESC')
          .getOne();

        return invoice ? this.mapInvoice(invoice) : null;
    }

    async getGRN(key:string){
      return await this.manager.query(`select generate_grn($1)`, [key]);
    }

    /**
     * Delete an invoice and its lines (a draft, or a received one whose stock is thereby reversed). Refused when a payment, a
     * vendor issue or a GST match is recorded against it. The screens offer it for drafts only.
     */
    async remove(id:number, userId?:number){
      const [inv] = await this.manager.query(
        `select i.id, i.invoice_no, i.status, i.total, v.business_name as vendor,
                (select count(*)::int from purchase_invoice_item x where x.invoice_id = i.id) as items,
                (select count(*)::int from vendor_payment p where p.invoice_id = i.id) as payments,
                (select count(*)::int from vendor_issue q where q.invoice_id = i.id) as issues,
                (select count(*)::int from gst_reconciliation g where g.purchase_invoice_id = i.id) + (select count(*)::int from gst_inward_supply s where s.matched_invoice_id = i.id) as gst
           from purchase_invoice i left join vendor v on v.id = i.vendor_id where i.id = $1`, [id]);
      if (!inv) throw new NotFoundException('That invoice does not exist.');
      if (inv.payments > 0) throw new BadRequestException('This invoice has payments recorded against it, so it cannot be deleted.');
      if (inv.issues > 0) throw new BadRequestException('A vendor issue is raised against this invoice, so it cannot be deleted.');
      if (inv.gst > 0) throw new BadRequestException('This invoice is matched in GST reconciliation, so it cannot be deleted.');
      const result = await this.removeRows(id);
      await this.audit.record({ userId: userId ?? null, action: 'purchase.invoice_deleted', entityType: 'purchase_invoice', entityId: id,
        summary: `${inv.status === 'NEW' ? 'Draft invoice' : 'Invoice'} ${inv.invoice_no} (${inv.vendor ?? 'vendor'}) deleted with ${inv.items} line${inv.items === 1 ? '' : 's'}`, details: { invoice_no: inv.invoice_no, status: inv.status, total: inv.total, items: inv.items } });
      return result;
    }

    private async removeRows(id:number){
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
      /**
       * Each line's net rate against the vendor's previous net rate for that product (their latest completed invoice),
       * with what the line still needs: nothing, a reason, or a reason and an approver. Backs the rate-change column on the receiving screen.
       */
      async priceCheck(invoiceid:number){
        const [inv] = await this.manager.query(`select id, vendor_id from purchase_invoice where id = $1`, [invoiceid]);
        if(!inv) throw new NotFoundException('That invoice does not exist.');
        const settings = await this.manager.query(
          `select setting_key, setting_value from app_setting where category = 'purchases' and setting_key in ('price_tolerance_pct', 'price_approval_pct') and active and not archive`);
        const pick = (k:string) => settings.find((s:any) => s.setting_key === k)?.setting_value;
        const tolerance = percentSetting(pick('price_tolerance_pct'), DEFAULT_PRICE_TOLERANCE_PCT);
        const approval = percentSetting(pick('price_approval_pct'), DEFAULT_PRICE_APPROVAL_PCT);

        const lines = await this.manager.query(
          `select i.id, i.product_id, p.title, p.pack, i.batch, i.ptr_value, i.mrp_cost, i.disc_pcnt, i.price_reason, i.price_approved_by
             from purchase_invoice_item i join product p on p.id = i.product_id
            where i.invoice_id = $1 and i.active and not i.archive order by i.id`, [invoiceid]);
        const previous = lines.length === 0 ? [] : await this.manager.query(
          `select distinct on (pii.product_id) pii.product_id, pii.ptr_value, pii.disc_pcnt, to_char(pi.invoice_date, 'YYYY-MM-DD') as invoice_date
             from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
            where pi.vendor_id = $1 and pi.id <> $2 and pi.status = 'COMPLETE' and pi.active and not pi.archive
              and pii.active and not pii.archive and pii.product_id = any($3::int[])
            order by pii.product_id, pi.invoice_date desc, pii.created_on desc`,
          [inv.vendor_id, invoiceid, [...new Set<number>(lines.map((l:any) => +l.product_id))]]);
        const prevOf = new Map<number, any>(previous.map((r:any) => [+r.product_id, r]));
        // the MRP of the product's last purchase from anyone: a jump is a different pack or unit
        const lastMrp = lines.length === 0 ? [] : await this.manager.query(
          `select distinct on (pii.product_id) pii.product_id, pii.mrp_cost
             from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
            where pi.id <> $1 and pi.status = 'COMPLETE' and pi.active and not pi.archive and pii.active and not pii.archive
              and pii.mrp_cost > 0 and pii.product_id = any($2::int[])
            order by pii.product_id, pi.invoice_date desc, pii.created_on desc`,
          [invoiceid, [...new Set<number>(lines.map((l:any) => +l.product_id))]]);
        const mrpOf = new Map<number, number>(lastMrp.map((r:any) => [+r.product_id, +r.mrp_cost]));

        const rows = lines.map((l:any) => {
          const p = prevOf.get(+l.product_id);
          const now = netRate(l.ptr_value, l.disc_pcnt);
          const prev = p ? netRate(p.ptr_value, p.disc_pcnt) : null;
          const changed = classifyChange(prev, now, tolerance, approval);
          const unit = unitJump(mrpOf.get(+l.product_id) ?? null, +l.mrp_cost);
          // a unit change needs the receiver's word (and the product's pack checked) even when the rate fell
          const level = unit !== null && changed.level === 'NONE' ? 'REASON' : changed.level;
          const pcnt = changed.pcnt;
          return {
            itemid: +l.id, productid: +l.product_id, title: l.title, batch: l.batch, pack: +l.pack,
            unitjump: unit, rate: now, prevrate: prev, prevdate: p?.invoice_date ?? null, pcnt, level,
            reason: l.price_reason ?? null, approvedby: l.price_approved_by ?? null,
          };
        });
        return { tolerance, approval, lines: rows, needs: rows.filter((r:any) => r.level !== 'NONE').length };
      }

      /**
       * Completing an invoice: every line whose rate rose past the tolerance needs a reason, and one that rose past the approval
       * percent needs a Store Head or Business Head to be the one completing it. What each line was compared with is kept on the line.
       */
      private async assertPriceRules(invoiceid:number, userid:number){
        const check = await this.priceCheck(invoiceid);
        const missing = check.lines.filter((l:any) => l.level !== 'NONE' && !l.reason);
        if(missing.length){
          throw new BadRequestException(`Give a reason for the rate change on: ${missing.map((l:any) => l.unitjump !== null
            ? `${l.title} (MRP is ${l.unitjump}x its last purchase: is the pack size right?)`
            : `${l.title} (${l.pcnt > 0 ? '+' : ''}${l.pcnt}% vs last ${l.prevrate})`).join('; ')}.`);
        }
        const [who] = await this.manager.query(`select r.name as role from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [userid]);
        const manager = isManagerRole(who?.role);
        const large = check.lines.filter((l:any) => l.level === 'APPROVAL');
        if(large.length && !manager){
          throw new BadRequestException(`A Store Head or Business Head must complete this invoice: the rate rose by more than ${check.approval}% on ${large.map((l:any) => `${l.title} (+${l.pcnt}%)`).join('; ')}.`);
        }
        for(const l of check.lines){
          await this.manager.query(
            `update purchase_invoice_item set prev_rate = $2, prev_rate_date = $3, rate_change_pcnt = $4,
                    price_approved_by = case when $5::boolean then $6 else price_approved_by end,
                    price_approved_on = case when $5::boolean then now() else price_approved_on end
              where id = $1`,
            [l.itemid, l.prevrate, l.prevdate, l.pcnt, l.level === 'APPROVAL', userid]);
        }
        if(check.needs > 0){
          await this.audit.record({ userId: userid, action: 'purchase.price_rise_accepted', entityType: 'purchase_invoice', entityId: invoiceid,
            summary: `${check.needs} line${check.needs === 1 ? '' : 's'} with a vendor rate rise accepted on completion${large.length ? `, ${large.length} above ${check.approval}%` : ''}`,
            details: { lines: check.lines.filter((l:any) => l.level !== 'NONE').map((l:any) => ({ item: l.itemid, title: l.title, prev: l.prevrate, now: l.rate, pcnt: l.pcnt, reason: l.reason })) } });
        }
      }

      /**
       * An invoice number or challan number is being set or changed on one receipt. One of the two must remain, neither may repeat
       * for the vendor, an invoice number cannot be taken away once money or GST depends on it, and the GST month follows the
       * invoice number and date (none while the invoice is still to come).
       */
      private async checkReferences(id:number, values:any){
        const [cur] = await this.manager.query(
          `select i.vendor_id, i.invoice_no, i.challan_no, to_char(i.invoice_date, 'YYYY-MM-DD') as invoice_date,
                  (select count(*)::int from vendor_payment p where p.invoice_id = i.id) as payments,
                  (select count(*)::int from gst_reconciliation g where g.purchase_invoice_id = i.id) as gst
             from purchase_invoice i where i.id = $1`, [id]);
        if(!cur) throw new NotFoundException('That invoice does not exist.');
        const invoiceno = 'invoiceno' in values ? cleanRef(values.invoiceno) : cleanRef(cur.invoice_no);
        const challanno = 'challanno' in values ? cleanRef(values.challanno) : cleanRef(cur.challan_no);
        if(!invoiceno && !challanno){
          throw new BadRequestException(`Keep the invoice number, or the delivery challan number if the invoice has not come yet.`);
        }
        if(cur.invoice_no && !invoiceno && (cur.payments > 0 || cur.gst > 0)){
          throw new BadRequestException(`The invoice number cannot be removed: a payment or a GST match is recorded against this invoice.`);
        }
        const vendorid = +(values.vendorid ?? cur.vendor_id);
        await this.assertNotDuplicate(vendorid, invoiceno ?? undefined, id);
        await this.assertNotDuplicateChallan(vendorid, challanno, id);
        const out:any = { ...values };
        if('invoiceno' in values) out.invoiceno = invoiceno;
        if('challanno' in values) out.challanno = challanno;
        if('invoiceno' in values || 'invoicedate' in values) out.gstperiod = gstPeriodFor(invoiceno, values.invoicedate ?? cur.invoice_date);
        return out;
      }

      async update(ids:number[], values:any, userid:number){
        if(values?.purchaseorderid){
          await this.assertApprovedPurchaseOrder(+values.purchaseorderid);
        }
        if(values?.status === 'COMPLETE'){
          for(const id of ids) await this.assertPriceRules(id, userid);
        }
        if(ids.length === 1 && values && ('invoiceno' in values || 'challanno' in values || 'invoicedate' in values)){
          values = await this.checkReferences(ids[0], values);
        }
        const result = await this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .update(PurchaseInvoice, {...values, updatedby: userid})
        .where("id in (:...ids)", { ids })
        .execute();

        // `total` (set at GRN completion, after all items exist) drives round_off - recompute once it lands.
        if(values?.total !== undefined){
          for(const id of ids){
            await this.recomputeInvoiceGstTotals(id);
          }
        }

        return result;
      }

      async updateItems(ids:number[], values:any, userid:any){
        const obj = {...values, updatedby:userid};
        if(values['status'] && values['status'] == 'VERIFIED'){
          obj['verifiedby'] = userid;
        }
       const result = await this.purchaseInvoiceItemRepository.createQueryBuilder('items')
        .update(PurchaseInvoiceItem, obj)
        .where("id in (:...ids)", { ids })
        .execute();

        // total/taxpcnt changed -> the line's GST split (and its invoice's header totals) is stale.
        if(values['total'] !== undefined || values['taxpcnt'] !== undefined){
          await this.recomputeLineGstForItems(ids);
        }

        return result;
      }

      async removeItems(ids:number[]){
          const affectedInvoiceIds = new Set<number>(
            (await this.purchaseInvoiceItemRepository.find({ where: { id: In(ids) } })).map((i:any) => i.invoiceid)
          );
          const result = await this.purchaseInvoiceItemRepository.createQueryBuilder('items')
          .delete()
          .from(PurchaseInvoiceItem)
          .where("id in (:...ids)", { ids })
          .execute();
          for(const invoiceid of affectedInvoiceIds){
            await this.recomputeInvoiceGstTotals(invoiceid);
          }
          return result;
        }

      /** Recomputes the GST split for individual items (after a manual edit to total/taxpcnt), then their invoices' header totals. */
      private async recomputeLineGstForItems(ids: number[]){
        const items = await this.purchaseInvoiceItemRepository.find({ where: { id: In(ids) } });
        const invoiceIds = new Set<number>();
        for(const item of items as any[]){
          const invoice = await this.purchaseInvoiceRepository.findOne({ where: { id: item.invoiceid } });
          const gstLine = this.computeLineGst(+(item.total || 0), item.taxpcnt, invoice?.supplytype || 'INTRA');
          await this.purchaseInvoiceItemRepository.update(item.id, gstLine);
          invoiceIds.add(item.invoiceid);
        }
        for(const invoiceid of invoiceIds){
          await this.recomputeInvoiceGstTotals(invoiceid);
        }
      }

    private async assertApprovedPurchaseOrder(id:number){
      const order = await this.purchaseOrderRepository.createQueryBuilder('po')
        .select(['po.id','po.status','po.approvalstatus'])
        .where('po.id = :id', { id })
        .getOne();

      if(!order){
        throw new Error('Linked purchase order not found');
      }

      if(order.approvalstatus !== 'Approved'){
        throw new Error('Invoice can only be created from an approved purchase order');
      }
    }
}

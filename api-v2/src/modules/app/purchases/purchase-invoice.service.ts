import { BadRequestException, Injectable } from "@nestjs/common";
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
    @InjectEntityManager() private manager: EntityManager) { }

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

    async create(dto: CreatePurchaseInvoiceDto, userid:any) {
        if(dto.purchaseorderid){
          await this.assertApprovedPurchaseOrder(+dto.purchaseorderid);
        }
        if(!dto.vendorid){
          throw new BadRequestException('Vendor is required.');
        }

        const vendor = await this.vendorRepository.findOne({ where: { id: +dto.vendorid } });

        let duedate = dto.duedate;
        if(!duedate && dto.invoicedate){
          const termsDays = Number(vendor?.paymenttermsdays || 0);
          const base = new Date(dto.invoicedate);
          base.setDate(base.getDate() + termsDays);
          duedate = base.toISOString().slice(0, 10);
        }

        const gst = await this.deriveInvoiceGstContext(vendor, dto);

        return this.purchaseInvoiceRepository.save({
          ...dto,
          duedate: duedate || dto.invoicedate,
          paymentstatus: dto.paymentstatus || 'Unpaid',
          ...gst,
          createdby:userid
        });
    }

    async createItem(dto: CreatePurchaseInvoiceItemDto, userid:any) {
        const invoice = await this.purchaseInvoiceRepository.findOne({ where: { id: +dto.invoiceid } });
        const gstLine = this.computeLineGst(+(dto.total || 0), (dto as any).taxpcnt, invoice?.supplytype || 'INTRA');
        const saved = await this.purchaseInvoiceItemRepository.save({...dto, ...gstLine, createdby:userid});
        await this.recomputeInvoiceGstTotals(+dto.invoiceid);
        return saved;
    }

    /** GSTIN/place-of-supply/supply-type defaults for a new invoice header (decision #1: one GSTIN per business). */
    private async deriveInvoiceGstContext(vendor: Vendor | null, dto: any){
        const business = await this.businessRepository.findOne({ where: { isActive: true } as any, order: { id: 'ASC' } as any });
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
          gstperiod: dto.invoicedate ? `${dto.invoicedate}`.slice(0, 7) : null
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
    
    async findAll(page = 1, limit = 50): Promise<{ data: any[]; total: number; page: number; limit: number }> {
      const safePage = Math.max(1, page);
      const safeLimit = Math.min(200, Math.max(1, limit));

      const [invoices, total] = await this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .innerJoinAndSelect("invoice.vendor", "vendor")
        .leftJoinAndSelect("invoice.items", "items")
        .leftJoinAndSelect("invoice.payments", "payments")
        .select(['invoice', 'vendor.id', 'vendor.name', 'payments', 'items.id'])
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
        if(values?.purchaseorderid){
          await this.assertApprovedPurchaseOrder(+values.purchaseorderid);
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

import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { Product } from "src/entities/product.entity";

@Injectable()
export class PurchaseInvoiceService {

    constructor(@InjectRepository(PurchaseInvoice) private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseInvoiceItem) private readonly purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>,
    @InjectRepository(VendorPayment) private readonly vendorPaymentRepository: Repository<VendorPayment>,
    @InjectRepository(PurchaseOrder) private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseRequest) private readonly purchaseRequestRepository: Repository<PurchaseRequest>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
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
        return this.purchaseInvoiceRepository.save({
          ...dto,
          duedate: dto.duedate || dto.invoicedate,
          paymentstatus: dto.paymentstatus || 'Unpaid',
          createdby:userid
        });
    }
    
    async createItem(dto: CreatePurchaseInvoiceItemDto, userid:any) {
        return this.purchaseInvoiceItemRepository.save({...dto, createdby:userid});
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

        await this.purchaseInvoiceItemRepository.save({
          invoiceid,
          productid: request.productid,
          requestid: request.id,
          batch: defaults.batch ?? null,
          expdate: defaults.exp_date ?? null,
          mfrdate: defaults.mfr_date ?? null,
          ptrvalue,
          ptrcost,
          mrpcost,
          discpcnt,
          taxpcnt,
          saleprice,
          qty,
          freeqty: 0,
          total,
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
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .update(PurchaseInvoice, {...values, updatedby: userid})
        .where("id in (:...ids)", { ids })
        .execute();
      }

      async updateItems(ids:number[], values:any, userid:any){
        const obj = {...values, updatedby:userid};
        if(values['status'] && values['status'] == 'VERIFIED'){
          obj['verifiedby'] = userid;
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

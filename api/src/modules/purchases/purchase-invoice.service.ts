import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { EntityManager, Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";

@Injectable()
export class PurchaseInvoiceService {

    constructor(@InjectRepository(PurchaseInvoice) private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseInvoiceItem) private readonly purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>,
    @InjectEntityManager() private manager: EntityManager) { }

    async create(dto: CreatePurchaseInvoiceDto, userid:any) {
        return this.purchaseInvoiceRepository.save({...dto, createdby:userid});
    }
    
    async createItem(dto: CreatePurchaseInvoiceItemDto, userid:any) {
        return this.purchaseInvoiceItemRepository.save({...dto, createdby:userid});
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
    where product_id = ${input.productid}
    and upper(batch) = '${input.batch.toUpperCase()}'
    order by pii.created_on desc 
    limit 1`);
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
      return await this.manager.query(`select generate_grn('${key}')`);
    }

    async remove(id:number){
      
      await this.manager.query(`
      delete from product_price where 
      item_id in (select id from purchase_invoice_item where invoice_id = ${id})`);

      await this.purchaseInvoiceItemRepository.createQueryBuilder('item')
      .delete()
      .from(PurchaseInvoiceItem)
      .where("invoiceid =:id", { id })
      .execute();
      return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
      .delete()
      .from(PurchaseInvoice)
      .where("id =:id", { id })
      .execute();
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
        
       return await this.purchaseInvoiceItemRepository.createQueryBuilder('items')
        .update(PurchaseInvoiceItem, {...values, updatedby:userid})
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
}
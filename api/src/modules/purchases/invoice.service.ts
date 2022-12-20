import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { PurchaseInvoice } from "src/entities/purchase-invoice.entity";
import { Repository } from "typeorm";
import { CreatePurchaseInvoiceItemDto } from "./dto/create-invoice-item.dto";
import { CreatePurchaseInvoiceDto } from "./dto/create-invoice.dto";

@Injectable()
export class PurchaseInvoiceService {

    constructor(@InjectRepository(PurchaseInvoice) private readonly purchaseInvoiceRepository: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseInvoiceItem) private readonly purchaseInvoiceItemRepository: Repository<PurchaseInvoiceItem>) { }

    async create(dto: CreatePurchaseInvoiceDto, userid:any) {
        return this.purchaseInvoiceRepository.save({...dto, createdby:userid});
    }
    
    async createItem(dto: CreatePurchaseInvoiceItemDto, userid:any) {
        return this.purchaseInvoiceItemRepository.save({...dto, createdby:userid});
    }
    
    async findAll(){
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
          .innerJoinAndSelect("invoice.vendor", "vendor")
          .select(['invoice','vendor.name'])
          .where('invoice.active = :flag', { flag:true })
          .getMany();
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

    async findItemById(id:string){
        return this.purchaseInvoiceItemRepository.createQueryBuilder('item')
        // .innerJoinAndSelect("item.invoice", "invoice")
        // .leftJoinAndSelect("item.product", "product")
        //   .select(['product'])
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

      async update(ids:number[], values:any, userid:number){
        console.log('USER id: ',userid);
        
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
        .update(PurchaseInvoice, {...values, updatedby: userid})
        .where("id in (:...ids)", { ids })
        .execute();
      }

      async updateItems(ids:number[], values:any, userid:any){
        return this.purchaseInvoiceItemRepository.createQueryBuilder('items')
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
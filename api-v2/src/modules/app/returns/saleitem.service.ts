import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { CreateSaleReturnDto } from "./dto/create-salereturn.dto";
import { CreateProductClearanceDto } from "./dto/create-clearance.dto";
import { SaleItem } from "src/entities/sale-item.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { ProductClearance } from "src/entities/product-clearance.entity";

@Injectable()
export class SaleItemService {

    RETURN_PERIOD_MONTHS_ALLOWED = 4;

    constructor(
        @InjectRepository(SaleItem) private readonly saleItemRepo: Repository<SaleItem>,
        @InjectRepository(PurchaseInvoiceItem) private readonly purchaseItemRepo: Repository<PurchaseInvoiceItem>,
        @InjectRepository(ProductClearance) private readonly clearanceRepo: Repository<ProductClearance>,
        @InjectEntityManager() private manager: EntityManager) { }

        async saveReturn(dto: CreateSaleReturnDto, userid: any) {

            const purchaseItem = await this.saleItemRepo.findOne({where:{id:dto.saleitemid}});
            if(!purchaseItem){
                throw new NotFoundException('Sale item not found');
            }
            return this.saleItemRepo.save({
                saleid: purchaseItem.saleid,
                itemid: purchaseItem.itemid,
                qty: (-1 * dto.qty),
                price: purchaseItem.price,
                total: purchaseItem.price * (-1 * dto.qty),
                paymode: dto.paymode,
                status: dto.status,
                reason: dto.reason,
                comments: dto.comments,
                createdby: userid
            });
        }

        async saveClearance(dto: CreateProductClearanceDto, userid: any) {

            const purchaseItem = await this.purchaseItemRepo.findOne({where:{id:dto.itemid}});
            if(!purchaseItem){
                throw new NotFoundException('Sale item not found');
            }
            return this.clearanceRepo.save({
                itemid: purchaseItem.id,
                qty: dto.qty,
                price: dto.price,
                total: dto.price * dto.qty,
                status: dto.status,
                reason: dto.reason,
                comments: dto.comments,
                createdby: userid
            });
        }
        
    async findAllReturns(query: any, userid: any) {
        const qb = this.saleItemRepo.createQueryBuilder("si")
            .leftJoinAndSelect("si.sale", "s")
            .leftJoinAndSelect("si.purchaseitem", "pi")
            .leftJoinAndSelect("pi.product", "p")
            .leftJoinAndSelect("s.customer", "c")
            .select(['si.id', 'si.qty', 'si.price', 'si.createdon',
                'si.reason', 'si.status', 'si.comments',
                's.billdate', 's.id',
                'pi.id', 'pi.batch', 'pi.expdate',
                'p.id', 'p.title',
                'c.name', 'c.mobile'])
            .where('si.active = true and si.qty < 0');
        qb.orderBy('si.createdon', 'DESC')
        return qb.getMany();
    }

    getFormatDate(dt: Date) {
        let mon = dt.getMonth() + 1;
        let dat = dt.getDate();
        return dt.getFullYear() + '-' + (mon < 10 ? ('0' + mon) : mon)
            + '-' + (dat < 10 ? ('0' + dat) : dat);
    }

    async findCustomers(criteria: any) {
        const now = new Date();
        const other = new Date(now.setMonth(now.getMonth() - this.RETURN_PERIOD_MONTHS_ALLOWED));
        return await this.manager.query(`
            select distinct c.id, c.name, c.mobile 
            from sale s 
            inner join customer c on s.customer_id = c.id
            where s.bill_date > '${this.getFormatDate(new Date(other))}' 
            and (c.name ilike '${criteria.starts}%' or c.mobile like '${criteria.starts}%')`);
    }

    async findCustomerItems(criteria: any) {
        const now = new Date();
        const other = new Date(now.setMonth(now.getMonth() - this.RETURN_PERIOD_MONTHS_ALLOWED));
        return await this.manager.query(`
        select distinct p.title, pii.batch, pii.mfr_date, pii.exp_date, si.price, 
        si.id as saleitem_id, s.bill_date, s.id as bill_no, si.qty as sold_qty, 
        x.aqty as allow_qty, si.created_on
        from sale_item si 
        inner join sale s on s.id = si.sale_id 
        inner join purchase_invoice_item pii on pii.id = si.purchase_item_id 
        inner join product p on p.id = pii.product_id 
        left join (select sale_id, purchase_item_id, sum(qty) as aqty from sale_item sri 
        group by sale_id, purchase_item_id) x on x.sale_id = si.sale_id and x.purchase_item_id = si.purchase_item_id
        where s.customer_id = ${criteria.customerid} 
        and s.bill_date > '${this.getFormatDate(new Date(other))}' 
        and p.title ilike '${criteria.starts}%'
        and si.qty > 0 and x.aqty > 0 
        order by si.created_on desc`);
    }

    async findById(id: number) {
        const qb = this.saleItemRepo.createQueryBuilder("si")
            .leftJoinAndSelect("si.sale", "s")
            .leftJoinAndSelect("si.purchaseitem", "pi")
            .leftJoinAndSelect("pi.product", "p")
            .leftJoinAndSelect("s.customer", "c")
            .select([
                'si.id', 'si.qty', 'si.price',
                'si.createdon', 'si.reason', 'si.status', 'si.comments',
                's.billdate', 's.id',
                'pi.id', 'pi.batch', 'pi.expdate',
                'p.id', 'p.title',
                'c.name', 'c.mobile'])
            .where('si.id = :id', { id });

        return qb.getOne();
    }

    async update(id: any, values: any, userid: any) {
        await this.saleItemRepo.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.saleItemRepo.findOne({where:{id}});
            if(!obj){
                throw new NotFoundException('Sale item not found');
            }
            await transaction.update(SaleItem, id, { ...values, updatedby: userid });
        });
    }

    async remove(itemid: any, userid: any) {
        await this.saleItemRepo.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.update(SaleItem, itemid, { isActive:false, isArchived: true, updatedby: userid });
        });
    }

}
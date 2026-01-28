import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager, DataSource } from "typeorm";
import { Repository } from "typeorm";
import { CreateSaleReturnDto } from "./dto/create-salereturn.dto";
import { CreateProductClearanceDto } from "./dto/create-clearance.dto";
import { SaleItem } from "src/entities/sale-item.entity";
import { PurchaseInvoiceItem } from "src/entities/purchase-invoice-item.entity";
import { ProductClearance } from "src/entities/product-clearance.entity";
import { BatchAllocationService, BatchAllocation } from "../stock/batch-allocation.service";

@Injectable()
export class SaleItemService {
    private readonly logger = new Logger(SaleItemService.name);
    RETURN_PERIOD_MONTHS_ALLOWED = 4;

    constructor(
        @InjectRepository(SaleItem) private readonly saleItemRepo: Repository<SaleItem>,
        @InjectRepository(PurchaseInvoiceItem) private readonly purchaseItemRepo: Repository<PurchaseInvoiceItem>,
        @InjectRepository(ProductClearance) private readonly clearanceRepo: Repository<ProductClearance>,
        @InjectEntityManager() private manager: EntityManager,
        private readonly batchAllocationService: BatchAllocationService,
        private readonly dataSource: DataSource) { }

        /**
         * Save product return and reconcile with original batch allocations
         * Returns quantity to the same batches from which it was sold (FEFO order)
         */
        async saveReturn(dto: CreateSaleReturnDto, userid: any) {
            return await this.dataSource.transaction('SERIALIZABLE', async (transactionManager) => {
                // 1. Get original sale item with batch allocations
                const originalSaleItem = await transactionManager.findOne(SaleItem, {
                    where: { id: dto.saleitemid }
                });

                if (!originalSaleItem) {
                    throw new NotFoundException('Sale item not found');
                }

                // 2. Validate return quantity
                if (dto.qty <= 0) {
                    throw new BadRequestException('Return quantity must be positive');
                }

                if (dto.qty > originalSaleItem.qty) {
                    throw new BadRequestException(
                        `Cannot return ${dto.qty} units. Only ${originalSaleItem.qty} units were sold.`
                    );
                }

                // 3. Parse batch allocations from original sale
                let batchAllocations: BatchAllocation[] = [];
                if (originalSaleItem.batchAllocations) {
                    try {
                        batchAllocations = typeof originalSaleItem.batchAllocations === 'string'
                            ? JSON.parse(originalSaleItem.batchAllocations)
                            : originalSaleItem.batchAllocations;
                    } catch (error) {
                        this.logger.warn(
                            `Failed to parse batch allocations for sale item ${dto.saleitemid}. ` +
                            `Proceeding with return but batch reconciliation skipped.`
                        );
                    }
                }

                // 4. Return quantity to batches (proportional to original allocation)
                if (batchAllocations && batchAllocations.length > 0) {
                    let remainingToReturn = dto.qty;
                    const totalOriginalQty = originalSaleItem.qty;

                    for (const allocation of batchAllocations) {
                        if (remainingToReturn <= 0) break;

                        // Calculate proportional return quantity
                        const proportionalQty = Math.min(
                            Math.ceil((allocation.quantity / totalOriginalQty) * dto.qty),
                            remainingToReturn
                        );

                        if (proportionalQty > 0) {
                            // Return to batch
                            await this.batchAllocationService.returnToBatch(
                                allocation.batchId,
                                proportionalQty,
                                'SALE_RETURN',
                                dto.saleitemid,
                                userid,
                                transactionManager
                            );

                            remainingToReturn -= proportionalQty;

                            this.logger.log(
                                `Returned ${proportionalQty} units to batch ${allocation.batchId} ` +
                                `(${allocation.batchNumber}) for sale item ${dto.saleitemid}`
                            );
                        }
                    }

                    // Handle any remaining quantity due to rounding
                    if (remainingToReturn > 0) {
                        this.logger.warn(
                            `${remainingToReturn} units could not be returned to batches ` +
                            `for sale item ${dto.saleitemid} due to rounding. ` +
                            `Returning to first batch.`
                        );

                        await this.batchAllocationService.returnToBatch(
                            batchAllocations[0].batchId,
                            remainingToReturn,
                            'SALE_RETURN',
                            dto.saleitemid,
                            userid,
                            transactionManager
                        );
                    }
                } else {
                    this.logger.warn(
                        `No batch allocations found for sale item ${dto.saleitemid}. ` +
                        `Return processed but inventory not reconciled to batches. ` +
                        `This may occur for sales created before batch tracking was implemented.`
                    );
                }

                // 5. Create negative sale item record (return entry)
                const returnItem = await transactionManager.save(SaleItem, {
                    saleid: originalSaleItem.saleid,
                    itemid: originalSaleItem.itemid,
                    productid: originalSaleItem.productid,
                    qty: (-1 * dto.qty),
                    price: originalSaleItem.price,
                    total: originalSaleItem.price * (-1 * dto.qty),
                    paymode: dto.paymode,
                    status: dto.status,
                    reason: dto.reason,
                    comments: dto.comments,
                    createdby: userid
                });

                this.logger.log(
                    `Return processed: ${dto.qty} units returned for sale item ${dto.saleitemid}. ` +
                    `Return ID: ${returnItem.id}`
                );

                return returnItem;
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
        const dateStr = this.getFormatDate(new Date(other));
        return await this.manager.query(`
            select distinct c.id, c.name, c.mobile
            from sale s
            inner join customer c on s.customer_id = c.id
            where s.bill_date > $1
            and (c.name ilike $2||'%' or c.mobile like $2||'%')`, [dateStr, criteria.starts]);
    }

    async findCustomerItems(criteria: any) {
        const now = new Date();
        const other = new Date(now.setMonth(now.getMonth() - this.RETURN_PERIOD_MONTHS_ALLOWED));
        const dateStr = this.getFormatDate(new Date(other));
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
        where s.customer_id = $1
        and s.bill_date > $2
        and p.title ilike $3||'%'
        and si.qty > 0 and x.aqty > 0
        order by si.created_on desc`, [criteria.customerid, dateStr, criteria.starts]);
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
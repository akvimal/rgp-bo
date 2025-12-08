import { Injectable, BadRequestException, Logger, HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository, DataSource } from "typeorm";
import { CreatePurchaseOrderDto } from "./dto/create-order.dto";
import { CreatePurchaseRequestDto } from "./dto/create-request.dto";
import { CreatePurchaseOrderFromIntentsDto } from "./dto/create-order-from-intents.dto";
import { CreatePurchaseOrderWithItemsDto } from "./dto/create-order-with-items.dto";
import { POSuggestionsResponseDto, POSuggestionItemDto, SuggestionReason } from "./dto/po-suggestion.dto";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { SalesIntent, IntentStatus, FulfillmentStatus } from "src/entities/sales-intent.entity";
import { Store } from "src/entities/store.entity";

@Injectable()
export class PurchaseService {
    private readonly logger = new Logger(PurchaseService.name);

    constructor(@InjectRepository(PurchaseRequest) private readonly requestRepository: Repository<PurchaseRequest>,
            @InjectRepository(PurchaseOrder) private readonly orderRepository: Repository<PurchaseOrder>,
            @InjectRepository(SalesIntent) private readonly salesIntentRepository: Repository<SalesIntent>,
            @InjectEntityManager() private manager: EntityManager,
            private dataSource: DataSource) { }

    async findAllRequests(query:any){
        return this.requestRepository.createQueryBuilder('req')
        .innerJoinAndSelect("req.product", "product")
        .select(['req','product'])
        .where('req.isActive = :flag', { flag: true })
        .getMany();
    }    

    async findAllRequestsByCriteria(criteria:any){
        let whereclause = 'req.isActive = :flag'
        if(criteria.status){
            whereclause += ' and req.status = :status'
        }
        return this.requestRepository.createQueryBuilder('req')
        .innerJoinAndSelect("req.product", "product")
        .select(['req','product'])
        .where(whereclause, {...criteria, flag: true })
        .getMany();
    }

    async findAllOrdersByCriteria(criteria:any){
        let whereclause = 'or.isActive = :flag'
        if(criteria.status){
            whereclause += ' and or.status = :status'
        }if(criteria.vendorid){
            whereclause += ' and or.vendorid = :vendorid'
        }
        return this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .select(['or','vendor.name'])
              .where(whereclause, {...criteria, flag: true }).getMany();
    }

    async findAllOrders(query:any){
        const qb = this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .select(['or','vendor.name'])
              .where('or.isActive = :flag', { flag: true });
            return qb.getMany();
    }

    async createOrder(dto: CreatePurchaseOrderDto, userid:any) {
        // const seq = await this.manager.query(`select currval('purchase_order_id_seq')`);
        // console.log('SEQ >> ',seq);
        
        const order = await this.orderRepository.save({...dto, createdby:userid});
        // const ponum = 'PO'+ ((new Date()).getFullYear()%2000) + (''+order.id).padStart(3,'0')
        // await this.manager.query(`update purchase_order set po_number = '${ponum}' where id = ${order.id}`);
        // order.ponumber = ponum;
        return order;
    }
    
    async createRequest(dto: CreatePurchaseRequestDto, userid:any) {
        return this.requestRepository.save({...dto, createdby:userid});
    }
    
    async findOrderById(id:string){
        return this.orderRepository.createQueryBuilder('or')
        .innerJoinAndSelect("or.vendor", "vendor")
        .leftJoinAndSelect("or.requests", "requests")
        .leftJoinAndSelect("requests.product", "product")
        .select(['or','requests', 'product','vendor'])
          .where('or.id = :id', { id })
          .getOne();
    }

    async findRequestById(id:number){
          return this.requestRepository.createQueryBuilder('req')
          .innerJoinAndSelect("req.product", "product")
          .select(['req','product'])
          .where('req.id = :id', { id })
          .getOne();
    }
    
    async updateRequest(id:any, values:any, userid){
        return this.requestRepository.update(id, {...values, updatedby:userid});
    }
    async removeOrder(id:any, userid){
        return this.requestRepository.update(id, {status: 'NEW', orderid: undefined, updatedby:userid});
    }
    
    async updateOrder(id:any, values:any, userid){
        return this.orderRepository.update(id, {...values, updatedby:userid});
    }

    /**
     * Create Purchase Order from selected Sales Intents
     */
    async createOrderFromIntents(dto: CreatePurchaseOrderFromIntentsDto, userid: number) {
        return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            try {
                // 1. Fetch and validate all intents
                const intents = await manager.find(SalesIntent, {
                    where: dto.intentIds.map(id => ({ id, active: true })),
                    relations: ['product']
                });

                if (intents.length !== dto.intentIds.length) {
                    throw new BadRequestException('One or more intents not found or inactive');
                }

                // 2. Validate intents are PENDING
                const nonPendingIntents = intents.filter(intent => intent.status !== IntentStatus.PENDING);
                if (nonPendingIntents.length > 0) {
                    const ids = nonPendingIntents.map(i => i.intentno).join(', ');
                    throw new BadRequestException(`Cannot add non-pending intents to PO: ${ids}`);
                }

                // 3. Create Purchase Order
                const order = await manager.save(PurchaseOrder, {
                    vendorid: dto.vendorid,
                    status: 'NEW',
                    comments: dto.comments || `Created from ${intents.length} sales intent(s)`,
                    createdby: userid
                });

                // 4. Create Purchase Requests from each intent
                const purchaseRequests = intents.map(intent => ({
                    productid: intent.prodid,
                    orderid: order.id,
                    qty: intent.requestedqty,
                    status: 'PENDING',
                    requesttype: intent.intenttype, // LOW_STOCK, CUSTOMER_REQUEST, etc.
                    comments: `From Intent: ${intent.intentno} - ${intent.requestnotes || ''}`,
                    createdby: userid
                }));

                await manager.save(PurchaseRequest, purchaseRequests);

                // 5. Update Sales Intents
                for (const intent of intents) {
                    await manager.update(SalesIntent, intent.id, {
                        status: IntentStatus.IN_PO,
                        fulfillmentstatus: FulfillmentStatus.PO_CREATED,
                        purchaseorderid: order.id,
                        updatedby: userid
                    });
                }

                this.logger.log(`Purchase Order ${order.id} created from ${intents.length} intents by user ${userid}`);

                // 6. Return complete order with requests
                return await manager.findOne(PurchaseOrder, {
                    where: { id: order.id },
                    relations: ['vendor', 'requests', 'requests.product']
                });

            } catch (error) {
                if (error instanceof HttpException) throw error;
                this.logger.error(`Failed to create PO from intents: ${error.message}`, error.stack);
                throw new HttpException('Failed to create purchase order from intents', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        });
    }

    /**
     * Create Purchase Order with items directly
     */
    async createOrderWithItems(dto: CreatePurchaseOrderWithItemsDto, userid: number) {
        return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            try {
                // 1. Validate vendor exists
                const vendor = await manager.findOne(Store, { where: { id: dto.vendorid } });
                if (!vendor) {
                    throw new BadRequestException(`Vendor with ID ${dto.vendorid} not found`);
                }

                // 2. Validate all products exist
                const productIds = dto.items.map(item => item.productId);
                const products = await manager.createQueryBuilder()
                    .select('id')
                    .from('product', 'p')
                    .where('id IN (:...ids)', { ids: productIds })
                    .getRawMany();

                if (products.length !== productIds.length) {
                    throw new BadRequestException('One or more products not found');
                }

                // 3. Create Purchase Order
                const order = await manager.save(PurchaseOrder, {
                    vendorid: dto.vendorid,
                    ponumber: dto.ponumber,
                    status: 'NEW',
                    comments: dto.comments || '',
                    createdby: userid
                });

                // 4. Create Purchase Requests for each item
                const purchaseRequests = dto.items.map(item => ({
                    productid: item.productId,
                    orderid: order.id,
                    qty: item.qty,
                    status: 'PENDING',
                    requesttype: 'MANUAL',
                    comments: item.comments || '',
                    createdby: userid
                }));

                await manager.save(PurchaseRequest, purchaseRequests);

                this.logger.log(`Purchase Order ${order.id} created with ${dto.items.length} items by user ${userid}`);

                // 5. Return complete order with requests
                return await manager.findOne(PurchaseOrder, {
                    where: { id: order.id },
                    relations: ['vendor', 'requests', 'requests.product']
                });

            } catch (error) {
                if (error instanceof HttpException) throw error;
                this.logger.error(`Failed to create PO with items: ${error.message}`, error.stack);
                throw new HttpException('Failed to create purchase order with items', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        });
    }

    /**
     * Get Smart Purchase Order Suggestions for a store
     * Combines low stock items and sales intent items
     */
    async getSmartPOSuggestions(storeId: number): Promise<POSuggestionsResponseDto> {
        try {
            // 1. Get store details
            const store = await this.dataSource.getRepository(Store).findOne({
                where: { id: storeId, active: true }
            });

            if (!store) {
                throw new NotFoundException(`Store with ID ${storeId} not found`);
            }

            // 2. Get low stock items
            const lowStockItems = await this.getLowStockItemsForStore(storeId);

            // 3. Get sales intent items
            const intentItems = await this.getSalesIntentItemsForStore(storeId);

            return {
                lowStockItems,
                salesIntentItems: intentItems,
                storeId: store.id,
                storeName: store.storeName,
                totalSuggestions: lowStockItems.length + intentItems.length
            };

        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error(`Error getting smart PO suggestions for store ${storeId}:`, error.stack);
            throw new HttpException('Failed to get PO suggestions', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get products below reorder limit for a specific store
     */
    private async getLowStockItemsForStore(storeId: number): Promise<POSuggestionItemDto[]> {
        const query = `
            SELECT
                p.id as "productId",
                p.title as "productName",
                COALESCE(stock.balance, 0) as "currentStock",
                psc.reorder_limit as "reorderLimit",
                GREATEST(psc.optimal_stock_level - COALESCE(stock.balance, 0), 10) as "suggestedQuantity",
                psc.preferred_vendor_id as "preferredVendorId",
                pv.business_name as "preferredVendorName",
                last_purchase.vendor_id as "lastVendorId",
                last_purchase.vendor_name as "lastVendorName",
                last_purchase.last_purchase_date as "lastPurchaseDate",
                last_purchase.last_purchase_price as "lastPurchasePrice"
            FROM product p
            INNER JOIN product_store_config psc ON p.id = psc.product_id AND psc.store_id = $1
            LEFT JOIN (
                SELECT product_id, SUM(available_qty) as balance
                FROM stock_view
                GROUP BY product_id
            ) stock ON p.id = stock.product_id
            LEFT JOIN vendor pv ON psc.preferred_vendor_id = pv.id
            LEFT JOIN LATERAL (
                SELECT
                    pi.vendor_id,
                    v.business_name as vendor_name,
                    pi.invoice_date as last_purchase_date,
                    pii.ptr_cost as last_purchase_price
                FROM purchase_invoice_item pii
                INNER JOIN purchase_invoice pi ON pii.invoice_id = pi.id
                INNER JOIN vendor v ON pi.vendor_id = v.id
                WHERE pii.product_id = p.id
                ORDER BY pi.invoice_date DESC
                LIMIT 1
            ) last_purchase ON true
            WHERE p.active = true
                AND psc.is_available_in_store = true
                AND psc.reorder_limit > 0
                AND COALESCE(stock.balance, 0) <= psc.reorder_limit
            ORDER BY
                CASE WHEN psc.is_fast_moving THEN 0 ELSE 1 END,
                (psc.reorder_limit - COALESCE(stock.balance, 0)) DESC
        `;

        const results = await this.dataSource.query(query, [storeId]);

        return results.map((row: any) => ({
            productId: row.productId,
            productName: row.productName,
            currentStock: parseInt(row.currentStock) || 0,
            reorderLimit: parseInt(row.reorderLimit) || 0,
            suggestedQuantity: Math.max(parseInt(row.suggestedQuantity) || 10, 10), // Minimum 10
            reason: SuggestionReason.LOW_STOCK,
            lastVendorId: row.lastVendorId,
            lastVendorName: row.lastVendorName,
            preferredVendorId: row.preferredVendorId,
            preferredVendorName: row.preferredVendorName,
            lastPurchaseDate: row.lastPurchaseDate,
            lastPurchasePrice: parseFloat(row.lastPurchasePrice) || null
        }));
    }

    /**
     * Get products from pending sales intents for a specific store
     */
    private async getSalesIntentItemsForStore(storeId: number): Promise<POSuggestionItemDto[]> {
        const query = `
            SELECT
                si.prodid as "productId",
                p.title as "productName",
                si.requestedqty as "requestedQty",
                si.priority,
                ARRAY_AGG(si.id) as "intentIds",
                SUM(si.requestedqty) as "totalRequestedQty",
                psc.preferred_vendor_id as "preferredVendorId",
                pv.business_name as "preferredVendorName",
                last_purchase.vendor_id as "lastVendorId",
                last_purchase.vendor_name as "lastVendorName",
                last_purchase.last_purchase_date as "lastPurchaseDate",
                last_purchase.last_purchase_price as "lastPurchasePrice"
            FROM sales_intent si
            INNER JOIN product p ON si.prodid = p.id
            LEFT JOIN product_store_config psc ON p.id = psc.product_id AND psc.store_id = $1
            LEFT JOIN vendor pv ON psc.preferred_vendor_id = pv.id
            LEFT JOIN LATERAL (
                SELECT
                    pi.vendor_id,
                    v.business_name as vendor_name,
                    pi.invoice_date as last_purchase_date,
                    pii.ptr_cost as last_purchase_price
                FROM purchase_invoice_item pii
                INNER JOIN purchase_invoice pi ON pii.invoice_id = pi.id
                INNER JOIN vendor v ON pi.vendor_id = v.id
                WHERE pii.product_id = p.id
                ORDER BY pi.invoice_date DESC
                LIMIT 1
            ) last_purchase ON true
            WHERE si.store_id = $1
                AND si.status = 'PENDING'
                AND si.active = true
                AND p.active = true
            GROUP BY
                si.prodid, p.title, si.requestedqty, si.priority,
                psc.preferred_vendor_id, pv.business_name,
                last_purchase.vendor_id, last_purchase.vendor_name,
                last_purchase.last_purchase_date, last_purchase.last_purchase_price
            ORDER BY
                CASE si.priority
                    WHEN 'URGENT' THEN 0
                    WHEN 'HIGH' THEN 1
                    WHEN 'MEDIUM' THEN 2
                    ELSE 3
                END,
                si.requestedqty DESC
        `;

        const results = await this.dataSource.query(query, [storeId]);

        return results.map((row: any) => ({
            productId: row.productId,
            productName: row.productName,
            suggestedQuantity: parseInt(row.totalRequestedQty) || parseInt(row.requestedQty) || 0,
            reason: SuggestionReason.SALES_INTENT,
            priority: row.priority,
            salesIntentIds: row.intentIds,
            lastVendorId: row.lastVendorId,
            lastVendorName: row.lastVendorName,
            preferredVendorId: row.preferredVendorId,
            preferredVendorName: row.preferredVendorName,
            lastPurchaseDate: row.lastPurchaseDate,
            lastPurchasePrice: parseFloat(row.lastPurchasePrice) || null
        }));
    }
}
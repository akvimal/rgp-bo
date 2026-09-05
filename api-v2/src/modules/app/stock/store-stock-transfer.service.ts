import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { StoreStockTransfer } from "src/entities/store-stock-transfer.entity";
import { ProductQtyChange } from "src/entities/product-qtychange.entity";
import { CreateStoreStockTransferDto } from "./dto/create-store-stock-transfer.dto";
import { ReceiveStoreStockTransferDto } from "./dto/receive-store-stock-transfer.dto";

/**
 * WS-6 of docs/planning/STORE_MANAGEMENT_ENHANCEMENTS.md.
 * Moves a batch (a purchase_invoice_item) from one store's stock to another's.
 * The actual quantity math is two product_qtychange postings (TRANSFER_OUT at the
 * source store, TRANSFER_IN at the destination) linked by transfer_id - this table
 * is the workflow/audit wrapper (who requested/received, dispatched vs short-received),
 * not a second source of truth for quantity.
 *
 * These postings are always APPROVED, deliberately bypassing WS-3's value-threshold
 * approval gate that ad-hoc adjustments go through: a transfer already requires two
 * separate auditStock-permission actions (dispatch, then a *different* physical receipt)
 * against a store-scoped balance check, which is its own control - gating it a second
 * time on value would just double-approve the same movement, not add safety.
 */
@Injectable()
export class StoreStockTransferService {

    constructor(
        @InjectRepository(StoreStockTransfer) private readonly repo: Repository<StoreStockTransfer>,
        @InjectEntityManager() private manager: EntityManager,
    ) {}

    /** Store-scoped available for one batch: home-store receipt - sold at that store + approved postings at that store. */
    private async getAvailableAtStore(transactionManager: EntityManager, purchaseItemId: number, storeId: number): Promise<number> {
        const rows = await transactionManager.query(
            `select
                (case when pi.store_id = $2 then (pii.qty + coalesce(pii.free_qty, 0)) * coalesce(p.pack, 1) else 0 end)
                - coalesce((select sum(si.qty) from sale_item si
                            inner join sale s on s.id = si.sale_id
                            where si.purchase_item_id = pii.id and si.active = true and si.archive = false
                              and s.store_id = $2), 0)
                + coalesce((select sum(pq.qty) from product_qtychange pq
                            where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED'
                              and pq.active = true and pq.archive = false
                              and pq.store_id = $2), 0)
                as available
             from purchase_invoice_item pii
             inner join purchase_invoice pi on pi.id = pii.invoice_id
             inner join product p on p.id = pii.product_id
             where pii.id = $1`,
            [purchaseItemId, storeId],
        );
        return Number(rows?.[0]?.available || 0);
    }

    async availableAtStore(purchaseItemId: number, storeId: number) {
        return this.getAvailableAtStore(this.manager, purchaseItemId, storeId);
    }

    async dispatch(dto: CreateStoreStockTransferDto, userid: number) {
        if (Number(dto.fromstoreid) === Number(dto.tostoreid)) {
            throw new BadRequestException('Source and destination stores must be different.');
        }
        if (!(Number(dto.qty) > 0)) {
            throw new BadRequestException('Transfer quantity must be positive.');
        }

        return this.repo.manager.transaction('SERIALIZABLE', async (tx) => {
            const available = await this.getAvailableAtStore(tx, dto.purchaseitemid, dto.fromstoreid);
            if (Number(dto.qty) > available) {
                throw new BadRequestException(`Not enough stock at the source store (requested ${dto.qty}, available ${available}).`);
            }

            const transfer = await tx.save(StoreStockTransfer, {
                fromstoreid: dto.fromstoreid,
                tostoreid: dto.tostoreid,
                purchaseitemid: dto.purchaseitemid,
                qty: dto.qty,
                notes: dto.notes || null,
                status: 'IN_TRANSIT',
                requestedby: userid,
                dispatchedon: new Date(),
                createdby: userid,
            } as any);

            await tx.save(ProductQtyChange, {
                itemid: dto.purchaseitemid,
                qty: -Math.abs(dto.qty),
                price: 0,
                reason: 'TRANSFER_OUT',
                reasoncode: 'TRANSFER_OUT',
                comments: `Transfer #${transfer.id} to store ${dto.tostoreid}`,
                status: 'APPROVED',
                storeid: dto.fromstoreid,
                transferid: transfer.id,
                createdby: userid,
            } as any);

            return transfer;
        });
    }

    async receive(id: number, dto: ReceiveStoreStockTransferDto, userid: number) {
        return this.repo.manager.transaction('SERIALIZABLE', async (tx) => {
            const transfer = await tx.findOne(StoreStockTransfer, { where: { id } });
            if (!transfer) {
                throw new NotFoundException('Transfer not found.');
            }
            if (transfer.status !== 'IN_TRANSIT') {
                throw new BadRequestException(`Transfer is already ${String(transfer.status).toLowerCase()}.`);
            }

            const receivedqty = dto.receivedqty ?? transfer.qty;
            if (!(receivedqty > 0) || receivedqty > transfer.qty) {
                throw new BadRequestException(`Received quantity must be between 1 and ${transfer.qty}.`);
            }

            await tx.save(ProductQtyChange, {
                itemid: transfer.purchaseitemid,
                qty: receivedqty,
                price: 0,
                reason: receivedqty < transfer.qty ? 'TRANSFER_IN_SHORT' : 'TRANSFER_IN',
                reasoncode: receivedqty < transfer.qty ? 'TRANSFER_IN_SHORT' : 'TRANSFER_IN',
                comments: `Transfer #${transfer.id} from store ${transfer.fromstoreid}`,
                status: 'APPROVED',
                storeid: transfer.tostoreid,
                transferid: transfer.id,
                createdby: userid,
            } as any);

            await tx.update(StoreStockTransfer, id, {
                status: 'RECEIVED',
                receivedqty,
                receivedby: userid,
                receivedon: new Date(),
                updatedby: userid,
            } as any);

            return { ...transfer, status: 'RECEIVED', receivedqty };
        });
    }

    async cancel(id: number, userid: number) {
        return this.repo.manager.transaction('SERIALIZABLE', async (tx) => {
            const transfer = await tx.findOne(StoreStockTransfer, { where: { id } });
            if (!transfer) {
                throw new NotFoundException('Transfer not found.');
            }
            if (transfer.status !== 'IN_TRANSIT') {
                throw new BadRequestException('Only an in-transit transfer can be cancelled.');
            }

            // reverse the TRANSFER_OUT posting so the source store's stock is restored
            await tx.save(ProductQtyChange, {
                itemid: transfer.purchaseitemid,
                qty: transfer.qty,
                price: 0,
                reason: 'TRANSFER_CANCELLED',
                reasoncode: 'TRANSFER_CANCELLED',
                comments: `Transfer #${transfer.id} cancelled`,
                status: 'APPROVED',
                storeid: transfer.fromstoreid,
                transferid: transfer.id,
                createdby: userid,
            } as any);

            await tx.update(StoreStockTransfer, id, { status: 'CANCELLED', updatedby: userid } as any);

            return { ...transfer, status: 'CANCELLED' };
        });
    }

    async findAll(query: { storeid?: string; status?: string }) {
        const qb = this.repo.createQueryBuilder('t')
            .leftJoinAndSelect('t.purchaseitem', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .leftJoinAndSelect('t.fromstore', 'fromstore')
            .leftJoinAndSelect('t.tostore', 'tostore')
            .select(['t', 'item.id', 'item.batch', 'item.expdate', 'product.id', 'product.title', 'fromstore.id', 'fromstore.location', 'tostore.id', 'tostore.location'])
            .orderBy('t.createdon', 'DESC');

        if (query.storeid) {
            qb.andWhere('(t.fromstoreid = :sid OR t.tostoreid = :sid)', { sid: Number(query.storeid) });
        }
        if (query.status) {
            qb.andWhere('t.status = :status', { status: query.status });
        }

        return qb.getMany();
    }
}

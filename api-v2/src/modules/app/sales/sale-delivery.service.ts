import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { Sale } from "src/entities/sale.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";
import { AuditService } from "src/core/audit/audit.service";
import { isManagerRole } from "src/core/roles";
import { deliveryModeProblem } from "./delivery-mode-rule";

@Injectable()
export class SaleDeliveryService {

    constructor(
        @InjectRepository(SaleDelivery) private readonly deliveryRepository: Repository<SaleDelivery>,
        @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
        @InjectEntityManager() private manager: EntityManager,
        private readonly audit: AuditService
    ) { }

    private getToday(){
        return new Date().toISOString().slice(0, 10);
    }

    private toEntityPayload(delivery:any) {
        return {
            saleId: delivery.saleid,
            bookeddate: delivery.bookeddate || this.getToday(),
            bookedby: delivery.bookedby || null,
            receivername: delivery.receivername || null,
            receiverphone: delivery.receiverphone || null,
            receiveraddress: delivery.receiveraddress || null,
            deliverydate: delivery.deliverydate || null,
            deliveryby: delivery.deliveryby || null,
            deliverymethod: delivery.deliverymethod || 'Staff Delivery',
            courierpartner: delivery.courierpartner || null,
            deliveredat: delivery.deliveredat ? new Date(delivery.deliveredat) : null,
            confirmed: !!delivery.confirmed,
            confirmedby: delivery.confirmedby || null,
            confirmedat: delivery.confirmedat ? new Date(delivery.confirmedat) : null,
            charges: delivery.charges ?? 0,
            actualcost: delivery.actualcost ?? 0,
            status: delivery.status || 'Pending',
            paymentmode: delivery.paymentmode || null,
            collectionstatus: delivery.collectionstatus || null,
            failurereason: delivery.failurereason || null,
            comments: delivery.comments || null,
        };
    }

    async save(delivery:any,userid:any, repo: Repository<SaleDelivery> = this.deliveryRepository) {
        const payload = this.toEntityPayload(delivery);
        const existing = await repo.findOne({
            where: { saleId: payload.saleId },
        });

        const entity = existing
            ? repo.merge(existing, {
                ...payload,
                updatedby: userid,
              })
            : repo.create({
                ...payload,
                bookedby: payload.bookedby || userid,
                createdby: userid,
                updatedby: userid,
              });

        return repo.save(entity);
    }

    /**
     * Turns a completed bill into a delivery (or back into a counter sale) after it was rung. The money is not touched: the bill was paid, or left
     * to pay later, when it was made, so the delivery is booked as already collected and never shows as cash to collect on the doorstep.
     */
    async changeMode(saleid: number, body: any, user: { id: number; roleid?: number }) {
        const target = String(body?.type || '');
        return this.manager.transaction(async (tm) => {
            const [sale] = await tm.query(
                `select s.id, s.status, s.delivery_type, s.shift_id, s.bill_no, s.created_by, s.acting_user_id, s.customer_id, sh.status as shift_status,
                        (select d.status from sale_deliveries d where d."saleId" = s.id) as delivery_status
                   from sale s left join store_shifts sh on sh.id = s.shift_id where s.id = $1 for update of s`, [saleid]);
            if (!sale) throw new NotFoundException('Bill not found.');
            const [role] = await tm.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
            const problem = deliveryModeProblem({
                status: sale.status, currentType: sale.delivery_type, target, shiftId: sale.shift_id ? +sale.shift_id : null, shiftStatus: sale.shift_status,
                deliveryStatus: sale.delivery_status, isOwn: [sale.created_by, sale.acting_user_id].some((u: any) => u && +u === +user.id),
                isManager: isManagerRole(role?.name), outsideState: body?.outsidestate === true, reason: body?.reason,
            });
            if (problem) throw new BadRequestException(problem);
            const before = sale.delivery_type || 'Counter';
            await tm.query(`update sale set delivery_type = $2, updated_by = $3, updated_on = now() where id = $1`, [saleid, target, user.id]);

            if (target === 'Delivery') {
                const d = body?.delivery || {};
                const delivered = d.delivered === true;
                const [cust] = sale.customer_id ? await tm.query(`select name, mobile, address from customer where id = $1`, [sale.customer_id]) : [null];
                await this.save({
                    saleid,
                    receivername: String(d.receivername || cust?.name || '').trim() || null,
                    receiverphone: String(d.receiverphone || cust?.mobile || '').trim() || null,
                    receiveraddress: String(d.receiveraddress || cust?.address || '').trim() || null,
                    deliveryby: String(d.deliveryby || '').trim() || null,
                    deliverymethod: d.deliverymethod === 'Courier' ? 'Courier' : 'Staff Delivery',
                    courierpartner: d.deliverymethod === 'Courier' ? (String(d.courierpartner || '').trim() || null) : null,
                    charges: Math.max(0, Number(d.charges) || 0),
                    // paid when the bill was made: nothing to collect at the door
                    paymentmode: 'Paid at counter', collectionstatus: 'Collected',
                    status: delivered ? 'Delivered' : 'Pending',
                    deliverydate: this.getToday(), deliveredat: delivered ? new Date() : null,
                    comments: String(d.comments || '').trim() || null,
                }, user.id, tm.getRepository(SaleDelivery));
            } else {
                await tm.query(`delete from sale_deliveries where "saleId" = $1`, [saleid]);
            }
            await this.audit.record({
                userId: user.id, action: 'sale.delivery_mode_changed', entityType: 'sales', entityId: saleid,
                summary: `Bill ${sale.bill_no ?? saleid} changed from ${before === 'Delivery' ? 'a delivery' : 'a counter sale'} to ${target === 'Delivery' ? 'a delivery' : 'a counter sale'}${body?.reason ? ` (${String(body.reason).trim().slice(0, 150)})` : ''}`,
                details: { from: before, to: target, reason: body?.reason ?? null },
            });
            return { id: saleid, deliverytype: target };
        });
    }

    /**
     * Recent completed bills that are not deliveries yet, for "new delivery" on the Deliveries page. A Store Head / Business Head sees every bill of
     * the store; anyone else sees only the bills they rang. Making one a delivery goes through changeMode, which checks the same rules again.
     */
    async candidates(query: any, user: { id: number; roleid?: number }) {
        const days = Math.min(Math.max(Math.floor(Number(query?.days)) || 3, 1), 30);
        const storeId = query?.storeid ? Number(query.storeid) : null;
        const q = String(query?.q || '').trim();
        const [role] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
        const manager = isManagerRole(role?.name);
        return this.manager.query(
            `select s.id, s.bill_no as billno, s.bill_date as billdate, s.total, s.order_type as ordertype, coalesce(s.delivery_type, 'Counter') as deliverytype,
                    c.name as custname, c.mobile as custmobile
               from sale s left join customer c on c.id = s.customer_id
              where s.status = 'COMPLETE' and coalesce(s.delivery_type, 'Counter') <> 'Delivery'
                and s.bill_date >= now() - ($1::int * interval '1 day')
                and ($2::int is null or s.store_id = $2)
                and ($3::boolean or s.created_by = $4 or s.acting_user_id = $4)
                and ($5 = '' or s.bill_no::text = $5 or c.name ilike '%' || $5 || '%' or c.mobile like '%' || $5 || '%')
              order by s.bill_date desc limit 100`,
            [days, storeId, manager, user.id, q]);
    }

    async findAll(query:any,userid:any){
        const qb = this.saleRepository.createQueryBuilder("sale")
                .leftJoinAndSelect("sale.delivery", "delivery")
                .leftJoinAndSelect("sale.customer", "customer")
                .leftJoinAndSelect("sale.created", "created")
                .select([
                    'sale',
                    'delivery',
                    'customer.id',
                    'customer.name',
                    'customer.mobile',
                    'customer.address',
                    'created.id',
                    'created.fullname'
                ])
                .where("sale.deliverytype = :deliveryType", { deliveryType: 'Delivery' })
                .andWhere("sale.status = :status", { status: 'COMPLETE' })
                .orderBy("sale.billdate", "DESC");

        if(userid){
            qb.andWhere("sale.created_by = :userid", { userid });
        }

        const sales = await qb.getMany();

        return sales.map((sale:any) => {
            const delivery = sale.delivery || {};
            return {
                id: delivery.id || null,
                saleid: sale.id,
                bookeddate: delivery.bookeddate || sale.billdate,
                bookedby: delivery.bookedby || sale.created?.id || null,
                receivername: delivery.receivername || sale.customer?.name || '',
                receiverphone: delivery.receiverphone || sale.customer?.mobile || '',
                receiveraddress: delivery.receiveraddress || sale.customer?.address || '',
                deliverydate: delivery.deliverydate || null,
                deliveryby: delivery.deliveryby || '',
                deliverymethod: delivery.deliverymethod || 'Staff Delivery',
                courierpartner: delivery.courierpartner || '',
                deliveredat: delivery.deliveredat || null,
                confirmed: delivery.confirmed || false,
                confirmedby: delivery.confirmedby || '',
                confirmedat: delivery.confirmedat || null,
                charges: delivery.charges ?? 0,
                actualcost: delivery.actualcost ?? 0,
                status: delivery.status || 'Pending',
                paymentmode: delivery.paymentmode || '',
                collectionstatus: delivery.collectionstatus || '',
                failurereason: delivery.failurereason || '',
                comments: delivery.comments || '',
                saleperson: sale.created?.fullname || '',
                sale,
            };
        });
    }

    async delete(id:any){
        await this.deliveryRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(SaleDelivery, id);
        });
    } 
    
}

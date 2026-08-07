import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { Sale } from "src/entities/sale.entity";
import { SaleDelivery } from "src/entities/sale-delivery.entity";

@Injectable()
export class SaleDeliveryService {

    constructor(
        @InjectRepository(SaleDelivery) private readonly deliveryRepository: Repository<SaleDelivery>,
        @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
        @InjectEntityManager() private manager: EntityManager
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

    async save(delivery:any,userid:any) {
        const payload = this.toEntityPayload(delivery);
        const existing = await this.deliveryRepository.findOne({
            where: { saleId: payload.saleId },
        });

        const entity = existing
            ? this.deliveryRepository.merge(existing, {
                ...payload,
                updatedby: userid,
              })
            : this.deliveryRepository.create({
                ...payload,
                bookedby: payload.bookedby || userid,
                createdby: userid,
                updatedby: userid,
              });

        return this.deliveryRepository.save(entity);
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

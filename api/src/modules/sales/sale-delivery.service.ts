import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Repository } from "typeorm";
import { SaleDelivery } from "../../entities/sale-delivery.entity";

@Injectable()
export class SaleDeliveryService {

    constructor(@InjectRepository(SaleDelivery) private readonly deliveryRepository: Repository<SaleDelivery>,
    @InjectEntityManager() private manager: EntityManager) { }

    async save(delivery:any,userid:any) {
        return this.deliveryRepository.save({...delivery, createdby:userid}).then(data => {
            
        });
    }
    
    async findAll(query:any,userid:any){
        const qb = this.deliveryRepository.createQueryBuilder("delivery")
                .leftJoinAndSelect("delivery.sale", "sale")
                    .select(['delivery','sale']); 
        
        return qb.getMany();
    }

    async delete(id:any){
        await this.deliveryRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.delete(SaleDelivery, id);
        });
    } 
    
}
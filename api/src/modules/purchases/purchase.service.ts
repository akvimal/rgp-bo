import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { PurchaseOrder } from "src/entities/purchase-order.entity";
import { PurchaseRequest } from "src/entities/purchase-request.entity";
import { EntityManager, Repository } from "typeorm";
import { CreatePurchaseOrderDto } from "./dto/create-order.dto";
import { CreatePurchaseRequestDto } from "./dto/create-request.dto";

@Injectable()
export class PurchaseService {

    constructor(@InjectRepository(PurchaseRequest) private readonly requestRepository: Repository<PurchaseRequest>,
            @InjectRepository(PurchaseOrder) private readonly orderRepository: Repository<PurchaseOrder>,
            @InjectEntityManager() private manager: EntityManager) { }

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
}
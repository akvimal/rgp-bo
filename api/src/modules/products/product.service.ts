import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/entities/product.entity";
import { Repository } from "typeorm";
import { CreateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>) { }

    async create(createProductDto: CreateProductDto, userid) {
        return this.productRepository.save({...createProductDto, createdby:userid});
      }
        
      async findAll(query:any,user:any){
        const qb = this.productRepository.createQueryBuilder(`p`)
            .where('p.isActive = :flag', { flag: true });
            if(query.category){
              qb.andWhere(`p.category = :ctg`, { ctg:query.category });
            }
            if(query.title){
              qb.andWhere(`p.title = :ttl`, { ttl:query.title });
            }
          return qb.getMany();
    }

    
    async findByTitle(title:any){
      const qb = this.productRepository.createQueryBuilder(`p`)
          .where('p.isActive = :flag', { flag: true });
        qb.andWhere(`p.title = :ttl`, { ttl:title });
          
        return qb.getOne();
  }

    findById(id:string) {
        return this.productRepository.findOne(id);
    }

    async update(id:any, values:any, userid){
        return this.productRepository.update(id, {...values, updatedby:userid});
      }

}
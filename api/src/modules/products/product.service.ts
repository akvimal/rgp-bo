import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { Product } from "src/entities/product.entity";
import { Repository } from "typeorm";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { CreateProductDto } from "./dto/create-product.dto";

@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>,
                @InjectRepository(ProductPrice2) private readonly priceRepository: Repository<ProductPrice2>) { }

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

    async create(createProductDto: CreateProductDto, userid) {
      return this.productRepository.save({...createProductDto, createdby:userid});
    }
    
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
      return this.priceRepository.save({...createProductPrice2Dto, createdby:userid});
    }
    
    async update(id:any, values:any, userid){
      return this.productRepository.update(id, {...values, updatedby:userid});
    }

    async updatePrice(id:any, values:any, userid){
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

}
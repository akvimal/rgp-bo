import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";

@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>,
                @InjectRepository(ProductPrice2) private readonly priceRepository: Repository<ProductPrice2>,
                @InjectEntityManager() private manager: EntityManager) { }

    async findAll(query:any,user:any){
      const qb = this.productRepository.createQueryBuilder(`p`)
          .where('p.isActive = :flag', { flag: true });
          if(query.category){
            qb.andWhere(`p.category = :ctg`, { ctg:query.category });
          }
          if(query.title){
            qb.andWhere(`p.title = :ttl`, { ttl:query.title });
          }
          qb.orderBy('p.updatedon','DESC')
        return qb.getMany();
    }

    async filterByCriteria(criteria:any) {

      const qb = this.productRepository.createQueryBuilder('p')
          .where('p.active = :flag', { flag: true });
          let ch = '';
          for(let index = 0; index < criteria.criteria.length; index++) {
              const c = criteria.criteria[index];
              let prop = c.property;
              if(c['props_json']){
                prop = `${c['props_json']}->>'${c.property}'`
              }

              if(c['check'] === 'startswith'){
                  ch += `${prop} ilike '${c.value}%'`
              }
              if(c['check'] === 'contains'){
                ch += `${prop} ilike '%${c.value}%'`
            }
            
            if(index < (criteria.criteria.length-1))
                  ch +=  criteria.condition === 'any' ? ' or ' : ' and '
          }
  
          qb.andWhere(ch);
          if(criteria.limit)
              qb.limit(criteria.limit);
      return qb.getMany();
  }

  async filterByCriteria2(product:any) {
    const qb = this.productRepository.createQueryBuilder('p')
        .where('p.archive = false and p.active = :flag', { flag: product.active });
        if(product.title && product.title !== ''){
          qb.andWhere(`p.title ilike :title`, {title: product.title+'%'});
        } 
        if(product.category && product.category !== ''){
          qb.andWhere(`p.category = :categ`, {categ: product.category});
        }
        product.props && product.props.forEach(prop => {
          if(typeof prop['value'] == 'boolean' && prop['value'] == false){
            //ignored
          } else
          qb.andWhere(`p.more_props->>'${prop['id']}' = :val`, {val:prop['value']});
        });
        
       
    return qb.getMany();
  }

  // async findPrices(criteria:any){
  //   return await this.manager.query(
  //     `select p.id, pp.id as price_id, p.title, pii.ptr as our_max_ptr, pii.mrp as our_max_mrp, pp.market_price, coalesce(pp.sale_price,0) as our_sale_price
  //     from product p 
  //     left join product_price2 pp on pp.product_id = p.id 
  //     left join (select product_id, max(mrp_cost) as mrp, max(ptr_cost) as ptr from purchase_invoice_item group by product_id) pii on pii.product_id = p.id
  //     order by p.title`);
  // }

  async findPrices(criteria:any){
    return await this.manager.query(
      `select * from price_view where active = ${criteria.active} and title ilike '${criteria.title}%'`);
  }

  async findPriceById(productid:number){
    return await this.manager.query(
      `select * from price_view where id = ${productid}`);
  }

  async endCurrentPrice(productid:number,enddate:string){
    return await this.manager.query(
      `update product_price2 set end_date = '${enddate}' where product_id = ${productid} and end_date = '2099-12-31'`);
  }

  async findPriceHistoryById(productid:number){
    return await this.manager.query(
      `select * from product_price2 where product_id = ${productid} order by eff_date desc`);
  }
    
    async findByTitle(title:any){
      const qb = this.productRepository.createQueryBuilder(`p`)
          .where('p.isActive = :flag', { flag: true });
        qb.andWhere(`p.title = :ttl`, { ttl:title });
        return qb.getOne();
    }

    findById(id:number) {
        return this.productRepository.findOne({where:{id}});
    }

    async create(createProductDto: CreateProductDto, userid) {
      return this.productRepository.save({...createProductDto, createdby:userid});
    }
    
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
      return await this.endCurrentPrice(createProductPrice2Dto.productid,createProductPrice2Dto.effdate).then(async (data:any) => {
        return await this.priceRepository.save({...createProductPrice2Dto, createdby:userid});
      })
      
    }
    
    async update(id:any, values:any, userid){
      return this.productRepository.update(id, {...values, updatedby:userid});
    }

    async updatePrice(id:any, values:any, userid){
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

}
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
    // Fixed SQL injection vulnerability - now using parameterized query
    return await this.manager.query(
      `SELECT * FROM price_view WHERE id = $1`,
      [productid]);
  }

  async endCurrentPrice(productid:number,enddate?:string){
    // Fixed SQL injection vulnerability - now using parameterized query
    return await this.manager.query(
      `UPDATE product_price2 SET end_date = $1 WHERE product_id = $2 AND end_date = '2099-12-31'`,
      [enddate, productid]);
  }

  async findPriceHistoryById(productid:number){
    // Fixed SQL injection vulnerability - now using parameterized query
    return await this.manager.query(
      `SELECT * FROM product_price2 WHERE product_id = $1 ORDER BY eff_date DESC`,
      [productid]);
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

    /**
     * Add new price for a product with transaction protection
     * Fixed: Race condition when ending current price and adding new price
     * Fixed: SQL injection vulnerabilities in helper methods
     */
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
      // Wrap entire operation in SERIALIZABLE transaction to prevent race conditions
      return await this.priceRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        try {
          // Step 1: Query existing prices within transaction
          const priceHistory = await transactionManager.query(
            `SELECT * FROM product_price2 WHERE product_id = $1 ORDER BY eff_date DESC`,
            [createProductPrice2Dto.productid]
          );

          // Step 2: End current price if one exists
          if (priceHistory && priceHistory.length > 0) {
            await transactionManager.query(
              `UPDATE product_price2 SET end_date = $1 WHERE product_id = $2 AND end_date = '2099-12-31'`,
              [createProductPrice2Dto.effdate, createProductPrice2Dto.productid]
            );
          }

          // Step 3: Save new price with default end_date if not provided
          const newPrice = await transactionManager.save(ProductPrice2, {
            ...createProductPrice2Dto,
            enddate: createProductPrice2Dto.enddate || '2099-12-31',
            createdby: userid
          });

          return newPrice;
        } catch (error) {
          // Transaction will automatically rollback on error
          throw new Error(`Failed to add price: ${error.message}`);
        }
      });
    }
    
    async update(id:any, values:any, userid){
      return this.productRepository.update(id, {...values, updatedby:userid});
    }

    async updatePrice(id:any, values:any, userid){
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

}
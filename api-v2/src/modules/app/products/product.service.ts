import { BadRequestException, Injectable } from "@nestjs/common";
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

    /**
     * Products matching a list of conditions, joined by "any" (or) or "all" (and). Each condition names a column (or, with
     * props_json, a key inside it), a check (startswith / contains) and a value. Names are checked and values are bound,
     * never glued into the SQL; % and _ in a value are taken literally.
     */
    async filterByCriteria(criteria:any) {
      const list: any[] = Array.isArray(criteria?.criteria) ? criteria.criteria : [];
      const parts: string[] = [];
      const params: Record<string, any> = { flag: true };
      list.forEach((c:any, i:number) => {
        const name = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
        if(!name.test(String(c?.property ?? '')) || (c?.props_json && c.props_json !== 'more_props') || !['startswith', 'contains'].includes(c?.check)){
          throw new BadRequestException('That product search is not valid.');
        }
        const prop = c.props_json ? `p.more_props->>'${c.property}'` : `p.${c.property}`;
        const text = String(c.value ?? '').replace(/[\\%_]/g, (ch) => '\\' + ch);
        params[`v${i}`] = c.check === 'startswith' ? `${text}%` : `%${text}%`;
        parts.push(`${prop} ilike :v${i}`);
      });
      if(!parts.length) return [];

      const qb = this.productRepository.createQueryBuilder('p')
          .where('p.active = :flag', params)
          .andWhere(`(${parts.join(criteria?.condition === 'any' ? ' or ' : ' and ')})`, params);
      if(Number(criteria?.limit) > 0)
          qb.limit(Math.min(Number(criteria.limit), 500));
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
          qb.andWhere(`p.more_props->>'${String(prop['id']).replace(/[^A-Za-z0-9_]/g, '')}' = :val`, {val:prop['value']});
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
    // values are bound, never glued into the SQL; % and _ in the title are taken literally
    const active = !(criteria?.active === false || criteria?.active === 'false');
    const title = String(criteria?.title ?? '').replace(/[\\%_]/g, (c) => '\\' + c) + '%';
    return await this.manager.query(
      `select * from price_view where active = $1 and title ilike $2`, [active, title]);
  }

  /**
   * The rules for a sale price, from the latest purchase of the product (the same MRP and PTR the price page shows;
   * with several lines on that invoice the lowest MRP and the highest PTR are used, so the limit is the safe one).
   *   - a price above MRP is capped at MRP (it is an offence to sell above it);
   *   - a margin above 1,000% on cost is refused as a typing mistake; above 300% it is saved with a warning;
   *   - a price below cost is saved with a warning.
   * A product with no purchase yet has no MRP or PTR to check against and is saved as given.
   */
  private async checkPrice(manager: EntityManager, productid: number, raw: any) {
    const price = Number(raw);
    if (!(price > 0)) {
      throw new BadRequestException('Enter a sale price above 0.');
    }
    const [lim] = await manager.query(
      `select min(pii.mrp_cost) as mrp, max(pii.ptr_cost) as ptr
         from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
        where pii.product_id = $1 and pii.mrp_cost > 0 and pii.ptr_cost > 0
          and pi.invoice_date = (select max(pi2.invoice_date) from purchase_invoice_item pii2
                                   join purchase_invoice pi2 on pi2.id = pii2.invoice_id where pii2.product_id = $1)`, [productid]);
    const mrp = lim?.mrp != null ? Number(lim.mrp) : null;
    const ptr = lim?.ptr != null ? Number(lim.ptr) : null;
    let final = price;
    let capped = false;
    if (mrp && price > mrp) { final = mrp; capped = true; }
    final = Math.round(final * 100) / 100;
    const warnings: string[] = [];
    let margin: number | null = null;
    if (ptr) {
      margin = Math.round((final - ptr) / ptr * 10000) / 100;
      if (margin > 1000) {
        throw new BadRequestException(`A margin of ${margin}% on a cost of ${ptr} looks like a typing mistake (the limit is 1,000%). Check the price${capped ? ` (it was capped at the MRP ${mrp})` : ''} and the purchase cost.`);
      }
      if (margin > 300) warnings.push(`High margin: ${margin}% on a cost of ${ptr}.`);
      if (final < ptr) warnings.push(`The price is below the purchase cost (${ptr}).`);
    }
    return { price: final, capped, mrp, ptr, margin, warnings };
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
      const title = (createProductDto.title ?? '').toString().trim();
      if (!title) {
        throw new BadRequestException('Product title is required.');
      }
      if (createProductDto.taxpcnt !== undefined && Number(createProductDto.taxpcnt) < 0) {
        throw new BadRequestException('Tax percent cannot be negative.');
      }
      const dup = await this.productRepository.createQueryBuilder('p')
        .where('lower(trim(p.title)) = lower(:title)', { title })
        .getCount();
      if (dup > 0) {
        throw new BadRequestException(`A product titled "${title}" already exists.`);
      }
      return this.productRepository.save({...createProductDto, title, createdby:userid});
    }

    /**
     * Add new price for a product with transaction protection
     * Fixed: Race condition when ending current price and adding new price
     * Fixed: SQL injection vulnerabilities in helper methods
     */
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
      if (!(Number(createProductPrice2Dto.saleprice) > 0)) {
        throw new BadRequestException('Enter a sale price above 0.');
      }
      // Wrap entire operation in SERIALIZABLE transaction to prevent race conditions
      return await this.priceRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        try {
          const check = await this.checkPrice(transactionManager, Number(createProductPrice2Dto.productid), createProductPrice2Dto.saleprice);
          // Set default values for effdate and enddate if not provided
          const effdate = createProductPrice2Dto.effdate || new Date().toISOString().split('T')[0];
          const enddate = createProductPrice2Dto.enddate || '2099-12-31';

          // Step 1: Query existing prices within transaction
          const priceHistory = await transactionManager.query(
            `SELECT * FROM product_price2 WHERE product_id = $1 ORDER BY eff_date DESC`,
            [createProductPrice2Dto.productid]
          );

          // A new price applies forward only. If the given effective date is not
          // after the latest existing price, clamp it to the day after so the
          // history stays chronological and ranges never overlap or invert.
          let applyFrom = effdate;
          const latestEff = priceHistory?.[0]?.eff_date
            ? new Date(priceHistory[0].eff_date).toISOString().split('T')[0]
            : null;
          if (latestEff && applyFrom <= latestEff) {
            const d = new Date(latestEff);
            d.setDate(d.getDate() + 1);
            applyFrom = d.toISOString().split('T')[0];
          }

          // Step 2: Close the currently-open price row at the new start date.
          if (priceHistory && priceHistory.length > 0) {
            await transactionManager.query(
              `UPDATE product_price2 SET end_date = $1
               WHERE product_id = $2 AND end_date = '2099-12-31' AND eff_date < $1`,
              [applyFrom, createProductPrice2Dto.productid]
            );
          }

          // Step 3: Save new price with default values
          const newPrice = await transactionManager.save(ProductPrice2, {
            ...createProductPrice2Dto,
            saleprice: check.price,
            effdate: applyFrom,
            enddate: enddate,
            createdby: userid
          });

          return { ...newPrice, capped: check.capped, mrp: check.mrp, ptr: check.ptr, margin: check.margin, warnings: check.warnings };
        } catch (error) {
          // Transaction will automatically rollback on error
          if (error instanceof BadRequestException) throw error;
          throw new Error(`Failed to add price: ${error.message}`);
        }
      });
    }
    
    async update(id:any, values:any, userid){
      if (values && 'title' in values) {
        const title = (values.title ?? '').toString().trim();
        if (!title) {
          throw new BadRequestException('Product title is required.');
        }
        const dup = await this.productRepository.createQueryBuilder('p')
          .where('lower(trim(p.title)) = lower(:title)', { title })
          .andWhere('p.id != :id', { id })
          .getCount();
        if (dup > 0) {
          throw new BadRequestException(`A product titled "${title}" already exists.`);
        }
        values = { ...values, title };
      }
      return this.productRepository.update(id, {...values, updatedby:userid});
    }

    async updatePrice(id:any, values:any, userid){
        if (values?.saleprice !== undefined) {
          const row = await this.priceRepository.findOne({ where: { id } });
          if (!row) throw new BadRequestException('Price not found.');
          const check = await this.checkPrice(this.manager, Number(row.productid), values.saleprice);
          values = { ...values, saleprice: check.price };
        }
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

}
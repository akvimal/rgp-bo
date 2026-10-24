import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { PricingService } from "./pricing.service";

@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>,
                @InjectRepository(ProductPrice2) private readonly priceRepository: Repository<ProductPrice2>,
                @InjectEntityManager() private manager: EntityManager,
                private readonly pricing: PricingService) { }

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
   * A sale price is per pack and excludes GST (the bill adds the GST the till bills, see sale_gst()); the MRP includes GST. So:
   *   - a price whose GST-inclusive amount would be above MRP is capped at MRP / (1 + GST billed) (it is an offence to sell above it);
   *   - a margin above 1,000% on cost is refused as a typing mistake; above 300% it is saved with a warning;
   *   - a price below cost is saved with a warning.
   * A product with no purchase yet has no MRP or PTR to check against and is saved as given.
   */
  /**
   * Products whose pack size or unit looks wrong, from how they were bought and priced. A wrong pack makes cost per unit wrong,
   * so margin, price checks and "sold below cost" lines all lie. Reasons:
   *  - UNIT_JUMP: two purchases in the last two years whose MRP differs by 2.5x or more (a box of ten, then single pieces);
   *  - COST_OVER_MRP: the latest purchase rate with GST is above its MRP;
   *  - PRICE_OVER_MRP: the current sale price with GST is above the latest MRP (the customer would pay more than the MRP);
   *  - PRICE_FAR_BELOW_MRP: the current sale price with GST is under 5% of the latest MRP.
   * The list price and the purchase rate and MRP are all per pack, GST excluded for the first two.
   */
  async packCheck() {
    return this.manager.query(
      `with pur as (
         select pii.product_id, pii.id, pi.invoice_date, pii.mrp_cost, pii.ptr_value, coalesce(pii.tax_pcnt, 0) tax,
                lag(pii.mrp_cost) over w prev_mrp, lag(pi.invoice_date) over w prev_date
           from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
          where pii.active and not pii.archive and pi.active and not pi.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
         window w as (partition by pii.product_id order by pi.invoice_date, pii.id)
       ), jumps as (
         select distinct on (product_id) product_id, mrp_cost / prev_mrp as ratio, invoice_date as jump_date, prev_date
           from pur where prev_mrp > 0 and (mrp_cost / prev_mrp >= 2.5 or mrp_cost / prev_mrp <= 0.4) and invoice_date >= current_date - 730
          order by product_id, invoice_date desc
       ), latest as (
         select distinct on (product_id) product_id, mrp_cost, ptr_value, tax, public.sale_gst(tax::double precision) as stax from pur order by product_id, invoice_date desc, id desc
       ), cur as (select product_id, sale_price from product_price2 where end_date > current_date and sale_price > 0)
       select p.id, p.title, p.pack, l.mrp_cost::numeric as mrp, round(l.ptr_value::numeric, 2) as rate, round(c.sale_price::numeric, 2) as price,
              round(j.ratio::numeric, 2) as jump_ratio, to_char(j.jump_date, 'YYYY-MM-DD') as jump_date,
              array_remove(array[
                case when j.product_id is not null then 'UNIT_JUMP' end,
                case when l.ptr_value * (1 + l.tax / 100) > l.mrp_cost * 1.001 then 'COST_OVER_MRP' end,
                case when c.sale_price * (1 + l.stax / 100) > l.mrp_cost * 1.001 then 'PRICE_OVER_MRP' end,
                case when c.sale_price * (1 + l.stax / 100) < l.mrp_cost * 0.05 then 'PRICE_FAR_BELOW_MRP' end], null) as reasons
         from product p join latest l on l.product_id = p.id left join jumps j on j.product_id = p.id left join cur c on c.product_id = p.id
        where p.active and (j.product_id is not null or l.ptr_value * (1 + l.tax / 100) > l.mrp_cost * 1.001
              or c.sale_price * (1 + l.stax / 100) > l.mrp_cost * 1.001 or c.sale_price * (1 + l.stax / 100) < l.mrp_cost * 0.05)
        order by (j.product_id is null), p.title`);
  }

  private async checkPrice(manager: EntityManager, productid: number, raw: any) {
    const price = Number(raw);
    if (!(price > 0)) {
      throw new BadRequestException('Enter a sale price above 0.');
    }
    const [lim] = await manager.query(
      `select min(pii.mrp_cost) as mrp, max(pii.ptr_cost) as ptr, max(pii.ptr_value) as ptrex, public.sale_gst(max(coalesce(pii.tax_pcnt, 0))::double precision) as tax
         from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
        where pii.product_id = $1 and pii.mrp_cost > 0 and pii.ptr_cost > 0
          and pi.invoice_date = (select max(pi2.invoice_date) from purchase_invoice_item pii2
                                   join purchase_invoice pi2 on pi2.id = pii2.invoice_id where pii2.product_id = $1)`, [productid]);
    const mrp = lim?.mrp != null ? Number(lim.mrp) : null;
    const ptr = lim?.ptr != null ? Number(lim.ptr) : null;
    // cost without GST, to compare with a price without GST
    const cost = lim?.ptrex != null && Number(lim.ptrex) > 0 ? Number(lim.ptrex) : ptr;
    const tax = lim?.tax != null ? Number(lim.tax) : 0;
    const ceiling = mrp ? Math.floor((mrp / (1 + tax / 100)) * 100 + 1e-6) / 100 : null;
    let final = price;
    let capped = false;
    if (ceiling && price > ceiling) { final = ceiling; capped = true; }
    final = Math.round(final * 100) / 100;
    const warnings: string[] = [];
    let margin: number | null = null;
    if (cost) {
      margin = Math.round((final - cost) / cost * 10000) / 100;
      if (margin > 1000) {
        throw new BadRequestException(`A margin of ${margin}% on a cost of ${cost} looks like a typing mistake (the limit is 1,000%). Check the price${capped ? ` (it was capped at ${ceiling}: the MRP ${mrp} less GST)` : ''} and the purchase cost.`);
      }
      if (margin > 300) warnings.push(`High margin: ${margin}% on a cost of ${cost}.`);
      if (final < cost) warnings.push(`The price is below the purchase cost (${cost}).`);
    }
    return { price: final, capped, mrp, ceiling, tax, ptr, margin, warnings };
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
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid, opts?: { policyApproved?: boolean }) {
      if (!(Number(createProductPrice2Dto.saleprice) > 0)) {
        throw new BadRequestException('Enter a sale price above 0.');
      }
      // Wrap entire operation in SERIALIZABLE transaction to prevent race conditions
      return await this.priceRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
        try {
          const check = await this.checkPrice(transactionManager, Number(createProductPrice2Dto.productid), createProductPrice2Dto.saleprice);
          // the price policy (floor markup, discount cap, stepped raises): a change that breaks it needs an approver and a reason.
          // The system's own policy steps are already approved and skip this.
          let override: string | null = null;
          if (!opts?.policyApproved) {
            const verdict = await this.pricing.assertChange(Number(createProductPrice2Dto.productid), check.price, userid, createProductPrice2Dto.overridereason);
            if (verdict.overridden.length) override = `Policy override: ${createProductPrice2Dto.overridereason!.trim()}`;
          }
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
          const { overridereason: _ignored, ...priceFields } = createProductPrice2Dto as any;
          const newPrice = await transactionManager.save(ProductPrice2, {
            ...priceFields,
            comments: override ? `${priceFields.comments ? priceFields.comments + ' | ' : ''}${override}`.slice(0, 400) : priceFields.comments,
            saleprice: check.price,
            effdate: applyFrom,
            enddate: enddate,
            createdby: userid
          });

          return { ...newPrice, capped: check.capped, mrp: check.mrp, ceiling: check.ceiling, ptr: check.ptr, margin: check.margin, warnings: check.warnings };
        } catch (error) {
          // Transaction will automatically rollback on error
          if (error instanceof HttpException) throw error;
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
          // an edit of the price in force is a price change like any other; an edit of old history is not
          if (String(row.enddate).slice(0, 10) === '2099-12-31') {
            await this.pricing.assertChange(Number(row.productid), check.price, userid, values.overridereason);
          }
          const { overridereason: _ignored, ...rest } = values;
          values = { ...rest, saleprice: check.price };
        }
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

}
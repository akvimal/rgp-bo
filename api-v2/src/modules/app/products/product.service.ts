import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { PricingService } from "./pricing.service";
import { priceBeforeGst } from "./pricing-mode";

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
      `select v.*, p.pack from price_view v join product p on p.id = v.id where v.active = $1 and v.title ilike $2`, [active, title]);
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
    // A flag comes from purchase and price history, which fixing the pack does not change. A product somebody has settled
    // (pack_check_resolution) therefore counts a flag again only when a purchase or price AFTER that day shows it.
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
         select distinct on (product_id) product_id, invoice_date, mrp_cost, ptr_value, tax, public.gst_sale_rate(product_id, tax::double precision) as stax from pur order by product_id, invoice_date desc, id desc
       ), cur as (
         select distinct on (product_id) product_id, sale_price, eff_date from product_price2 where end_date > current_date and sale_price > 0 order by product_id, eff_date desc, id desc
       ), res as (
         select distinct on (r.product_id) r.product_id, r.action, r.reason, r.note, r.old_pack, r.new_pack, r.created_on, r.created_on::date as res_date, u.full_name as res_by
           from pack_check_resolution r left join app_user u on u.id = r.created_by order by r.product_id, r.id desc
       ), flagged as (
         select p.id, p.title, p.pack, l.mrp_cost::numeric as mrp, round(l.ptr_value::numeric, 2) as rate, round(c.sale_price::numeric, 2) as price,
                round(j.ratio::numeric, 2) as jump_ratio, to_char(j.jump_date, 'YYYY-MM-DD') as jump_date, (j.product_id is not null) as has_jump,
                array_remove(array[
                  case when j.product_id is not null and (r.product_id is null or j.jump_date > r.res_date) then 'UNIT_JUMP' end,
                  case when l.ptr_value * (1 + l.tax / 100) > l.mrp_cost * 1.001 and (r.product_id is null or l.invoice_date > r.res_date) then 'COST_OVER_MRP' end,
                  case when c.sale_price * (1 + l.stax / 100) > l.mrp_cost * 1.001 and (r.product_id is null or c.eff_date > r.res_date) then 'PRICE_OVER_MRP' end,
                  case when c.sale_price * (1 + l.stax / 100) < l.mrp_cost * 0.05 and (r.product_id is null or c.eff_date > r.res_date) then 'PRICE_FAR_BELOW_MRP' end], null) as reasons,
                (j.product_id is not null or l.ptr_value * (1 + l.tax / 100) > l.mrp_cost * 1.001
                  or c.sale_price * (1 + l.stax / 100) > l.mrp_cost * 1.001 or c.sale_price * (1 + l.stax / 100) < l.mrp_cost * 0.05) as ever_flagged,
                r.product_id is not null as settled, r.action as resolution, r.reason as resolution_reason, r.note as resolution_note,
                to_char(r.res_date, 'YYYY-MM-DD') as resolved_on, r.res_by as resolved_by, r.old_pack, r.new_pack
           from product p join latest l on l.product_id = p.id left join jumps j on j.product_id = p.id left join cur c on c.product_id = p.id left join res r on r.product_id = p.id
          where p.active)
       select id, title, pack, mrp, rate, price, jump_ratio, jump_date, reasons, resolution, resolution_reason, resolution_note, resolved_on, resolved_by, old_pack, new_pack,
              case when cardinality(reasons) > 0 then 'OPEN' else resolution end as status,
              (settled and cardinality(reasons) > 0) as reopened
         from flagged
        where ever_flagged or settled
        order by (cardinality(reasons) = 0), (not has_jump), title`);
  }

  private async checkPrice(manager: EntityManager, productid: number, raw: any) {
    const price = Number(raw);
    if (!(price > 0)) {
      throw new BadRequestException('Enter a sale price above 0.');
    }
    const [lim] = await manager.query(
      // the MRP and cost of the product's newest VERIFIED purchase line (an unverified line sets no limit): the same line the Set the price dialog shows
      `select pii.mrp_cost as mrp, pii.ptr_cost as ptr, pii.ptr_value as ptrex, public.gst_sale_rate($1::int4, coalesce(pii.tax_pcnt, 0)::double precision) as tax
         from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.active and not pi.archive
        where pii.status = 'VERIFIED' and pii.product_id = $1 and pii.active and not pii.archive and pii.mrp_cost > 0 and pii.ptr_cost > 0 and pii.ptr_value > 0
        order by pi.invoice_date desc, pii.id desc limit 1`, [productid]);
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

  /**
   * The product's price row for the Set the price dialog. price_view takes the cost and MRP from the purchase on the newest invoice date, whatever its
   * status (a draft counts), but the pricing policy (the lowest price, the legal ceiling, the largest raise) is judged against the newest COMPLETED purchase.
   * With the two being different purchases the dialog disagreed with itself. So the dialog's figures come from the same completed purchase as the policy,
   * and a newer purchase that is not completed yet is reported on its own (`pending`), with the ceiling it would give once it is.
   */
  async findPriceById(productid:number){
    const rows = await this.manager.query(
      `SELECT v.*, p.pack FROM price_view v JOIN product p ON p.id = v.id WHERE v.id = $1`,
      [productid]);
    if(!rows.length) return rows;
    const BASIS = `select pi.invoice_no, coalesce(pi.invoice_no, 'challan ' || pi.challan_no) as ref, to_char(pi.invoice_date, 'YYYY-MM-DD') as invoice_date, pi.status,
                          pii.mrp_cost::float8 as mrp, pii.ptr_cost::float8 as ptr, coalesce(pii.tax_pcnt, 0)::float8 as tax,
                          public.sale_gst(coalesce(pii.tax_pcnt, 0)::double precision)::float8 as sale_tax
                     from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id and pi.active and not pi.archive`;
    const [done] = await this.manager.query(
      `${BASIS} where pii.status = 'VERIFIED' and pii.product_id = $1 and pii.active and not pii.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
        order by pi.invoice_date desc, pii.id desc limit 1`, [productid]);
    const [open] = await this.manager.query(
      `${BASIS} where pii.status not in ('VERIFIED', 'REJECTED') and pii.product_id = $1 and pii.active and not pii.archive and pii.mrp_cost > 0 and pii.ptr_value > 0
        order by pi.invoice_date desc, pii.id desc limit 1`, [productid]);
    const row: any = { ...rows[0] };
    const ceilingOf = (mrp:number, saleTax:number) => Math.floor(mrp / (1 + saleTax / 100) * 100 + 1e-6) / 100;
    if(done){
      // the same purchase the policy reads
      row.mrp = done.mrp; row.ptr = done.ptr; row.tax = done.tax; row.sale_tax = done.sale_tax;
      const price = row.price !== null && row.price !== undefined ? +row.price : done.mrp / (1 + done.sale_tax / 100);
      row.margin = done.ptr > 0 ? Math.round(((price * (1 + done.tax / 100) - done.ptr) / done.ptr) * 100) : row.margin;
      row.discount = done.mrp > 0 ? Math.round(((done.mrp - price * (1 + done.sale_tax / 100)) / done.mrp) * 100) : row.discount;
      row.basis = { invoiceno: done.ref, invoicedate: done.invoice_date };
      // a newer purchase that is still a draft, with a different MRP or cost: shown, and what its MRP would allow
      if(open && open.invoice_date >= done.invoice_date && (Math.abs(open.mrp - done.mrp) > 0.005 || Math.abs(open.ptr - done.ptr) > 0.005)){
        row.pending = { invoiceno: open.ref, invoicedate: open.invoice_date, status: open.status, mrp: open.mrp, ptr: open.ptr, ceiling: ceilingOf(open.mrp, open.sale_tax) };
      }
    } else if(open){
      // no completed purchase yet: the figures are a draft's, and the policy has nothing to judge them by until it is completed
      row.basisdraft = { invoiceno: open.ref, invoicedate: open.invoice_date, status: open.status };
    }
    return [row];
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
      `SELECT h.id, h.product_id, h.eff_date, h.end_date, round(h.sale_price::numeric, 2)::float8 AS sale_price, h.reason, h.comments, h.created_by, u.full_name AS by_name, h.created_on
         FROM product_price2 h LEFT JOIN app_user u ON u.id = h.created_by WHERE h.product_id = $1 ORDER BY h.eff_date DESC, h.id DESC`,
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

    /**
     * The first price of the new products on a received invoice. With no `prices` each gets the price the rules suggest; with `prices` (what the
     * person typed, in the way the business shows prices) that price is used and checked against the rules like any other price change.
     * A product the user may not price, or whose cost or pack looks wrong, is reported and left for someone who can.
     */
    async priceNewFromInvoice(invoiceid:number, userid:number, prices?:{[productid:number]:number}){
      const { basis, products } = await this.pricing.newPricesForInvoice(invoiceid);
      const done:any[] = [];
      const failed:any[] = [];
      for(const u of products){
        try{
          await this.pricing.prepareNew(u.productid, userid);
          const typed = prices ? Number(prices[u.productid]) : NaN;
          const own = Number.isFinite(typed) && typed > 0;
          const price = own ? (basis === 'incl' ? priceBeforeGst(typed, u.tax, u.mrp) : typed) : u.suggestion!.price;
          const saved = await this.addPrice(
            { productid: u.productid, saleprice: price, reason: 'Initial', comments: `First price from purchase invoice #${invoiceid}` } as any,
            userid, own ? undefined : { policyApproved: true });
          await this.pricing.audited(userid, 'price.first_price', u.productid, `${u.title}: first price ${saved.saleprice} from purchase invoice #${invoiceid}${own ? ' (entered)' : ' (from the rules)'}`,
            { price: saved.saleprice, invoiceid, class: u.classkey, cost: u.cost, mrp: u.mrp, entered: own });
          done.push({ productid: u.productid, title: u.title, price: Number(saved.saleprice) });
        }
        catch(e:any){
          const m = e?.response?.message;
          failed.push({ productid: u.productid, title: u.title, message: (Array.isArray(m) ? m.join(' ') : m) || e?.message });
        }
      }
      return { applied: done.length, done, failed };
    }

    /** Completing an invoice: when the business prices at the MRP the price of a new product needs no decision, so it is set now. Never blocks the completion. */
    async autoPriceNew(invoiceid:number, userid:number){
      try{
        if((await this.pricing.mode()).mode !== 'MRP') return { auto: false, applied: 0, failed: [] };
        return { auto: true, ...(await this.priceNewFromInvoice(invoiceid, userid)) };
      }
      catch(e:any){ return { auto: true, applied: 0, failed: [{ message: e?.message }] }; }
    }

}
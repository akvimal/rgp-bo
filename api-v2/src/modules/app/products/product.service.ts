import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { HsnTaxMaster } from "src/entities/hsn-tax-master.entity";

@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>,
                @InjectRepository(ProductPrice2) private readonly priceRepository: Repository<ProductPrice2>,
                @InjectRepository(HsnTaxMaster) private readonly hsnTaxRepository: Repository<HsnTaxMaster>,
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
          if(query.search){
            qb.andWhere(`p.title ILIKE :search`, { search: `%${query.search}%` });
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
      `select * from price_view where active = $1 and title ilike $2`,
      [criteria.active, `${criteria.title}%`]);
  }

  async findPriceById(productid:number){
    return await this.manager.query(
      `select * from price_view where id = $1`,
      [productid]);
  }

  async endCurrentPrice(productid:number,enddate?:string){
    // If no end date provided, use current date
    const dateToSet = enddate || new Date().toISOString().split('T')[0];
    return await this.manager.query(
      `update product_price2 set end_date = $1 where product_id = $2 and end_date = '2099-12-31'`,
      [dateToSet, productid]);
  }

  async findPriceHistoryById(productid:number){
    return await this.manager.query(
      `select * from product_price2 where product_id = $1 order by eff_date desc`,
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
    
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
      // Use transaction to prevent race condition when ending current price and adding new price
      return await this.manager.transaction('SERIALIZABLE', async (transactionalEntityManager) => {
        // Check if there's an existing price history
        const priceFound = await transactionalEntityManager.query(
          `SELECT * FROM product_price2 WHERE product_id = $1 ORDER BY eff_date DESC`,
          [createProductPrice2Dto.productid]
        );

        // If no existing price, just insert the new price
        if (!priceFound || priceFound.length === 0) {
          return await transactionalEntityManager.save(ProductPrice2, {
            ...createProductPrice2Dto,
            createdby: userid
          });
        }

        // End the current price (set end_date for prices ending on 2099-12-31)
        const dateToSet = createProductPrice2Dto.effdate || new Date().toISOString().split('T')[0];
        await transactionalEntityManager.query(
          `UPDATE product_price2 SET end_date = $1 WHERE product_id = $2 AND end_date = '2099-12-31'`,
          [dateToSet, createProductPrice2Dto.productid]
        );

        // Add the new price
        return await transactionalEntityManager.save(ProductPrice2, {
          ...createProductPrice2Dto,
          createdby: userid
        });
      });
    }
    
    async update(id:any, values:any, userid){
      return this.productRepository.update(id, {...values, updatedby:userid});
    }

    async updatePrice(id:any, values:any, userid){
        return this.priceRepository.update(id, {...values, updatedby:userid});
    }

    /**
     * Get tax rate for a given HSN code
     * @param hsnCode - HSN code to lookup
     * @param date - Date for which to get the rate (defaults to current date)
     * @returns Tax rates (CGST, SGST, IGST) or null if not found
     */
    async getTaxRateForHsn(hsnCode: string, date?: Date): Promise<any> {
      const effectiveDate = date || new Date();

      const taxRate = await this.hsnTaxRepository
        .createQueryBuilder('htm')
        .where('htm.hsncode = :hsnCode', { hsnCode })
        .andWhere('htm.active = :active', { active: true })
        .andWhere(':effectiveDate BETWEEN htm.effectivefrom AND htm.effectiveto', { effectiveDate })
        .orderBy('htm.effectivefrom', 'DESC')
        .getOne();

      if (!taxRate) {
        return null;
      }

      return {
        cgstRate: taxRate.cgstrate,
        sgstRate: taxRate.sgstrate,
        igstRate: taxRate.igstrate,
        totalRate: taxRate.totalTaxRate,
        taxCategory: taxRate.taxcategory,
      };
    }

    /**
     * Get product with auto-populated tax rate from HSN code
     * @param productId - Product ID to lookup
     * @returns Product with tax rate information
     */
    async getProductWithTaxRate(productId: number): Promise<any> {
      const product = await this.productRepository.findOne({ where: { id: productId } });

      if (!product) {
        return null;
      }

      // If product has HSN code, fetch tax rate
      if (product.hsn) {
        const taxRate = await this.getTaxRateForHsn(product.hsn);
        return {
          ...product,
          taxRate: taxRate,
        };
      }

      return product;
    }

    /**
     * Update product HSN code and auto-populate tax rate
     * @param productId - Product ID to update
     * @param hsnCode - New HSN code
     * @param userId - User performing the update
     * @returns Updated product
     */
    async updateProductHsn(productId: number, hsnCode: string, userId: number): Promise<Product> {
      const product = await this.productRepository.findOne({ where: { id: productId } });

      if (!product) {
        throw new Error('Product not found');
      }

      // Get tax rate for new HSN code
      const taxRate = await this.getTaxRateForHsn(hsnCode);

      if (!taxRate) {
        throw new Error(`No tax rate found for HSN code: ${hsnCode}`);
      }

      // Update product with new HSN and tax rate
      product.hsn = hsnCode;
      product.taxpcnt = taxRate.totalRate;
      product.updatedby = userId;

      return await this.productRepository.save(product);
    }

    /**
     * Get price margins report by category
     */
    async getPriceMarginsByCategory(): Promise<any> {
      const result = await this.manager.query(`
        SELECT
          p.category,
          COUNT(DISTINCT p.id) as product_count,
          COUNT(pp.id) as price_records,

          -- Current active prices
          COUNT(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN 1 END) as current_prices,

          -- Average prices
          ROUND(AVG(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.sale_price END)::numeric, 2) as avg_sale_price,
          ROUND(AVG(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.mrp END)::numeric, 2) as avg_mrp,

          -- Margin calculations
          ROUND(AVG(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.margin_pcnt END)::numeric, 2) as avg_margin_pcnt,
          ROUND(MIN(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.margin_pcnt END)::numeric, 2) as min_margin_pcnt,
          ROUND(MAX(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.margin_pcnt END)::numeric, 2) as max_margin_pcnt,

          -- Discount calculations
          ROUND(AVG(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.discount_pcnt END)::numeric, 2) as avg_discount_pcnt,

          -- Tax calculations
          ROUND(AVG(CASE WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date THEN pp.tax_pcnt END)::numeric, 2) as avg_tax_pcnt,

          -- Calculated margins (when margin_pcnt not stored)
          ROUND(AVG(
            CASE
              WHEN CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date AND pp.base_price > 0
              THEN ((pp.sale_price - pp.base_price) / pp.base_price * 100)
            END
          )::numeric, 2) as calculated_avg_margin

        FROM product p
        LEFT JOIN product_price2 pp ON pp.product_id = p.id
        WHERE p.active = true
        GROUP BY p.category
        ORDER BY product_count DESC, category
      `);

      return result;
    }

    /**
     * Get detailed price margins for a category
     */
    async getPriceMarginsByProduct(category: string): Promise<any> {
      const result = await this.manager.query(`
        SELECT
          p.id as product_id,
          p.title as product_name,
          p.category,
          p.hsn_code,
          p.tax_pcnt as product_tax_pcnt,

          pp.id as price_id,
          pp.sale_price,
          pp.mrp,
          pp.base_price,
          pp.margin_pcnt,
          pp.discount_pcnt,
          pp.tax_pcnt as price_tax_pcnt,
          pp.tax_inclusive,
          pp.calculation_method,
          pp.eff_date,
          pp.end_date,

          -- Calculated values
          CASE
            WHEN pp.tax_inclusive THEN pp.sale_price::numeric
            ELSE ROUND((pp.sale_price * (1 + COALESCE(pp.tax_pcnt, 0)/100))::numeric, 2)
          END as sale_price_with_tax,

          CASE
            WHEN pp.mrp IS NOT NULL AND pp.sale_price IS NOT NULL
            THEN ROUND((((pp.mrp - pp.sale_price) / pp.mrp * 100))::numeric, 2)
            ELSE 0
          END as savings_pcnt,

          CASE
            WHEN pp.base_price IS NOT NULL AND pp.sale_price IS NOT NULL AND pp.base_price > 0
            THEN ROUND((((pp.sale_price - pp.base_price) / pp.base_price * 100))::numeric, 2)
            ELSE pp.margin_pcnt
          END as calculated_margin_pcnt

        FROM product p
        INNER JOIN product_price2 pp ON pp.product_id = p.id
        WHERE p.active = true
          AND pp.active = true
          AND p.category = $1
          AND CURRENT_DATE BETWEEN pp.eff_date AND pp.end_date
        ORDER BY p.title
      `, [category]);

      return result;
    }

    /**
     * Get pricing trends over time
     */
    async getPricingTrends(startDate: Date, endDate: Date, category?: string): Promise<any> {
      const categoryFilter = category ? 'AND p.category = $3' : '';
      const params = category ? [startDate, endDate, category] : [startDate, endDate];

      const result = await this.manager.query(`
        SELECT
          DATE_TRUNC('month', pp.eff_date) as month,
          p.category,
          COUNT(DISTINCT p.id) as products_updated,
          COUNT(pp.id) as price_changes,

          ROUND(AVG(pp.sale_price)::numeric, 2) as avg_sale_price,
          ROUND(AVG(pp.mrp)::numeric, 2) as avg_mrp,
          ROUND(AVG(pp.margin_pcnt)::numeric, 2) as avg_margin,
          ROUND(AVG(pp.discount_pcnt)::numeric, 2) as avg_discount

        FROM product p
        INNER JOIN product_price2 pp ON pp.product_id = p.id
        WHERE p.active = true
          AND pp.active = true
          AND pp.eff_date BETWEEN $1 AND $2
          ${categoryFilter}
        GROUP BY DATE_TRUNC('month', pp.eff_date), p.category
        ORDER BY month DESC, category
      `, params);

      return result;
    }

    // ========================================
    // HSN Tax Master CRUD Operations
    // ========================================

    /**
     * Get all HSN tax codes with optional filters
     */
    async findAllHsnTaxCodes(filters?: {
      taxCategory?: string;
      activeOnly?: boolean;
      searchTerm?: string;
    }): Promise<HsnTaxMaster[]> {
      const qb = this.hsnTaxRepository.createQueryBuilder('htm');

      if (filters?.activeOnly) {
        qb.where('htm.isActive = :active', { active: true });
      }

      if (filters?.taxCategory) {
        qb.andWhere('htm.taxcategory = :category', { category: filters.taxCategory });
      }

      if (filters?.searchTerm) {
        qb.andWhere(
          '(htm.hsncode LIKE :term OR htm.hsndescription ILIKE :term)',
          { term: `%${filters.searchTerm}%` }
        );
      }

      qb.orderBy('htm.taxcategory', 'ASC')
        .addOrderBy('htm.hsncode', 'ASC');

      return await qb.getMany();
    }

    /**
     * Get HSN tax code by ID
     */
    async findHsnTaxById(id: number): Promise<HsnTaxMaster | null> {
      return await this.hsnTaxRepository.findOne({ where: { id } });
    }

    /**
     * Get HSN tax code by HSN code
     */
    async findHsnTaxByCode(hsnCode: string): Promise<HsnTaxMaster | null> {
      return await this.hsnTaxRepository.findOne({
        where: { hsncode: hsnCode, isActive: true }
      });
    }

    /**
     * Create new HSN tax code
     */
    async createHsnTax(data: any, userId: number): Promise<HsnTaxMaster> {
      // Validate IGST = CGST + SGST
      if (data.igstrate !== data.cgstrate + data.sgstrate) {
        throw new Error('IGST rate must equal CGST + SGST');
      }

      const hsnTax = {
        ...data,
        createdby: userId,
        updatedby: userId,
      };

      const saved = await this.hsnTaxRepository.save(hsnTax);
      return saved;
    }

    /**
     * Update HSN tax code
     */
    async updateHsnTax(id: number, data: any, userId: number): Promise<HsnTaxMaster | null> {
      const existing = await this.findHsnTaxById(id);
      if (!existing) {
        throw new Error('HSN tax code not found');
      }

      // Validate IGST = CGST + SGST if rates are being updated
      if (data.cgstrate !== undefined || data.sgstrate !== undefined || data.igstrate !== undefined) {
        const cgst = data.cgstrate !== undefined ? data.cgstrate : existing.cgstrate;
        const sgst = data.sgstrate !== undefined ? data.sgstrate : existing.sgstrate;
        const igst = data.igstrate !== undefined ? data.igstrate : existing.igstrate;

        if (igst !== cgst + sgst) {
          throw new Error('IGST rate must equal CGST + SGST');
        }
      }

      await this.hsnTaxRepository.update(id, {
        ...data,
        updatedby: userId,
      });

      return await this.findHsnTaxById(id);
    }

    /**
     * Delete (archive) HSN tax code
     */
    async deleteHsnTax(id: number, userId: number): Promise<void> {
      await this.hsnTaxRepository.update(id, {
        isArchived: true,
        isActive: false,
        updatedby: userId,
      });
    }

    /**
     * Get HSN tax statistics
     */
    async getHsnTaxStatistics(): Promise<any> {
      const result = await this.manager.query(`
        SELECT
          tax_category,
          COUNT(*) as total_codes,
          COUNT(CASE WHEN active = true THEN 1 END) as active_codes,
          ROUND(AVG(cgst_rate + sgst_rate)::numeric, 2) as avg_tax_rate,
          MIN(cgst_rate + sgst_rate) as min_tax_rate,
          MAX(cgst_rate + sgst_rate) as max_tax_rate
        FROM hsn_tax_master
        WHERE archive = false
        GROUP BY tax_category
        ORDER BY tax_category
      `);

      return result;
    }

    /**
     * Get unique tax categories
     */
    async getHsnTaxCategories(): Promise<string[]> {
      const result = await this.hsnTaxRepository
        .createQueryBuilder('htm')
        .select('DISTINCT htm.taxcategory', 'category')
        .where('htm.isActive = :active', { active: true })
        .andWhere('htm.taxcategory IS NOT NULL')
        .orderBy('htm.taxcategory', 'ASC')
        .getRawMany();

      return result.map(r => r.category);
    }

    // ========================================
    // Lookup/Autocomplete Methods
    // ========================================

    /**
     * Lookup brands by search term
     */
    async lookupBrand(term: string): Promise<string[]> {
      const result = await this.productRepository
        .createQueryBuilder('p')
        .select('DISTINCT p.brand', 'brand')
        .where('p.isActive = :active', { active: true })
        .andWhere('p.brand IS NOT NULL')
        .andWhere('LOWER(p.brand) LIKE LOWER(:term)', { term: `%${term}%` })
        .orderBy('p.brand', 'ASC')
        .limit(10)
        .getRawMany();

      return result.map(r => r.brand).filter(b => b);
    }

    /**
     * Lookup manufacturers by search term
     */
    async lookupManufacturer(term: string): Promise<string[]> {
      const result = await this.productRepository
        .createQueryBuilder('p')
        .select('DISTINCT p.manufacturer', 'manufacturer')
        .where('p.isActive = :active', { active: true })
        .andWhere('p.manufacturer IS NOT NULL')
        .andWhere('LOWER(p.manufacturer) LIKE LOWER(:term)', { term: `%${term}%` })
        .orderBy('p.manufacturer', 'ASC')
        .limit(10)
        .getRawMany();

      return result.map(r => r.manufacturer).filter(m => m);
    }

}
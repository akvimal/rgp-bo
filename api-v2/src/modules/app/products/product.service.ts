import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository, DataSource } from "typeorm";
import { CreateProductPrice2Dto } from "./dto/create-product-price2.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { Product } from "src/entities/product.entity";
import { ProductPrice2 } from "src/entities/product-price2.entity";
import { HsnTaxMaster } from "src/entities/hsn-tax-master.entity";

@Injectable()
export class ProductService {
    private readonly logger = new Logger(ProductService.name);

    constructor(@InjectRepository(Product) private readonly productRepository: Repository<Product>,
                @InjectRepository(ProductPrice2) private readonly priceRepository: Repository<ProductPrice2>,
                @InjectRepository(HsnTaxMaster) private readonly hsnTaxRepository: Repository<HsnTaxMaster>,
                @InjectEntityManager() private manager: EntityManager,
                private readonly dataSource: DataSource) { }

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
    // Build WHERE conditions
    let whereConditions = ['p.archive = false'];
    const params: any[] = [];
    let paramIndex = 1;

    // Active filter - handle all/active/inactive
    if (product.active !== undefined && product.active !== null) {
      whereConditions.push(`p.active = $${paramIndex}`);
      params.push(product.active);
      paramIndex++;
    }

    // Title filter
    if (product.title && product.title !== '') {
      whereConditions.push(`p.title ILIKE $${paramIndex}`);
      params.push(product.title + '%');
      paramIndex++;
    }

    // Category filter
    if (product.category && product.category !== '') {
      whereConditions.push(`p.category = $${paramIndex}`);
      params.push(product.category);
      paramIndex++;
    }

    // Properties filter
    if (product.props && product.props.length > 0) {
      product.props.forEach((prop: any) => {
        if (!(typeof prop['value'] === 'boolean' && prop['value'] === false)) {
          whereConditions.push(`p.more_props->>'${prop['id']}' = $${paramIndex}`);
          params.push(prop['value']);
          paramIndex++;
        }
      });
    }

    const whereClause = whereConditions.join(' AND ');

    // Enhanced query with stock, price, and margin data
    const query = `
      SELECT
        p.id,
        p.title,
        p.product_code as code,
        p.pack,
        p.hsn_code as hsn,
        p.mfr,
        p.brand,
        p.category,
        p.description,
        p.tax_pcnt as taxpcnt,
        p.more_props as props,
        p.active as "isActive",
        p.archive as "isArchived",
        p.created_on as createdon,
        p.updated_on as updatedon,
        p.created_by as createdby,
        p.updated_by as updatedby,
        COALESCE(stock.balance, 0) as "currentStock",
        COALESCE(price.price, price.mrp, 0) as "salePrice",
        COALESCE(price.mrp, 0) as mrp,
        COALESCE(price.ptr, 0) as ptr,
        COALESCE(price.margin, 0) as margin,
        COALESCE(stock.last_sale_date, NULL) as "lastSaleDate"
      FROM product p
      LEFT JOIN product_items_agg_view stock ON stock.id = p.id
      LEFT JOIN price_view price ON price.id = p.id
      WHERE ${whereClause}
      ORDER BY p.updated_on DESC
    `;

    return await this.dataSource.query(query, params);
  }

  async getCategories() {
    const result = await this.dataSource.query(`
      SELECT DISTINCT category
      FROM product
      WHERE category IS NOT NULL AND category != '' AND active = true
      ORDER BY category
    `);
    return result.map((row: any) => row.category);
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
      `SELECT
        pv.*,
        p.category,
        COALESCE(stock.balance, 0) as current_stock,
        stock.last_sale_date,
        pp2_curr.eff_date as last_change_date,
        DATE_PART('day', NOW() - pp2_curr.eff_date) as price_age_days,
        pp2_prev.sale_price as previous_price,
        CASE
          WHEN pp2_prev.sale_price IS NOT NULL AND pv.price > pp2_prev.sale_price THEN 'up'
          WHEN pp2_prev.sale_price IS NOT NULL AND pv.price < pp2_prev.sale_price THEN 'down'
          ELSE 'stable'
        END as price_trend
      FROM price_view pv
      LEFT JOIN product p ON p.id = pv.id
      LEFT JOIN product_items_agg_view stock ON stock.id = pv.id
      LEFT JOIN product_price2 pp2_curr ON pp2_curr.product_id = pv.id AND pp2_curr.end_date = '2099-12-31'
      LEFT JOIN LATERAL (
        SELECT sale_price
        FROM product_price2
        WHERE product_id = pv.id AND id != pp2_curr.id
        ORDER BY eff_date DESC LIMIT 1
      ) pp2_prev ON true
      WHERE pv.active = $1 AND pv.title ILIKE $2
      ORDER BY pv.title`,
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
      try {
        // Check for existing ACTIVE product with same title (ignore soft-deleted products)
        const existingProduct = await this.productRepository.findOne({
          where: {
            title: createProductDto.title,
            isActive: true,
            isArchived: false
          }
        });

        if (existingProduct) {
          this.logger.warn(`Duplicate product title attempted: ${createProductDto.title}`);
          throw new BadRequestException(
            `Product with title "${createProductDto.title}" already exists. ` +
            `Please use a different title or edit the existing product (ID: ${existingProduct.id}).`
          );
        }

        return await this.productRepository.save({...createProductDto, createdby:userid});
      } catch (error) {
        // Handle unique constraint violation from database
        if (error.code === '23505') { // PostgreSQL unique violation
          this.logger.error(`Duplicate product creation failed: ${error.detail}`);
          throw new BadRequestException(
            `Product with this title already exists. Please use a unique product title.`
          );
        }
        throw error;
      }
    }
    
    /**
     * Add a new price for a product with auto-calculation and validation
     * Issue #122 - Auto-calculate price margins
     *
     * Auto-calculates:
     * - margin_pcnt if base_price and sale_price provided
     * - discount_pcnt if mrp and sale_price provided
     *
     * Validates:
     * - sale_price >= base_price (prevent loss-making sales)
     * - sale_price <= mrp (prevent overpricing)
     */
    async addPrice(createProductPrice2Dto: CreateProductPrice2Dto, userid) {
      this.logger.log(`Adding price for product ${createProductPrice2Dto.productid}`);

      // Create a mutable copy for calculations
      const priceData: any = { ...createProductPrice2Dto };

      // Auto-calculate margin_pcnt if not provided but base_price and sale_price exist
      if (priceData.marginpcnt === undefined && priceData.baseprice && priceData.saleprice) {
        priceData.marginpcnt = parseFloat(
          (((priceData.saleprice - priceData.baseprice) / priceData.baseprice) * 100).toFixed(2)
        );
        this.logger.log(
          `Auto-calculated margin: ${priceData.marginpcnt}% ` +
          `(sale: ${priceData.saleprice}, base: ${priceData.baseprice})`
        );
      }

      // Auto-calculate discount_pcnt if not provided but mrp and sale_price exist
      if (priceData.discountpcnt === undefined && priceData.mrp && priceData.saleprice) {
        priceData.discountpcnt = parseFloat(
          (((priceData.mrp - priceData.saleprice) / priceData.mrp) * 100).toFixed(2)
        );
        this.logger.log(
          `Auto-calculated discount: ${priceData.discountpcnt}% ` +
          `(mrp: ${priceData.mrp}, sale: ${priceData.saleprice})`
        );
      }

      // Validate sale_price >= base_price (prevent loss-making sales)
      if (priceData.baseprice && priceData.saleprice < priceData.baseprice) {
        const error = `Sale price (${priceData.saleprice}) cannot be less than base price (${priceData.baseprice}). ` +
          `This would result in a loss of ${(priceData.baseprice - priceData.saleprice).toFixed(2)} per unit.`;
        this.logger.error(error);
        throw new BadRequestException(error);
      }

      // Validate sale_price <= mrp (prevent overpricing above MRP)
      if (priceData.mrp && priceData.saleprice > priceData.mrp) {
        const error = `Sale price (${priceData.saleprice}) cannot exceed MRP (${priceData.mrp}). ` +
          `Selling above MRP is not permitted.`;
        this.logger.error(error);
        throw new BadRequestException(error);
      }

      // Use transaction to prevent race condition when ending current price and adding new price
      return await this.manager.transaction('SERIALIZABLE', async (transactionalEntityManager) => {
        // Check if there's an existing price history
        const priceFound = await transactionalEntityManager.query(
          `SELECT * FROM product_price2 WHERE product_id = $1 ORDER BY eff_date DESC`,
          [priceData.productid]
        );

        // If no existing price, just insert the new price
        if (!priceFound || priceFound.length === 0) {
          this.logger.log(`Creating first price record for product ${priceData.productid}`);
          return await transactionalEntityManager.save(ProductPrice2, {
            ...priceData,
            createdby: userid
          });
        }

        // End the current price (set end_date for prices ending on 2099-12-31)
        // Set end_date to one day before the new effective date to prevent unique constraint violation
        const newEffDate = priceData.effdate || new Date().toISOString().split('T')[0];
        const endDateForOldPrice = new Date(newEffDate);
        endDateForOldPrice.setDate(endDateForOldPrice.getDate() - 1);
        const dateToSet = endDateForOldPrice.toISOString().split('T')[0];

        this.logger.log(`Ending previous price records for product ${priceData.productid} on ${dateToSet}`);

        await transactionalEntityManager.query(
          `UPDATE product_price2 SET end_date = $1 WHERE product_id = $2 AND end_date = '2099-12-31'`,
          [dateToSet, priceData.productid]
        );

        // Add the new price
        this.logger.log(`Creating new price record for product ${priceData.productid}`);
        return await transactionalEntityManager.save(ProductPrice2, {
          ...priceData,
          createdby: userid
        });
      });
    }
    
    async update(id:any, values:any, userid){
      return this.productRepository.update(id, {...values, updatedby:userid});
    }

    /**
     * Remove (soft delete) a product with validation
     * Issue #121 - Product Deletion Validation & Safety
     *
     * Prevents deletion when:
     * - Product has active stock in batches
     * - Product has pending purchase invoices
     */
    async remove(id: number, userid: number): Promise<any> {
      this.logger.log(`Attempting to delete product ${id} by user ${userid}`);

      // Check for active stock in batches
      const stockCheck = await this.dataSource.query(
        `SELECT COALESCE(SUM(quantity_remaining), 0) as total_stock
         FROM product_batch
         WHERE product_id = $1 AND status = 'ACTIVE' AND active = true`,
        [id]
      );

      const totalStock = parseInt(stockCheck[0].total_stock);

      if (totalStock > 0) {
        this.logger.warn(
          `Cannot delete product ${id}: Has ${totalStock} units in active batches`
        );
        throw new BadRequestException(
          `Cannot delete product with active stock (${totalStock} units remaining). ` +
          `Please clear or transfer stock before deletion.`
        );
      }

      // Check for pending purchase invoices
      const poCheck = await this.dataSource.query(
        `SELECT COUNT(*) as pending_po
         FROM purchase_invoice pi
         INNER JOIN purchase_invoice_item pii ON pi.id = pii.invoice_id
         WHERE pii.product_id = $1
           AND pi.status IN ('NEW', 'PARTIAL')
           AND pi.active = true`,
        [id]
      );

      const pendingPO = parseInt(poCheck[0].pending_po);

      if (pendingPO > 0) {
        this.logger.warn(
          `Cannot delete product ${id}: Has ${pendingPO} pending purchase invoice(s)`
        );
        throw new BadRequestException(
          `Cannot delete product with pending purchase invoices (${pendingPO} pending). ` +
          `Please complete or cancel these invoices first.`
        );
      }

      // Get the product to modify its title
      const product = await this.productRepository.findOne({ where: { id } });

      if (!product) {
        throw new BadRequestException(`Product with ID ${id} not found`);
      }

      // Modify title to free up the unique constraint for future products
      // Append deletion timestamp to allow recreating products with the same original title
      const deletedTitle = `${product.title}_deleted_${Date.now()}`;

      // Soft delete (set active = false, archive = true, modify title)
      await this.productRepository.update(id, {
        title: deletedTitle,
        isActive: false,
        isArchived: true,
        updatedby: userid
      });

      this.logger.log(`Product ${id} successfully deleted by user ${userid}. Title changed from "${product.title}" to "${deletedTitle}"`);

      return {
        message: 'Product deleted successfully',
        productId: id
      };
    }

    /**
     * Update an existing price with auto-calculation and validation
     * Issue #122 - Auto-calculate price margins
     */
    async updatePrice(id:any, values:any, userid){
        this.logger.log(`Updating price ${id}`);

        // Create a mutable copy for calculations
        const priceData: any = { ...values };

        // Auto-calculate margin_pcnt if not provided but base_price and sale_price exist
        if (priceData.marginpcnt === undefined && priceData.baseprice && priceData.saleprice) {
          priceData.marginpcnt = parseFloat(
            (((priceData.saleprice - priceData.baseprice) / priceData.baseprice) * 100).toFixed(2)
          );
          this.logger.log(
            `Auto-calculated margin: ${priceData.marginpcnt}% ` +
            `(sale: ${priceData.saleprice}, base: ${priceData.baseprice})`
          );
        }

        // Auto-calculate discount_pcnt if not provided but mrp and sale_price exist
        if (priceData.discountpcnt === undefined && priceData.mrp && priceData.saleprice) {
          priceData.discountpcnt = parseFloat(
            (((priceData.mrp - priceData.saleprice) / priceData.mrp) * 100).toFixed(2)
          );
          this.logger.log(
            `Auto-calculated discount: ${priceData.discountpcnt}% ` +
            `(mrp: ${priceData.mrp}, sale: ${priceData.saleprice})`
          );
        }

        // Validate sale_price >= base_price (prevent loss-making sales)
        if (priceData.baseprice && priceData.saleprice < priceData.baseprice) {
          const error = `Sale price (${priceData.saleprice}) cannot be less than base price (${priceData.baseprice}). ` +
            `This would result in a loss of ${(priceData.baseprice - priceData.saleprice).toFixed(2)} per unit.`;
          this.logger.error(error);
          throw new BadRequestException(error);
        }

        // Validate sale_price <= mrp (prevent overpricing above MRP)
        if (priceData.mrp && priceData.saleprice > priceData.mrp) {
          const error = `Sale price (${priceData.saleprice}) cannot exceed MRP (${priceData.mrp}). ` +
            `Selling above MRP is not permitted.`;
          this.logger.error(error);
          throw new BadRequestException(error);
        }

        return this.priceRepository.update(id, {...priceData, updatedby:userid});
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

    /**
     * Get product dashboard metrics
     */
    async getDashboardMetrics(): Promise<any> {
      try {
        // Overview metrics
        const overviewQuery = `
          SELECT
            COUNT(*) FILTER (WHERE active = true AND archive = false) as total_active,
            COUNT(*) FILTER (WHERE active = false AND archive = false) as total_inactive,
            COUNT(*) FILTER (WHERE archive = true) as total_archived,
            COUNT(DISTINCT category) FILTER (WHERE active = true AND archive = false) as total_categories
          FROM product
        `;
        const overview = await this.dataSource.query(overviewQuery);

        // Stock metrics
        const stockQuery = `
          SELECT
            COUNT(*) FILTER (WHERE stock.balance = 0) as out_of_stock,
            COUNT(*) FILTER (WHERE stock.balance > 0 AND stock.balance < 20) as low_stock,
            COUNT(*) FILTER (WHERE stock.balance >= 20) as in_stock,
            COALESCE(SUM(stock.balance), 0) as total_stock_units
          FROM product p
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          WHERE p.active = true AND p.archive = false
        `;
        const stock = await this.dataSource.query(stockQuery);

        // Pricing metrics
        const pricingQuery = `
          SELECT
            COALESCE(AVG(price.margin), 0) as avg_margin,
            COALESCE(SUM(price.price * stock.balance), 0) as total_inventory_value,
            COUNT(*) FILTER (WHERE price.margin >= 20) as high_margin_count,
            COUNT(*) FILTER (WHERE price.margin < 10) as low_margin_count
          FROM product p
          LEFT JOIN price_view price ON price.id = p.id
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          WHERE p.active = true AND p.archive = false
        `;
        const pricing = await this.dataSource.query(pricingQuery);

        // Products by category
        const categoryQuery = `
          SELECT
            category,
            COUNT(*) as count
          FROM product
          WHERE active = true AND archive = false
          GROUP BY category
          ORDER BY count DESC
          LIMIT 10
        `;
        const byCategory = await this.dataSource.query(categoryQuery);

        // Stock status distribution
        const stockDistribution = {
          outOfStock: parseInt(stock[0].out_of_stock) || 0,
          lowStock: parseInt(stock[0].low_stock) || 0,
          inStock: parseInt(stock[0].in_stock) || 0
        };

        // Low stock alerts (products with stock < 20)
        const lowStockAlertsQuery = `
          SELECT
            p.id,
            p.title,
            p.pack,
            p.category,
            COALESCE(stock.balance, 0) as current_stock,
            COALESCE(price.price, 0) as sale_price,
            stock.last_sale_date
          FROM product p
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          LEFT JOIN price_view price ON price.id = p.id
          WHERE p.active = true
            AND p.archive = false
            AND COALESCE(stock.balance, 0) > 0
            AND COALESCE(stock.balance, 0) < 20
          ORDER BY stock.balance ASC
          LIMIT 10
        `;
        const lowStockAlerts = await this.dataSource.query(lowStockAlertsQuery);

        // Out of stock products
        const outOfStockQuery = `
          SELECT
            p.id,
            p.title,
            p.pack,
            p.category,
            stock.last_sale_date
          FROM product p
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          WHERE p.active = true
            AND p.archive = false
            AND COALESCE(stock.balance, 0) = 0
          ORDER BY p.updated_on DESC
          LIMIT 10
        `;
        const outOfStock = await this.dataSource.query(outOfStockQuery);

        // Top products by margin
        const topMarginQuery = `
          SELECT
            p.id,
            p.title,
            p.pack,
            p.category,
            price.margin,
            price.price as sale_price,
            COALESCE(stock.balance, 0) as current_stock
          FROM product p
          LEFT JOIN price_view price ON price.id = p.id
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          WHERE p.active = true
            AND p.archive = false
            AND price.margin IS NOT NULL
          ORDER BY price.margin DESC
          LIMIT 10
        `;
        const topByMargin = await this.dataSource.query(topMarginQuery);

        // Low margin products
        const lowMarginQuery = `
          SELECT
            p.id,
            p.title,
            p.pack,
            p.category,
            price.margin,
            price.price as sale_price,
            COALESCE(stock.balance, 0) as current_stock
          FROM product p
          LEFT JOIN price_view price ON price.id = p.id
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          WHERE p.active = true
            AND p.archive = false
            AND price.margin IS NOT NULL
            AND price.margin < 10
          ORDER BY price.margin ASC
          LIMIT 10
        `;
        const lowMargin = await this.dataSource.query(lowMarginQuery);

        // Recently added products
        const recentQuery = `
          SELECT
            p.id,
            p.title,
            p.pack,
            p.category,
            p.created_on,
            COALESCE(price.price, 0) as sale_price,
            COALESCE(price.margin, 0) as margin,
            COALESCE(stock.balance, 0) as current_stock
          FROM product p
          LEFT JOIN price_view price ON price.id = p.id
          LEFT JOIN product_items_agg_view stock ON stock.id = p.id
          WHERE p.active = true AND p.archive = false
          ORDER BY p.created_on DESC
          LIMIT 10
        `;
        const recentProducts = await this.dataSource.query(recentQuery);

        return {
          overview: {
            totalActive: parseInt(overview[0].total_active) || 0,
            totalInactive: parseInt(overview[0].total_inactive) || 0,
            totalArchived: parseInt(overview[0].total_archived) || 0,
            totalCategories: parseInt(overview[0].total_categories) || 0,
            totalStockUnits: parseInt(stock[0].total_stock_units) || 0,
            avgMargin: parseFloat(pricing[0].avg_margin) || 0,
            totalInventoryValue: parseFloat(pricing[0].total_inventory_value) || 0,
            highMarginCount: parseInt(pricing[0].high_margin_count) || 0,
            lowMarginCount: parseInt(pricing[0].low_margin_count) || 0
          },
          stockDistribution,
          byCategory,
          alerts: {
            lowStock: lowStockAlerts,
            outOfStock: outOfStock
          },
          topProducts: {
            byMargin: topByMargin,
            lowMargin: lowMargin
          },
          recentProducts
        };
      } catch (error) {
        this.logger.error('Error getting dashboard metrics:', error.stack);
        throw error;
      }
    }

}
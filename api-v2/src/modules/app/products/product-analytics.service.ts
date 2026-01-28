import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from 'src/entities/product.entity';
import { ProductPrice2 } from 'src/entities/product-price2.entity';
import { ProductBatch } from 'src/entities/product-batch.entity';
import { SaleItem } from 'src/entities/sale-item.entity';
import {
  ProductAnalyticsDto,
  ProductSummaryDto,
  TopProductDto,
  CategoryPerformanceDto,
  StockStatusDto,
  MarginDistributionDto,
  LowStockAlertDto,
  PriceChangeDto,
} from './dto/product-analytics.dto';

@Injectable()
export class ProductAnalyticsService {
  private readonly logger = new Logger(ProductAnalyticsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductPrice2)
    private readonly priceRepository: Repository<ProductPrice2>,
    @InjectRepository(ProductBatch)
    private readonly batchRepository: Repository<ProductBatch>,
    @InjectRepository(SaleItem)
    private readonly saleItemRepository: Repository<SaleItem>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Main orchestrator - Gets all analytics data in parallel
   */
  async getAnalytics(): Promise<ProductAnalyticsDto> {
    this.logger.log('Fetching product analytics...');

    try {
      const [
        summary,
        topProducts,
        categoryPerformance,
        stockStatus,
        marginDistribution,
        lowStockAlerts,
        recentPriceChanges,
      ] = await Promise.all([
        this.getSummary(),
        this.getTopProducts(),
        this.getCategoryPerformance(),
        this.getStockStatus(),
        this.getMarginDistribution(),
        this.getLowStockAlerts(),
        this.getRecentPriceChanges(),
      ]);

      return {
        summary,
        topProducts,
        categoryPerformance,
        stockStatus,
        marginDistribution,
        lowStockAlerts,
        recentPriceChanges,
      };
    } catch (error) {
      this.logger.error('Error fetching product analytics:', error.stack);
      throw error;
    }
  }

  /**
   * Get summary metrics
   */
  private async getSummary(): Promise<ProductSummaryDto> {
    // Total active products
    const totalActiveProducts = await this.productRepository.count({
      where: { isActive: true, isArchived: false },
    });

    // Total stock value (at PTR cost)
    const stockValueResult = await this.dataSource.query(`
      SELECT COALESCE(SUM(quantity_remaining * ptr_cost), 0) as total_stock_value
      FROM product_batch
      WHERE status = 'ACTIVE'
    `);
    const totalStockValue = parseFloat(stockValueResult[0]?.total_stock_value || 0);

    // Average margin from product_price2
    const marginResult = await this.dataSource.query(`
      SELECT COALESCE(AVG(margin_pcnt), 0) as avg_margin
      FROM product_price2
      WHERE active = true
    `);
    const averageMargin = parseFloat(marginResult[0]?.avg_margin || 0);

    // Low stock count (products with stock below 7 days of average sales)
    const lowStockResult = await this.dataSource.query(`
      SELECT COUNT(DISTINCT p.id) as low_stock_count
      FROM product p
      LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
      LEFT JOIN product_sale_agg_view psav ON psav.product_id = p.id
      WHERE p.active = true
      GROUP BY p.id, psav.avg_sales_qty
      HAVING COALESCE(SUM(pb.quantity_remaining), 0) < COALESCE(psav.avg_sales_qty * 7, 0)
        AND COALESCE(psav.avg_sales_qty, 0) > 0
    `);
    const lowStockCount = lowStockResult.length;

    // Out of stock count
    const outOfStockResult = await this.dataSource.query(`
      SELECT COUNT(DISTINCT p.id) as out_of_stock_count
      FROM product p
      LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
      WHERE p.active = true
      GROUP BY p.id
      HAVING COALESCE(SUM(pb.quantity_remaining), 0) = 0
    `);
    const outOfStockCount = outOfStockResult.length;

    // Category count
    const categoryResult = await this.dataSource.query(`
      SELECT COUNT(DISTINCT category) as category_count
      FROM product
      WHERE active = true AND category IS NOT NULL
    `);
    const categoryCount = parseInt(categoryResult[0]?.category_count || 0);

    // Near-expiry count (within 90 days)
    const nearExpiryCount = await this.batchRepository.count({
      where: {
        status: 'ACTIVE',
      },
    });

    // Dead stock count (no sales in 90 days with stock > 0)
    const deadStockResult = await this.dataSource.query(`
      SELECT COUNT(DISTINCT p.id) as dead_stock_count
      FROM product p
      LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
      LEFT JOIN sale_item si ON si.product_id = p.id
        AND si.sale_id IN (SELECT id FROM sale WHERE bill_dt >= CURRENT_DATE - INTERVAL '90 days')
      WHERE p.active = true
      GROUP BY p.id
      HAVING COALESCE(SUM(pb.quantity_remaining), 0) > 0
        AND COUNT(si.id) = 0
    `);
    const deadStockCount = deadStockResult.length;

    return {
      totalActiveProducts,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      averageMargin: Math.round(averageMargin * 100) / 100,
      lowStockCount,
      outOfStockCount,
      categoryCount,
      nearExpiryCount,
      deadStockCount,
    };
  }

  /**
   * Get top 10 products by revenue (last 30 days)
   */
  private async getTopProducts(): Promise<TopProductDto[]> {
    const results = await this.dataSource.query(`
      SELECT
        p.id as product_id,
        p.title as product_title,
        p.category,
        COALESCE(SUM(si.qty * si.price), 0) as total_revenue,
        COALESCE(SUM(si.qty), 0) as qty_sold,
        COALESCE(AVG(si.price), 0) as average_price,
        COALESCE(AVG(CASE
          WHEN si.ptr_cost > 0
          THEN ((si.price - si.ptr_cost) / si.ptr_cost * 100)
          ELSE 0
        END), 0) as margin_percentage
      FROM sale_item si
      JOIN product p ON p.id = si.product_id
      JOIN sale s ON s.id = si.sale_id
      WHERE s.bill_dt >= CURRENT_DATE - INTERVAL '30 days'
        AND s.active = true
        AND p.active = true
      GROUP BY p.id, p.title, p.category
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    return results.map((row) => ({
      productId: parseInt(row.product_id),
      productTitle: row.product_title,
      category: row.category || 'Uncategorized',
      totalRevenue: parseFloat(row.total_revenue),
      qtySold: parseFloat(row.qty_sold),
      averagePrice: parseFloat(row.average_price),
      marginPercentage: parseFloat(row.margin_percentage),
    }));
  }

  /**
   * Get category performance analysis
   */
  private async getCategoryPerformance(): Promise<CategoryPerformanceDto[]> {
    const results = await this.dataSource.query(`
      SELECT
        COALESCE(p.category, 'Uncategorized') as category,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(si.qty * si.price), 0) as total_revenue,
        COALESCE(SUM(pb.quantity_remaining * pb.ptr_cost), 0) as stock_value,
        COALESCE(AVG(pp.margin_pcnt), 0) as average_margin
      FROM product p
      LEFT JOIN sale_item si ON si.product_id = p.id
        AND si.sale_id IN (SELECT id FROM sale WHERE bill_dt >= CURRENT_DATE - INTERVAL '30 days' AND active = true)
      LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
      LEFT JOIN product_price2 pp ON pp.product_id = p.id AND pp.active = true
      WHERE p.active = true
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `);

    const totalRevenue = results.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0);

    return results.map((row) => ({
      category: row.category,
      productCount: parseInt(row.product_count),
      totalRevenue: parseFloat(row.total_revenue),
      stockValue: parseFloat(row.stock_value),
      averageMargin: parseFloat(row.average_margin),
      revenuePercentage: totalRevenue > 0 ? (parseFloat(row.total_revenue) / totalRevenue) * 100 : 0,
    }));
  }

  /**
   * Get stock status distribution
   */
  private async getStockStatus(): Promise<StockStatusDto[]> {
    const results = await this.dataSource.query(`
      WITH stock_levels AS (
        SELECT
          p.id,
          COALESCE(SUM(pb.quantity_remaining), 0) as current_stock,
          COALESCE(SUM(pb.quantity_remaining * pb.ptr_cost), 0) as stock_value,
          COALESCE(psav.avg_sales_qty * 7, 0) as reorder_level
        FROM product p
        LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
        LEFT JOIN product_sale_agg_view psav ON psav.product_id = p.id
        WHERE p.active = true
        GROUP BY p.id, psav.avg_sales_qty
      )
      SELECT
        CASE
          WHEN current_stock = 0 THEN 'Out of Stock'
          WHEN current_stock < reorder_level AND reorder_level > 0 THEN 'Low Stock'
          ELSE 'In Stock'
        END as status,
        COUNT(*) as count,
        COALESCE(SUM(stock_value), 0) as value
      FROM stock_levels
      GROUP BY status
      ORDER BY
        CASE status
          WHEN 'Out of Stock' THEN 1
          WHEN 'Low Stock' THEN 2
          WHEN 'In Stock' THEN 3
        END
    `);

    const totalCount = results.reduce((sum, row) => sum + parseInt(row.count), 0);

    return results.map((row) => ({
      status: row.status,
      count: parseInt(row.count),
      value: parseFloat(row.value),
      percentage: totalCount > 0 ? (parseInt(row.count) / totalCount) * 100 : 0,
    }));
  }

  /**
   * Get margin distribution by category
   */
  private async getMarginDistribution(): Promise<MarginDistributionDto[]> {
    const results = await this.dataSource.query(`
      SELECT
        COALESCE(p.category, 'Uncategorized') as category,
        COALESCE(MIN(pp.margin_pcnt), 0) as min_margin,
        COALESCE(AVG(pp.margin_pcnt), 0) as avg_margin,
        COALESCE(MAX(pp.margin_pcnt), 0) as max_margin,
        COUNT(DISTINCT p.id) as product_count
      FROM product p
      JOIN product_price2 pp ON pp.product_id = p.id AND pp.active = true
      WHERE p.active = true
      GROUP BY p.category
      ORDER BY avg_margin DESC
    `);

    return results.map((row) => ({
      category: row.category,
      minMargin: parseFloat(row.min_margin),
      avgMargin: parseFloat(row.avg_margin),
      maxMargin: parseFloat(row.max_margin),
      productCount: parseInt(row.product_count),
    }));
  }

  /**
   * Get low stock alerts
   */
  private async getLowStockAlerts(): Promise<LowStockAlertDto[]> {
    const results = await this.dataSource.query(`
      SELECT
        p.id as product_id,
        p.title as product_title,
        COALESCE(p.category, 'Uncategorized') as category,
        COALESCE(SUM(pb.quantity_remaining), 0) as current_stock,
        COALESCE(psav.avg_sales_qty * 7, 0) as reorder_level,
        COALESCE(psav.avg_sales_qty, 0) as avg_monthly_sales,
        CASE
          WHEN psav.avg_sales_qty > 0
          THEN FLOOR(COALESCE(SUM(pb.quantity_remaining), 0) / (psav.avg_sales_qty / 30))
          ELSE 999
        END as days_until_stockout
      FROM product p
      LEFT JOIN product_batch pb ON pb.product_id = p.id AND pb.status = 'ACTIVE'
      LEFT JOIN product_sale_agg_view psav ON psav.product_id = p.id
      WHERE p.active = true
      GROUP BY p.id, p.title, p.category, psav.avg_sales_qty
      HAVING COALESCE(SUM(pb.quantity_remaining), 0) < COALESCE(psav.avg_sales_qty * 7, 0)
        AND COALESCE(psav.avg_sales_qty, 0) > 0
      ORDER BY days_until_stockout ASC
      LIMIT 20
    `);

    return results.map((row) => ({
      productId: parseInt(row.product_id),
      productTitle: row.product_title,
      category: row.category,
      currentStock: parseFloat(row.current_stock),
      reorderLevel: parseFloat(row.reorder_level),
      avgMonthlySales: parseFloat(row.avg_monthly_sales),
      daysUntilStockOut: parseInt(row.days_until_stockout),
    }));
  }

  /**
   * Get recent price changes (last 30 days)
   */
  private async getRecentPriceChanges(): Promise<PriceChangeDto[]> {
    const results = await this.dataSource.query(`
      SELECT
        p.id as product_id,
        p.title as product_title,
        pp.base_price as old_price,
        pp.sale_price as new_price,
        CASE
          WHEN pp.base_price > 0
          THEN ((pp.sale_price - pp.base_price) / pp.base_price * 100)
          ELSE 0
        END as change_percentage,
        pp.eff_date as effective_date,
        COALESCE(pp.reason, 'No reason specified') as reason
      FROM product_price2 pp
      JOIN product p ON p.id = pp.product_id
      WHERE pp.eff_date >= CURRENT_DATE - INTERVAL '30 days'
        AND pp.active = true
        AND p.active = true
      ORDER BY pp.eff_date DESC
      LIMIT 20
    `);

    return results.map((row) => ({
      productId: parseInt(row.product_id),
      productTitle: row.product_title,
      oldPrice: parseFloat(row.old_price),
      newPrice: parseFloat(row.new_price),
      changePercentage: parseFloat(row.change_percentage),
      effectiveDate: row.effective_date,
      reason: row.reason,
    }));
  }
}

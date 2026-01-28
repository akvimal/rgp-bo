import { ApiProperty } from '@nestjs/swagger';

export class ProductSummaryDto {
  @ApiProperty({ description: 'Total number of active products' })
  totalActiveProducts: number;

  @ApiProperty({ description: 'Total stock value (at cost)' })
  totalStockValue: number;

  @ApiProperty({ description: 'Average margin percentage' })
  averageMargin: number;

  @ApiProperty({ description: 'Number of low stock items' })
  lowStockCount: number;

  @ApiProperty({ description: 'Number of out of stock items' })
  outOfStockCount: number;

  @ApiProperty({ description: 'Total number of categories' })
  categoryCount: number;

  @ApiProperty({ description: 'Near-expiry products count (within 90 days)' })
  nearExpiryCount: number;

  @ApiProperty({ description: 'Dead stock count (no sales in 90 days)' })
  deadStockCount: number;
}

export class TopProductDto {
  @ApiProperty({ description: 'Product ID' })
  productId: number;

  @ApiProperty({ description: 'Product title' })
  productTitle: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiProperty({ description: 'Total revenue' })
  totalRevenue: number;

  @ApiProperty({ description: 'Quantity sold' })
  qtySold: number;

  @ApiProperty({ description: 'Average price' })
  averagePrice: number;

  @ApiProperty({ description: 'Margin percentage' })
  marginPercentage: number;
}

export class CategoryPerformanceDto {
  @ApiProperty({ description: 'Category name' })
  category: string;

  @ApiProperty({ description: 'Product count' })
  productCount: number;

  @ApiProperty({ description: 'Total revenue' })
  totalRevenue: number;

  @ApiProperty({ description: 'Total stock value' })
  stockValue: number;

  @ApiProperty({ description: 'Average margin percentage' })
  averageMargin: number;

  @ApiProperty({ description: 'Percentage of total revenue' })
  revenuePercentage: number;
}

export class StockStatusDto {
  @ApiProperty({ description: 'Status label' })
  status: string;

  @ApiProperty({ description: 'Product count' })
  count: number;

  @ApiProperty({ description: 'Stock value' })
  value: number;

  @ApiProperty({ description: 'Percentage of total products' })
  percentage: number;
}

export class MarginDistributionDto {
  @ApiProperty({ description: 'Category name' })
  category: string;

  @ApiProperty({ description: 'Minimum margin percentage' })
  minMargin: number;

  @ApiProperty({ description: 'Average margin percentage' })
  avgMargin: number;

  @ApiProperty({ description: 'Maximum margin percentage' })
  maxMargin: number;

  @ApiProperty({ description: 'Product count' })
  productCount: number;
}

export class LowStockAlertDto {
  @ApiProperty({ description: 'Product ID' })
  productId: number;

  @ApiProperty({ description: 'Product title' })
  productTitle: string;

  @ApiProperty({ description: 'Category' })
  category: string;

  @ApiProperty({ description: 'Current stock quantity' })
  currentStock: number;

  @ApiProperty({ description: 'Reorder level' })
  reorderLevel: number;

  @ApiProperty({ description: 'Average monthly sales' })
  avgMonthlySales: number;

  @ApiProperty({ description: 'Days until stock out' })
  daysUntilStockOut: number;
}

export class PriceChangeDto {
  @ApiProperty({ description: 'Product ID' })
  productId: number;

  @ApiProperty({ description: 'Product title' })
  productTitle: string;

  @ApiProperty({ description: 'Old price' })
  oldPrice: number;

  @ApiProperty({ description: 'New price' })
  newPrice: number;

  @ApiProperty({ description: 'Change percentage' })
  changePercentage: number;

  @ApiProperty({ description: 'Effective date' })
  effectiveDate: string;

  @ApiProperty({ description: 'Reason for change' })
  reason: string;
}

export class ProductAnalyticsDto {
  @ApiProperty({ description: 'Summary metrics', type: ProductSummaryDto })
  summary: ProductSummaryDto;

  @ApiProperty({
    description: 'Top 10 products by revenue (last 30 days)',
    type: [TopProductDto],
  })
  topProducts: TopProductDto[];

  @ApiProperty({
    description: 'Category performance analysis',
    type: [CategoryPerformanceDto],
  })
  categoryPerformance: CategoryPerformanceDto[];

  @ApiProperty({
    description: 'Stock status distribution',
    type: [StockStatusDto],
  })
  stockStatus: StockStatusDto[];

  @ApiProperty({
    description: 'Margin distribution by category',
    type: [MarginDistributionDto],
  })
  marginDistribution: MarginDistributionDto[];

  @ApiProperty({
    description: 'Low stock alerts',
    type: [LowStockAlertDto],
  })
  lowStockAlerts: LowStockAlertDto[];

  @ApiProperty({
    description: 'Recent price changes (last 30 days)',
    type: [PriceChangeDto],
  })
  recentPriceChanges: PriceChangeDto[];
}

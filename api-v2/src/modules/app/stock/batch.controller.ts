import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { BatchAllocationService } from './batch-allocation.service';
import { RecallBatchDto } from './dto/batch.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductBatch } from 'src/entities/product-batch.entity';

/**
 * Batch Management Controller
 * Provides endpoints for batch traceability, near-expiry monitoring, and batch lifecycle management
 * Issue #127 - Batch/Expiry Tracking with FEFO Enforcement
 */
@ApiTags('Batch Management')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('batch')
export class BatchController {
  private readonly logger = new Logger(BatchController.name);

  constructor(
    private readonly batchAllocationService: BatchAllocationService,
    @InjectRepository(ProductBatch)
    private readonly batchRepository: Repository<ProductBatch>,
    private readonly dataSource: DataSource
  ) {}

  /**
   * GET /batch/:id/traceability
   * Get complete supplier-to-customer traceability chain for a batch
   */
  @Get(':id/traceability')
  @ApiOperation({ summary: 'Get complete batch traceability from supplier to customer' })
  @ApiResponse({
    status: 200,
    description: 'Batch traceability information retrieved successfully',
    schema: {
      example: {
        batch: {
          id: 123,
          batchNumber: 'LOT2024-001',
          expiryDate: '2025-12-31',
          product: {
            id: 456,
            title: 'Paracetamol 500mg',
            category: 'Tablet'
          }
        },
        supplier: {
          vendor: { id: 1, name: 'ABC Pharma' },
          purchaseInvoice: { id: 789, invoiceNo: 'PI-001' },
          receivedDate: '2024-01-15'
        },
        movements: [
          {
            type: 'RECEIVED',
            quantity: 1000,
            date: '2024-01-15',
            user: 'admin',
            notes: 'Initial receipt'
          },
          {
            type: 'SOLD',
            quantity: 50,
            date: '2024-02-01',
            user: 'sales_user',
            notes: 'FEFO allocation'
          }
        ],
        sales: [
          {
            sale_id: 100,
            billno: 'BILL-001',
            sale_date: '2024-02-01',
            customer_name: 'John Doe',
            quantity: 50
          }
        ],
        currentStatus: {
          quantityReceived: 1000,
          quantityRemaining: 950,
          status: 'ACTIVE'
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatchTraceability(@Param('id', ParseIntPipe) batchId: number) {
    try {
      return await this.batchAllocationService.getBatchTraceability(batchId);
    } catch (error) {
      this.logger.error(`Error fetching traceability for batch ${batchId}:`, error.stack);

      if (error.message.includes('not found')) {
        throw new HttpException(
          `Batch ${batchId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      throw new HttpException(
        'Failed to retrieve batch traceability',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /batch/near-expiry/:threshold
   * Get products/batches expiring within specified days threshold (30/60/90)
   */
  @Get('near-expiry/:threshold')
  @ApiOperation({ summary: 'Get batches expiring within specified days (30/60/90)' })
  @ApiResponse({
    status: 200,
    description: 'Near-expiry batches retrieved successfully',
    schema: {
      example: [
        {
          product_id: 456,
          title: 'Paracetamol 500mg',
          category: 'Tablet',
          batch_id: 123,
          batch_number: 'LOT2024-001',
          expiry_date: '2024-03-15',
          quantity_remaining: 100,
          ptr_cost: 50.00,
          value_at_risk: 5000.00,
          days_to_expiry: 25,
          vendor_name: 'ABC Pharma'
        }
      ]
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid threshold value' })
  async getNearExpiryBatches(@Param('threshold', ParseIntPipe) daysThreshold: number) {
    try {
      // Validate threshold
      if (daysThreshold <= 0 || daysThreshold > 365) {
        throw new HttpException(
          'Threshold must be between 1 and 365 days',
          HttpStatus.BAD_REQUEST
        );
      }

      const batches = await this.batchAllocationService.getNearExpiryProducts(daysThreshold);

      return {
        threshold: daysThreshold,
        count: batches.length,
        totalValueAtRisk: batches.reduce((sum, b) => sum + parseFloat(b.value_at_risk || 0), 0),
        batches
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error fetching near-expiry batches:`, error.stack);
      throw new HttpException(
        'Failed to retrieve near-expiry batches',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /batch/product/:productId
   * Get all batches for a specific product
   */
  @Get('product/:productId')
  @ApiOperation({ summary: 'Get all batches for a specific product' })
  @ApiResponse({
    status: 200,
    description: 'Product batches retrieved successfully',
    schema: {
      example: {
        productId: 456,
        productTitle: 'Paracetamol 500mg',
        totalBatches: 3,
        totalQuantity: 2500,
        batches: [
          {
            id: 123,
            batchNumber: 'LOT2024-001',
            expiryDate: '2024-06-30',
            quantityReceived: 1000,
            quantityRemaining: 500,
            status: 'ACTIVE',
            receivedDate: '2024-01-15',
            vendorName: 'ABC Pharma',
            daysToExpiry: 45
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProductBatches(@Param('productId', ParseIntPipe) productId: number) {
    try {
      const batches = await this.dataSource.query(
        `SELECT
          pb.id,
          pb.batch_number,
          pb.expiry_date,
          pb.manufactured_date,
          pb.quantity_received,
          pb.quantity_remaining,
          pb.ptr_cost,
          pb.status,
          pb.received_date,
          pb.created_on,
          v.name AS vendor_name,
          p.title AS product_title,
          (pb.expiry_date - CURRENT_DATE) AS days_to_expiry,
          CASE
            WHEN pb.expiry_date <= CURRENT_DATE THEN 'EXPIRED'
            WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'CRITICAL'
            WHEN pb.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'WARNING'
            ELSE 'NORMAL'
          END AS expiry_status
         FROM product_batch pb
         INNER JOIN product p ON pb.product_id = p.id
         LEFT JOIN vendor v ON pb.vendor_id = v.id
         WHERE pb.product_id = $1
           AND pb.active = true
         ORDER BY pb.expiry_date ASC, pb.created_on ASC`,
        [productId]
      );

      if (batches.length === 0) {
        return {
          productId,
          productTitle: null,
          totalBatches: 0,
          totalQuantity: 0,
          batches: []
        };
      }

      const totalQuantity = batches.reduce((sum, b) => sum + parseInt(b.quantity_remaining || 0), 0);

      return {
        productId,
        productTitle: batches[0].product_title,
        totalBatches: batches.length,
        totalQuantity,
        batches
      };
    } catch (error) {
      this.logger.error(`Error fetching batches for product ${productId}:`, error.stack);
      throw new HttpException(
        'Failed to retrieve product batches',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * POST /batch/:id/recall
   * Mark a batch as recalled (quality/safety issue)
   */
  @Post(':id/recall')
  @ApiOperation({ summary: 'Mark batch as recalled due to quality/safety issue' })
  @ApiResponse({ status: 200, description: 'Batch recalled successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({ status: 400, description: 'Batch already recalled or depleted' })
  async recallBatch(
    @Param('id', ParseIntPipe) batchId: number,
    @Body() recallDto: RecallBatchDto,
    @User() currentUser: any
  ) {
    try {
      return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
        // Get batch
        const batch = await manager.findOne(ProductBatch, {
          where: { id: batchId }
        });

        if (!batch) {
          throw new HttpException(
            `Batch ${batchId} not found`,
            HttpStatus.NOT_FOUND
          );
        }

        if (batch.status === 'RECALLED') {
          throw new HttpException(
            'Batch is already recalled',
            HttpStatus.BAD_REQUEST
          );
        }

        // Update batch status
        await manager.query(
          `UPDATE product_batch
           SET status = 'RECALLED',
               updated_on = CURRENT_TIMESTAMP,
               updated_by = $1
           WHERE id = $2`,
          [currentUser.id, batchId]
        );

        // Log recall movement
        await this.batchAllocationService.logBatchMovement(
          batchId,
          'RECALLED',
          batch.quantityRemaining,
          'BATCH_RECALL',
          batchId,
          currentUser.id,
          `Batch recalled: ${recallDto.reason}. ${recallDto.notes || ''}`,
          manager
        );

        this.logger.warn(
          `Batch ${batchId} (${batch.batchNumber}) recalled by user ${currentUser.id}. Reason: ${recallDto.reason}`
        );

        return {
          message: 'Batch recalled successfully',
          batchId,
          batchNumber: batch.batchNumber,
          quantityRecalled: batch.quantityRemaining,
          reason: recallDto.reason
        };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error recalling batch ${batchId}:`, error.stack);
      throw new HttpException(
        'Failed to recall batch',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /batch/inventory-summary
   * Get batch inventory summary view
   */
  @Get('inventory-summary')
  @ApiOperation({ summary: 'Get comprehensive batch inventory summary' })
  @ApiResponse({
    status: 200,
    description: 'Batch inventory summary retrieved successfully',
    schema: {
      example: {
        totalBatches: 150,
        activeBatches: 120,
        expiredBatches: 10,
        depletedBatches: 15,
        recalledBatches: 5,
        nearExpiryBatches: {
          critical_30_days: 8,
          warning_60_days: 15,
          caution_90_days: 25
        },
        totalValueAtRisk: 125000.00,
        batchesByStatus: [
          { status: 'ACTIVE', count: 120, total_value: 500000.00 },
          { status: 'EXPIRED', count: 10, total_value: 25000.00 },
          { status: 'DEPLETED', count: 15, total_value: 0 },
          { status: 'RECALLED', count: 5, total_value: 10000.00 }
        ]
      }
    }
  })
  async getInventorySummary() {
    try {
      const [summary, statusBreakdown, nearExpiry] = await Promise.all([
        // Overall summary
        this.dataSource.query(`
          SELECT
            COUNT(*) AS total_batches,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active_batches,
            COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) AS expired_batches,
            COUNT(CASE WHEN status = 'DEPLETED' THEN 1 END) AS depleted_batches,
            COUNT(CASE WHEN status = 'RECALLED' THEN 1 END) AS recalled_batches,
            COALESCE(SUM(quantity_remaining * COALESCE(ptr_cost, 0)), 0) AS total_inventory_value
          FROM product_batch
          WHERE active = true
        `),

        // Status breakdown
        this.dataSource.query(`
          SELECT
            status,
            COUNT(*) AS count,
            COALESCE(SUM(quantity_remaining), 0) AS total_quantity,
            COALESCE(SUM(quantity_remaining * COALESCE(ptr_cost, 0)), 0) AS total_value
          FROM product_batch
          WHERE active = true
          GROUP BY status
          ORDER BY status
        `),

        // Near expiry counts
        this.dataSource.query(`
          SELECT
            COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
                  AND status = 'ACTIVE' THEN 1 END) AS critical_30_days,
            COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
                  AND status = 'ACTIVE' THEN 1 END) AS warning_60_days,
            COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
                  AND status = 'ACTIVE' THEN 1 END) AS caution_90_days,
            COALESCE(SUM(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
                  AND status = 'ACTIVE' THEN quantity_remaining * COALESCE(ptr_cost, 0) END), 0) AS total_value_at_risk
          FROM product_batch
          WHERE active = true
        `)
      ]);

      return {
        ...summary[0],
        nearExpiryBatches: nearExpiry[0],
        totalValueAtRisk: parseFloat(nearExpiry[0].total_value_at_risk || 0),
        batchesByStatus: statusBreakdown
      };
    } catch (error) {
      this.logger.error('Error fetching inventory summary:', error.stack);
      throw new HttpException(
        'Failed to retrieve inventory summary',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /batch/:id
   * Get detailed information about a specific batch
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get detailed batch information' })
  @ApiResponse({ status: 200, description: 'Batch details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatchDetails(@Param('id', ParseIntPipe) batchId: number) {
    try {
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
        relations: ['product', 'vendor', 'purchaseInvoiceItem']
      });

      if (!batch) {
        throw new HttpException(
          `Batch ${batchId} not found`,
          HttpStatus.NOT_FOUND
        );
      }

      // Get movement count
      const movementCount = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM batch_movement_log WHERE batch_id = $1`,
        [batchId]
      );

      return {
        ...batch,
        movementCount: parseInt(movementCount[0].count),
        daysToExpiry: batch.expiryDate
          ? Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(`Error fetching batch ${batchId}:`, error.stack);
      throw new HttpException(
        'Failed to retrieve batch details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

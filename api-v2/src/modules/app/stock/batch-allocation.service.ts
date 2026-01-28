import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { ProductBatch } from "src/entities/product-batch.entity";
import { BatchMovementLog } from "src/entities/batch-movement-log.entity";

/**
 * Batch Allocation Result
 */
export interface BatchAllocation {
  batchId: number;
  batchNumber: string;
  expiryDate: Date;
  quantity: number;
}

/**
 * Batch Allocation Service
 * Implements First-Expiry-First-Out (FEFO) logic for batch allocation
 * Issue #127 - Batch/Expiry Tracking with FEFO Enforcement
 */
@Injectable()
export class BatchAllocationService {
  private readonly logger = new Logger(BatchAllocationService.name);

  constructor(
    @InjectRepository(ProductBatch) private readonly batchRepository: Repository<ProductBatch>,
    @InjectRepository(BatchMovementLog) private readonly movementLogRepository: Repository<BatchMovementLog>,
    private dataSource: DataSource
  ) {}

  /**
   * Allocate quantity using First-Expiry-First-Out (FEFO) logic
   * Automatically selects batches expiring soonest first
   *
   * @param productId - Product ID to allocate
   * @param requestedQty - Quantity to allocate
   * @param transactionManager - Optional transaction manager
   * @returns Array of batch allocations
   * @throws Error if insufficient stock or only expired batches available
   */
  async allocateBatches(
    productId: number,
    requestedQty: number,
    transactionManager?: EntityManager
  ): Promise<BatchAllocation[]> {
    const manager = transactionManager || this.dataSource.manager;

    // Get available batches ordered by expiry date (FEFO)
    // Use SELECT FOR UPDATE to lock rows during allocation
    const batches = await manager.query(
      `SELECT id, batch_number, expiry_date, quantity_remaining
       FROM product_batch
       WHERE product_id = $1
         AND status = 'ACTIVE'
         AND expiry_date > CURRENT_DATE
         AND quantity_remaining > 0
         AND active = true
       ORDER BY expiry_date ASC, created_on ASC
       FOR UPDATE`,
      [productId]
    );

    if (batches.length === 0) {
      // Check if there are only expired batches
      const expiredCheck = await manager.query(
        `SELECT COUNT(*) as count
         FROM product_batch
         WHERE product_id = $1
           AND status = 'ACTIVE'
           AND quantity_remaining > 0
           AND active = true`,
        [productId]
      );

      if (expiredCheck[0].count > 0) {
        throw new Error(
          `Cannot allocate stock: All available batches for product ${productId} are expired`
        );
      }

      throw new Error(`No available batches for product ${productId}`);
    }

    const allocations: BatchAllocation[] = [];
    let remainingQty = requestedQty;

    for (const batch of batches) {
      if (remainingQty <= 0) break;

      const allocateQty = Math.min(batch.quantity_remaining, remainingQty);

      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        expiryDate: batch.expiry_date,
        quantity: allocateQty
      });

      remainingQty -= allocateQty;
    }

    if (remainingQty > 0) {
      const availableQty = requestedQty - remainingQty;
      throw new Error(
        `Insufficient stock for product ${productId}. ` +
        `Requested: ${requestedQty}, Available: ${availableQty}`
      );
    }

    this.logger.log(
      `Allocated ${requestedQty} units for product ${productId} across ${allocations.length} batch(es) using FEFO`
    );

    return allocations;
  }

  /**
   * Deduct allocated quantities from batches and create movement logs
   *
   * @param allocations - Batch allocations to deduct
   * @param referenceType - Type of transaction (SALE, STOCK_ADJUSTMENT, etc.)
   * @param referenceId - Transaction ID
   * @param userId - User performing the action
   * @param transactionManager - Transaction manager
   */
  async deductAllocatedBatches(
    allocations: BatchAllocation[],
    referenceType: string,
    referenceId: number,
    userId: number,
    transactionManager: EntityManager
  ): Promise<void> {
    for (const allocation of allocations) {
      // Deduct quantity from batch
      await transactionManager.query(
        `UPDATE product_batch
         SET quantity_remaining = quantity_remaining - $1,
             status = CASE
               WHEN quantity_remaining - $1 = 0 THEN 'DEPLETED'
               ELSE status
             END,
             updated_on = CURRENT_TIMESTAMP,
             updated_by = $2
         WHERE id = $3`,
        [allocation.quantity, userId, allocation.batchId]
      );

      // Log movement
      await this.logBatchMovement(
        allocation.batchId,
        'SOLD',
        allocation.quantity,
        referenceType,
        referenceId,
        userId,
        `FEFO allocation: Batch ${allocation.batchNumber}, Expiry: ${allocation.expiryDate}`,
        transactionManager
      );
    }

    this.logger.log(
      `Deducted ${allocations.length} batch allocation(s) for ${referenceType} #${referenceId}`
    );
  }

  /**
   * Return quantity to specific batches (for customer returns)
   *
   * @param batchId - Batch ID to return to
   * @param quantity - Quantity to return
   * @param referenceType - Type of transaction
   * @param referenceId - Transaction ID
   * @param userId - User performing the action
   * @param transactionManager - Transaction manager
   */
  async returnToBatch(
    batchId: number,
    quantity: number,
    referenceType: string,
    referenceId: number,
    userId: number,
    transactionManager: EntityManager
  ): Promise<void> {
    // Add quantity back to batch
    await transactionManager.query(
      `UPDATE product_batch
       SET quantity_remaining = quantity_remaining + $1,
           status = CASE
             WHEN status = 'DEPLETED' AND quantity_remaining + $1 > 0 THEN 'ACTIVE'
             ELSE status
           END,
           updated_on = CURRENT_TIMESTAMP,
           updated_by = $2
       WHERE id = $3`,
      [quantity, userId, batchId]
    );

    // Log movement
    await this.logBatchMovement(
      batchId,
      'RETURNED',
      quantity,
      referenceType,
      referenceId,
      userId,
      `Customer return`,
      transactionManager
    );

    this.logger.log(`Returned ${quantity} units to batch ${batchId}`);
  }

  /**
   * Log batch movement (immutable audit trail)
   *
   * @param batchId - Batch ID
   * @param movementType - Type of movement
   * @param quantity - Quantity
   * @param referenceType - Reference type
   * @param referenceId - Reference ID
   * @param userId - User ID
   * @param notes - Optional notes
   * @param transactionManager - Transaction manager
   */
  async logBatchMovement(
    batchId: number,
    movementType: 'RECEIVED' | 'SOLD' | 'ADJUSTED' | 'RETURNED' | 'EXPIRED' | 'RECALLED',
    quantity: number,
    referenceType: string,
    referenceId: number,
    userId: number,
    notes?: string,
    transactionManager?: EntityManager
  ): Promise<BatchMovementLog> {
    const manager = transactionManager || this.dataSource.manager;

    const movement = await manager.save(BatchMovementLog, {
      batchId,
      movementType,
      quantity,
      referenceType,
      referenceId,
      performedBy: userId,
      performedAt: new Date(),
      notes
    });

    return movement;
  }

  /**
   * Check if product has only expired batches
   *
   * @param productId - Product ID
   * @returns True if all batches are expired
   */
  async hasOnlyExpiredBatches(productId: number): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT COUNT(*) as active_count
       FROM product_batch
       WHERE product_id = $1
         AND status = 'ACTIVE'
         AND expiry_date > CURRENT_DATE
         AND quantity_remaining > 0
         AND active = true`,
      [productId]
    );

    return result[0].active_count === 0;
  }

  /**
   * Get near-expiry products (30/60/90 days threshold)
   *
   * @param daysThreshold - Number of days threshold (default: 30)
   * @returns Array of near-expiry batches
   */
  async getNearExpiryProducts(daysThreshold: number = 30) {
    return await this.dataSource.query(
      `SELECT
        p.id AS product_id,
        p.title,
        p.category,
        pb.id AS batch_id,
        pb.batch_number,
        pb.expiry_date,
        pb.quantity_remaining,
        pb.ptr_cost,
        (pb.quantity_remaining * pb.ptr_cost) AS value_at_risk,
        (pb.expiry_date - CURRENT_DATE) AS days_to_expiry,
        v.business_name AS vendor_name
       FROM product_batch pb
       INNER JOIN product p ON pb.product_id = p.id
       LEFT JOIN vendor v ON pb.vendor_id = v.id
       WHERE pb.status = 'ACTIVE'
         AND pb.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
         AND pb.quantity_remaining > 0
         AND pb.active = true
       ORDER BY pb.expiry_date ASC, pb.quantity_remaining DESC`,
      [daysThreshold]
    );
  }

  /**
   * Get batch traceability information
   * Complete chain from supplier to customer
   *
   * @param batchId - Batch ID
   * @returns Traceability information
   */
  async getBatchTraceability(batchId: number) {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ['product', 'vendor', 'purchaseInvoiceItem']
    });

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Get all movements
    const movements = await this.movementLogRepository.find({
      where: { batchId },
      relations: ['performedByUser'],
      order: { performedAt: 'ASC' }
    });

    // Get sales where this batch was used
    const sales = await this.dataSource.query(
      `SELECT DISTINCT
        bml.reference_id AS sale_id,
        s.billno,
        s.sale_date,
        c.name AS customer_name,
        bml.quantity,
        bml.performed_at
       FROM batch_movement_log bml
       INNER JOIN sale s ON bml.reference_id = s.id
       LEFT JOIN customer c ON s.customerid = c.id
       WHERE bml.batch_id = $1
         AND bml.movement_type = 'SOLD'
         AND bml.reference_type = 'SALE'
       ORDER BY bml.performed_at DESC`,
      [batchId]
    );

    return {
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        product: {
          id: batch.product.id,
          title: batch.product.title,
          category: batch.product.category
        }
      },
      supplier: {
        vendor: batch.vendor,
        purchaseInvoice: batch.purchaseInvoiceItem,
        receivedDate: batch.receivedDate
      },
      movements: movements.map(m => ({
        type: m.movementType,
        quantity: m.quantity,
        date: m.performedAt,
        user: m.performedByUser?.fullname,
        notes: m.notes
      })),
      sales: sales,
      currentStatus: {
        quantityReceived: batch.quantityReceived,
        quantityRemaining: batch.quantityRemaining,
        status: batch.status
      }
    };
  }
}

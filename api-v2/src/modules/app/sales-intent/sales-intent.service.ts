import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SalesIntent, IntentStatus, FulfillmentStatus, Priority } from 'src/entities/sales-intent.entity';
import { SalesIntentItem } from 'src/entities/sales-intent-item.entity';
import { CreateSalesIntentDto } from './dto/create-sales-intent.dto';
import { UpdateSalesIntentDto, UpdateFulfillmentDto } from './dto/update-sales-intent.dto';

@Injectable()
export class SalesIntentService {
    private readonly logger = new Logger(SalesIntentService.name);

    constructor(
        @InjectRepository(SalesIntent)
        private salesIntentRepository: Repository<SalesIntent>,
        @InjectRepository(SalesIntentItem)
        private salesIntentItemRepository: Repository<SalesIntentItem>,
        private dataSource: DataSource,
    ) {}

    /**
     * Create a new sales intent
     */
    async create(dto: CreateSalesIntentDto, userId: number): Promise<SalesIntent> {
        return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            try {
                // Generate intent number using database function
                const intentNoResult = await manager.query('SELECT generate_intent_number() as intentno');
                const intentno = intentNoResult[0].intentno;

                // Determine if using new items array or old single-product format
                const hasItems = dto.items && dto.items.length > 0;
                const hasSingleProduct = dto.prodid || dto.productname;

                // Calculate summary values
                let totalItems = 0;
                let totalEstimatedCost = 0;
                let totalRequestedQty = 0;

                if (hasItems && dto.items) {
                    // NEW: Using items array
                    totalItems = dto.items.length;
                    totalRequestedQty = dto.items.reduce((sum, item) => sum + item.requestedqty, 0);
                    totalEstimatedCost = dto.items.reduce((sum, item) =>
                        sum + ((item.estimatedcost || 0) * item.requestedqty), 0
                    );
                } else if (hasSingleProduct) {
                    // OLD: Backward compatibility with single-product format
                    totalItems = 1;
                    totalRequestedQty = dto.requestedqty || 1;
                    totalEstimatedCost = (dto.estimatedcost || 0) * (dto.requestedqty || 1);
                }

                // Create sales intent
                const salesIntent = await manager.save(SalesIntent, {
                    intentno,
                    intenttype: dto.intenttype,
                    priority: dto.priority || Priority.MEDIUM,
                    prodid: dto.prodid,
                    productname: dto.productname || '',
                    requestedqty: totalRequestedQty,
                    customerid: dto.customerid,
                    customername: dto.customername,
                    customermobile: dto.customermobile,
                    advanceamount: dto.advanceamount || 0,
                    estimatedcost: dto.estimatedcost,
                    requestnotes: dto.requestnotes,
                    internalnotes: dto.internalnotes,
                    status: IntentStatus.PENDING,
                    fulfillmentstatus: FulfillmentStatus.NOT_STARTED,
                    totalitems: totalItems,
                    totalestimatedcost: totalEstimatedCost,
                    createdby: userId,
                    updatedby: userId,
                });

                // Save items if provided
                if (hasItems && dto.items) {
                    const itemsToSave = dto.items.map(item => ({
                        intentid: (salesIntent as SalesIntent).id,
                        prodid: item.prodid,
                        productname: item.productname,
                        requestedqty: item.requestedqty,
                        estimatedcost: item.estimatedcost,
                        itemnotes: item.itemnotes,
                        createdby: userId,
                        updatedby: userId,
                    }));

                    await manager.save(SalesIntentItem, itemsToSave);
                } else if (hasSingleProduct) {
                    // Backward compatibility: create single item from old format
                    await manager.save(SalesIntentItem, {
                        intentid: (salesIntent as SalesIntent).id,
                        prodid: dto.prodid,
                        productname: dto.productname,
                        requestedqty: dto.requestedqty,
                        estimatedcost: dto.estimatedcost,
                        createdby: userId,
                        updatedby: userId,
                    });
                }

                this.logger.log(`Sales intent created: ${intentno} with ${totalItems} item(s) by user ${userId}`);

                // Return with items loaded
                const createdIntent = await manager.findOne(SalesIntent, {
                    where: { id: (salesIntent as SalesIntent).id },
                    relations: ['items', 'product', 'customer'],
                });

                if (!createdIntent) {
                    throw new HttpException('Failed to load created sales intent', HttpStatus.INTERNAL_SERVER_ERROR);
                }

                return createdIntent;

            } catch (error) {
                if (error instanceof HttpException) throw error;
                this.logger.error(`Failed to create sales intent: ${error.message}`, error.stack);
                throw new HttpException('Failed to create sales intent', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        });
    }

    /**
     * Find all sales intents with filters
     */
    async findAll(filters?: any): Promise<SalesIntent[]> {
        try {
            const queryBuilder = this.salesIntentRepository
                .createQueryBuilder('intent')
                .leftJoinAndSelect('intent.items', 'items')
                .leftJoinAndSelect('intent.product', 'product')
                .leftJoinAndSelect('intent.customer', 'customer')
                .leftJoinAndSelect('intent.purchaseorder', 'po')
                .where('intent.active = :active', { active: true })
                .orderBy('intent.createdon', 'DESC');

            // Apply filters
            if (filters?.status) {
                queryBuilder.andWhere('intent.status = :status', { status: filters.status });
            }

            if (filters?.intenttype) {
                queryBuilder.andWhere('intent.intenttype = :intenttype', { intenttype: filters.intenttype });
            }

            if (filters?.priority) {
                queryBuilder.andWhere('intent.priority = :priority', { priority: filters.priority });
            }

            if (filters?.customerid) {
                queryBuilder.andWhere('intent.customerid = :customerid', { customerid: filters.customerid });
            }

            if (filters?.fulfillmentstatus) {
                queryBuilder.andWhere('intent.fulfillmentstatus = :fulfillmentstatus',
                    { fulfillmentstatus: filters.fulfillmentstatus });
            }

            return await queryBuilder.getMany();

        } catch (error) {
            this.logger.error(`Failed to fetch sales intents: ${error.message}`, error.stack);
            throw new HttpException('Failed to fetch sales intents', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Find sales intent by ID
     */
    async findOne(id: number): Promise<SalesIntent> {
        try {
            const intent = await this.salesIntentRepository.findOne({
                where: { id, active: true },
                relations: ['items', 'product', 'customer', 'purchaseorder', 'createdbyuser', 'updatedbyuser'],
            });

            if (!intent) {
                throw new NotFoundException(`Sales intent with ID ${id} not found`);
            }

            return intent;

        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(`Failed to find sales intent ${id}: ${error.message}`, error.stack);
            throw new HttpException('Failed to find sales intent', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Update sales intent
     */
    async update(id: number, dto: UpdateSalesIntentDto, userId: number): Promise<SalesIntent> {
        return await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
            try {
                const intent = await manager.findOne(SalesIntent, {
                    where: { id, active: true },
                    relations: ['items'],
                });

                if (!intent) {
                    throw new NotFoundException(`Sales intent with ID ${id} not found`);
                }

                // Check if intent can be updated
                if (intent.status === IntentStatus.FULFILLED || intent.status === IntentStatus.CANCELLED) {
                    throw new BadRequestException(`Cannot update ${intent.status} intent`);
                }

                // Extract items from dto
                const items = dto.items;
                const updateData: any = { ...dto };
                delete updateData.items;

                // Calculate totals if items are provided
                if (items && items.length > 0) {
                    const totalItems = items.length;
                    const totalRequestedQty = items.reduce((sum, item) => sum + (item.requestedqty || 0), 0);
                    const totalEstimatedCost = items.reduce((sum, item) =>
                        sum + ((item.estimatedcost || 0) * (item.requestedqty || 0)), 0
                    );

                    updateData.totalitems = totalItems;
                    updateData.requestedqty = totalRequestedQty;
                    updateData.totalestimatedcost = totalEstimatedCost;
                }

                // Update intent (without items)
                await manager.update(SalesIntent, id, {
                    ...updateData,
                    updatedby: userId,
                });

                // Handle items if provided
                if (items) {
                    // Get existing item IDs
                    const existingItemIds = intent.items.map(item => item.id);
                    const updatedItemIds = items.filter(item => item.id).map(item => item.id);

                    // Delete items that are no longer in the array
                    const itemsToDelete = existingItemIds.filter(id => !updatedItemIds.includes(id));
                    if (itemsToDelete.length > 0) {
                        await manager.delete(SalesIntentItem, itemsToDelete);
                    }

                    // Update or create items
                    for (const item of items) {
                        if (item.id) {
                            // Update existing item
                            await manager.update(SalesIntentItem, item.id, {
                                productname: item.productname,
                                requestedqty: item.requestedqty,
                                estimatedcost: item.estimatedcost,
                                itemnotes: item.itemnotes,
                                prodid: item.prodid,
                                updatedby: userId,
                            });
                        } else {
                            // Create new item
                            await manager.save(SalesIntentItem, {
                                intentid: id,
                                prodid: item.prodid,
                                productname: item.productname,
                                requestedqty: item.requestedqty,
                                estimatedcost: item.estimatedcost,
                                itemnotes: item.itemnotes,
                                createdby: userId,
                                updatedby: userId,
                            });
                        }
                    }
                }

                this.logger.log(`Sales intent ${id} updated by user ${userId}`);

                // Fetch and return updated intent
                const updatedIntent = await manager.findOne(SalesIntent, {
                    where: { id },
                    relations: ['items', 'product', 'customer', 'purchaseorder'],
                });

                if (!updatedIntent) {
                    throw new NotFoundException(`Sales intent with ID ${id} not found after update`);
                }

                return updatedIntent;

            } catch (error) {
                if (error instanceof HttpException) throw error;
                this.logger.error(`Failed to update sales intent ${id}: ${error.message}`, error.stack);
                throw new HttpException('Failed to update sales intent', HttpStatus.INTERNAL_SERVER_ERROR);
            }
        });
    }

    /**
     * Update fulfillment status
     */
    async updateFulfillment(id: number, dto: UpdateFulfillmentDto, userId: number): Promise<SalesIntent> {
        try {
            const intent = await this.findOne(id);

            const updateData: any = {
                ...dto,
                updatedby: userId,
            };

            // Auto-update timestamps based on fulfillment status
            if (dto.fulfillmentstatus) {
                switch (dto.fulfillmentstatus) {
                    case FulfillmentStatus.PO_CREATED:
                        updateData.status = IntentStatus.IN_PO;
                        break;
                    case FulfillmentStatus.GOODS_RECEIVED:
                        updateData.fulfilledon = new Date();
                        break;
                    case FulfillmentStatus.CUSTOMER_NOTIFIED:
                        updateData.notifiedon = new Date();
                        break;
                    case FulfillmentStatus.DELIVERED:
                        updateData.deliveredon = new Date();
                        updateData.status = IntentStatus.FULFILLED;
                        break;
                }
            }

            await this.salesIntentRepository.update(id, updateData);

            this.logger.log(`Sales intent ${id} fulfillment updated to ${dto.fulfillmentstatus} by user ${userId}`);
            return this.findOne(id);

        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(`Failed to update fulfillment for intent ${id}: ${error.message}`, error.stack);
            throw new HttpException('Failed to update fulfillment', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Cancel sales intent
     */
    async cancel(id: number, userId: number, reason?: string): Promise<SalesIntent> {
        try {
            const intent = await this.findOne(id);

            // Check if intent can be cancelled
            if (intent.status === IntentStatus.FULFILLED) {
                throw new BadRequestException('Cannot cancel fulfilled intent');
            }

            if (intent.status === IntentStatus.IN_PO) {
                throw new BadRequestException('Cannot cancel intent already in PO. Remove from PO first.');
            }

            await this.salesIntentRepository.update(id, {
                status: IntentStatus.CANCELLED,
                internalnotes: reason ? `${intent.internalnotes || ''}\nCancellation reason: ${reason}` : intent.internalnotes,
                updatedby: userId,
            });

            this.logger.log(`Sales intent ${id} cancelled by user ${userId}`);
            return this.findOne(id);

        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(`Failed to cancel sales intent ${id}: ${error.message}`, error.stack);
            throw new HttpException('Failed to cancel sales intent', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Delete sales intent (soft delete)
     */
    async delete(id: number, userId: number): Promise<void> {
        try {
            const intent = await this.findOne(id);

            // Only allow deletion of PENDING intents
            if (intent.status !== IntentStatus.PENDING) {
                throw new BadRequestException('Can only delete PENDING intents');
            }

            await this.salesIntentRepository.update(id, {
                active: false,
                archive: true,
                updatedby: userId,
            });

            this.logger.log(`Sales intent ${id} deleted by user ${userId}`);

        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(`Failed to delete sales intent ${id}: ${error.message}`, error.stack);
            throw new HttpException('Failed to delete sales intent', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get pending intents for PO generation
     */
    async getPendingForPO(): Promise<SalesIntent[]> {
        try {
            return await this.salesIntentRepository.find({
                where: {
                    status: IntentStatus.PENDING,
                    active: true,
                },
                relations: ['items', 'product', 'customer'],
                order: {
                    priority: 'DESC',
                    createdon: 'ASC',
                },
            });

        } catch (error) {
            this.logger.error(`Failed to fetch pending intents for PO: ${error.message}`, error.stack);
            throw new HttpException('Failed to fetch pending intents', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}

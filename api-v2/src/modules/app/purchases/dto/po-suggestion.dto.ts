import { ApiProperty } from '@nestjs/swagger';

export enum SuggestionReason {
    LOW_STOCK = 'LOW_STOCK',
    SALES_INTENT = 'SALES_INTENT',
    MANUAL = 'MANUAL'
}

export class POSuggestionItemDto {
    @ApiProperty({ description: 'Product ID' })
    productId: number;

    @ApiProperty({ description: 'Product name' })
    productName: string;

    @ApiProperty({ description: 'Current stock balance', required: false })
    currentStock?: number;

    @ApiProperty({ description: 'Reorder limit', required: false })
    reorderLimit?: number;

    @ApiProperty({ description: 'Suggested order quantity' })
    suggestedQuantity: number;

    @ApiProperty({ enum: SuggestionReason, description: 'Reason for suggestion' })
    reason: SuggestionReason;

    @ApiProperty({ description: 'Priority (for SALES_INTENT items)', required: false })
    priority?: string;

    @ApiProperty({ description: 'Last vendor ID', required: false })
    lastVendorId?: number;

    @ApiProperty({ description: 'Last vendor name', required: false })
    lastVendorName?: string;

    @ApiProperty({ description: 'Preferred vendor ID', required: false })
    preferredVendorId?: number;

    @ApiProperty({ description: 'Preferred vendor name', required: false })
    preferredVendorName?: string;

    @ApiProperty({ description: 'Last purchase date', required: false })
    lastPurchaseDate?: Date;

    @ApiProperty({ description: 'Last purchase price', required: false })
    lastPurchasePrice?: number;

    @ApiProperty({ description: 'Related sales intent IDs', type: [Number], required: false })
    salesIntentIds?: number[];
}

export class POSuggestionsResponseDto {
    @ApiProperty({ type: [POSuggestionItemDto], description: 'Low stock items below reorder limit' })
    lowStockItems: POSuggestionItemDto[];

    @ApiProperty({ type: [POSuggestionItemDto], description: 'Items from pending sales intents' })
    salesIntentItems: POSuggestionItemDto[];

    @ApiProperty({ description: 'Store ID' })
    storeId: number;

    @ApiProperty({ description: 'Store name' })
    storeName: string;

    @ApiProperty({ description: 'Total number of suggestions' })
    totalSuggestions: number;
}

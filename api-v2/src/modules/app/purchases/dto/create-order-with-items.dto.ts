import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
    @ApiProperty({ description: 'Product ID' })
    @IsInt()
    @IsNotEmpty()
    productId: number;

    @ApiProperty({ description: 'Quantity' })
    @IsNumber()
    @Min(1)
    qty: number;

    @ApiProperty({ description: 'Expected price per unit', required: false })
    @IsNumber()
    @IsOptional()
    expectedPrice?: number;

    @ApiProperty({ description: 'Item comments', required: false })
    @IsString()
    @IsOptional()
    comments?: string;
}

export class CreatePurchaseOrderWithItemsDto {
    @ApiProperty({ description: 'Vendor ID' })
    @IsInt()
    @IsNotEmpty()
    vendorid: number;

    @ApiProperty({ description: 'PO Number', required: false })
    @IsString()
    @IsOptional()
    ponumber?: string;

    @ApiProperty({ description: 'Order comments', required: false })
    @IsString()
    @IsOptional()
    comments?: string;

    @ApiProperty({ description: 'Order items', type: [PurchaseOrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PurchaseOrderItemDto)
    items: PurchaseOrderItemDto[];
}

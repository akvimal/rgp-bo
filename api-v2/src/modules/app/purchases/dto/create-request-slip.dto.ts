import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

/** one product on a slip: the product (or the name of one that is not in the list yet), how many, and an optional note for this line */
export class RequestSlipLineDto {
    @ApiProperty({ description: 'product id (leave out for a product that is not in the list, and give requestedname)', example: 0 })
    @IsOptional()
    @IsNumber()
    @IsPositive()
    readonly productid: number;

    @ApiProperty({ description: 'the name of a product that is not in the product list', example: 'Revital H capsules' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly requestedname: string;

    @ApiProperty({ description: 'qty', example: 1 })
    @IsNumber()
    @Min(1)
    @Max(100000)
    readonly qty: number;

    @ApiProperty({ description: 'a note for this line only', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    readonly note: string;
}

/** several products asked for together: the fields below are shared by every line (they are copied onto each request) */
export class CreatePurchaseRequestSlipDto {
    @ApiProperty({ description: 'the store that is asking', example: 0 })
    @IsOptional()
    @IsNumber()
    @IsPositive()
    readonly storeid: number;

    @ApiProperty({ description: 'request type', example: 'Ad Hoc' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly requesttype: string;

    @ApiProperty({ description: 'request source', example: 'Customer' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    readonly source: string;

    @ApiProperty({ description: 'priority', example: 'Normal' })
    @IsOptional()
    @IsIn(['Low', 'Normal', 'High', 'Urgent'])
    readonly priority: string;

    @ApiProperty({ description: 'comments shared by every line', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly comments: string;

    @ApiProperty({ description: 'internal notes (the buying side only)', example: '' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    readonly notes: string;

    @ApiProperty({ description: 'vendor id (the buying side only)', example: 0 })
    @IsOptional()
    @IsNumber()
    readonly vendorid: number;

    @ApiProperty({ description: 'customer name', example: 'Aarav Kumar' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    readonly customername: string;

    @ApiProperty({ description: 'customer phone', example: '9000000001' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    readonly customerphone: string;

    @ApiProperty({ description: 'needed by date', example: '2026-07-02' })
    @IsOptional()
    @IsDateString()
    readonly neededby: string;

    @ApiProperty({ description: 'source reference', example: 'walk-in special order' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    readonly sourceref: string;

    @ApiProperty({ description: 'the products asked for', type: [RequestSlipLineDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => RequestSlipLineDto)
    readonly lines: RequestSlipLineDto[];
}

/** more products for a slip that is already raised (while some of its lines are still open) */
export class AddSlipLinesDto {
    @ApiProperty({ description: 'the products to add', type: [RequestSlipLineDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => RequestSlipLineDto)
    readonly lines: RequestSlipLineDto[];
}

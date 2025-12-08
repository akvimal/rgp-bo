import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreatePurchaseOrderFromIntentsDto {
    @ApiProperty({ description: 'Vendor ID' })
    @IsInt()
    @IsNotEmpty()
    vendorid: number;

    @ApiProperty({ description: 'Array of Sales Intent IDs', type: [Number] })
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one intent must be selected' })
    @IsInt({ each: true })
    intentIds: number[];

    @ApiProperty({ description: 'Purchase order comments', required: false })
    @IsString()
    @IsOptional()
    comments?: string;
}

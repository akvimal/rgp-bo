import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BlockVendorDto {
  @ApiProperty({ description: 'why the vendor is put on hold (shown to staff who try to order from it)', example: 'Drug licence expired' })
  @IsString() @MinLength(5, { message: 'Give a reason of at least 5 characters.' }) @MaxLength(200)
  readonly reason: string;
}

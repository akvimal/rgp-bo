import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectClaimDto {
  @ApiProperty({ example: 'Insufficient documentation provided' })
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyAcknowledgmentMethod } from '../../../../entities/enums/hr-policy-benefits.enums';

export class AcknowledgePolicyDto {
  @ApiProperty({ enum: PolicyAcknowledgmentMethod, example: PolicyAcknowledgmentMethod.DIGITAL_SIGNATURE })
  @IsEnum(PolicyAcknowledgmentMethod)
  @IsNotEmpty()
  acknowledgmentMethod: PolicyAcknowledgmentMethod;

  @ApiPropertyOptional({ example: 'base64_encoded_signature_data' })
  @IsOptional()
  @IsString()
  digitalSignature?: string;

  @ApiPropertyOptional({ example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SystemInfoDto {
  @ApiProperty({ description: 'Browser name and version' })
  @IsString()
  browser: string;

  @ApiProperty({ description: 'Operating system' })
  @IsString()
  os: string;

  @ApiProperty({ description: 'Current route/URL' })
  @IsString()
  currentRoute: string;

  @ApiProperty({ description: 'User agent string' })
  @IsString()
  userAgent: string;

  @ApiProperty({ description: 'Screen resolution' })
  @IsString()
  screenResolution: string;

  @ApiProperty({ description: 'Timestamp when report was created' })
  @IsString()
  timestamp: string;
}

export class CreateBugReportDto {
  @ApiProperty({
    description: 'Bug report title',
    example: 'Cannot save product',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the bug',
    example: 'When I try to save a new product, I get an error message',
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    description: 'Steps to reproduce the bug',
    example: '1. Go to Products\n2. Click Add New\n3. Fill form\n4. Click Save',
    maxLength: 1000,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  stepsToReproduce?: string;

  @ApiProperty({
    description: 'System information auto-captured from client',
    type: SystemInfoDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => SystemInfoDto)
  systemInfo: SystemInfoDto;
}

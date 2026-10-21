import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const GRIEVANCE_CATEGORIES = ['SERVICE', 'PRODUCT_QUALITY', 'WRONG_ITEM', 'PRICING', 'STOCK', 'DELIVERY', 'OTHER'];
export const GRIEVANCE_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'];
export const GRIEVANCE_SOURCES = ['COUNTER', 'PHONE', 'WHATSAPP', 'DELIVERY', 'OTHER'];
export const GRIEVANCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export class CreateGrievanceDto {
  @IsOptional() @IsInt() storeid?: number;
  @IsOptional() @IsInt() customerid?: number;
  @IsOptional() @IsInt() saleid?: number;
  @IsOptional() @IsInt() aboutuserid?: number;
  @IsOptional() @IsInt() assignedto?: number;
  @IsIn(GRIEVANCE_CATEGORIES) category: string;
  @IsOptional() @IsIn(GRIEVANCE_SEVERITIES) severity?: string;
  @IsOptional() @IsIn(GRIEVANCE_SOURCES) source?: string;
  @IsString() @MinLength(5) @MaxLength(200) summary: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
}

export class UpdateGrievanceDto {
  @IsOptional() @IsIn(GRIEVANCE_STATUSES) status?: string;
  @IsOptional() @IsInt() assignedto?: number;
  @IsOptional() @IsIn(GRIEVANCE_SEVERITIES) severity?: string;
  @IsOptional() @IsString() @MaxLength(4000) resolution?: string;
}

export class AddNoteDto {
  @IsString() @MinLength(2) @MaxLength(2000) note: string;
}

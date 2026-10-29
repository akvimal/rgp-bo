import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString,
  Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const VENDOR_TYPES = ['DISTRIBUTOR', 'MANUFACTURER', 'LOCAL', 'OTHER'];
export const REGISTRATION_TYPES = ['REGULAR', 'COMPOSITION', 'UNREGISTERED', 'UNKNOWN'];
export const LICENSE_TYPES = ['WHOLESALE_20B_21B', 'RETAIL_20_21', 'MANUFACTURING', 'FSSAI', 'SHOP_EST', 'TRADE', 'OTHER'];

/** A form sends '' for an empty box: store nothing instead. */
const Blank = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value));
/** Indian mobile numbers: keep digits, drop a leading 91 or 0. */
const Mobile = () => Transform(({ value }) => {
  if (typeof value !== 'string') return value;
  let d = value.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d === '' ? null : d;
});
const Upper = () => Transform(({ value }) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim().toUpperCase()) : value));

export class VendorLicenseDto {
  @ApiProperty({ enum: LICENSE_TYPES }) @IsIn(LICENSE_TYPES) licensetype: string;
  @ApiProperty() @Blank() @IsNotEmpty() @IsString() @MaxLength(40) number: string;
  @ApiPropertyOptional() @IsOptional() @Blank() @IsDateString() validfrom?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @IsDateString() validto?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(200) notes?: string | null;
}

export class CreateVendorDto {
  @ApiProperty({ description: 'business name (trade name), unique', example: '' })
  @Blank() @IsNotEmpty() @IsString() @MaxLength(40)
  readonly name: string;

  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(120) readonly legalname?: string | null;
  @ApiPropertyOptional({ enum: VENDOR_TYPES }) @IsOptional() @Blank() @IsIn(VENDOR_TYPES) readonly vendortype?: string | null;
  @ApiPropertyOptional({ enum: REGISTRATION_TYPES }) @IsOptional() @IsIn(REGISTRATION_TYPES) readonly registrationtype?: string;

  @ApiPropertyOptional({ description: 'GSTIN; checked for format, state and check digit', example: '' })
  @IsOptional() @Upper() @IsString() @MaxLength(40)
  readonly gstn?: string | null;
  @ApiPropertyOptional() @IsOptional() @Upper() @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'PAN must look like ABCDE1234F' }) readonly pan?: string | null;
  @ApiPropertyOptional({ description: 'GST state code, derived from the GSTIN when there is one' }) @IsOptional() @Blank() @Matches(/^[0-9]{2}$/, { message: 'state code must be 2 digits' }) readonly statecode?: string | null;

  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(200) readonly address?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(60) readonly city?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @Matches(/^[1-9][0-9]{5}$/, { message: 'pincode must be 6 digits' }) readonly pincode?: string | null;

  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(40) readonly contactname?: string | null;
  @ApiPropertyOptional({ description: 'landline or any phone text' }) @IsOptional() @Blank() @IsString() @MaxLength(40) readonly contactphone?: string | null;
  @ApiPropertyOptional({ description: '10-digit mobile / WhatsApp' }) @IsOptional() @Mobile() @Matches(/^[6-9][0-9]{9}$/, { message: 'mobile must be a 10-digit Indian mobile number' }) readonly mobile?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @IsEmail({}, { message: 'email is not valid' }) @MaxLength(120) readonly email?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(60) readonly repname?: string | null;
  @ApiPropertyOptional() @IsOptional() @Mobile() @Matches(/^[6-9][0-9]{9}$/, { message: 'sales rep phone must be a 10-digit mobile number' }) readonly repphone?: string | null;

  @ApiPropertyOptional({ description: 'payment terms in days, used to default an invoice due date', example: 0 })
  @IsOptional() @IsInt() @Min(0) @Max(365)
  readonly paymenttermsdays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) readonly creditlimit?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) readonly discountpcnt?: number | null;

  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(80) readonly bankname?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @Matches(/^[0-9A-Za-z]{6,30}$/, { message: 'bank account number must be 6 to 30 letters or digits' }) readonly bankaccount?: string | null;
  @ApiPropertyOptional() @IsOptional() @Upper() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must look like HDFC0001234' }) readonly bankifsc?: string | null;
  @ApiPropertyOptional() @IsOptional() @Blank() @Matches(/^[\w.\-]{2,}@[A-Za-z]{2,}$/, { message: 'UPI id must look like name@bank' }) readonly upiid?: string | null;

  @ApiPropertyOptional() @IsOptional() @Blank() @IsString() @MaxLength(400) readonly comments?: string | null;
  @ApiPropertyOptional({ description: 'props', example: '{}' }) @IsOptional() @IsObject() readonly props?: object;

  @ApiPropertyOptional({ type: [VendorLicenseDto], description: 'replaces the vendor\'s licences when sent' })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VendorLicenseDto)
  readonly licenses?: VendorLicenseDto[];
}

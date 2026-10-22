import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Trim } from 'class-sanitizer';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'email', example: '' })
  @Trim()
  @IsEmail()
  public readonly email: string;

  @ApiProperty({ description: 'password', example: '' })
  @IsString()
  public readonly password: string;

  @ApiPropertyOptional({ description: 'which sign-in page this came from; platform admins sign in on the platform page only', enum: ['business', 'platform'] })
  @IsOptional()
  @IsIn(['business', 'platform'])
  public readonly scope?: 'business' | 'platform';
}

export class ChangePasswordDto extends LoginDto {

  @ApiProperty({ description: 'newpassword', example: '' })
  @IsString()
  public readonly newpassword: string;

}
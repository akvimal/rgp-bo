import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Trim } from 'class-sanitizer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class MfaTokenDto {
  @ApiProperty({ description: 'the short-lived token the password step returned' })
  @IsString()
  public readonly mfaToken: string;
}

export class MfaCodeDto extends MfaTokenDto {
  @ApiProperty({ description: 'the 6-digit code from the authenticator app, or a recovery code' })
  @IsString()
  @MaxLength(32)
  public readonly code: string;
}

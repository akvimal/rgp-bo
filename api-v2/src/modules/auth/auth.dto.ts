import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Trim } from 'class-sanitizer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'email', example: '' })
  @Trim()
  @IsEmail()
  public readonly email: string;

  @ApiProperty({ description: 'password', example: '' })
  @IsString()
  @MinLength(8)
  public readonly password: string;

  @ApiPropertyOptional({ description: 'name', example: '' })
  @IsString()
  @IsOptional()
  public readonly name?: string;
}

export class LoginDto {
  @ApiProperty({ description: 'email', example: '' })
  @Trim()
  @IsEmail()
  public readonly email: string;

  @ApiProperty({ description: 'password', example: '' })
  @IsString()
  public readonly password: string;
}

export class ChangePasswordDto extends LoginDto {

  @ApiProperty({ description: 'newpassword', example: '' })
  @IsString()
  public readonly newpassword: string;

}
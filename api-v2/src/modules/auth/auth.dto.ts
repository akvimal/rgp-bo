import { ApiProperty } from '@nestjs/swagger';
import { Trim } from 'class-sanitizer';
import { IsEmail, IsString } from 'class-validator';

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
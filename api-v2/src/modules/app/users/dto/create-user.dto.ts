import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsNumber, IsString } from 'class-validator';

export class CreateUserDto {

    @ApiProperty({ description: 'fullname', example: '' })
    @IsString()
    @IsDefined()
    readonly fullname?: string;

    @ApiProperty({ description: 'password', example: '' })
    @IsString()
    @IsDefined()
    readonly password?: string;

    @ApiProperty({ description: 'email', example: '' })
    @IsString()
    @IsDefined()
    readonly email?: string;

    @ApiProperty({ description: 'phone', example: '' })
    @IsString()
    @IsDefined()
    readonly phone?: string;

    @ApiProperty({ description: 'location', example: '' })
    @IsString()
    @IsDefined()
    readonly location?: string;

    @ApiProperty({ description: 'role', example: 0 })
    @IsNumber()
    @IsDefined()
    readonly roleid?: number;

    public lastlogin?: Date | null;
}
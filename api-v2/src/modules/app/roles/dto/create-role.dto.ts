import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString } from 'class-validator';

export class CreateRoleDto {

    @ApiProperty({ description: 'name', example: '' })
    @IsString()
    @IsDefined()
    readonly name: string;

    @ApiProperty({ description: 'permissions', example: '' })
    @IsString()
    @IsDefined()
    readonly permissions: object;

    @ApiProperty({ description: 'locked', example: false })
    @IsString()
    @IsDefined()
    readonly locked: boolean;

}
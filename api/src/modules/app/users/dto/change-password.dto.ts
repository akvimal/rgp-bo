import { IsOptional, IsString } from "class-validator";

export class ChangePasswordeDto {
    @IsString()
    @IsOptional()
    public readonly password?: string;
}
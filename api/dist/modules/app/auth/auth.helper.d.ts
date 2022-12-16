import { JwtService } from '@nestjs/jwt';
import { AppUser } from 'src/entities/AppUser.entity';
export declare class AuthHelper {
    private readonly repository;
    private readonly jwt;
    constructor(jwt: JwtService);
    decode(token: string): Promise<unknown>;
    validateUser(decoded: any): Promise<AppUser>;
    generateToken(user: AppUser): string;
    isPasswordValid(password: string, userPassword: string): boolean;
    encodePassword(password: string): string;
    private validate;
}

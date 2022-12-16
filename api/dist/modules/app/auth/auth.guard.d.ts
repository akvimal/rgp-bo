import { ExecutionContext } from '@nestjs/common';
import { IAuthGuard } from '@nestjs/passport';
import { AppUser } from 'src/entities/AppUser.entity';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base implements IAuthGuard {
    handleRequest(err: unknown, user: AppUser): any;
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export {};

import { Injectable, ExecutionContext, CanActivate, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { isActiveUser } from 'src/core/active-users';

import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  
  constructor(private jwtService: JwtService, @InjectEntityManager() private readonly manager: EntityManager) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_KEY});
    } catch {
      throw new UnauthorizedException();
    }
    // a login that was removed or archived stops working now, not when its token runs out (outside the try: a database error is not a bad token)
    const id = Number(payload?.id);
    if (Number.isInteger(id) && !(await isActiveUser(id, (i) => this.stillActive(i)))) throw new UnauthorizedException();

    // 💡 We're assigning the payload to the request object here
    // so that we can access it in our route handlers
    request['user'] = payload;
    return true;
  }

  private async stillActive(id: number): Promise<boolean> {
    const [u] = await this.manager.query(`select active, archive from app_user where id = $1`, [id]);
    return !!u && u.active === true && u.archive !== true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // console.log(request.headers);
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
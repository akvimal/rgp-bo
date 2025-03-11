import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppUser } from '../../../entities/appuser.entity';
import { AuthHelper } from './auth.helper';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

  @Inject(AuthHelper)
  private readonly helper: AuthHelper;

  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_KEY,
      ignoreExpiration: false,
    });
  }

  private validate(payload: string): Promise<AppUser | never> {
    return this.helper.validateUser(payload);
  }

}
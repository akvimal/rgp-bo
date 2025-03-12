import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthHelper } from './auth.helper';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';
import { AppUser } from '../../../entities/appuser.entity';
import { UserService } from '../users/user.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
    JwtModule.register({     secret: process.env.JWT_KEY,
        signOptions: { expiresIn: process.env.JWT_EXPIRES },
    }),
    TypeOrmModule.forFeature([AppUser])
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, AuthHelper, JwtStrategy],
  exports: [AuthHelper]
})
export class AuthModule {}
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthHelper } from './auth.helper';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';
import { AppUser } from '../../../entities/appuser.entity';
import { UserService } from '../users/user.service';
import authConfig from 'src/config/auth.config';

@Module({
  imports: [
    ConfigModule.forRoot({
    isGlobal: true,
    load: [
      authConfig
    ],
    envFilePath: `src/config/env/.${process.env.NODE_ENV}.env`,
  }),
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_KEY'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES') },
      }),
    }),
    TypeOrmModule.forFeature([AppUser])
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, AuthHelper, JwtStrategy],
  exports: [AuthHelper]
})
export class AuthModule {}
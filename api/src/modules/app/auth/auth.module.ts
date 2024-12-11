import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthHelper } from './auth.helper';
import { AuthService } from './auth.service';
import { JwtStrategy } from './auth.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppUser } from '../../../entities/appuser.entity';
import authConfig from '../../../config/auth.config';
import { UserService } from '../users/user.service';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    load: [
      authConfig
    ],
    envFilePath: ['src/.env'],
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
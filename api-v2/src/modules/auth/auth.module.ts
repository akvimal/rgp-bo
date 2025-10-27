import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppUser } from 'src/entities/appuser.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthHelper } from './auth.helper';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from '../app/users/user.service';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forFeature([AppUser]),
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
    JwtModule.register({     secret: process.env.JWT_KEY,
        signOptions: { expiresIn: process.env.JWT_EXPIRES },
    })
  ],
  controllers: [AuthController],
  providers: [AuthHelper, AuthService, UserService, AuthGuard],
  exports: [AuthHelper, AuthGuard, JwtModule]
})
export class AuthModule {}
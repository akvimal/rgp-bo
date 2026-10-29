import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/modules/auth/auth.module';
import { PackConfigController } from './pack-config.controller';

@Module({ imports: [AuthModule], controllers: [PackConfigController], providers: [JwtService] })
export class PackConfigModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ConfigProfileController } from './config-profile.controller';
import { ConfigProfileService } from './config-profile.service';

@Module({
  imports: [AuthModule],
  controllers: [ConfigProfileController],
  providers: [ConfigProfileService],
})
export class ConfigProfileModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RoleModule } from '../roles/role.module';
import { WhatsAppController, WhatsAppGuard } from './whatsapp.controller';
import { WhatsAppAdapter } from './whatsapp.adapter';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/** WhatsApp messages to customers (the bill copy first), one number per store, through a queue. */
@Module({
  imports: [AuthModule, RoleModule],
  controllers: [WhatsAppController, WhatsAppWebhookController],
  providers: [WhatsAppGuard, WhatsAppAdapter, WhatsAppService, WhatsAppWebhookService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}

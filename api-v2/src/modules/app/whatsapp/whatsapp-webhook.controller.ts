import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

/** Meta calls these two routes; there is no sign-in. The GET proves the verify token, the POST proves Meta's signature. */
@ApiTags('WhatsApp')
@ApiExcludeController()
@Controller('whatsapp/webhook')
export class WhatsAppWebhookController {
  constructor(private readonly service: WhatsAppWebhookService) {}

  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string, @Res() res: any) {
    res.type('text/plain').send(this.service.verifyChallenge(mode, token, challenge));
  }

  @Post()
  @HttpCode(200)
  async receive(@Req() req: any, @Headers('x-hub-signature-256') signature: string, @Body() body: any) {
    return this.service.receive(req.rawBody, signature, body);
  }
}

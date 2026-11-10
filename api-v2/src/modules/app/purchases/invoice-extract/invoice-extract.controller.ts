import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { User } from 'src/core/decorator/user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { PurchasingGuard } from '../../roles/purchasing.guard';
import { InvoiceExtractService } from './invoice-extract.service';
import { PlatformService, ScanQuotaGuard } from 'src/core/platform/platform.service';

/** Reads an invoice copy that was uploaded with the invoice form. Nothing is saved. */
@ApiTags('PurchaseInvoices')
@Controller('purchases/extract')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard, ScanQuotaGuard)
export class InvoiceExtractController {
  constructor(private readonly service: InvoiceExtractService, private readonly platform: PlatformService) {}

  @Post()
  async extract(@Body() body: any, @User() user: any) {
    try {
      // `ai: true` is the person asking for the assistant to read it, whatever the plain reading made of it
      return await this.service.extract(String(body?.path ?? ''), { userId: user?.id ?? null, ai: body?.ai === true });
    } finally {
      await this.platform.bump('scans');
    }
  }
}

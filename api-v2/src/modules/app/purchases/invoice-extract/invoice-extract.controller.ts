import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { PurchasingGuard } from '../../roles/purchasing.guard';
import { InvoiceExtractService } from './invoice-extract.service';

/** Reads an invoice copy that was uploaded with the invoice form. Nothing is saved. */
@ApiTags('PurchaseInvoices')
@Controller('purchases/extract')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class InvoiceExtractController {
  constructor(private readonly service: InvoiceExtractService) {}

  @Post()
  extract(@Body() body: any) {
    return this.service.extract(String(body?.path ?? ''));
  }
}

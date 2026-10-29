import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { PurchasingGuard } from "../roles/purchasing.guard";
import { Setting } from 'src/entities/setting.entity';
import { PurchaseService } from './purchase.service';
import { buildPoPdf, DEFAULT_PO_TERMS, parseSignatureBlocks, PoBuyer } from './po-pdf';

const LICENCE_LABELS: { [type: string]: string } = {
  RETAIL_20_21: 'DL No.', WHOLESALE_20B_21B: 'Wholesale DL No.', FSSAI: 'FSSAI', SHOP_EST: 'Shop licence no.', TRADE: 'Trade licence no.', OTHER: 'Licence',
};

@ApiTags('PurchaseDownload')
@Controller('download')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class PurchaseDownloadController {
  constructor(
    private readonly service: PurchaseService,
    @InjectRepository(Setting) private readonly settingRepository: Repository<Setting>,
    @InjectEntityManager() private readonly manager: EntityManager
  ) {}

  @Post('po')
  async downloadPurchaseOrder(@Body() body: any, @Res() res: Response) {
    const order = await this.service.findOrderById(`${body?.id || ''}`);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const showBuyerDetails = await this.getSettingBoolean('purchase_order_pdf_show_buyer_details', true);
    const terms = await this.getTerms();
    const buyer = showBuyerDetails ? await this.buyerFor(order) : null;

    const signatures = parseSignatureBlocks(await this.getLines('purchase_order_signatures'), {
      business: buyer?.name, preparedBy: order.createdbyname || undefined, vendor: order.vendor?.name,
    });

    const buffer = await buildPoPdf(order, { buyer, terms, signatures, preparedBy: order.createdbyname || undefined });
    const filename = `PO-${order.ponumber || order.id}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.type('application/pdf');
    return res.send(buffer);
  }

  private async getSettingBoolean(key: string, fallback: boolean) {
    const setting = await this.settingRepository.findOne({ where: { key, isActive: true, isArchived: false } });
    if (setting?.value === undefined || setting?.value === null || `${setting.value}`.trim() === '') {
      return fallback;
    }
    return ['1', 'true', 'yes', 'y', 'on'].includes(`${setting.value}`.trim().toLowerCase());
  }

  /** the lines of a text setting, blanks dropped */
  private async getLines(key: string): Promise<string[]> {
    const setting = await this.settingRepository.findOne({ where: { key, isActive: true, isArchived: false } });
    return `${setting?.value ?? ''}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }

  /** the terms the business has written (one per line), or the standard three */
  private async getTerms(): Promise<string[]> {
    const lines = await this.getLines('purchase_order_terms');
    return lines.length ? lines : DEFAULT_PO_TERMS;
  }

  /**
   * The buyer is the business the person who made the order works for, with the address, phone and licences of their store (the first
   * store they are assigned to, else the business's first). Nothing about any one shop is written into the page.
   */
  private async buyerFor(order: any): Promise<PoBuyer | null> {
    const [row] = await this.manager.query(
      `select b.id as business_id, b.name, b.legal_name, b.gstin, b.address as baddr, b.pincode as bpin
         from app_user u join business b on b.id = u.business_id where u.id = $1`, [order.createdby || 0]);
    const [fallback] = row ? [] : await this.manager.query(`select id as business_id, name, legal_name, gstin, address as baddr, pincode as bpin from business order by id limit 1`);
    const b = row || fallback;
    if (!b) return null;
    const [store] = await this.manager.query(
      `select s.id, s.location, s.address, s.pincode, s.phone
         from stores s
         left join user_stores us on us.store_id = s.id and us.user_id = $2
        where s.business_id = $1 and s.active = true and s.archive = false
        order by (us.user_id is null), s.id limit 1`, [b.business_id, order.createdby || 0]);
    const licences = store ? await this.manager.query(`select license_type as type, number from store_license where store_id = $1 order by id`, [store.id]) : [];
    const byType: { [t: string]: string[] } = {};
    licences.forEach((l: any) => { (byType[l.type] = byType[l.type] || []).push(l.number); });
    const join = (...bits: any[]) => bits.map((x) => `${x || ''}`.trim()).filter(Boolean).join(', ');
    const storeAddress = store?.address ? join(store.address, store.pincode) : '';
    const businessAddress = join(b.baddr, b.bpin);
    return {
      name: b.legal_name || b.name,
      address: businessAddress || storeAddress,
      phone: store?.phone || '',
      gstin: b.gstin || '',
      licences: Object.keys(byType).map((t) => ({ label: LICENCE_LABELS[t] || 'Licence', numbers: byType[t].join(' | ') })),
      deliverTo: storeAddress && businessAddress && storeAddress !== businessAddress ? join(store.location, storeAddress, store.phone) : undefined,
    };
  }
}

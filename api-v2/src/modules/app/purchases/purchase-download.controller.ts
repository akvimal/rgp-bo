import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { Setting } from 'src/entities/setting.entity';
import { PurchaseService } from './purchase.service';

@ApiTags('PurchaseDownload')
@Controller('download')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PurchaseDownloadController {
  constructor(
    private readonly service: PurchaseService,
    @InjectRepository(Setting) private readonly settingRepository: Repository<Setting>
  ) {}

  @Post('po')
  async downloadPurchaseOrder(@Body() body: any, @Res() res: Response) {
    const order = await this.service.findOrderById(`${body?.id || ''}`);
    if (!order) {
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const [showBuyerDetails] = await Promise.all([
      this.getSettingBoolean('purchase_order_pdf_show_buyer_details', true),
    ]);

    const buffer = this.buildPdf(order, { showBuyerDetails });
    const filename = `PO-${order.id}.pdf`;
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

  private buildPdf(order: any, options: { showBuyerDetails: boolean }): Buffer {
    const content = this.createPdfContent(order, options);
    return this.createPdfDocument(content);
  }

  private createPdfContent(order: any, options: { showBuyerDetails: boolean }): string {
    const esc = (value: any) => `${value ?? ''}`
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    const fmtDate = (value: any) => {
      if (!value) return '-';
      const dt = new Date(value);
      return isNaN(dt.getTime()) ? `${value}` : dt.toLocaleDateString('en-GB');
    };
    const totalQty = (order.requests || []).reduce((sum: number, req: any) => sum + +(req.qty || 0), 0);

    const lines: string[] = [];
    const t = (x: number, y: number, text: string, font = 'F1', size = 10, color = '0 0 0') => {
      lines.push(`${color} rg ${color} RG`);
      lines.push(`BT /${font} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`);
    };
    const rect = (x: number, y: number, w: number, h: number, stroke = '0 0 0', fill?: string) => {
      if (fill) {
        lines.push(`${fill} rg ${x} ${y} ${w} ${h} re f`);
      }
      lines.push(`${stroke} RG 1 w ${x} ${y} ${w} ${h} re S`);
    };
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      lines.push(`0 0 0 RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`);
    };

    lines.push('q');
    lines.push('0.12 0.25 0.45 rg');
    lines.push('40 780 515 42 re f');
    t(52, 797, 'PURCHASE ORDER', 'F2', 16, '1 1 1');
    t(430, 797, `PO No: ${order.ponumber || order.id}`, 'F2', 12, '1 1 1');
    t(430, 783, `Date: ${fmtDate(order.createdon)}`, 'F1', 10, '1 1 1');
    lines.push('Q');
    lines.push('0 0 0 rg 0 0 0 RG');

    rect(40, 700, 515, 70);
    t(50, 752, 'Vendor', 'F2', 9);
    t(50, 736, order.vendor?.name || '-', 'F1', 10);
    t(50, 721, order.vendor?.address || '-', 'F1', 9);
    t(50, 708, `GSTIN: ${order.vendor?.gstn || '-'}`, 'F1', 9);

    if (options.showBuyerDetails) {
      t(315, 752, 'Buyer', 'F2', 9);
      t(315, 736, 'Ramesh Generic Pharmacy', 'F1', 10);
      t(315, 721, '1/256 Kalamegam Salai, 4th Street', 'F1', 9);
      t(315, 708, 'Mogappair West, Chennai - 600037', 'F1', 9);
    }

    const tableTop = 650;
    const headerHeight = 20;
    const rowHeight = 18;
    rect(40, tableTop, 515, headerHeight);
    lines.push('0.88 0.92 0.96 rg');
    lines.push(`40 ${tableTop} 515 ${headerHeight} re f`);
    lines.push('Q');
    t(52, 657, 'S.No', 'F2', 8.5);
    t(98, 657, 'Item', 'F2', 8.5);
    t(468, 657, 'Qty', 'F2', 8.5);

    let y = tableTop - rowHeight;
    (order.requests || []).forEach((req: any, index: number) => {
      rect(40, y, 515, rowHeight);
      t(52, y + 5, `${index + 1}`, 'F1', 9);
      t(98, y + 5, `${req.product?.title || '-'}`.slice(0, 42), 'F1', 9);
      t(468, y + 5, `${req.qty ?? '-'}`, 'F1', 9);
      y -= rowHeight;
    });

    const totalsY = y - 10;
    rect(40, totalsY - 18, 515, 42);
    t(50, totalsY + 7, `Total Items: ${(order.requests || []).length}`, 'F2', 9);
    t(50, totalsY - 6, `Total Qty: ${totalQty}`, 'F2', 9);

    const footerY = totalsY - 30;
    t(40, footerY, 'Terms & Conditions', 'F2', 9);
    t(40, footerY - 14, '1. Please supply the above items as per the agreed rates and schedule.', 'F1', 8);
    t(40, footerY - 26, '2. Goods should be delivered against this purchase order number.', 'F1', 8);
    t(40, footerY - 38, '3. Invoice should quote this PO number for settlement.', 'F1', 8);

    t(365, footerY - 10, 'Authorized Signatory', 'F2', 9);
    line(365, footerY - 25, 535, footerY - 25);
    t(365, footerY - 40, 'Vendor Acceptance', 'F2', 9);
    line(365, footerY - 55, 535, footerY - 55);

    return lines.join('\n');
  }

  private createPdfDocument(content: string): Buffer {
    const objects: string[] = [];
    objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
    objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
    objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj');
    objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
    objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj');
    objects.push(`6 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}\nendstream endobj`);

    let pdf = '%PDF-1.4\n';
    const offsets: string[] = ['0000000000 65535 f \n'];
    for (const obj of objects) {
      offsets.push(`${Buffer.byteLength(pdf, 'utf8').toString().padStart(10, '0')} 00000 n \n`);
      pdf += `${obj}\n`;
    }
    const xrefStart = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += offsets.join('');
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    pdf += `startxref\n${xrefStart}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
  }
}

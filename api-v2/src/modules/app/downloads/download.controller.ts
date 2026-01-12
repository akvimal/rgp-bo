import { Controller, Post, Body, Res, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { PurchaseService } from '../purchases/purchase.service';
import * as PDFDocument from 'pdfkit';

@ApiTags('Downloads')
@Controller('download')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DownloadController {

    constructor(private purchaseService: PurchaseService) {}

    @Post('po')
    @ApiOperation({ summary: 'Download Purchase Order as PDF' })
    async downloadPurchaseOrder(@Body() body: { id: number }, @Res() res: Response) {
        try {
            const order = await this.purchaseService.findOrderById(body.id.toString());

            if (!order) {
                throw new HttpException('Purchase Order not found', HttpStatus.NOT_FOUND);
            }

            // Create PDF document
            const doc = new PDFDocument({ size: 'A4', margin: 50 });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=PO-${order.id}.pdf`);

            // Pipe the PDF to response
            doc.pipe(res);

            // Header
            doc.fontSize(20).text('Purchase Order', { align: 'center' });
            doc.moveDown();

            // Company Info
            doc.fontSize(10)
                .text('Ramesh Generic Pharmacy', { align: 'center' })
                .text('1/256 Kalamegam Salai, 4th Street, Mogappair West', { align: 'center' })
                .text('Chennai - 600037', { align: 'center' });
            doc.moveDown(2);

            // PO Details
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text(`PO #: ${order.id}`);
            doc.font('Helvetica');
            if (order.ponumber) {
                doc.text(`PO Number: ${order.ponumber}`);
            }
            doc.text(`Status: ${order.status}`);
            doc.text(`Vendor: ${order.vendor?.name || 'N/A'}`);
            doc.text(`Date: ${new Date(order.createdon).toLocaleDateString()}`);
            doc.moveDown();

            if (order.comments) {
                doc.fontSize(10).text(`Comments: ${order.comments}`);
                doc.moveDown();
            }

            // Items Table Header
            doc.fontSize(12).text('Items:', { underline: true });
            doc.moveDown(0.5);

            // Table Header
            const tableTop = doc.y;
            const col1 = 50;
            const col2 = 80;
            const col3 = 350;
            const col4 = 450;

            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('#', col1, tableTop);
            doc.text('Product', col2, tableTop);
            doc.text('Quantity', col3, tableTop);
            doc.text('Type', col4, tableTop);

            doc.font('Helvetica');
            let yPosition = tableTop + 20;

            // Items
            if (order.requests && order.requests.length > 0) {
                order.requests.forEach((item, index) => {
                    if (yPosition > 700) {
                        doc.addPage();
                        yPosition = 50;
                    }

                    doc.text(`${index + 1}`, col1, yPosition);
                    doc.text(item.product?.title || 'N/A', col2, yPosition, { width: 260 });
                    doc.text(item.qty.toString(), col3, yPosition);
                    doc.text(item.requesttype || '-', col4, yPosition, { width: 100 });

                    if (item.comments) {
                        yPosition += 15;
                        doc.fontSize(8).fillColor('gray')
                            .text(`  ${item.comments}`, col2, yPosition, { width: 400 });
                        doc.fillColor('black').fontSize(10);
                    }

                    yPosition += 25;
                });
            } else {
                doc.text('No items in this purchase order', col2, yPosition);
            }

            // Footer
            doc.moveDown(3);
            doc.fontSize(10).text(`Total Items: ${order.requests?.length || 0}`, { align: 'right' });

            // Finalize PDF
            doc.end();

        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new HttpException('Failed to generate purchase order PDF', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}

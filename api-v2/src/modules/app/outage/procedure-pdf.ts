import { join } from 'path';
import PDFDocument = require('pdfkit');
import { procedureFor } from './outage-kit';
import { stamp } from './price-list-pdf';

const FONT_DIR = join(__dirname, '..', '..', '..', 'assets', 'fonts');

/**
 * The one page kept in the bill book: what the counter does when the power goes, in large plain steps, with blanks to write the numbers that
 * matter on the day (who to call, where the bill book starts). Printed from the Outage kit page.
 */
export function buildProcedurePdf(business: string, generatedAt: Date, pharmacy = true): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 36, left: 44, right: 44, bottom: 30 }, info: { Title: 'Outage procedure', Author: business } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('R', join(FONT_DIR, 'NotoSans-Regular.ttf'));
    doc.registerFont('B', join(FONT_DIR, 'NotoSans-Bold.ttf'));

    const W = 595 - 88;
    doc.font('B').fontSize(18).fillColor('#111827').text('If the power or the system goes', { width: W });
    doc.font('R').fontSize(9).fillColor('#6b7280').text(`${business}  ·  printed ${stamp(generatedAt)}`, { width: W });
    doc.moveDown(0.8);

    let n = 1;
    for (const section of procedureFor(pharmacy)) {
      doc.font('B').fontSize(13).fillColor('#1d4ed8').text(section.heading, { width: W });
      doc.moveDown(0.25);
      for (const step of section.steps) {
        doc.font('B').fontSize(11.5).fillColor('#111827').text(`${n}.`, 44, doc.y, { continued: true, width: W }).font('R').text(`  ${step}`, { width: W });
        doc.moveDown(0.3);
        n++;
      }
      doc.moveDown(0.5);
    }

    doc.moveDown(0.5);
    doc.font('B').fontSize(11).fillColor('#111827').text('Numbers to keep here', { width: W });
    doc.moveDown(0.3);
    for (const line of ['Store Head:', 'Owner:', 'Electrician:', 'Bill book starts at number:']) {
      doc.font('R').fontSize(11).fillColor('#111827').text(`${line}  ______________________________________`, { width: W });
      doc.moveDown(0.4);
    }
    doc.end();
  });
}

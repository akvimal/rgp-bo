import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { readFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { uploadedFilePath } from '../../files/upload-path';
import { ExtractedLine, Word, linesTotalWithTax, parseInvoice, toLines } from './invoice-parser';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png'];

/** letters and numbers apart ("500mg" is "500" and "mg"), lower case */
const tokens = (s: string) => (String(s ?? '').toLowerCase().match(/[a-z]+|\d+(?:\.\d+)?/g) || []);

/** how alike two names are, 0 to 1: shared words (a word of 4+ letters also counts when one starts with the other) */
export function nameScore(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return 0;
  const left = [...y];
  let common = 0;
  for (const t of x) {
    let i = left.indexOf(t);
    if (i < 0 && t.length >= 4) i = left.findIndex((u) => u.length >= 4 && (u.startsWith(t) || t.startsWith(u)));
    if (i >= 0) { common++; left.splice(i, 1); }
  }
  return (2 * common) / (x.length + y.length);
}

/**
 * Reads an invoice copy that was already uploaded: the text of a PDF, or OCR of a photo, then the header and the item table,
 * then the vendor and each product matched against the master. Nothing is saved; the person reviews and fills the form.
 */
@Injectable()
export class InvoiceExtractService {
  private readonly log = new Logger(InvoiceExtractService.name);
  private products: { at: number; rows: any[] } = { at: 0, rows: [] };

  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  // ---------------------------------------------------------------------------------------------- reading the file
  private async pdfWords(buf: Buffer): Promise<Word[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
    const words: Word[] = [];
    try {
      for (let p = 1; p <= Math.min(doc.numPages, 10); p++) {
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        for (const it of tc.items as any[]) {
          const t = String(it.str ?? '');
          if (!t.trim()) continue;
          const x0 = it.transform[4];
          const h = Math.abs(it.height || it.transform[3] || 8);
          const yBase = vp.height - it.transform[5];                                 // top-down, like an image
          words.push({ t, x0, x1: x0 + (it.width || t.length * h * 0.5), y0: yBase - h, y1: yBase, page: p });
        }
      }
    } finally { try { await doc.destroy(); } catch { /* ignore */ } }
    return words;
  }

  private async imageWords(buf: Buffer): Promise<Word[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require('tesseract.js');
    const langDir = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
    const worker = await createWorker('eng', 1, { langPath: langDir, gzip: true, cachePath: join(process.env.TMPDIR || '/tmp', 'tess-cache'), logger: () => undefined });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
      const { data } = await worker.recognize(buf);
      return (data.words || []).filter((w: any) => String(w.text || '').trim()).map((w: any) => ({
        t: String(w.text), x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, page: 1,
      }));
    } finally { await worker.terminate(); }
  }

  // ---------------------------------------------------------------------------------------------- matching
  private async catalog() {
    if (Date.now() - this.products.at > 60_000) {
      this.products = { at: Date.now(), rows: await this.manager.query(`select id, title, pack, tax_pcnt::float as tax_pcnt from product where active = true and archive = false`) };
    }
    return this.products.rows;
  }

  private async suggest(lines: ExtractedLine[]) {
    const cat = await this.catalog();
    const index = cat.map((p: any) => ({ p, tk: tokens(p.title) }));
    return lines.map((l) => {
      const scored = index.map(({ p }) => ({ p, s: nameScore(l.description, p.title) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, 3);
      return scored.map((x) => ({ id: x.p.id, title: x.p.title, score: Math.round(x.s * 100) / 100, tax_pcnt: x.p.tax_pcnt, pack: x.p.pack }));
    });
  }

  private async matchVendor(gstin: string | null, name: string | null) {
    const vendors = await this.manager.query(`select id, business_name as name, gstn from vendor where active = true and archive = false`);
    if (gstin) {
      const v = vendors.find((x: any) => String(x.gstn || '').toUpperCase() === gstin);
      if (v) return { id: v.id, name: v.name, matchedBy: 'GSTIN' };
    }
    if (name) {
      const ranked = vendors.map((x: any) => ({ x, s: nameScore(name, x.name) })).sort((a: any, b: any) => b.s - a.s);
      if (ranked[0] && ranked[0].s >= 0.6) return { id: ranked[0].x.id, name: ranked[0].x.name, matchedBy: 'name' };
    }
    return null;
  }

  // ---------------------------------------------------------------------------------------------- the whole read
  async extract(path: string) {
    const file = uploadedFilePath(path);
    const ext = extname(file).toLowerCase();
    const buf = readFileSync(file);
    let words: Word[];
    let method: 'pdf' | 'ocr';
    const started = Date.now();
    try {
      if (ext === '.pdf') {
        method = 'pdf';
        words = await this.pdfWords(buf);
        if (words.map((w) => w.t).join('').length < 30) {
          throw new BadRequestException('This PDF is a scan with no text in it. Upload a photo (JPG or PNG) of each page of the invoice instead.');
        }
      } else if (IMAGE_EXT.includes(ext)) {
        method = 'ocr';
        words = await this.imageWords(buf);
      } else {
        throw new BadRequestException('Only a PDF, JPG or PNG copy of the invoice can be read.');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.log.error(`invoice copy could not be read: ${(e as Error).message}`);
      throw new BadRequestException('The invoice copy could not be read. Enter the invoice by hand, or try a clearer photo.');
    }

    const textLines = toLines(words);
    const [biz] = await this.manager.query(`select gstin from business where active = true order by id limit 1`).catch(() => [null]);
    const parsed = parseInvoice(textLines, { ownGstin: biz?.gstin || null });
    const suggestions = await this.suggest(parsed.lines);
    const vendor = await this.matchVendor(parsed.header.suppliergstin, parsed.header.suppliername);
    const warnings = [...parsed.warnings];
    if (method === 'ocr') warnings.unshift('Read from a photo: check every number against the invoice.');
    if (parsed.tableFound && !parsed.header.invoiceno) warnings.push('The invoice number was not found.');

    return {
      method,
      ms: Date.now() - started,
      text: textLines.map((l) => l.text).join('\n'),
      header: parsed.header,
      vendor,
      lines: parsed.lines.map((l, i) => ({ ...l, suggestions: suggestions[i], product: suggestions[i][0] && suggestions[i][0].score >= 0.9 ? suggestions[i][0] : null     // only a near-identical name is chosen for the person })),
      linesTotal: linesTotalWithTax(parsed.lines),
      warnings,
    };
  }
}

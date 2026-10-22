import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { readFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { uploadedFilePath } from '../../files/upload-path';
import { ExtractedLine, ParsedInvoice, TextLine, Word, cashFactor, linesTotalWithTax, parseInvoice, readDate, toLines } from './invoice-parser';
import { prepare } from './image-prep';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png'];

/** the GST rates (percent) an invoice line may carry: GST_RATES in the environment, "0,5,12,18" unless set */
export function gstRates(): number[] {
  const list = String(process.env.GST_RATES || '0,5,12,18').split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  return Array.from(new Set(list)).sort((a, b) => a - b);
}
const MAX_PAGES = 5;
const PAGE_SCALE = 3;                 // a scanned page is drawn at 3x before OCR: fine print needs the pixels
const MAX_PHOTO_WIDTH = 2800;

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

/** pdfjs wants these in a Node process to draw a page; the canvas library provides them */
function nodeCanvas() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nc = require('@napi-rs/canvas');
  const g: any = globalThis;
  if (!g.DOMMatrix) g.DOMMatrix = nc.DOMMatrix;
  if (!g.Path2D) g.Path2D = nc.Path2D;
  if (!g.ImageData) g.ImageData = nc.ImageData;
  return nc;
}

class CanvasFactory {
  constructor(private readonly nc: any) {}
  create(width: number, height: number) { const canvas = this.nc.createCanvas(width, height); return { canvas, context: canvas.getContext('2d') }; }
  reset(c: any, width: number, height: number) { c.canvas.width = width; c.canvas.height = height; }
  destroy(c: any) { c.canvas.width = 0; c.canvas.height = 0; c.canvas = null; c.context = null; }
}

/**
 * Reads an invoice copy that was already uploaded: the text of a PDF, or OCR of a scan or photo, then the header and the item
 * table, then the vendor and each product matched against the master. Nothing is saved; the person reviews and fills the form.
 */
@Injectable()
export class InvoiceExtractService {
  private readonly log = new Logger(InvoiceExtractService.name);
  private products: { version: string; rows: any[] } = { version: '', rows: [] };

  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  // ---------------------------------------------------------------------------------------------- reading the file
  private async openPdf(buf: Buffer) {
    const nc = nodeCanvas();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    return pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true, verbosity: 0, canvasFactory: new CanvasFactory(nc) }).promise;
  }

  /** the text a PDF carries (a digital invoice has it; a scan has none, or the junk a scanner's own OCR left behind) */
  private async pdfWords(doc: any): Promise<Word[]> {
    const words: Word[] = [];
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
    return words;
  }

  /** the pages drawn as pictures (a page's own rotation is applied), cleaned up for OCR */
  private async pdfPictures(doc: any, clean = true) {
    const nc = nodeCanvas();
    const factory = new CanvasFactory(nc);
    const out: any[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: PAGE_SCALE });
      const c = factory.create(Math.ceil(vp.width), Math.ceil(vp.height));
      await page.render({ canvasContext: c.context, viewport: vp, canvasFactory: factory }).promise;
      out.push(clean ? prepare(c.canvas) : c.canvas);
    }
    return out;
  }

  private async photoPicture(buf: Buffer, clean = true) {
    const nc = nodeCanvas();
    const img = await nc.loadImage(buf);
    const scale = img.width > MAX_PHOTO_WIDTH ? MAX_PHOTO_WIDTH / img.width : 1;
    const c = nc.createCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return clean ? prepare(c) : c;
  }

  /** OCR of pictures, one page after another with one worker; words carry their page number */
  private async ocrWords(pictures: any[]): Promise<Word[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require('tesseract.js');
    const langDir = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
    const worker = await createWorker('eng', 1, { langPath: langDir, gzip: true, cachePath: join(process.env.TMPDIR || '/tmp', 'tess-cache'), logger: () => undefined });
    const words: Word[] = [];
    try {
      // sparse text finds the words of a table; block mode scrambles a table's header row
      await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
      for (let i = 0; i < pictures.length; i++) {
        const { data } = await worker.recognize(pictures[i].toBuffer('image/png'));
        for (const w of data.words || []) {
          if (!String(w.text || '').trim()) continue;
          words.push({ t: String(w.text), x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, page: i + 1 });
        }
      }
    } finally { await worker.terminate(); }
    return words;
  }

  /**
   * The invoice date is often the one thing OCR garbles on a scan (it prints in a different style). When the "Date" label was read
   * but no date came with it, the strip to the right of the label is read again on its own, digits only; the separators may come
   * back as nothing ("011026"), which is taken as day, month, year.
   */
  private async rereadDate(pictures: any[], words: Word[]): Promise<string | null> {
    const label = words.filter((w) => w.page === 1 && /^date\b/i.test(w.t)).sort((a, b) => a.y0 - b.y0)[0];
    const pic = pictures[0];
    if (!label || !pic || label.y0 > pic.height * 0.6) return null;
    const nc = nodeCanvas();
    const h = label.y1 - label.y0;
    const x0 = Math.round(label.x1), y0 = Math.max(0, Math.round(label.y0 - h * 0.4));
    const cw = Math.round(Math.min(pic.width - x0, h * 9)), ch = Math.round(h * 1.8);
    if (cw < 20 || ch < 10) return null;
    const crop = nc.createCanvas(cw * 2, ch * 2);
    const cx = crop.getContext('2d');
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, crop.width, crop.height);
    cx.drawImage(pic, x0, y0, cw, ch, 0, 0, crop.width, crop.height);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker } = require('tesseract.js');
    const langDir = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
    const worker = await createWorker('eng', 1, { langPath: langDir, gzip: true, cachePath: join(process.env.TMPDIR || '/tmp', 'tess-cache'), logger: () => undefined });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '8', tessedit_char_whitelist: '0123456789/-. ' });
      const text = String((await worker.recognize(crop.toBuffer('image/png'))).data.text || '').trim();
        const direct = readDate(text);
      const compact = text.replace(/\D/g, '').match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);
      const made = compact ? readDate(`${compact[1]}/${compact[2]}/${compact[3]}`) : null;
      const found = direct || made;
      return found && +found.slice(0, 4) >= 2015 && +found.slice(0, 4) <= 2060 ? found : null;
    } finally { await worker.terminate(); }
  }

  // ---------------------------------------------------------------------------------------------- matching
  /** the product list, reloaded when a product is added or changed (a cheap count and last-changed check on every read) */
  private async catalog() {
    const [v] = await this.manager.query(`select count(*)::int as n, max(updated_on) as last from product where active = true and archive = false`);
    const version = `${v.n}|${v.last ? new Date(v.last).toISOString() : ''}`;
    if (version !== this.products.version) {
      this.products = { version, rows: await this.manager.query(`select id, title, pack, tax_pcnt::float as tax_pcnt, (coalesce(more_props->>'noexpiry', '') = 'true') as noexpiry from product where active = true and archive = false`) };
    }
    return this.products.rows;
  }

  private async suggest(lines: ExtractedLine[]) {
    const cat = await this.catalog();
    return lines.map((l) => {
      const scored = cat.map((p: any) => ({ p, s: nameScore(l.description, p.title) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, 3);
      return scored.map((x) => ({ id: x.p.id, title: x.p.title, score: Math.round(x.s * 100) / 100, tax_pcnt: x.p.tax_pcnt, pack: x.p.pack, noexpiry: !!x.p.noexpiry }));
    });
  }

  private matchVendor(vendors: any[], gstin: string | null, name: string | null) {
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
    const started = Date.now();
    const [biz] = await this.manager.query(`select gstin from business where active = true order by id limit 1`).catch(() => [null]);
    const vendors = await this.manager.query(`select id, business_name as name, gstn from vendor where active = true and archive = false`);
    const knownGstins = vendors.map((v: any) => String(v.gstn || '').toUpperCase()).filter((g: string) => !!g);
    const parse = (words: Word[]) => { const lines = toLines(words); return { lines, parsed: parseInvoice(lines, { ownGstin: biz?.gstin || null, knownGstins }) }; };
    const usable = (p: ParsedInvoice) => p.tableFound && p.lines.length > 0;
    // cleaning the picture helps the table but can lose a line of the header: when the header lacks a field, a plain pass fills the gaps
    const missing = (p: ParsedInvoice) => !p.header.invoiceno || !p.header.invoicedate || !p.header.printedtotal;
    const fillGaps = (to: ParsedInvoice, from: ParsedInvoice) => {
      const h: any = to.header, g: any = from.header;
      for (const k of Object.keys(h)) if ((h[k] === null || h[k] === undefined) && g[k] !== null && g[k] !== undefined) h[k] = g[k];
    };

    let textLines: TextLine[];
    let parsed: ParsedInvoice;
    let method: 'pdf' | 'pdf-ocr' | 'ocr';
    try {
      if (ext === '.pdf') {
        const doc = await this.openPdf(buf);
        try {
          const words = await this.pdfWords(doc);
          const fromText = words.map((w) => w.t).join('').length >= 30 ? parse(words) : null;     // some text on the page (a one-row invoice has few words)
          if (fromText && usable(fromText.parsed)) {
            method = 'pdf';
            ({ lines: textLines, parsed } = fromText);
          } else {
            // a scan: no text, or the junk a scanner left. Draw the pages and read them as pictures.
            const pics = await this.pdfPictures(doc);
            const ocrAll = await this.ocrWords(pics);
            const ocr = parse(ocrAll);
            if (ocr.lines.length && !ocr.parsed.header.invoicedate) ocr.parsed.header.invoicedate = await this.rereadDate(pics, ocrAll);
            if (ocr.lines.length && missing(ocr.parsed)) fillGaps(ocr.parsed, parse(await this.ocrWords(await this.pdfPictures(doc, false))).parsed);
            if (!ocr.lines.length) throw new BadRequestException('Nothing could be read from this PDF. Try a clearer scan or a photo of the invoice.');
            method = 'pdf-ocr';
            const better = fromText && fromText.parsed.lines.length > ocr.parsed.lines.length ? fromText : ocr;
            method = better === ocr ? 'pdf-ocr' : 'pdf';
            ({ lines: textLines, parsed } = better);
          }
        } finally { try { await doc.destroy(); } catch { /* ignore */ } }
      } else if (IMAGE_EXT.includes(ext)) {
        method = 'ocr';
        const pic = await this.photoPicture(buf);
        const photoWords = await this.ocrWords([pic]);
        ({ lines: textLines, parsed } = parse(photoWords));
        if (usable(parsed) && !parsed.header.invoicedate) parsed.header.invoicedate = await this.rereadDate([pic], photoWords);
        if (usable(parsed) && missing(parsed)) fillGaps(parsed, parse(await this.ocrWords([await this.photoPicture(buf, false)])).parsed);
      } else {
        throw new BadRequestException('Only a PDF, JPG or PNG copy of the invoice can be read.');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.log.error(`invoice copy could not be read: ${(e as Error).stack || (e as Error).message}`);
      throw new BadRequestException('The invoice copy could not be read. Enter the invoice by hand, or try a clearer photo.');
    }

    const suggestions = await this.suggest(parsed.lines);
    const vendor = this.matchVendor(vendors, parsed.header.suppliergstin, parsed.header.suppliername);
    const warnings = [...parsed.warnings];
    if (method !== 'pdf') warnings.unshift(method === 'pdf-ocr' ? 'This PDF is a scan, so it was read as a picture: check every number against the invoice.' : 'Read from a photo: check every number against the invoice.');
    if (parsed.tableFound && !parsed.header.invoiceno) warnings.push('The invoice number was not found.');
    if (parsed.header.cashdiscount) warnings.push(`A cash discount of ${parsed.header.cashdiscount.pct ? parsed.header.cashdiscount.pct + '% = ' : ''}${parsed.header.cashdiscount.amount.toFixed(2)} is printed under the goods value. It is not a line, so the lines come to more than the invoice total by that much (before tax).`);

    return {
      method,
      ms: Date.now() - started,
      text: textLines.map((l) => l.text).join('\n'),
      header: parsed.header,
      vendor,
      lines: parsed.lines.map((l, i) => ({ ...l, suggestions: suggestions[i], product: suggestions[i][0] && suggestions[i][0].score >= 0.9 ? suggestions[i][0] : null })),
      linesTotal: linesTotalWithTax(parsed.lines, parsed.header),
      cashFactor: cashFactor(parsed.lines, parsed.header),
      gstRates: gstRates(),
      warnings,
    };
  }
}

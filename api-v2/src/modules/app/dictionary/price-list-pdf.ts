import { TextPiece } from './price-list-rules';

/** the text pieces of every page of a PDF, with where each starts (x from the left, y from the bottom), for the price list reader */
export async function pdfPieces(buf: Buffer): Promise<TextPiece[][]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const pages: TextPiece[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it: any) => ({ x: Math.round(it.transform[4] * 10) / 10, y: Math.round(it.transform[5] * 10) / 10, str: String(it.str ?? '') })));
    page.cleanup();
  }
  await doc.destroy();
  return pages;
}

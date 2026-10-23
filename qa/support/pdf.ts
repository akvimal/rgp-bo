import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/** the text of each page of a PDF, as a list of lines (for checking what a downloaded document says) */
export async function pdfPages(buf: Buffer): Promise<string[]> {
  const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // one line per row of text: items on the same baseline are joined left to right
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      if (!`${it.str}`.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      rows.set(key, [...(rows.get(key) || []), { x: it.transform[4], s: it.str }]);
    }
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ')).join('\n'));
  }
  return pages;
}

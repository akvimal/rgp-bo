import * as ExcelJS from 'exceljs';
import { Mapping, Parsed, parseTable, parseText } from './statement-parser';

/** an Excel cell as the text a person would see */
function cellText(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellText((v as any).result);
    if ('richText' in v) return (v as any).richText.map((t: any) => t.text).join('');
    if ('text' in v) return String((v as any).text);
  }
  return String(v);
}

/**
 * A statement file from any bank: text or CSV, or an Excel sheet. Read in memory; the file is not kept, only the lines parsed from it.
 * Dates in an Excel sheet come out as year-month-day, whatever the sheet shows.
 */
export async function readStatement(buffer: Buffer, filename: string, override?: Partial<Mapping>): Promise<Parsed> {
  if (/\.xlsx$/i.test(filename || '')) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    const table: string[][] = [];
    ws?.eachRow({ includeEmpty: false }, (row) => {
      const cells = (row.values as any[]).slice(1).map(cellText);
      while (cells.length && !cells[cells.length - 1].trim()) cells.pop();
      if (cells.length) table.push(cells);
    });
    // ragged rows are padded to the widest, so a short row is not mistaken for a footer
    const width = Math.max(0, ...table.map((r) => r.length));
    return parseTable(table.map((r) => [...r, ...Array(width - r.length).fill('')]), ',', override);
  }
  let text = buffer.toString('utf8');
  if (text.includes('�')) text = buffer.toString('latin1');
  return parseText(text, override);
}

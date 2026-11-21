import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { parseDelimited, withHeader } from './drug-ref-rules';

export interface Table { headers: string[]; records: Record<string, string>[] }

const MAX_ROWS = 50000;

/** the text of a cell, whatever Excel kept in it (a number, a date, a formula result, rich text) */
function cellText(c: ExcelJS.Cell): string {
  const v: any = c.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  if (typeof v === 'number') return String(v);
  return String(c.text ?? '').trim();
}

/** a CSV (comma, semicolon or tab separated) or an Excel (.xlsx) file as headings and rows; the first row with anything in it is the headings */
export async function readTable(buf: Buffer, fileName: string): Promise<Table> {
  if (!buf?.length) throw new BadRequestException('Choose a CSV or Excel (.xlsx) file.');
  const isXlsx = /\.xlsx$/i.test(fileName) || buf.subarray(0, 2).toString('latin1') === 'PK';
  let grid: string[][];
  if (isXlsx) {
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(buf as any); } catch { throw new BadRequestException('That Excel file could not be read. Save it as .xlsx and try again.'); }
    const ws = wb.worksheets.find((w) => w.rowCount > 0);
    if (!ws) throw new BadRequestException('The Excel file has no data.');
    grid = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let i = 1; i <= row.cellCount; i++) cells.push(cellText(row.getCell(i)));
      grid.push(cells);
    });
  } else {
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delimiter = ['\t', ';', ','].map((d) => [d, first.split(d).length] as [string, number]).sort((a, b) => b[1] - a[1])[0][0];
    grid = parseDelimited(text, delimiter);
  }
  grid = grid.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (grid.length < 2) throw new BadRequestException('The file needs a heading row and at least one row of prices.');
  if (grid.length > MAX_ROWS + 1) throw new BadRequestException(`The file has more than ${MAX_ROWS} rows; split it.`);
  const { headers, records } = withHeader(grid);
  const cleaned = headers.map((h, i) => (h || `Column ${i + 1}`));
  return { headers: cleaned, records: records.map((r) => Object.fromEntries(headers.map((h, i) => [cleaned[i], r[h]]))) };
}

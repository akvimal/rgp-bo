import { classifyForm } from './dosage-form';
import { compositionKey } from '../sales/composition-match';

/**
 * Pure rules for a printed generic price list (the PMBI Jan Aushadhi list: Sr. No., Drug Code, Generic Name, Unit Size, MRP). The PDF reader hands over the text
 * pieces of each page with their positions; the rows are rebuilt from them here, and each generic name is turned into a composition and a dosage form so it
 * can be matched with the shop's products. Nothing is guessed: a row that cannot be read is skipped with its reason.
 */

export interface TextPiece { x: number; y: number; str: string }
export interface PriceListRow {
  sr: number; code: string; name: string; unitSize: string; packQty: number | null; packKind: 'units' | 'ml' | 'g' | 'other'; mrp: number; sellPrice: number | null;
  composition: string | null; compositionKey: string | null; saltsKey: string | null; hasStrength: boolean; form: string | null;
}
export interface PriceListRead { rows: PriceListRow[]; problems: string[]; pages: number }

/** the column a text piece belongs to, by where it starts (the layout of the published list: checked against its header on each page) */
// a name line starts at the left edge of its column; the unit text (centred, so it may start earlier) begins well to the right
const COLS = { sr: [0, 120], code: [120, 225], name: [225, 300], unit: [300, 470], mrp: [470, 1000] } as const;
const col = (x: number): keyof typeof COLS | null => (Object.keys(COLS) as (keyof typeof COLS)[]).find((k) => x >= COLS[k][0] && x < COLS[k][1]) ?? null;

/** lines of one name are this far apart; a gap clearly bigger than that starts the next row's name */
const LINE_PITCH = 18;
const BLOCK_GAP = 21;

/** words that say the form or the pharmacopoeia, not the ingredient */
const NOISE = new Set(('tablet tablets capsule capsules oral solution suspension syrup injection cream ointment gel drops drop eye ear nasal film coated extended release prolonged ' +
  'modified delayed chewable dispersible powder for sachet topical inhalation inhaler spray sustained enteric gastro resistant soft hard sublingual lotion infusion vial ' +
  'ampoule concentrate emulsion granules lozenge paste ip bp usp paediatric pediatric adult dry suspension reconstitution and with in wfi').split(' '));
const isNoise = (w: string) => w.toLowerCase().replace(/[(),]/g, '').split('-').every((x) => NOISE.has(x));

const STRENGTH = /^(\d[\d.,]*\s*(?:%\s*w\s*\/\s*[wv]|%|mg|mcg|g|ml|iu|units?|million\s+units?|lakh\s+units?)(?:\s*per\s*\d*[\d.]*\s*(?:ml|g|mg|actuation|dose))?)/i;

/**
 * "Aceclofenac 100mg and Paracetamol 325mg Tablets" / "Aceclofenac Tablets IP 100 mg" / "Chlorzoxazone 500mg, Diclofenac 50mg and Paracetamol 325mg Tablets"
 * -> "Aceclofenac 100 mg + Paracetamol 325 mg", and the form the name says. Brackets (the salt the product is made from) are left out.
 */
export function compositionOfListName(name: string): { composition: string | null; form: string | null } {
  let plain = name.replace(/\([^)]*\)/g, ' ');
  // "Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg) Tablets": the ingredients with their strengths are the ones in the brackets
  if (!/\d/.test(plain)) { const inside = /\(([^()]*\d[^()]*)\)/.exec(name); if (inside) plain = inside[1] + ' ' + plain; }
  const form = classifyForm(plain);
  const text = plain.replace(/\s+/g, ' ').trim();
  const parts = text.split(/\s*,\s*|\s+and\s+|\s+\+\s+/i).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const at = p.search(/\d/);
    if (at < 0) continue;                                                   // a part with no strength is not an ingredient with a dose (a trailing form word)
    const words = p.slice(0, at).split(/\s+/).filter(Boolean).filter((w) => !isNoise(w));
    const m = STRENGTH.exec(p.slice(at));
    if (!words.length || !m) continue;
    out.push(`${words.join(' ')} ${m[1].replace(/\s+/g, ' ').replace(/(\d)\s*(mg|mcg|g|ml|iu)\b/i, '$1 $2')}`);
  }
  return { composition: out.length ? out.join(' + ') : null, form };
}

/** "10's" -> 10 units; "15 g" -> 15 g; "60 ml" -> 60 ml; "2 ml Vial" -> 2 ml; "Vial & Wfi" -> no quantity */
export function packOf(unit: string): { qty: number | null; kind: PriceListRow['packKind'] } {
  const t = unit.trim().toLowerCase();
  let m = /^(\d+)\s*'?s\b/.exec(t);
  if (m) return { qty: Number(m[1]), kind: 'units' };
  m = /^(\d+(?:\.\d+)?)\s*(ml|g|gm)\b/.exec(t);
  if (m) return { qty: Number(m[1]), kind: m[2] === 'ml' ? 'ml' : 'g' };
  return { qty: null, kind: 'other' };
}

const num = (s: string): number | null => { const n = parseFloat(s.replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null; };

/** the rows of one page: each row is anchored by its Sr. No.; the name lines (several, centred on that row) are split into blocks by their spacing and taken in order */
export function rowsOfPage(pieces: TextPiece[], pageNo: number, problems: string[]): PriceListRow[] {
  const items = pieces.filter((p) => p.str.trim() !== '');
  const anchors = items.filter((p) => col(p.x) === 'sr' && /^\d+$/.test(p.str.trim())).sort((a, b) => b.y - a.y);
  if (!anchors.length) return [];
  const nameLines = items.filter((p) => col(p.x) === 'name').sort((a, b) => b.y - a.y);
  const blocks: TextPiece[][] = [];
  for (const l of nameLines) {
    const last = blocks[blocks.length - 1];
    if (last && last[last.length - 1].y - l.y <= BLOCK_GAP) last.push(l); else blocks.push([l]);
  }
  // the heading is not a row's name (a long name can start above its own row, so position cannot tell them apart)
  const body = blocks.filter((b) => !/^generic name$/i.test(b[0].str.trim()));
  if (body.length !== anchors.length) { problems.push(`page ${pageNo}: ${anchors.length} rows but ${body.length} names, page skipped`); return []; }
  const rows: PriceListRow[] = [];
  anchors.forEach((a, i) => {
    const at = (c: keyof typeof COLS) => items.filter((p) => col(p.x) === c && Math.abs(p.y - a.y) < 4).sort((x, y) => x.x - y.x).map((p) => p.str.trim()).join(' ').trim();
    const block = body[i];
    // the name is centred on its row: a block that is not is the wrong block
    const centre = (block[0].y + block[block.length - 1].y) / 2;
    const sr = Number(a.str.trim());
    if (Math.abs(centre - a.y) > 6) { problems.push(`row ${sr} (page ${pageNo}): the name does not line up with its row, skipped`); return; }
    let name = '';
    for (const l of block) { const s = l.str.trim(); name += name && !name.endsWith('-') ? ' ' + s : s; }
    const unitSize = at('unit'), mrp = num(at('mrp'));
    const code = at('code');
    if (!name) { problems.push(`row ${sr} (page ${pageNo}): no name, skipped`); return; }
    if (mrp === null || mrp <= 0) { problems.push(`row ${sr} (page ${pageNo}): MRP ${mrp ?? 'missing'}, skipped`); return; }
    const { composition, form } = compositionOfListName(name);
    const key = composition ? compositionKey(composition) : null;
    const pack = packOf(unitSize);
    rows.push({ sr, code, name, unitSize, packQty: pack.qty, packKind: pack.kind, mrp, sellPrice: null, composition, compositionKey: key?.key ?? null, saltsKey: key?.salts ?? null, hasStrength: !!key?.hasStrength, form });
  });
  return rows;
}

/** every page of the list: the header row is checked, and the rows are rebuilt */
export function readPriceList(pages: TextPiece[][]): PriceListRead {
  const problems: string[] = [];
  const rows: PriceListRow[] = [];
  pages.forEach((p, i) => {
    if (i === 0 && !p.some((x) => /generic name/i.test(x.str)) ) problems.push('the first page has no "Generic Name" heading: this does not look like the price list');
    rows.push(...rowsOfPage(p, i + 1, problems));
  });
  const seen = new Set<number>();
  const unique = rows.filter((r) => (seen.has(r.sr) ? false : (seen.add(r.sr), true)));
  return { rows: unique, problems, pages: pages.length };
}

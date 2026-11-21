/**
 * Pure rules for the online price lookup of a brand from the dictionary (the dictionary has no prices). A model with web search is asked what each pharmacy
 * site lists (its pack, MRP and selling price); every site is checked on its own and the sites are compared per unit before anything is shown or kept.
 * Nothing is guessed: an answer that does not pass is "not found", with the reason.
 */

export const FRESH_DAYS = 30;
export const MAX_SOURCES = 5;

export interface BrandForPrice { brand: string; composition: string | null; manufacturer: string | null; formLabel: string | null; }
export interface PriceSource { url: string; title: string }
/** what one site said, per pack and per unit, and what became of it: used for the figures, differing from the others, or not valid on its own */
export interface Listing {
  site: string; url: string | null; packText: string | null; packUnits: number | null;
  mrp: number | null; sell: number | null; unitMrp: number | null; unitSell: number | null;
  status: 'used' | 'differs' | 'invalid'; problem: string | null;
}
export interface PriceAnswer {
  found: boolean;
  note: string;
  packUnits: number | null;
  packText: string | null;
  mrp: number | null;
  sellMin: number | null;
  sellMax: number | null;
  unitMrp: number | null;
  unitSellMin: number | null;
  unitSellMax: number | null;
  listings: Listing[];
  sources: PriceSource[];
}

export const PRICE_SYSTEM = [
  'You look up the retail price of one medicine brand sold in India, using web search.',
  'Use only what the pages you find say. Never guess, never convert from another country, never use a price for a different strength or pack.',
  'Report each site separately, with the pack that site lists. MRP is the printed maximum retail price for that pack; the selling price is what that site charges for the same pack and can never be above its MRP.',
  'Reply with one JSON object and nothing else.',
].join(' ');

export function priceInstruction(b: BrandForPrice): string {
  return [
    `Medicine brand: ${b.brand}`,
    b.manufacturer ? `Manufacturer: ${b.manufacturer}` : '',
    b.formLabel ? `Form: ${b.formLabel}` : '',
    b.composition ? `Composition: ${b.composition}` : '',
    '',
    'Find this exact brand and strength on two to five Indian pharmacy or drug information sites. For each site give the pack it lists, that pack MRP and that site selling price.',
    'Reply with JSON: {"found": true or false, "listings": [{"site": "1mg", "url": "page address", "pack_text": "strip of 10 tablets", "pack_units": whole number of tablets, capsules or ml in that pack,',
    '"mrp": number, "selling_price": number or null}], "note": "one short sentence"}.',
    'Take each figure from the same page as its pack. If you cannot find this exact brand and strength with a price, reply {"found": false, "note": "why"}.',
  ].filter(Boolean).join('\n');
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: any): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** the JSON object in a model's text (it may wrap it in words or a code fence) */
export function jsonIn(text: string): any {
  const s = String(text || '');
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return undefined; }
}

/** only http(s) links, once each, a few of them, with a short title */
export function cleanSources(list: { url?: any; title?: any }[] | undefined): PriceSource[] {
  const seen = new Set<string>();
  const out: PriceSource[] = [];
  for (const s of list || []) {
    const url = String(s?.url || '').trim();
    if (!/^https?:\/\/[^\s]+$/i.test(url) || url.length > 500 || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, title: String(s?.title || '').trim().slice(0, 120) });
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

const none = (note: string, sources: PriceSource[] = [], listings: Listing[] = []): PriceAnswer =>
  ({ found: false, note: note.slice(0, 300), packUnits: null, packText: null, mrp: null, sellMin: null, sellMax: null, unitMrp: null, unitSellMin: null, unitSellMax: null, listings, sources });

/** one site as the model gave it, checked on its own: an MRP, a whole pack size, and a selling price that is not above that site's own MRP */
function checkListing(raw: any): Listing {
  const site = String(raw?.site || '').trim().slice(0, 40) || 'a site';
  const url = /^https?:\/\/[^\s]+$/i.test(String(raw?.url || '').trim()) ? String(raw.url).trim().slice(0, 500) : null;
  const packText = String(raw?.pack_text || '').trim().slice(0, 80) || null;
  const mrp = num(raw?.mrp), packUnits = num(raw?.pack_units);
  let sell = num(raw?.selling_price ?? raw?.sell);
  const bad = (problem: string): Listing => ({ site, url, packText, packUnits: packUnits !== null && Number.isInteger(packUnits) ? packUnits : null, mrp: mrp === null ? null : r2(mrp), sell: sell === null ? null : r2(sell),
    unitMrp: null, unitSell: null, status: 'invalid', problem });
  if (mrp === null || mrp <= 0 || mrp > 100000) return bad('no usable MRP');
  if (packUnits === null || !Number.isInteger(packUnits) || packUnits < 1 || packUnits > 1000) return bad('pack size not clear');
  if (sell !== null && sell <= 0) sell = null;
  if (sell !== null && sell > mrp + 0.005) return bad('selling price is above its own MRP');
  return { site, url, packText, packUnits, mrp: r2(mrp), sell: sell === null ? null : r2(sell), unitMrp: r4(mrp / packUnits), unitSell: sell === null ? null : r4(sell / packUnits), status: 'used', problem: null };
}

/**
 * The checked answer. Each site is checked on its own, then the sites are compared per unit: the MRP most sites agree on is the one shown (a tie goes to the
 * higher, as MRPs only rise), and a site whose MRP differs is listed as "differs" and left out of the figures. The selling range is the used sites' selling
 * prices, per unit and for the pack shown. Needs at least one site that passes and at least one source link. A reply in the older single-answer shape
 * (an MRP at the top, no list of sites) is read as one site.
 */
export function parsePriceAnswer(text: string, sources: { url?: any; title?: any }[] | undefined): PriceAnswer {
  const a = jsonIn(text);
  const rows: any[] = Array.isArray(a?.listings) ? a.listings.slice(0, 8) : a && typeof a === 'object' && a.found !== false && a.mrp !== undefined ? [{ ...a, selling_price: a.sell_min ?? a.selling_price }] : [];
  const links = cleanSources([...(sources || []), ...rows.map((r) => ({ url: r?.url, title: r?.site }))]);
  if (!a || typeof a !== 'object') return none('The answer could not be read.', links);
  if (a.found === false) return none(String(a.note || 'No price found for this brand.'), links);
  const listings = rows.map(checkListing);
  const valid = listings.filter((l) => l.status === 'used');
  if (!valid.length) {
    const why = listings.length ? 'No site gave a price that holds together: ' + listings.map((l) => `${l.site} (${l.problem})`).join(', ') + '.' : 'No usable price was found.';
    return none(why, links, listings);
  }
  if (!links.length) return none('No source page was given, so the price cannot be checked.', [], listings);
  // the unit MRP most sites agree on (to the paisa a unit); a tie goes to the higher
  const groups = new Map<number, Listing[]>();
  for (const l of valid) { const k = Math.round((l.unitMrp as number) * 100); const g = groups.get(k) || []; g.push(l); groups.set(k, g); }
  const best = Array.from(groups.entries()).sort((x, y) => y[1].length - x[1].length || y[0] - x[0])[0][1];
  for (const l of valid) if (!best.includes(l)) { l.status = 'differs'; l.problem = 'its MRP per unit differs from the others'; }
  const packUnits = best[0].packUnits as number;
  const unitMrp = best[0].unitMrp as number;
  const sells = best.filter((l) => l.unitSell !== null).map((l) => l.unitSell as number);
  const unitSellMin = sells.length ? Math.min(...sells) : null, unitSellMax = sells.length ? Math.max(...sells) : null;
  let note = String(a.note || '').trim().slice(0, 160);
  const off = listings.filter((l) => l.status !== 'used').length;
  if (off) note = (note ? note + ' ' : '') + `${off} of ${listings.length} site(s) are left out of the figures (see the list).`;
  return {
    found: true, note, packUnits, packText: best[0].packText, mrp: r2(unitMrp * packUnits),
    sellMin: unitSellMin === null ? null : r2(unitSellMin * packUnits), sellMax: unitSellMax === null ? null : r2(unitSellMax * packUnits),
    unitMrp: r2(unitMrp), unitSellMin: unitSellMin === null ? null : r2(unitSellMin), unitSellMax: unitSellMax === null ? null : r2(unitSellMax), listings, sources: links,
  };
}

/** a kept answer is fresh for a month; older is shown with its date and a prompt to look again */
export function isFresh(asOf: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!asOf) return false;
  const t = new Date(asOf).getTime();
  return Number.isFinite(t) && now.getTime() - t < FRESH_DAYS * 86400000;
}

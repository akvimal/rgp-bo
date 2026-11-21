import { cleanSources, jsonIn, PriceSource, isFresh } from './brand-price-rules';

export { isFresh };

/**
 * Pure rules for the market price of a composition: what pharmacies in India sell medicines with the same ingredients, strength and form for, taken from the
 * web by a model with search. Each listing (a brand on a site) is checked on its own and the listings are compared per unit; one wildly different listing is
 * left out of the range. Nothing is guessed: an answer that does not pass is "not found", with the reason.
 */

export interface MarketListing {
  brand: string; site: string; url: string | null; packText: string | null; packUnits: number | null;
  mrp: number | null; sell: number | null; unitMrp: number | null; unitSell: number | null;
  status: 'used' | 'differs' | 'invalid'; problem: string | null;
}
export interface Range { min: number; max: number }
export interface MarketAnswer {
  found: boolean; note: string; composition: string; form: string | null;
  listings: MarketListing[];
  unitMrp: Range | null;                       // across the listings used, per unit
  unitSell: (Range & { median: number }) | null;
  sources: PriceSource[];
}

export const MARKET_SYSTEM = [
  'You look up what Indian pharmacies sell a medicine for, using web search.',
  'Use only what the pages you find say. Never guess, never convert from another country, never use a price for a different strength, form or pack.',
  'Report each brand on each site separately, with the pack that site lists. MRP is the printed maximum retail price for that pack; the selling price is what that site charges for the same pack and can never be above its MRP.',
  'Reply with one JSON object and nothing else.',
].join(' ');

export function marketInstruction(composition: string, formLabel: string | null): string {
  return [
    `Composition: ${composition}`,
    formLabel ? `Dosage form: ${formLabel}` : '',
    '',
    'Find brands sold in India with exactly this composition: the same ingredients, the same strength of each, and the same dosage form. Leave out any other strength, combination or form.',
    'Give four to eight listings from different brands and sites if you can find them.',
    'Reply with JSON: {"found": true or false, "listings": [{"brand": "brand name", "site": "1mg", "url": "page address", "pack_text": "strip of 10 tablets", "pack_units": whole number of tablets, capsules or ml in that pack,',
    '"mrp": number, "selling_price": number or null}], "note": "one short sentence"}.',
    'Take each figure from the same page as its pack. If you cannot find any with a price, reply {"found": false, "note": "why"}.',
  ].filter(Boolean).join('\n');
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const median = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function checkListing(raw: any): MarketListing {
  const site = String(raw?.site || '').trim().slice(0, 40) || 'a site';
  const brand = String(raw?.brand || '').trim().slice(0, 80) || 'brand not named';
  const url = /^https?:\/\/[^\s]+$/i.test(String(raw?.url || '').trim()) ? String(raw.url).trim().slice(0, 500) : null;
  const packText = String(raw?.pack_text || '').trim().slice(0, 80) || null;
  const mrp = num(raw?.mrp), packUnits = num(raw?.pack_units);
  let sell = num(raw?.selling_price ?? raw?.sell);
  const bad = (problem: string): MarketListing => ({ brand, site, url, packText, packUnits: packUnits !== null && Number.isInteger(packUnits) ? packUnits : null,
    mrp: mrp === null ? null : r2(mrp), sell: sell === null ? null : r2(sell), unitMrp: null, unitSell: null, status: 'invalid', problem });
  if (mrp === null || mrp <= 0 || mrp > 100000) return bad('no usable MRP');
  if (packUnits === null || !Number.isInteger(packUnits) || packUnits < 1 || packUnits > 1000) return bad('pack size not clear');
  if (sell !== null && sell <= 0) sell = null;
  if (sell !== null && sell > mrp + 0.005) return bad('selling price is above its own MRP');
  return { brand, site, url, packText, packUnits, mrp: r2(mrp), sell: sell === null ? null : r2(sell), unitMrp: r4(mrp / packUnits), unitSell: sell === null ? null : r4(sell / packUnits), status: 'used', problem: null };
}

const none = (note: string, composition: string, form: string | null, sources: PriceSource[] = [], listings: MarketListing[] = []): MarketAnswer =>
  ({ found: false, note: note.slice(0, 300), composition, form, listings, unitMrp: null, unitSell: null, sources });

/** The checked answer; see the file comment. A listing whose MRP per unit is far from the middle of the others (a third or three times) is "differs" and left out. */
export function parseMarketAnswer(text: string, sources: { url?: any; title?: any }[] | undefined, composition: string, form: string | null): MarketAnswer {
  const a = jsonIn(text);
  const rows: any[] = Array.isArray(a?.listings) ? a.listings.slice(0, 12) : [];
  const links = cleanSources([...(sources || []), ...rows.map((r) => ({ url: r?.url, title: r?.site }))]);
  if (!a || typeof a !== 'object') return none('The answer could not be read.', composition, form, links);
  if (a.found === false) return none(String(a.note || 'No market price found for this composition.'), composition, form, links);
  const listings = rows.map(checkListing);
  const valid = listings.filter((l) => l.status === 'used');
  if (!valid.length) return none(listings.length ? 'No listing gave a price that holds together: ' + listings.map((l) => `${l.brand} on ${l.site} (${l.problem})`).join(', ') + '.' : 'No usable price was found.', composition, form, links, listings);
  if (!links.length) return none('No source page was given, so the prices cannot be checked.', composition, form, [], listings);
  if (valid.length >= 3) {
    const mid = median(valid.map((l) => l.unitMrp as number));
    for (const l of valid) if ((l.unitMrp as number) > mid * 3 || (l.unitMrp as number) < mid / 3) { l.status = 'differs'; l.problem = 'its price per unit is far from the others (a different pack or strength?)'; }
  }
  const used = listings.filter((l) => l.status === 'used');
  const mrps = used.map((l) => l.unitMrp as number);
  const sells = used.filter((l) => l.unitSell !== null).map((l) => l.unitSell as number);
  const off = listings.length - used.length;
  let note = String(a.note || '').trim().slice(0, 160);
  if (off) note = (note ? note + ' ' : '') + `${off} of ${listings.length} listing(s) are left out of the range (see the list).`;
  return {
    found: true, note, composition, form, listings,
    unitMrp: { min: r2(Math.min(...mrps)), max: r2(Math.max(...mrps)) },
    unitSell: sells.length ? { min: r2(Math.min(...sells)), max: r2(Math.max(...sells)), median: r2(median(sells)) } : null,
    sources: links,
  };
}

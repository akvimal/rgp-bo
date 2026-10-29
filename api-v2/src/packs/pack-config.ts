/**
 * The configuration the app reads for a business: the words it uses, the product attributes, the document types and the licence types. A base set
 * serves every kind of business; each pack the business has adds to it (and its words win). Core holds only the base; a pack holds its own.
 */
import { pharmacyConfig } from './pharmacy/pharmacy-config';

export interface LicenceType { code: string; label: string; for: ('store' | 'vendor')[]; }

export interface PackConfig {
  labels?: Record<string, string>;
  productProps?: any[];
  documentProps?: any[];
  licenceTypes?: LicenceType[];
}

export type ResolvedConfig = Required<PackConfig>;

/** the words of a business that is nothing in particular */
export const BASE_CONFIG: ResolvedConfig = {
  labels: { item: 'item', items: 'items', Item: 'Item', Items: 'Items', shop: 'shop', Shop: 'Shop', professional: 'staff member', Professional: 'Staff member' },
  // a business with no product categories configured types its own
  productProps: [],
  documentProps: [
    {
      "category": "Age Proof",
      "props": [
        {
          "id": "prooftype",
          "label": "Proof Type",
          "required": true,
          "type": "SINGLE-SELECT",
          "choices": [
            {
              "label": "Driving License",
              "value": "Driving License"
            },
            {
              "label": "AADHAR Card",
              "value": "AADHAR Card"
            }
          ]
        }
      ]
    }
  ],
  licenceTypes: [
    { code: 'SHOP_EST', label: 'Shop and establishment licence', for: ['store', 'vendor'] },
    { code: 'TRADE', label: 'Trade licence', for: ['store', 'vendor'] },
    { code: 'FSSAI', label: 'FSSAI', for: ['store', 'vendor'] },
    { code: 'OTHER', label: 'Other', for: ['store', 'vendor'] },
  ],
};

/** every pack there is, by name: a pack not loaded in this installation is simply absent here */
export const PACK_CONFIGS: Record<string, PackConfig> = { pharmacy: pharmacyConfig };

/** the base, then each of the business's packs in turn: words are overridden, lists are added to (a pack's licence types come before "Other") */
export function buildConfig(packs: string[], loaded: Record<string, PackConfig> = PACK_CONFIGS): ResolvedConfig {
  const out: ResolvedConfig = { labels: { ...BASE_CONFIG.labels }, productProps: [...BASE_CONFIG.productProps], documentProps: [...BASE_CONFIG.documentProps], licenceTypes: [...BASE_CONFIG.licenceTypes] };
  for (const name of packs) {
    const c = loaded[name];
    if (!c) continue;
    Object.assign(out.labels, c.labels || {});
    out.productProps.push(...(c.productProps || []));
    out.documentProps.unshift(...(c.documentProps || []));
    const added = (c.licenceTypes || []).filter((l) => !out.licenceTypes.some((x) => x.code === l.code));
    const other = out.licenceTypes.findIndex((l) => l.code === 'OTHER');
    out.licenceTypes.splice(other < 0 ? out.licenceTypes.length : other, 0, ...added);
  }
  return out;
}

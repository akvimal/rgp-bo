import { BASE_CONFIG, buildConfig } from './pack-config';

describe('pack config', () => {
  it('gives a business with no packs only the base: its own words, no product categories, the generic documents and licences', () => {
    const c = buildConfig([]);
    expect(c.labels.item).toBe('item');
    expect(c.labels.Shop).toBe('Shop');
    expect(c.productProps).toEqual([]);
    expect(c.documentProps.map((d: any) => d.category)).toEqual(['Age Proof']);
    expect(c.licenceTypes.map((l) => l.code)).toEqual(['SHOP_EST', 'TRADE', 'FSSAI', 'OTHER']);
    expect(JSON.stringify(c)).not.toMatch(/medicine|pharmac|prescription|schedule|chronic|20B/i);        // nothing of a pharmacy reaches another business
  });

  it('adds what the pharmacy pack brings: its words, the medicine attributes, the prescription document and the drug licences', () => {
    const c = buildConfig(['pharmacy']);
    expect(c.labels).toMatchObject({ item: 'medicine', items: 'medicines', Item: 'Medicine', shop: 'pharmacy', Professional: 'Pharmacist' });
    expect(c.productProps.map((p: any) => p.category)).toEqual(['Medicine', 'OTC']);
    const medicine = c.productProps[0].props.map((p: any) => p.id);
    expect(medicine).toEqual(expect.arrayContaining(['schedule', 'composition', 'chronic', 'generic', 'document']));
    expect(c.documentProps.map((d: any) => d.category)).toEqual(['Prescription', 'Age Proof']);
    expect(c.licenceTypes.map((l) => l.code)).toEqual(['SHOP_EST', 'TRADE', 'FSSAI', 'RETAIL_20_21', 'WHOLESALE_20B_21B', 'MANUFACTURING', 'OTHER']);   // "Other" stays last
    expect(c.licenceTypes.find((l) => l.code === 'MANUFACTURING')!.for).toEqual(['vendor']);
  });

  it('ignores a pack it does not know, and does not change the base', () => {
    const before = JSON.stringify(BASE_CONFIG);
    expect(buildConfig(['electronics']).labels.item).toBe('item');
    buildConfig(['pharmacy']);
    expect(JSON.stringify(BASE_CONFIG)).toBe(before);
  });

  it('lets a pack that is passed in stand in for the real ones', () => {
    const c = buildConfig(['demo'], { demo: { labels: { item: 'garment' }, licenceTypes: [{ code: 'DEMO', label: 'Demo licence', for: ['store'] }] } });
    expect(c.labels.item).toBe('garment');
    expect(c.licenceTypes.map((l) => l.code)).toEqual(['SHOP_EST', 'TRADE', 'FSSAI', 'DEMO', 'OTHER']);
  });
});

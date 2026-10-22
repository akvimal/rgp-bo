/**
 * The product search used by the item forms and the POS — PSRCH-1
 * Searches are matched with bound values: wildcards are taken literally, odd characters cannot change the query, and a name
 * that is not a plain column is refused.
 */
import { test, expect, data } from '../fixtures/index.js';

const MGR = 'businesshead@local.test';

test.describe('Product search @p1', () => {
  test('PSRCH-1 starts-with, contains and all-words searches work; quotes and wildcards are only text; bad names are refused @negative', async ({ api }) => {
    const p = data.m.products[3];
    const word = p.title.split(/\s+/)[0];
    const search = (criteria: any[], condition = 'any') => api.request('POST', '/products/filter', { condition, criteria }, MGR);

    const starts = await search([{ property: 'title', check: 'startswith', value: word }]);
    expect(starts.status).toBeLessThan(300);
    expect(starts.body.some((x: any) => x.id === p.id)).toBe(true);

    const contains = await search([{ property: 'title', check: 'contains', value: word.slice(1, 5) }]);
    expect(contains.body.some((x: any) => x.id === p.id)).toBe(true);

    const all = await search(p.title.replace(/\[.*\]/, '').trim().split(/\s+/).slice(0, 2).map((w: string) => ({ property: 'title', check: 'contains', value: w })), 'all');
    expect(all.body.some((x: any) => x.id === p.id)).toBe(true);

    const apostrophe = await search([{ property: 'title', check: 'startswith', value: "o'brien" }]);
    expect(apostrophe.status).toBeLessThan(300);                                                      // a quote is only text
    expect(apostrophe.body).toEqual([]);

    const inject = await search([{ property: 'title', check: 'startswith', value: "x' or '1'='1" }]);
    expect(inject.status).toBeLessThan(300);
    expect(inject.body).toEqual([]);                                                                  // not "everything"

    const wildcard = await search([{ property: 'title', check: 'startswith', value: '%' }]);
    expect(wildcard.body).toEqual([]);                                                                // % is a character, not "anything"

    expect((await search([{ property: "title; drop table product; --", check: 'contains', value: 'a' }])).status).toBe(400);
    expect((await search([{ property: 'title', check: 'regex', value: 'a' }])).status).toBe(400);
    expect((await search([{ property: 'composition', props_json: 'password', check: 'contains', value: 'a' }])).status).toBe(400);
    expect((await search([])).body).toEqual([]);
  });
});

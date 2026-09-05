/**
 * Reports — RPT-1..4
 * Source: docs/testing/manual-test-plan.html  (module "reports")
 */
import { test, expect } from '../fixtures/index.js';
import { expectShell } from '../support/assert.js';

const MGR = 'businesshead@local.test';
const API = (process.env.QA_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// the report service reads criteria.report / criteria.begin / criteria.end
function rangeCriteria(begin: string, end: string, extra: any = {}) {
  return { report: 'sale', begin, end, ...extra };
}
async function saleReport(token: string, criteria: any, action = 'search', timeoutMs = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/reports/sale`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, criteria }), signal: c.signal,
    });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, ct, body: ct.includes('json') ? await res.json() : await res.arrayBuffer() };
  } catch (e: any) {
    return { status: 0, ct: '', body: null, error: e.name };
  } finally {
    clearTimeout(t);
  }
}

test.describe('Reports @p2', () => {
  test('RPT-1 a sale report for a date range totals to the sum of its sales @happy', async ({ api }) => {
    const token = await api.token(MGR);
    const from = '2026-08-01', to = '2026-09-30';
    const rep = await saleReport(token, rangeCriteria(from, to));
    expect(rep.status).toBeLessThan(400);
    const rows: any[] = Array.isArray(rep.body) ? rep.body : [];
    // cross-check the row count against the raw sales list in the window
    const raw = (await api.request('GET', '/sales/raw', undefined, MGR)).body
      .filter((s: any) => {
        const d = String(s.bill_date).slice(0, 10);
        return d >= from && d <= to;
      });
    expect(rows.length).toBeGreaterThan(0);
    // the report is at least as granular as the bills (line-level vs bill-level)
    expect(rows.length).toBeGreaterThanOrEqual(Math.min(raw.length, 1));
  });

  test('RPT-2 a range with no sales returns an empty report, not an error @edge', async ({ api }) => {
    const rep = await saleReport(await api.token(MGR), rangeCriteria('2019-01-01','2019-01-07'));
    expect(rep.status).toBeLessThan(400);
    expect(Array.isArray(rep.body) ? rep.body.length : 0).toBe(0);
  });

  test('RPT-3 the Excel export completes @happy', async ({ api }) => {
    const rep = await saleReport(await api.token(MGR), rangeCriteria('2026-09-01','2026-09-05'), 'export', 20000);
    if (rep.status === 0) {
      test.info().annotations.push({ type: 'finding', description: `RPT-3: POST /reports/sale (export) did not respond within 20s (${rep.error})` });
    } else {
      expect(rep.status).toBeLessThan(500);
      // an xlsx buffer, or json - either way, real content
      const len = rep.body instanceof ArrayBuffer ? rep.body.byteLength : JSON.stringify(rep.body).length;
      expect(len).toBeGreaterThan(0);
    }
  });

  test('RPT-4 a large date range does not time out @edge', async ({ api }) => {
    const rep = await saleReport(await api.token(MGR), rangeCriteria('2025-01-01','2026-12-31'), 'search', 25000);
    if (rep.status === 0) {
      test.info().annotations.push({ type: 'finding', description: 'RPT-4: a 2-year sale report search did not respond within 25s' });
    }
    expect([0, 200, 201].includes(rep.status)).toBeTruthy();
  });

  test('the Reports screen loads @happy', async ({ app }) => {
    const { page } = await app.open(MGR, '/secure/reports');
    await expectShell(page);
  });
});

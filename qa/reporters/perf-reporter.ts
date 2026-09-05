/**
 * Merges per-test metrics (report/metrics/*.json written by fixtures/perf.ts)
 * with Playwright pass/fail into report/index.html + report/perf-summary.json.
 * Also pulls a run-level pg_stat_statements snapshot if QA_DB_URL is set.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import type { PageMetric } from '../fixtures/perf.js';

const METRICS_DIR = join(process.cwd(), 'report', 'metrics');
const OUT_DIR = join(process.cwd(), 'report');

interface Row {
  id: string;
  title: string;
  file: string;
  status: string;
  durationMs: number;
  apiCalls: number;
  totalApiMs: number;
  totalDbMs: number;
  slowestApi?: string;
  consoleErrors: number;
  pageErrors: number;
}

export default class PerfReporter implements Reporter {
  private rows: Row[] = [];
  private findings: { id: string; text: string }[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    this.rows.push({
      id: test.title.split(' ')[0],
      title: test.title,
      file: test.location.file.split(/[\\/]/).pop() || '',
      status: result.status,
      durationMs: result.duration,
      apiCalls: 0, totalApiMs: 0, totalDbMs: 0,
      consoleErrors: 0, pageErrors: 0,
    });
    for (const a of [...(test.annotations || []), ...(result.annotations || [])]) {
      if (a.type === 'finding' && a.description) {
        this.findings.push({ id: test.title.split(' ')[0], text: a.description });
      }
    }
  }

  async onEnd(result: FullResult) {
    // fold in metric files
    const metrics: PageMetric[] = [];
    if (existsSync(METRICS_DIR)) {
      for (const f of readdirSync(METRICS_DIR).filter((x) => x.endsWith('.json'))) {
        try { metrics.push(JSON.parse(readFileSync(join(METRICS_DIR, f), 'utf8'))); } catch { /* skip */ }
      }
    }
    for (const row of this.rows) {
      const mine = metrics.filter((m) => m.title === row.title);
      row.apiCalls = mine.reduce((a, m) => a + m.apiCalls, 0);
      row.totalApiMs = +mine.reduce((a, m) => a + m.totalApiMs, 0).toFixed(1);
      row.totalDbMs = +mine.reduce((a, m) => a + m.totalDbMs, 0).toFixed(1);
      row.consoleErrors = mine.reduce((a, m) => a + m.consoleErrors.length, 0);
      row.pageErrors = mine.reduce((a, m) => a + m.pageErrors.length, 0);
      const slow = mine.map((m) => m.slowestApi).filter(Boolean).sort((a, b) => (b!.apiMs || 0) - (a!.apiMs || 0))[0];
      if (slow) row.slowestApi = `${slow.method} ${slow.url} ${slow.apiMs}ms`;
    }

    // per-endpoint aggregation
    const byEndpoint = new Map<string, number[]>();
    for (const m of metrics) {
      for (const r of m.requests) {
        if (r.apiMs === undefined) continue;
        const key = `${r.method} ${r.url.replace(/\/\d+/g, '/:id')}`;
        if (!byEndpoint.has(key)) byEndpoint.set(key, []);
        byEndpoint.get(key)!.push(r.apiMs);
      }
    }
    const endpoints = [...byEndpoint.entries()]
      .map(([k, v]) => {
        const s = v.slice().sort((a, b) => a - b);
        return { endpoint: k, count: v.length, p50: pct(s, 50), p95: pct(s, 95), max: s[s.length - 1] };
      })
      .sort((a, b) => b.p95 - a.p95);

    let pgTop: any[] = [];
    try { pgTop = await pgStat(); } catch { /* pg_stat_statements not available */ }

    const passed = this.rows.filter((r) => r.status === 'passed').length;
    const uniqFindings = [...new Map(this.findings.map((f) => [`${f.id}|${f.text}`, f])).values()];
    const summary = {
      generatedAt: new Date().toISOString(),
      result: result.status,
      tests: { total: this.rows.length, passed, failed: this.rows.length - passed },
      totalConsoleErrors: this.rows.reduce((a, r) => a + r.consoleErrors, 0),
      totalPageErrors: this.rows.reduce((a, r) => a + r.pageErrors, 0),
      findings: uniqFindings,
      endpoints,
      pgTopQueries: pgTop,
      cases: this.rows,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, 'perf-summary.json'), JSON.stringify(summary, null, 2));
    writeFileSync(join(OUT_DIR, 'index.html'), renderHtml(summary));
    console.log(`\nPerf report: report/index.html   (${passed}/${this.rows.length} passed, ` +
      `${uniqFindings.length} findings, ${summary.totalConsoleErrors} console errors, ${endpoints.length} endpoints profiled)`);
  }
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return +sorted[i].toFixed(1);
}

async function pgStat(): Promise<any[]> {
  const url = process.env.QA_DB_URL;
  if (!url) return [];
  const pg = await import('pg');
  const c = new pg.default.Client({ connectionString: url });
  await c.connect();
  try {
    const { rows } = await c.query(`
      SELECT left(query, 120) AS query, calls,
             round(total_exec_time::numeric, 1) AS total_ms,
             round(mean_exec_time::numeric, 2) AS mean_ms
      FROM pg_stat_statements
      WHERE query NOT ILIKE '%pg_stat_statements%'
      ORDER BY total_exec_time DESC LIMIT 15`);
    return rows;
  } finally {
    await c.end();
  }
}

function renderHtml(s: any): string {
  const rows = s.cases.map((r: Row) => `
    <tr class="${r.status}">
      <td>${esc(r.id)}</td><td>${esc(r.title)}</td><td>${esc(r.file)}</td>
      <td class="st">${r.status}</td><td class="n">${(r.durationMs / 1000).toFixed(1)}s</td>
      <td class="n">${r.apiCalls}</td><td class="n">${r.totalApiMs}</td><td class="n">${r.totalDbMs}</td>
      <td class="n ${r.consoleErrors ? 'bad' : ''}">${r.consoleErrors}</td>
      <td class="n ${r.pageErrors ? 'bad' : ''}">${r.pageErrors}</td>
      <td class="sm">${esc(r.slowestApi || '')}</td>
    </tr>`).join('');
  const eps = s.endpoints.map((e: any) => `
    <tr><td>${esc(e.endpoint)}</td><td class="n">${e.count}</td><td class="n">${e.p50}</td>
    <td class="n">${e.p95}</td><td class="n">${e.max}</td></tr>`).join('');
  const pg = s.pgTopQueries.map((q: any) => `
    <tr><td class="sm">${esc(q.query)}</td><td class="n">${q.calls}</td><td class="n">${q.total_ms}</td><td class="n">${q.mean_ms}</td></tr>`).join('');
  const findings = (s.findings || []).map((f: any) =>
    `<tr><td class="mono">${esc(f.id)}</td><td>${esc(f.text)}</td></tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>RGP QA run</title>
<style>
 body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#1b241f;background:#f7f8f6}
 h1{font-size:20px} h2{font-size:15px;margin-top:32px}
 td.mono{font-family:ui-monospace,Consolas,monospace;font-weight:600;white-space:nowrap}
 .findings td{background:#fbf1e5}
 table{border-collapse:collapse;width:100%;background:#fff;font-size:12.5px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
 th,td{border:1px solid #e0e4dd;padding:5px 8px;text-align:left;vertical-align:top}
 th{background:#eef1ec;position:sticky;top:0}
 td.n{text-align:right;font-variant-numeric:tabular-nums} td.sm{font-size:11px;color:#5c6862;max-width:340px;overflow:hidden}
 tr.failed td{background:#fbe9e7} tr.passed td.st{color:#2e7d5b} tr.failed td.st{color:#b23a2e;font-weight:600}
 td.bad{color:#b23a2e;font-weight:600}
 .kpi{display:flex;gap:24px;margin:12px 0}
 .kpi div{background:#fff;border:1px solid #e0e4dd;border-radius:8px;padding:10px 16px}
 .kpi b{display:block;font-size:20px}
</style>
<h1>RGP Back Office — QA run</h1>
<div class="kpi">
  <div><b>${s.tests.passed}/${s.tests.total}</b>tests passed</div>
  <div><b>${(s.findings || []).length}</b>findings</div>
  <div><b>${s.totalConsoleErrors}</b>console errors</div>
  <div><b>${s.totalPageErrors}</b>page errors</div>
  <div><b>${s.endpoints.length}</b>endpoints profiled</div>
  <div><b>${new Date(s.generatedAt).toLocaleString()}</b>generated</div>
</div>
<h2>Findings (current behaviour asserted by the suite)</h2>
<table class="findings"><thead><tr><th>Case</th><th>Finding</th></tr></thead><tbody>${findings || '<tr><td colspan=2>none</td></tr>'}</tbody></table>
<h2>Test cases</h2>
<table><thead><tr><th>ID</th><th>Title</th><th>File</th><th>Status</th><th>Dur</th><th>API calls</th>
<th>API ms</th><th>DB ms</th><th>Console err</th><th>Page err</th><th>Slowest API call</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>API endpoints (server time, ms)</h2>
<table><thead><tr><th>Endpoint</th><th>Calls</th><th>p50</th><th>p95</th><th>max</th></tr></thead><tbody>${eps}</tbody></table>
<h2>Postgres — top statements by total time</h2>
<table><thead><tr><th>Query</th><th>Calls</th><th>Total ms</th><th>Mean ms</th></tr></thead><tbody>${pg || '<tr><td colspan=4>pg_stat_statements unavailable</td></tr>'}</tbody></table>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

// A stand-in for the Anthropic Messages API, for the QA specs that exercise the assistants (hr-assistant.spec.ts) without a real model or key.
// Each forced tool is answered with a canned proposal (with token counts, as the real API reports) and the last request is kept at GET /last.
//
// Run it, then start the API pointing at it:
//   node qa/support/ai-standin.mjs                                  # listens on 3911
//   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=server-env-key-0000000000000000 ANTHROPIC_BASE_URL=http://localhost:3911 AI_MODEL=claude-haiku-5-5 <start the API>
//   QA_AI_STANDIN=1 npx playwright test specs/hr-assistant.spec.ts
import http from 'node:http';
let last = null;
const answers = {
  reply: () => ({ ok: true }),
  propose_role: () => ({
    purpose: 'Serve walk-in customers quickly and correctly at the counter.',
    responsibilities: [
      { text: 'Bill every sale accurately with the right batch', measure: 'DISCARDED_BILLS' },
      { text: 'Reach the monthly sales target for the counter', measure: 'SALES_VALUE' },
      { text: 'Keep cash tallied at shift close', measure: 'CASH_VARIANCE' },
      { text: 'Greet and help customers politely', measure: 'MANUAL' },
      { text: 'Keep the counter and shelves tidy', measure: 'MADE_UP_KEY' },
      { text: 'Be present on every working day', measure: 'ABSENT_DAYS' },
    ],
  }),
  propose_kpis: () => ({
    kpis: [
      { name: 'Sales value', source: 'SYSTEM', system_key: 'SALES_VALUE', rule: { kind: 'linear', target: 300000, floor: 100000 }, weight: 40, why: 'Sales target' },
      { name: 'Discarded bills', source: 'SYSTEM', system_key: 'DISCARDED_BILLS', rule: { kind: 'steps', steps: [{ upto: 2, pct: 100 }, { upto: 5, pct: 50 }], otherwise: 0 }, weight: 20, why: 'Billing accuracy' },
      { name: 'Courtesy', source: 'MANUAL', description: 'Rate 1 to 5: 1 = rude or ignored customers, 5 = warm and helpful every time', weight: 25 },
      { name: 'Cash care', source: 'SYSTEM', system_key: 'CASH_VARIANCE', rule: { kind: 'linear', target: 500, floor: 0 }, description: 'Rate cash care from the shift book', weight: 15 },
    ],
  }),
  propose_bands: () => ({
    bands: [
      { min_percent: 0, label: 'Below', incentive_amount: 0 }, { min_percent: 60, label: 'Steady', incentive_amount: 500 },
      { min_percent: 80, label: 'Strong', incentive_amount: 1000 }, { min_percent: 92, label: 'Excellent', incentive_amount: 1500 },
    ],
    rationale: 'Top band is about 7% of monthly earnings.',
  }),
};
http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/last') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(last)); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const b = JSON.parse(body || '{}');
    const name = b.tools?.[0]?.name;
    last = { key: req.headers['x-api-key'], model: b.model, tool: name, max_tokens: b.max_tokens, instruction: b.messages?.[0]?.content, system: b.system };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ content: [{ type: 'tool_use', name, input: (answers[name] || (() => ({})))() }], usage: { input_tokens: 111, output_tokens: 22 } }));
  });
}).listen(3911, () => console.log('mock ai on 3911'));

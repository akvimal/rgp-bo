// A stand-in for the Anthropic Messages API, for the QA specs that exercise the assistants (hr-assistant.spec.ts) without a real model or key.
// Each forced tool is answered with a canned proposal (with token counts, as the real API reports) and the last request is kept at GET /last.
//
// Run it, then start the API pointing at it:
//   node qa/support/ai-standin.mjs                                  # listens on 3911
//   AI_PROVIDER=anthropic ANTHROPIC_API_KEY=server-env-key-0000000000000000 ANTHROPIC_BASE_URL=http://localhost:3911 AI_MODEL=claude-haiku-5-5 <start the API>
//   QA_AI_STANDIN=1 npx playwright test specs/hr-assistant.spec.ts
import http from 'node:http';
let last = null;
// how many requests each tool has been asked for since the stand-in started (GET /stats; GET /stats?reset=1 starts the count again), so a spec can show a request was NOT made
let counts = {};
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
  // the shop-question picker answers from keywords in the question, the way a model would pick a report
  answer_question: (b) => {
    const q = String(b.messages?.[0]?.content || '').toLowerCase();
    if (q.includes('weather')) return { report: 'none', understood: 'Asks about the weather', reason: 'No report covers that. The nearest is the sales summary.' };
    if (q.includes('expire') || q.includes('expiry')) return { report: 'expiry_risk', understood: 'Stock that will not sell before it expires' };
    if (q.includes('margin') || q.includes('profit')) return { report: 'margin_by_product', period: 'this_month', understood: 'Products by profit this month' };
    if (q.includes('owe') || q.includes('dues')) return { report: 'customer_dues', understood: 'Customers who owe money' };
    if (q.includes('who sold') || q.includes('staff')) return { report: 'sales_by_staff', period: 'last_30_days', understood: 'Sales by staff, last 30 days' };
    if (q.includes('top')) return { report: 'top_products', period: 'last_month', limit: 5, understood: 'The top 5 products of last month' };
    return { report: 'sales_summary', period: 'last_week', understood: 'Sales last week' };
  },
  write_weekly_summary: () => ({
    headline: 'A steady week: sales held up and the main risk is stock close to expiry.',
    wins: ['Sales stayed in line with the week before.', 'Most shifts closed without a difference.'],
    watch: ['Some stock will not sell before it expires: return or discount it.'],
    do_first: ['Open Purchases > Reorder and press Write the brief.'],
  }),
  write_coaching_note: () => ({
    strengths: ['Accuracy is strong this month.'],
    focus: ['Upselling scored below target.'],
    tips: ['Try suggesting one related product on every third bill, and check after two weeks.'],
    talk_points: ['Start with the accuracy result and thank them for it.', 'Ask what makes suggesting a second product hard.'],
  }),
  write_buying_brief: () => ({
    headline: 'Order the fast movers first and clear the slow stock before it expires.',
    buy_first: ['Order the products that are nearly out and selling every day.'],
    clear: ['Return or discount the batches listed under Expiry risk.'],
    watch_out: [],
  }),
  draft_followup_messages: () => ({
    messages: [
      { audience: 'due_back', en: 'Hello {name}, it is about time for your regular medicines. We have them ready whenever you need them. - {store}', ta: 'வணக்கம் {name}, உங்கள் வழக்கமான மருந்துகள் தீரும் நேரம் ஆகிவிட்டது. தேவைப்படும்போது எங்களிடம் தயாராக உள்ளன. - {store}' },
      { audience: 'at_risk', en: 'Hello {name}, we have not seen you for a while. Is there anything we can help with? - {store}', ta: 'வணக்கம் {name}, உங்களைப் பார்த்து நாளாகிவிட்டது. எங்களால் ஏதேனும் உதவ முடியுமா? - {store}' },
      { audience: 'new_second_visit', en: 'Hello {name}, thank you for visiting {store}. We would be glad to see you again.', ta: 'வணக்கம் {name}, {store} க்கு வந்ததற்கு நன்றி. மீண்டும் உங்களை சந்திக்க ஆவலாக இருக்கிறோம்.' },
      { audience: 'dues', en: 'Hello {name}, a gentle reminder from {store}: {amount} is pending on your account. Please pay when convenient. Thank you.', ta: 'வணக்கம் {name}, {store} இலிருந்து ஒரு நினைவூட்டல்: உங்கள் கணக்கில் {amount} நிலுவையில் உள்ளது. வசதியாக இருக்கும்போது செலுத்தவும். நன்றி.' },
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
  if (req.method === 'GET' && req.url.startsWith('/stats')) { const out = { ...counts }; if (req.url.includes('reset=1')) counts = {}; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(out)); }
  if (req.method === 'GET' && req.url === '/last') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(last)); }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const b = JSON.parse(body || '{}');
    const name = b.tools?.[0]?.name;
    counts[name] = (counts[name] || 0) + 1;
    last = { key: req.headers['x-api-key'], model: b.model, tool: name, max_tokens: b.max_tokens, instruction: b.messages?.[0]?.content, system: b.system };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ content: [{ type: 'tool_use', name, input: (answers[name] || (() => ({})))(b) }], usage: { input_tokens: 111, output_tokens: 22 } }));
  });
}).listen(3911, () => console.log('mock ai on 3911'));

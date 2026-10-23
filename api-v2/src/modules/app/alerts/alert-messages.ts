export type Lang = 'en' | 'ta';
export const LANGUAGES: Lang[] = ['en', 'ta'];

interface Message { title: string; body: string; }

/**
 * What each alert says, in each language. A notification stores only its code and parameters; the words are chosen when it is
 * read, so one alert shows in the reader's own language. Anything missing in a language falls back to English.
 * The Tamil is a draft for a native speaker to review before it ships.
 */
const CATALOGUE: Record<string, Record<Lang, Message>> = {
  deposit_due_amount: {
    en: { title: 'Bank deposit due: {store}', body: 'The cash balance is {balance}, which is {excess} over the limit. Bank it and record the deposit.' },
    ta: { title: 'வங்கியில் பணம் செலுத்த வேண்டும்: {store}', body: 'பண இருப்பு {balance}; வரம்பை விட {excess} அதிகம். வங்கியில் செலுத்தி பதிவு செய்யவும்.' },
  },
  deposit_due_schedule: {
    en: { title: 'Bank deposit due: {store}', body: 'Cash of {balance} has not been banked since {since}. Bank it and record the deposit.' },
    ta: { title: 'வங்கியில் பணம் செலுத்த வேண்டும்: {store}', body: '{balance} பணம் {since} முதல் வங்கியில் செலுத்தப்படவில்லை. வங்கியில் செலுத்தி பதிவு செய்யவும்.' },
  },
  licence_expiring: {
    en: { title: '{type} licence ends on {date}: {store}', body: '{days} days left. Renew it and add the new dates under Store settings.' },
    ta: { title: '{type} உரிமம் {date} அன்று முடிகிறது: {store}', body: '{days} நாட்கள் மீதமுள்ளன. புதுப்பித்து புதிய தேதிகளை கடை அமைப்புகளில் சேர்க்கவும்.' },
  },
  licence_expired: {
    en: { title: '{type} licence ended on {date}: {store}', body: 'It ended {days} days ago. Renew it and add the new dates under Store settings.' },
    ta: { title: '{type} உரிமம் {date} அன்று முடிந்துவிட்டது: {store}', body: '{days} நாட்களுக்கு முன் முடிந்தது. புதுப்பித்து புதிய தேதிகளை கடை அமைப்புகளில் சேர்க்கவும்.' },
  },
  registration_expiring: {
    en: { title: 'Pharmacist registration ends on {date}: {person}', body: '{days} days left. Update the registration under Users once it is renewed.' },
    ta: { title: 'மருந்தாளர் பதிவு {date} அன்று முடிகிறது: {person}', body: '{days} நாட்கள் மீதமுள்ளன. புதுப்பித்த பின் பயனர்கள் பகுதியில் பதிவைப் புதுப்பிக்கவும்.' },
  },
  registration_expired: {
    en: { title: 'Pharmacist registration ended on {date}: {person}', body: 'It ended {days} days ago. Update the registration under Users once it is renewed.' },
    ta: { title: 'மருந்தாளர் பதிவு {date} அன்று முடிந்துவிட்டது: {person}', body: '{days} நாட்களுக்கு முன் முடிந்தது. புதுப்பித்த பின் பயனர்கள் பகுதியில் பதிவைப் புதுப்பிக்கவும்.' },
  },
  shift_open_long: {
    en: { title: 'A shift is still open: {store}', body: '{name} has been open for {hours} hours. Close it to count the cash.' },
    ta: { title: 'ஒரு ஷிப்ட் இன்னும் திறந்திருக்கிறது: {store}', body: '{name} {hours} மணி நேரமாகத் திறந்துள்ளது. பணத்தை எண்ண அதை மூடவும்.' },
  },
  approvals_pending: {
    en: { title: '{count} stock adjustments waiting for approval: {store}', body: 'The oldest has waited {hours} hours.' },
    ta: { title: '{count} இருப்பு மாற்றங்கள் ஒப்புதலுக்குக் காத்திருக்கின்றன: {store}', body: 'பழமையானது {hours} மணி நேரமாகக் காத்திருக்கிறது.' },
  },
  approvals_pending_one: {
    en: { title: 'A stock adjustment is waiting for approval: {store}', body: 'It has waited {hours} hours.' },
    ta: { title: 'ஒரு இருப்பு மாற்றம் ஒப்புதலுக்குக் காத்திருக்கிறது: {store}', body: '{hours} மணி நேரமாகக் காத்திருக்கிறது.' },
  },
};

export const MESSAGE_CODES = Object.keys(CATALOGUE);

const money = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** the kinds of store licence, named for a person */
const LICENCE_TYPES: Record<string, Record<Lang, string>> = {
  RETAIL_20_21: { en: 'Retail drug', ta: 'சில்லறை மருந்து' },
  WHOLESALE_20B_21B: { en: 'Wholesale drug', ta: 'மொத்த மருந்து' },
  FSSAI: { en: 'FSSAI', ta: 'FSSAI' },
  OTHER: { en: 'Other', ta: 'பிற' },
};

/** the value of a parameter as it reads in a message: money, dates as 12 Nov 2026, licence kinds by name, the rest as is */
function show(key: string, v: any, lang: Lang): string {
  if (v === null || v === undefined) return '';
  if (key === 'type' && LICENCE_TYPES[String(v)]) return LICENCE_TYPES[String(v)][lang];
  if (['balance', 'excess', 'value'].includes(key)) return money(v);
  if (['date', 'since'].includes(key) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) {
    const d = new Date(String(v).slice(0, 10) + 'T00:00:00Z');
    return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return String(v);
}

/** the title and body of an alert in the reader's language (English when there is no text in that language) */
export function render(code: string, params: Record<string, any>, lang: Lang | string = 'en'): Message {
  const entry = CATALOGUE[code];
  if (!entry) return { title: code, body: '' };
  const m = entry[lang as Lang] || entry.en;
  const l: Lang = entry[lang as Lang] ? (lang as Lang) : 'en';
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => show(k, params?.[k], l));
  return { title: fill(m.title), body: fill(m.body) };
}

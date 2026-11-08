/**
 * The wording of the messages staff send to customers from the contact list. One message for each reason to get in touch and each language; the shop can
 * change any of them (and the assistant can write a first version). A message may hold {name}, {store} and {amount}, which are filled in when it is used.
 * Pure: no framework and no database.
 */
export const FOLLOWUP_AUDIENCES = ['due_back', 'at_risk', 'new_second_visit', 'dues'] as const;
export type FollowupAudience = (typeof FOLLOWUP_AUDIENCES)[number];
export const FOLLOWUP_LANGS = ['en', 'ta'] as const;
export type FollowupLang = (typeof FOLLOWUP_LANGS)[number];

export const AUDIENCE_LABELS: Record<FollowupAudience, string> = {
  due_back: 'Due back (regular medicines)', at_risk: 'Not seen for a while', new_second_visit: 'New customer, second visit', dues: 'Unpaid dues',
};

export type Templates = Record<FollowupAudience, Record<FollowupLang, string>>;

export const DEFAULT_TEMPLATES: Templates = {
  due_back: {
    en: 'Hello {name}, a gentle reminder from {store}: it is about time for your regular medicines. We are here whenever you need them.',
    ta: 'வணக்கம் {name}, {store} இலிருந்து ஒரு நினைவூட்டல்: உங்கள் வழக்கமான மருந்துகள் தீரும் நேரம் ஆகிவிட்டது. தேவைப்படும்போது எங்களிடம் தயாராக உள்ளன.',
  },
  at_risk: {
    en: 'Hello {name}, we have not seen you at {store} for a while and wanted to check that all is well. Please let us know if there is anything we can do.',
    ta: 'வணக்கம் {name}, {store} க்கு நீங்கள் வந்து நாளாகிவிட்டது. எல்லாம் நலமா என்று கேட்க விரும்பினோம். எங்களால் ஏதேனும் உதவ முடியுமானால் சொல்லுங்கள்.',
  },
  new_second_visit: {
    en: 'Hello {name}, thank you for visiting {store}. We would be glad to see you again; ask us if there is anything we can help with.',
    ta: 'வணக்கம் {name}, {store} க்கு வந்ததற்கு நன்றி. மீண்டும் உங்களை சந்திக்க ஆவலாக இருக்கிறோம்; எந்த உதவியும் தேவைப்பட்டால் கேளுங்கள்.',
  },
  dues: {
    en: 'Hello {name}, a gentle reminder from {store}: {amount} is pending on your account. Please pay when it is convenient. Thank you.',
    ta: 'வணக்கம் {name}, {store} இலிருந்து ஒரு நினைவூட்டல்: உங்கள் கணக்கில் {amount} நிலுவையில் உள்ளது. வசதியாக இருக்கும்போது செலுத்தவும். நன்றி.',
  },
};

const ALLOWED = ['name', 'store', 'amount'];

/** one message as typed or drafted: trimmed, limited, only the three placeholders kept (any other {word} is dropped), and it must greet by {name} */
export function cleanTemplate(text: unknown): string | null {
  let t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  t = t.replace(/\{([^{}]*)\}/g, (m, w) => (ALLOWED.includes(String(w).trim().toLowerCase()) ? `{${String(w).trim().toLowerCase()}}` : ''));
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return null;
  return t.includes('{name}') ? t : null;
}

/** the saved wording laid over the defaults: a message that is missing or does not pass is replaced by the default */
export function mergeTemplates(saved: any): Templates {
  const out: Templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  for (const a of FOLLOWUP_AUDIENCES) for (const l of FOLLOWUP_LANGS) {
    const t = cleanTemplate(saved?.[a]?.[l]);
    if (t) out[a][l] = t;
  }
  return out;
}

/** a message for a person: {name} is how the shop greets them, {amount} what they owe */
export function fillTemplate(text: string, v: { name: string; store: string; amount?: number | null }): string {
  const amount = v.amount === null || v.amount === undefined ? '' : `Rs ${Math.round(v.amount).toLocaleString('en-IN')}`;
  return text.replace(/\{name\}/g, v.name).replace(/\{store\}/g, v.store).replace(/\{amount\}/g, amount).replace(/\s+/g, ' ').trim();
}

/** what the assistant returned, cleaned: the wording for every audience and language it gave, and the defaults for the rest */
export function cleanDraft(out: any): { templates: Templates; changed: number } {
  const base = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)) as Templates;
  let changed = 0;
  for (const m of Array.isArray(out?.messages) ? out.messages : []) {
    const a = String(m?.audience || '') as FollowupAudience;
    if (!FOLLOWUP_AUDIENCES.includes(a)) continue;
    for (const l of FOLLOWUP_LANGS) {
      const t = cleanTemplate(m?.[l]);
      if (!t) continue;
      if (a === 'dues' && !t.includes('{amount}')) continue;                 // a dues reminder that does not say how much is no use
      base[a][l] = t; changed++;
    }
  }
  return { templates: base, changed };
}

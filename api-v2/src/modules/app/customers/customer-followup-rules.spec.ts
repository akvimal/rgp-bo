import { DEFAULT_TEMPLATES, cleanDraft, cleanTemplate, fillTemplate, mergeTemplates } from './customer-followup-rules';

describe('follow-up message wording', () => {
  it('has English and Tamil for every reason, each greeting the customer by name', () => {
    for (const a of Object.keys(DEFAULT_TEMPLATES) as (keyof typeof DEFAULT_TEMPLATES)[]) for (const l of ['en', 'ta'] as const) {
      expect(DEFAULT_TEMPLATES[a][l]).toContain('{name}');
      expect(cleanTemplate(DEFAULT_TEMPLATES[a][l])).toBe(DEFAULT_TEMPLATES[a][l]);
    }
    expect(DEFAULT_TEMPLATES.dues.en).toContain('{amount}');
    expect(DEFAULT_TEMPLATES.dues.ta).toContain('{amount}');
  });

  it('keeps only the three placeholders and needs the name', () => {
    expect(cleanTemplate('Hello {name}, from {STORE}: {amount} is pending. {evil} {x}')).toBe('Hello {name}, from {store}: {amount} is pending.');
    expect(cleanTemplate('Please pay what you owe to the shop')).toBeNull();      // no {name}
    expect(cleanTemplate('Hi {name}')).toBeNull();                                  // too short to be a message
    expect(cleanTemplate(undefined)).toBeNull();
    expect(cleanTemplate('Hello {name}, ' + 'x'.repeat(900))!.length).toBeLessThanOrEqual(500);
  });

  it('lays saved wording over the defaults and ignores what does not pass', () => {
    const t = mergeTemplates({ due_back: { en: 'Hi {name}, time for your refill at {store}!' }, dues: { en: 'no name here at all' }, at_risk: { ta: 5 } });
    expect(t.due_back.en).toBe('Hi {name}, time for your refill at {store}!');
    expect(t.due_back.ta).toBe(DEFAULT_TEMPLATES.due_back.ta);
    expect(t.dues.en).toBe(DEFAULT_TEMPLATES.dues.en);
    expect(t.at_risk.ta).toBe(DEFAULT_TEMPLATES.at_risk.ta);
    expect(mergeTemplates(null)).toEqual(DEFAULT_TEMPLATES);
  });

  it('fills the name, the store and the amount', () => {
    expect(fillTemplate('Hello {name}, {amount} is pending at {store}.', { name: 'Mr. Kumar', store: 'RGP', amount: 1234.4 })).toBe('Hello Mr. Kumar, Rs 1,234 is pending at RGP.');
    expect(fillTemplate('Hello {name} from {store}', { name: 'Asha', store: 'RGP' })).toBe('Hello Asha from RGP');
  });

  it('cleans a drafted set: keeps good messages, drops bad ones, and needs an amount in a dues reminder', () => {
    const d = cleanDraft({ messages: [
      { audience: 'due_back', en: 'Hello {name}, your medicines are due at {store}.', ta: 'bad' },
      { audience: 'dues', en: 'Hello {name}, please clear the pending balance.', ta: 'வணக்கம் {name}, {amount} நிலுவையில் உள்ளது.' },
      { audience: 'unknown', en: 'Hello {name}, hi there everyone' },
    ] });
    expect(d.templates.due_back.en).toBe('Hello {name}, your medicines are due at {store}.');
    expect(d.templates.due_back.ta).toBe(DEFAULT_TEMPLATES.due_back.ta);
    expect(d.templates.dues.en).toBe(DEFAULT_TEMPLATES.dues.en);
    expect(d.templates.dues.ta).toBe('வணக்கம் {name}, {amount} நிலுவையில் உள்ளது.');
    expect(d.changed).toBe(2);
    expect(cleanDraft({}).changed).toBe(0);
  });
});

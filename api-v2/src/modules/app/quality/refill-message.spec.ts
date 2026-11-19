import { refillLang, refillMessages } from './refill-message';

describe('the refill reminder', () => {
  it('is the shop\'s standard due-back wording, greeting the customer, in English and Tamil', () => {
    const m = refillMessages(null, 'RGP Pharmacy', { name: 'Mr Kumar S' })!;
    expect(m.en).toContain('Kumar Sir/Madam');
    expect(m.en).toContain('RGP Pharmacy');
    expect(m.en).not.toContain('{');
    expect(m.ta).toContain('Kumar Sir/Madam');
    expect(m.ta).not.toContain('{');
  });

  it('follows the wording the shop saved', () => {
    const saved = { due_back: { en: 'Hi {name}, your refill at {store} is due.', ta: 'வணக்கம் {name}, {store} மருந்து நேரம் ஆச்சு.' } };
    expect(refillMessages(saved, 'RGP', { name: 'Anu' })!.en).toBe('Hi Anu Sir/Madam, your refill at RGP is due.');
  });

  it('is not made for a customer who asked not to be contacted', () => {
    expect(refillMessages(null, 'RGP', { name: 'Kumar', doNotContact: true })).toBeNull();
  });

  it('uses the customer\'s own language, English when they have not chosen', () => {
    expect(refillLang('ta')).toBe('ta');
    expect(refillLang('en')).toBe('en');
    expect(refillLang(null)).toBe('en');
    expect(refillLang('xx')).toBe('en');
  });

  it('puts the medicines that are due where the wording has {medicine}, and a plain phrase when there are none', () => {
    const saved = { due_back: { en: 'Hi {name}, {medicine} at {store} is due.', ta: 'வணக்கம் {name}, {medicine}.' } };
    expect(refillMessages(saved, 'RGP', { name: 'Anu', medicines: ['Metformin 500', 'Telma 40', 'Third'] })!.en).toBe('Hi Anu Sir/Madam, Metformin 500 and Telma 40 at RGP is due.');
    expect(refillMessages(saved, 'RGP', { name: 'Anu' })!.en).toBe('Hi Anu Sir/Madam, your regular medicines at RGP is due.');
  });
});

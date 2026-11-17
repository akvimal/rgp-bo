import { FOLLOWUP_LANGS, Templates, fillTemplate, mergeTemplates } from '../customers/customer-followup-rules';
import { greetingName } from '../customers/customer-export';

export type MessageLang = (typeof FOLLOWUP_LANGS)[number];

/** the language this customer is sent messages in: their own choice when they have one, English otherwise */
export function refillLang(messageLanguage: string | null | undefined): MessageLang {
  return messageLanguage === 'ta' ? 'ta' : 'en';
}

/**
 * The reminder for a refill row, in every language: the shop's own "due back" wording (the one the contact list uses), filled in for this
 * customer. A customer who asked not to be contacted, or who has no usable number, gets no message.
 */
export function refillMessages(savedWording: unknown, store: string, row: { name: string | null; doNotContact?: boolean | null }): Record<MessageLang, string> | null {
  if (row.doNotContact) return null;
  const t: Templates = mergeTemplates(savedWording);
  const v = { name: greetingName(row.name), store: store || 'our shop' };
  const out = {} as Record<MessageLang, string>;
  for (const l of FOLLOWUP_LANGS) out[l] = fillTemplate(t.due_back[l], v);
  return out;
}

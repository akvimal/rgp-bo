import { Injectable } from '@nestjs/common';
import { classifyMetaError } from './whatsapp-rules';

/** a send that failed: permanent (do not try again) or worth trying later */
export class WhatsAppError extends Error {
  constructor(message: string, readonly permanent: boolean, readonly code?: number, readonly auth = false) { super(message); }
}

export interface WhatsAppSend {
  mode: 'MOCK' | 'LIVE';
  phoneNumberId: string | null;
  token: string | null;
  /** country code and number, no plus, e.g. 919876543210 */
  to: string;
  template: string;
  language: 'en' | 'ta';
  params: string[];
  /** a document sent in the template's header (the bill) */
  document?: { filename: string; data: Buffer };
}

const base = () => (process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0').replace(/\/$/, '');

/**
 * The WhatsApp Business Cloud API (Meta), the only place the app talks to it. Each store has its own number (phone number id) and token.
 * MOCK mode sends nothing anywhere and answers with a made-up id, so the screens can be tried before Meta credentials exist.
 * The token is never logged or returned.
 */
@Injectable()
export class WhatsAppAdapter {
  async send(m: WhatsAppSend): Promise<string> {
    if (m.mode === 'MOCK') return 'mock.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (!m.phoneNumberId || !m.token) throw new WhatsAppError('This store has no WhatsApp number or token saved.', true, undefined, true);
    const mediaId = m.document ? await this.upload(m.phoneNumberId, m.token, m.document) : null;
    const components: any[] = [];
    if (mediaId) components.push({ type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: m.document!.filename } }] });
    if (m.params.length) components.push({ type: 'body', parameters: m.params.map((text) => ({ type: 'text', text })) });
    const json = await this.call(`${base()}/${m.phoneNumberId}/messages`, m.token, {
      messaging_product: 'whatsapp', to: m.to, type: 'template',
      template: { name: m.template, language: { code: m.language }, components },
    });
    const id = json?.messages?.[0]?.id;
    if (!id) throw new WhatsAppError('WhatsApp did not return a message id.', false);
    return String(id);
  }

  private async upload(phoneNumberId: string, token: string, doc: { filename: string; data: Buffer }): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', new Blob([new Uint8Array(doc.data)], { type: 'application/pdf' }), doc.filename);
    const json = await this.call(`${base()}/${phoneNumberId}/media`, token, form);
    if (!json?.id) throw new WhatsAppError('WhatsApp did not accept the bill file.', false);
    return String(json.id);
  }

  private async call(url: string, token: string, body: any): Promise<any> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    let res: Response;
    try {
      const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
      res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, ...(isForm ? {} : { 'content-type': 'application/json' }) }, body: isForm ? body : JSON.stringify(body), signal: ctl.signal });
    } catch (e: any) {
      throw new WhatsAppError(e?.name === 'AbortError' ? 'WhatsApp did not answer in time.' : `WhatsApp could not be reached: ${e?.message ?? e}`, false);
    } finally { clearTimeout(timer); }
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    if (res.ok) return json;
    const code = Number(json?.error?.code) || undefined;
    const msg = String(json?.error?.error_user_msg || json?.error?.message || `HTTP ${res.status}`).slice(0, 200);
    const k = classifyMetaError(res.status, code);
    throw new WhatsAppError(msg, k.permanent, code, !!k.auth);
  }
}

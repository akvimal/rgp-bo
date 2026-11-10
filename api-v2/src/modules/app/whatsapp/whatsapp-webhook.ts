import { createHmac, timingSafeEqual } from 'crypto';
import { normaliseMobile } from './whatsapp-rules';

/** Rules for what Meta sends to the webhook: who signed it, what receipts and replies it holds, and how a message's status may move. */

/** Meta signs each call: "sha256=" + HMAC-SHA256 of the raw body with the app secret. No secret, no header or a wrong one all mean "not from Meta". */
export function verifySignature(raw: Buffer | undefined, header: string | undefined, secret: string | undefined): boolean {
  if (!secret || !raw || !header) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(header).trim());
  if (!m) return false;
  const want = createHmac('sha256', secret).update(raw).digest();
  const got = Buffer.from(m[1], 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

export type WaState = 'sent' | 'delivered' | 'read' | 'failed';
export interface WaStatus { id: string; state: WaState; at: Date | null; error: string | null }
export interface WaInbound { from: string; text: string; phoneNumberId: string | null }

/** the delivery receipts and the customer's replies in a webhook body; anything else (other fields, odd shapes) is ignored */
export function parseWebhook(body: any): { statuses: WaStatus[]; inbound: WaInbound[] } {
  const statuses: WaStatus[] = [], inbound: WaInbound[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const ch of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (ch?.field && ch.field !== 'messages') continue;
      const v = ch?.value || {};
      const phoneNumberId = v?.metadata?.phone_number_id ? String(v.metadata.phone_number_id) : null;
      for (const s of Array.isArray(v.statuses) ? v.statuses : []) {
        const state = String(s?.status ?? '').toLowerCase();
        if (!s?.id || !['sent', 'delivered', 'read', 'failed'].includes(state)) continue;
        const ts = Number(s.timestamp);
        const e = Array.isArray(s.errors) ? s.errors[0] : null;
        statuses.push({
          id: String(s.id), state: state as WaState, at: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : null,
          error: e ? String(e.error_data?.details || e.message || e.title || `Error ${e.code ?? ''}`).slice(0, 300) : null,
        });
      }
      for (const m of Array.isArray(v.messages) ? v.messages : []) {
        if (!m?.from) continue;
        const text = m.type === 'text' ? m.text?.body : m.type === 'button' ? m.button?.text : m.type === 'interactive' ? (m.interactive?.button_reply?.title || m.interactive?.list_reply?.title) : '';
        inbound.push({ from: String(m.from), text: String(text ?? ''), phoneNumberId });
      }
    }
  }
  return { statuses, inbound };
}

const RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };

/** the status a message moves to on a receipt, or null to leave it (receipts can arrive late or twice: a message never goes back from Read to Delivered) */
export function nextStatus(current: string, state: WaState): 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null {
  if (!(current in RANK)) return null;                                  // FAILED and SKIPPED are final
  if (state === 'failed') return RANK[current] <= RANK.SENT ? 'FAILED' : null;
  const to = state.toUpperCase() as 'SENT' | 'DELIVERED' | 'READ';
  return RANK[to] > RANK[current] ? to : null;
}

/** the ways one mobile can be stored: ten digits, with 91, or with +91 (empty when it is not a mobile) */
export function mobileForms(from: string): string[] {
  const n = normaliseMobile(from);
  return n ? [n.slice(2), n, '+' + n] : [];
}

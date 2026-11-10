import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isStopWord } from './whatsapp-rules';
import { mobileForms, nextStatus, parseWebhook, verifySignature, WaInbound, WaStatus } from './whatsapp-webhook';

/**
 * What Meta calls us with: delivery receipts for the bills we sent (Sent, Delivered, Read, Failed) and the customer's replies. A reply of STOP (or its Tamil
 * form) switches contact off for that customer and cancels anything still waiting for them. Every call must carry Meta's signature, made with the app secret
 * (WHATSAPP_APP_SECRET); the address is registered with Meta with a verify token (WHATSAPP_VERIFY_TOKEN). Without them the webhook accepts nothing.
 */
@Injectable()
export class WhatsAppWebhookService {
  private readonly log = new Logger(WhatsAppWebhookService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly audit: AuditService) {}

  /** Meta's one-time check when the address is registered: it sends a challenge and expects it back if the verify token is ours */
  verifyChallenge(mode: any, token: any, challenge: any): string {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!expected || mode !== 'subscribe' || String(token ?? '') !== expected) throw new ForbiddenException('Verification failed.');
    return String(challenge ?? '');
  }

  async receive(raw: Buffer | undefined, signature: string | undefined, body: any): Promise<{ statuses: number; stopped: number }> {
    if (!verifySignature(raw, signature, process.env.WHATSAPP_APP_SECRET)) throw new ForbiddenException('The signature is not valid.');
    const { statuses, inbound } = parseWebhook(body);
    let changed = 0, stopped = 0;
    for (const s of statuses) {
      try { if (await this.applyStatus(s)) changed++; } catch (e: any) { this.log.error(`Receipt ${s.id} not applied: ${e?.message}`); }
    }
    for (const m of inbound) {
      try { stopped += await this.applyReply(m); } catch (e: any) { this.log.error(`Reply not applied: ${e?.message}`); }
    }
    return { statuses: changed, stopped };
  }

  /** moves the message with this WhatsApp id forward (never back); false when it is not ours or the receipt changes nothing */
  private async applyStatus(s: WaStatus): Promise<boolean> {
    const [m] = await this.manager.query(`select id, status from customer_message where provider_id = $1`, [s.id]);
    if (!m) return false;
    const to = nextStatus(m.status, s.state);
    if (!to) return false;
    const at = s.at ?? new Date();
    const rows = await this.manager.query(
      `update customer_message set status = $3::varchar,
              sent_on = case when $3::varchar in ('SENT', 'DELIVERED', 'READ') then coalesce(sent_on, $4::timestamptz) else sent_on end,
              delivered_on = case when $3::varchar in ('DELIVERED', 'READ') then coalesce(delivered_on, $4::timestamptz) else delivered_on end,
              read_on = case when $3::varchar = 'READ' then coalesce(read_on, $4::timestamptz) else read_on end,
              last_error = case when $3::varchar = 'FAILED' then $5::varchar else last_error end
        where id = $1 and status = $2 returning id`,
      [m.id, m.status, to, at, to === 'FAILED' ? (s.error || 'WhatsApp could not deliver this message.') : null]);
    return rows.length > 0;
  }

  /** a customer who writes STOP to one of our store numbers is not contacted again, and what was waiting for them is cancelled */
  private async applyReply(m: WaInbound): Promise<number> {
    if (!isStopWord(m.text) || !m.phoneNumberId) return 0;
    const [own] = await this.manager.query(`select store_id from store_whatsapp where phone_number_id = $1`, [m.phoneNumberId]);
    if (!own) return 0;                                                  // not one of our numbers
    const forms = mobileForms(m.from);
    if (!forms.length) return 0;
    const people = await this.manager.query(`select id from customer where mobile = any($1::text[])`, [forms]);
    let n = 0;
    for (const c of people) {
      await this.manager.query(`update customer set do_not_contact = true, updated_on = now() where id = $1`, [c.id]);
      await this.manager.query(
        `update customer_message set status = 'SKIPPED', last_error = 'The customer asked to stop.' where customer_id = $1 and status = 'PENDING'`, [c.id]);
      await this.audit.record({ action: 'whatsapp.customer_stopped', entityType: 'customer', entityId: c.id, summary: 'Customer asked to stop WhatsApp messages', details: { via: 'whatsapp', store_id: own.store_id } });
      n++;
    }
    return n;
  }
}

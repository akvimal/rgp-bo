import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { cleanKey, decryptKey, encryptKey, keyHint } from '../alerts/ai-key';
import { BillData, buildBillPdf } from './bill-pdf';
import { WhatsAppAdapter, WhatsAppError } from './whatsapp.adapter';
import { asLang, billLabel, billParams, canSendService, normaliseMobile, overMonthlyCap, retryInMinutes, templateName } from './whatsapp-rules';

const round2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;

/**
 * WhatsApp to customers, one number per store. A bill copy is written to customer_message first and sent by a worker, so a failure is retried and a bill never
 * goes twice. Only a completed bill, to a customer with a mobile who has not said no, from a store whose WhatsApp is switched on, within the month's cap.
 * In MOCK mode nothing leaves the server. Nothing is sent to a real number until a store is switched to LIVE with its own credentials.
 */
@Injectable()
export class WhatsAppService {
  private readonly log = new Logger(WhatsAppService.name);
  private working = false;

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly adapter: WhatsAppAdapter, private readonly audit: AuditService) {}

  private async scope(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const s = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id as number, all: isOwnerRole(r?.name), stores: s.map((x: any) => x.store_id) as number[] };
  }

  private async storeFor(user: any, storeId: number) {
    const c = await this.scope(user);
    const [st] = await this.manager.query(`select id, location, business_id from stores where id = $1 and active and not archive`, [storeId]);
    if (!st) throw new NotFoundException('Store not found.');
    if (c.all) {
      const [mine] = await this.manager.query(`select coalesce(u.business_id, (select s.business_id from user_stores us join stores s on s.id = us.store_id where us.user_id = u.id and us.active and not us.archive order by us.is_primary desc, us.id limit 1)) as b from app_user u where u.id = $1`, [user.id]);
      if (mine?.b && st.business_id && mine.b !== st.business_id) throw new ForbiddenException('That store is not in your business.');
    } else if (!c.stores.includes(storeId)) throw new ForbiddenException('You can only use WhatsApp for your own stores.');
    return { c, st };
  }

  // ------------------------------------------------------------------------------------------------ the store's number
  private shape(r: any, st: any) {
    return {
      store_id: st.id, store: st.location, configured: !!r,
      mode: r?.mode ?? 'MOCK', enabled: !!r?.enabled, auto_send_bill: !!r?.auto_send_bill, monthly_cap: r?.monthly_cap ?? 1000,
      phone_number_id: r?.phone_number_id ?? null, waba_id: r?.waba_id ?? null, display_number: r?.display_number ?? null,
      has_token: !!r?.token_sealed, token_hint: r?.token_hint ?? null,
    };
  }

  async settings(user: any, storeId: number) {
    const { st } = await this.storeFor(user, storeId);
    const [r] = await this.manager.query(`select * from store_whatsapp where store_id = $1`, [storeId]);
    return this.shape(r, st);
  }

  async saveSettings(user: any, storeId: number, b: any) {
    const { st } = await this.storeFor(user, storeId);
    const [old] = await this.manager.query(`select * from store_whatsapp where store_id = $1`, [storeId]);
    const mode = b?.mode === 'LIVE' ? 'LIVE' : 'MOCK';
    const phoneId = String(b?.phone_number_id ?? old?.phone_number_id ?? '').trim() || null;
    if (phoneId && !/^\d{5,25}$/.test(phoneId)) throw new BadRequestException('The phone number id is the long number from Meta (digits only).');
    const waba = String(b?.waba_id ?? old?.waba_id ?? '').trim() || null;
    if (waba && !/^\d{5,25}$/.test(waba)) throw new BadRequestException('The WhatsApp account id is the long number from Meta (digits only).');
    const display = String(b?.display_number ?? old?.display_number ?? '').trim().slice(0, 20) || null;
    let sealed: string | null = old?.token_sealed ?? null, hint: string | null = old?.token_hint ?? null;
    if (b?.clear_token) { sealed = null; hint = null; }
    else if (String(b?.token ?? '').trim()) {
      const k = cleanKey(b.token);
      if (!k) throw new BadRequestException('That access token does not look right. Paste the whole token from Meta.');
      sealed = encryptKey(k); hint = keyHint(k);
    }
    if (mode === 'LIVE' && (!phoneId || !sealed)) throw new BadRequestException('LIVE needs the phone number id and the access token.');
    const cap = b?.monthly_cap === undefined ? (old?.monthly_cap ?? 1000) : Number(b.monthly_cap);
    if (!Number.isInteger(cap) || cap < 0 || cap > 100000) throw new BadRequestException('The monthly limit must be a whole number from 0 to 100000.');
    const enabled = b?.enabled === undefined ? !!old?.enabled : !!b.enabled;
    const auto = b?.auto_send_bill === undefined ? !!old?.auto_send_bill : !!b.auto_send_bill;
    await this.manager.query(
      `insert into store_whatsapp (store_id, mode, phone_number_id, waba_id, display_number, token_sealed, token_hint, enabled, auto_send_bill, monthly_cap, updated_on, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), $11)
       on conflict (store_id) do update set mode = excluded.mode, phone_number_id = excluded.phone_number_id, waba_id = excluded.waba_id, display_number = excluded.display_number,
         token_sealed = excluded.token_sealed, token_hint = excluded.token_hint, enabled = excluded.enabled, auto_send_bill = excluded.auto_send_bill,
         monthly_cap = excluded.monthly_cap, updated_on = now(), updated_by = excluded.updated_by`,
      [storeId, mode, phoneId, waba, display, sealed, hint, enabled, auto, cap, user.id]);
    await this.audit.record({ userId: user.id, action: 'whatsapp.settings_saved', entityType: 'store', entityId: storeId, summary: `WhatsApp settings saved for ${st.location}`,
      details: { mode, enabled, auto_send_bill: auto, monthly_cap: cap, token_changed: sealed !== (old?.token_sealed ?? null) } });
    return this.settings(user, storeId);
  }

  // ------------------------------------------------------------------------------------------------ a bill
  private async loadBill(saleId: number) {
    const [s] = await this.manager.query(
      `select s.id, s.bill_no, s.gst_invoice_no, s.bill_date, s.status, s.total, s.disc_amount, s.cash_amount, s.digi_amount, s.digi_method, s.due_amount, s.expreturn_days, s.store_id, s.customer_id,
              c.name as customer_name, c.mobile, c.do_not_contact, c.contact_consent, c.message_language,
              st.location as store_name, st.address as store_address, st.phone as store_phone, st.business_id,
              b.legal_name, b.gstin
         from sale s join customer c on c.id = s.customer_id left join stores st on st.id = s.store_id left join business b on b.id = st.business_id
        where s.id = $1 and s.active and not s.archive`, [saleId]);
    if (!s) throw new NotFoundException('Bill not found.');
    const items = await this.manager.query(
      `select p.title, si.batch, si.exp_date, si.qty, si.mrp_cost, si.price, si.tax_pcnt, si.total
         from sale_item si join product p on p.id = si.product_id
        where si.sale_id = $1 and si.active and not si.archive and coalesce(si.sale_mode, 'SALE') = 'SALE' order by si.id`, [saleId]);
    return { s, items };
  }

  private billData(s: any, items: any[]): BillData {
    return {
      shop: { name: s.store_name || 'Store', address: s.store_address, phone: s.store_phone, legalName: s.legal_name, gstin: s.gstin },
      label: billLabel({ gstinvoiceno: s.gst_invoice_no, billno: s.bill_no, id: s.id }), taxInvoice: !!s.gst_invoice_no,
      date: new Date(s.bill_date), customer: s.customer_name, mobile: s.mobile,
      lines: items.map((i) => ({ title: i.title, batch: i.batch, expDate: i.exp_date ? String(i.exp_date).slice(0, 10) : null, qty: Number(i.qty), mrp: i.mrp_cost, price: Number(i.price), taxPcnt: i.tax_pcnt, total: Number(i.total ?? Number(i.price) * Number(i.qty)) })),
      discount: round2(s.disc_amount), total: round2(s.total), cash: round2(s.cash_amount), digital: round2(s.digi_amount), digitalMethod: s.digi_method, due: round2(s.due_amount), returnDays: s.expreturn_days,
    };
  }

  /** the customer's copy of a bill as the PDF that would be sent (for a preview before sending) */
  async billPdf(user: any, saleId: number): Promise<{ data: Buffer; filename: string }> {
    const { s, items } = await this.loadBill(saleId);
    await this.canTouch(user, s);
    const d = this.billData(s, items);
    return { data: await buildBillPdf(d), filename: `Bill-${d.label.replace(/[^A-Za-z0-9_-]+/g, '-')}.pdf` };
  }

  private async canTouch(user: any, s: any) {
    if (!s.store_id) throw new BadRequestException('This bill has no store.');
    await this.storeFor(user, s.store_id);
  }

  /** puts a bill copy in the queue for the customer; says plainly why when it cannot */
  async queueBill(user: any, saleId: number, opts: { auto?: boolean } = {}) {
    const { s } = await this.loadBill(saleId);
    if (!opts.auto) await this.canTouch(user, s);          // the store's own auto-send is not a person's choice, so it does not need their permission
    if (String(s.status).toUpperCase() !== 'COMPLETE') throw new BadRequestException('Only a completed bill can be sent.');
    const [cfg] = await this.manager.query(`select * from store_whatsapp where store_id = $1`, [s.store_id]);
    if (!cfg?.enabled) throw new BadRequestException('WhatsApp is not switched on for this store. Turn it on in Settings > WhatsApp.');
    const can = canSendService(s);
    if (!can.ok) throw new BadRequestException(can.reason);
    const [used] = await this.manager.query(
      `select count(*)::int as n from customer_message where store_id = $1 and status in ('PENDING', 'SENT', 'DELIVERED', 'READ') and created_on >= date_trunc('month', now())`, [s.store_id]);
    if (overMonthlyCap(used.n, cfg.monthly_cap)) throw new BadRequestException(`This store has reached its WhatsApp limit of ${cfg.monthly_cap} messages this month.`);
    const lang = asLang(s.message_language);
    const label = billLabel({ gstinvoiceno: s.gst_invoice_no, billno: s.bill_no, id: s.id });
    const rows = await this.manager.query(
      `insert into customer_message (business_id, store_id, customer_id, sale_id, kind, template, language, params, to_mobile, created_by)
       values ($1, $2, $3, $4, 'BILL', $5, $6, $7::jsonb, $8, $9)
       on conflict (kind, sale_id) where sale_id is not null and kind = 'BILL' and status <> 'FAILED' do nothing returning id`,
      [s.business_id, s.store_id, s.customer_id, s.id, templateName('BILL', lang), lang, JSON.stringify(billParams(s.customer_name, s.store_name, label, s.total)), normaliseMobile(s.mobile), opts.auto ? null : user.id]);
    if (!rows.length) throw new BadRequestException('This bill has already been sent to the customer.');
    await this.audit.record({ userId: user.id, action: 'whatsapp.bill_queued', entityType: 'sale', entityId: saleId, summary: `Bill ${label} queued on WhatsApp`, details: { message_id: rows[0].id, mode: cfg.mode } });
    void this.processQueue().catch(() => undefined);
    return { id: Number(rows[0].id), status: 'PENDING', mode: cfg.mode };
  }

  /**
   * Called after a bill is saved: when the store sends bills automatically and this one is completed, queue it. It never fails the sale: a customer with no
   * mobile or who said no, a bill already sent, or the monthly limit simply means nothing is sent.
   */
  async autoSendBill(user: any, saleId: any): Promise<void> {
    try {
      const id = Number(saleId);
      if (!Number.isInteger(id) || id <= 0) return;
      const [s] = await this.manager.query(
        `select s.status, w.enabled, w.auto_send_bill from sale s left join store_whatsapp w on w.store_id = s.store_id where s.id = $1`, [id]);
      if (!s || String(s.status).toUpperCase() !== 'COMPLETE' || !s.enabled || !s.auto_send_bill) return;
      await this.queueBill(user, id, { auto: true });
    } catch (e: any) {
      this.log.debug(`Bill ${saleId} was not sent automatically: ${e?.message}`);
    }
  }

  /** what has been sent for a bill (newest first) */
  async forSale(user: any, saleId: number) {
    const { s } = await this.loadBill(saleId);
    await this.canTouch(user, s);
    return this.manager.query(
      `select id, kind, status, language, last_error, created_on, sent_on, delivered_on, read_on from customer_message where sale_id = $1 order by id desc`, [saleId]);
  }

  /** the recent messages of a store, for the log */
  async recent(user: any, storeId: number, limit = 100) {
    await this.storeFor(user, storeId);
    const rows = await this.manager.query(
      `select m.id, m.kind, m.status, m.language, m.to_mobile, m.last_error, m.created_on, m.sent_on, m.delivered_on, m.read_on, m.sale_id, c.name as customer, s.bill_no, s.gst_invoice_no
         from customer_message m join customer c on c.id = m.customer_id left join sale s on s.id = m.sale_id
        where m.store_id = $1 order by m.id desc limit $2`, [storeId, Math.min(Math.max(limit, 1), 300)]);
    const [month] = await this.manager.query(
      `select count(*)::int as n from customer_message where store_id = $1 and status in ('PENDING', 'SENT', 'DELIVERED', 'READ') and created_on >= date_trunc('month', now())`, [storeId]);
    return { messages: rows.map((r: any) => ({ ...r, to_mobile: '******' + String(r.to_mobile).slice(-4) })), this_month: month.n };
  }

  /** sends a test template to a number the manager types, from the store's own number (MOCK sends nothing) */
  async test(user: any, storeId: number, mobile: string) {
    const { st } = await this.storeFor(user, storeId);
    const to = normaliseMobile(mobile);
    if (!to) throw new BadRequestException('Enter a valid 10-digit mobile number.');
    const [cfg] = await this.manager.query(`select * from store_whatsapp where store_id = $1`, [storeId]);
    if (!cfg) throw new BadRequestException('Save the store\'s WhatsApp settings first.');
    try {
      const id = await this.adapter.send({
        mode: cfg.mode, phoneNumberId: cfg.phone_number_id, token: decryptKey(cfg.token_sealed), to, template: templateName('BILL', 'en'), language: 'en',
        params: billParams('Test', st.location, 'TEST-1', 0),
      });
      await this.audit.record({ userId: user.id, action: 'whatsapp.test_sent', entityType: 'store', entityId: storeId, summary: `WhatsApp test sent from ${st.location}`, details: { mode: cfg.mode } });
      return { ok: true, mode: cfg.mode, provider_id: id };
    } catch (e: any) {
      if (e instanceof WhatsAppError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  // ------------------------------------------------------------------------------------------------ the worker
  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick() { try { await this.processQueue(); } catch (e: any) { this.log.error(`WhatsApp queue run failed: ${e?.message}`); } }

  /** sends what is due: each message is claimed first (so two runs never send the same one), then sent, then marked */
  async processQueue(): Promise<number> {
    if (this.working) return 0;
    this.working = true;
    let sent = 0;
    try {
      const claimed = await this.manager.query(
        `update customer_message set attempts = attempts + 1, send_after = now() + interval '2 minutes'
          where id in (select id from customer_message where status = 'PENDING' and send_after <= now() order by id limit 20 for update skip locked)
          returning id, store_id, sale_id, kind, template, language, params, to_mobile, attempts`);
      const rows = Array.isArray(claimed[0]) ? claimed[0] : claimed;       // an UPDATE ... RETURNING comes back as [rows, count]
      for (const m of rows) {
        try {
          const [cfg] = await this.manager.query(`select * from store_whatsapp where store_id = $1`, [m.store_id]);
          if (!cfg?.enabled) throw new WhatsAppError('WhatsApp was switched off for this store.', true);
          let document: { filename: string; data: Buffer } | undefined;
          if (m.kind === 'BILL' && m.sale_id) {
            const { s, items } = await this.loadBill(m.sale_id);
            const d = this.billData(s, items);
            document = { filename: `Bill-${d.label.replace(/[^A-Za-z0-9_-]+/g, '-')}.pdf`, data: await buildBillPdf(d) };
          }
          const id = await this.adapter.send({
            mode: cfg.mode, phoneNumberId: cfg.phone_number_id, token: decryptKey(cfg.token_sealed), to: m.to_mobile, template: m.template, language: asLang(m.language),
            params: Array.isArray(m.params) ? m.params : [], document,
          });
          await this.manager.query(`update customer_message set status = 'SENT', sent_on = now(), provider_id = $2, last_error = null where id = $1`, [m.id, id]);
          sent++;
        } catch (e: any) {
          const err = e instanceof WhatsAppError ? e : new WhatsAppError(String(e?.message ?? e), false);
          const wait = err.permanent ? null : retryInMinutes(Number(m.attempts));
          if (wait === null) await this.manager.query(`update customer_message set status = 'FAILED', last_error = $2 where id = $1`, [m.id, err.message.slice(0, 300)]);
          else await this.manager.query(`update customer_message set status = 'PENDING', send_after = now() + make_interval(mins => $2::int), last_error = $3 where id = $1`, [m.id, wait, err.message.slice(0, 300)]);
        }
      }
    } finally { this.working = false; }
    return sent;
  }
}

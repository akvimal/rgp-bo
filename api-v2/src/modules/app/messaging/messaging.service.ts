import { BadRequestException, ForbiddenException, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectEntityManager } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import { BUSINESS_OF_USER_SQL, businessOfUser } from 'src/core/business-of-user';
import { isOwnerRole } from 'src/core/roles';
import { canSee } from '../alerts/alert-access';
import { AuditService } from 'src/core/audit/audit.service';
import { decryptKey, encryptKey } from '../alerts/ai-key';
import { cleanAppUrl, cleanBotToken, setStoredTelegram, storedTelegram, telegramAppUrl, telegramSource, tokenHint } from './telegram-config';
import { LANGUAGES, Lang, render } from '../alerts/alert-messages';
import { ChannelError, TelegramAdapter } from './telegram.adapter';
import { Command, SEVERITIES, TOKEN_MINUTES, formatAlert, inQuiet, istMinute, overCap, parseUpdate, passesSeverity, quietEnds, retryAfterMinutes, toMinutes } from './messaging-rules';

const CHANNEL = 'TELEGRAM';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AlertToSend {
  businessId: number; notificationId: number; severity: string; code: string; params: any; link: string | null; storeId: number | null; recipients: any; kind?: 'ALERT' | 'ALERT_UP';
}

/**
 * Sending alerts to staff outside the app: Telegram first, through an outbox. An alert that opens is written to the outbox for each person who can see
 * it, has linked Telegram and wants that level; a worker sends from the outbox, retrying a failure; quiet hours hold the lower levels until morning.
 * A person links by pressing Start on a one-time link made in the app, and can stop with /stop. Nothing goes to anyone who has not linked.
 */
@Injectable()
export class MessagingService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(MessagingService.name);
  private polling = false;
  private stopped = false;
  private working = false;
  private loopId = 0;

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly telegram: TelegramAdapter, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------------------------------------ polling for what people type to the bot
  async onApplicationBootstrap() {
    try { await this.loadConfig(); } catch (e: any) { this.log.warn(`Telegram settings not loaded: ${e?.message}`); }
    this.startPolling();
  }

  private startPolling() {
    if (this.polling || !this.telegram.configured || process.env.TELEGRAM_POLL === 'off') return;
    const id = ++this.loopId;
    this.polling = true;
    void this.pollLoop(id).finally(() => { if (this.loopId === id) this.polling = false; });
  }

  // ------------------------------------------------------------------------------------------------ the bot's settings (saved in the app)
  private async loadConfig() {
    const rows = await this.manager.query(`select setting_key, setting_value from app_setting where setting_key in ('telegram.token', 'telegram.bot', 'telegram.app_url') and active and not archive`);
    const get = (k: string): string | null => rows.find((r: any) => r.setting_key === k)?.setting_value ?? null;
    setStoredTelegram({ token: decryptKey(get('telegram.token')), username: get('telegram.bot'), appUrl: get('telegram.app_url') });
  }

  private async putSetting(key: string, value: string | null, by: number) {
    if (value === null) { await this.manager.query(`update app_setting set active = false, archive = true, setting_value = null, updated_on = now() where setting_key = $1`, [key]); return; }
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, created_by, updated_by) values ('alerts', $1, $2, $3, $3)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [key, value, by]);
  }

  /** what the settings card shows: where the bot comes from, never the token itself */
  private configState() {
    const s = storedTelegram();
    return { source: telegramSource(), token_hint: s.token ? tokenHint(s.token) : null, app_url: telegramAppUrl() || null };
  }

  /** the owner saves the bot's token (checked with Telegram first) and, if wanted, the app's public address */
  async saveConfig(user: any, body: any) {
    const w = await this.whoami(user);
    if (!w.owner) throw new ForbiddenException('Only the owner can set up the Telegram bot.');
    const cur = storedTelegram();
    let url: string | null = cur.appUrl;
    if (body?.app_url !== undefined) {
      const u = cleanAppUrl(body.app_url);
      if (u === undefined) throw new BadRequestException('The app address must start with https://, such as https://ops.myrgp.in (or leave it empty).');
      url = u;
    }
    let token = cur.token, username = cur.username, changed = false;
    if (body?.token !== undefined && String(body.token).trim() !== '') {
      const t = cleanBotToken(body.token);
      if (!t) throw new BadRequestException('Paste the whole token from BotFather, like 123456789:AAH... (no spaces).');
      try { username = await this.telegram.check(t); } catch (e: any) { throw new BadRequestException(e instanceof ChannelError ? e.message : 'Telegram could not be reached.'); }
      token = t; changed = t !== cur.token;
    } else if (!token) {
      throw new BadRequestException('Paste the bot token from BotFather.');
    }
    await this.putSetting('telegram.token', encryptKey(token!), user.id);
    await this.putSetting('telegram.bot', username, user.id);
    await this.putSetting('telegram.app_url', url, user.id);
    setStoredTelegram({ token, username, appUrl: url });
    this.telegram.reset();
    if (changed) await this.manager.query(`delete from app_setting where setting_key = 'telegram.offset'`);   // a new bot starts its own count
    this.startPolling();
    await this.audit.record({ userId: user.id, action: 'telegram.bot_saved', summary: `Telegram bot saved (@${username})`, details: { bot: username, token_changed: changed } });
    return this.overview(user);
  }

  /** removes the bot saved in the app (the server's own setting, if any, takes over) */
  async clearConfig(user: any) {
    const w = await this.whoami(user);
    if (!w.owner) throw new ForbiddenException('Only the owner can set up the Telegram bot.');
    for (const k of ['telegram.token', 'telegram.bot', 'telegram.app_url', 'telegram.offset']) await this.putSetting(k, null, user.id);
    setStoredTelegram({ token: null, username: null, appUrl: null });
    this.telegram.reset();
    this.polling = false;                                           // an old loop ends after its current wait
    this.startPolling();
    await this.audit.record({ userId: user.id, action: 'telegram.bot_removed', summary: 'Telegram bot removed from the app', details: {} });
    return this.overview(user);
  }

  onApplicationShutdown() { this.stopped = true; }

  private async pollLoop(id: number) {
    let backoff = 2000;
    while (!this.stopped && this.polling && this.loopId === id) {
      try {
        const offset = await this.offset();
        const updates = await this.telegram.updates(offset, 25);
        for (const u of updates) {
          try { await this.handle(parseUpdate(u)); } catch (e: any) { this.log.error(`Telegram update failed: ${e?.message}`); }
          await this.saveOffset(Number(u.update_id) + 1);
        }
        backoff = 2000;
        if (!updates.length) await sleep(200);
      } catch (e: any) {
        this.log.warn(`Telegram polling: ${e?.message}`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 10000);
      }
    }
  }

  private async offset(): Promise<number> {
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = 'telegram.offset' and active and not archive`);
    return Number(s?.setting_value) || 0;
  }

  private async saveOffset(n: number) {
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value) values ('alerts', 'telegram.offset', $1)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_on = now()`, [String(n)]);
  }

  /** what to do with something a person typed (public so a test can feed it without Telegram) */
  async handle(cmd: Command | null) {
    if (!cmd) return;
    const say = (text: string) => this.telegram.send(cmd.chatId, text).catch((e) => this.log.warn(`Telegram reply failed: ${e?.message}`));
    if (cmd.kind === 'chatid') {
      // for the people who set up the daily digest: the id to paste under Settings > Notifications (it works in a group too, and says nothing else)
      await say(`This ${cmd.chatType === 'private' ? 'chat' : cmd.chatType}${cmd.title ? ` (${cmd.title})` : ''} has the chat ID ${cmd.chatId}. Paste it under Settings > Notifications in the app.`);
      return;
    }
    if (cmd.kind === 'start') {
      if (!cmd.token) { await say('To get alerts here, open Notifications in the app and press "Connect Telegram". It gives you a link that brings you back to this chat.'); return; }
      const used = await this.manager.query(
        `update channel_link_token set used_on = now() where token_hash = $1 and used_on is null and expires_on > now() and channel = $2 returning user_id`, [hash(cmd.token), CHANNEL]);
      const t = (Array.isArray(used[0]) ? used[0] : used)[0];       // an UPDATE ... RETURNING comes back as [rows, count]
      if (!t) { await say('That link has expired or was already used. Press "Connect Telegram" in the app for a new one.'); return; }
      const [taken] = await this.manager.query(`select user_id from user_channel where channel = $1 and chat_id = $2 and user_id <> $3`, [CHANNEL, cmd.chatId, t.user_id]);
      if (taken) { await say('This Telegram account is already connected to someone else in the app. They need to disconnect it first.'); return; }
      await this.manager.query(
        `insert into user_channel (user_id, channel, chat_id, handle, status, linked_on, stopped_on) values ($1, $2, $3, $4, 'ACTIVE', now(), null)
         on conflict (user_id, channel) do update set chat_id = excluded.chat_id, handle = excluded.handle, status = 'ACTIVE', linked_on = now(), stopped_on = null`,
        [t.user_id, CHANNEL, cmd.chatId, cmd.handle]);
      const [u] = await this.manager.query(`select full_name from app_user where id = $1`, [t.user_id]);
      await say(`Connected, ${String(u?.full_name ?? '').trim() || 'thank you'}. Alerts of warning level and above will come here, and critical ones at any hour. Send /stop to stop, /status to see your settings.`);
      return;
    }
    const [ch] = await this.manager.query(`select uc.*, u.full_name from user_channel uc join app_user u on u.id = uc.user_id where uc.channel = $1 and uc.chat_id = $2`, [CHANNEL, cmd.chatId]);
    if (cmd.kind === 'stop') {
      if (ch) await this.manager.query(`update user_channel set status = 'STOPPED', stopped_on = now() where id = $1`, [ch.id]);
      await say(ch ? 'Stopped. You will not get alerts here. Press "Connect Telegram" in the app to start again.' : 'Nothing was connected to this chat.');
    } else if (cmd.kind === 'status') {
      await say(!ch ? 'This chat is not connected to anyone. Press "Connect Telegram" in the app.'
        : `${String(ch.full_name).trim()}: ${ch.status === 'ACTIVE' ? 'connected' : 'stopped'}. Level ${ch.min_severity} and above. Quiet hours ${ch.quiet_from && ch.quiet_to ? `${ch.quiet_from} to ${ch.quiet_to} (critical alerts still come)` : 'none'}.`);
    } else {
      await say('I send the shop\'s alerts. /status shows your settings and /stop stops them. Change the level and quiet hours in the app under Notifications.');
    }
  }

  // ------------------------------------------------------------------------------------------------ a person's own connection
  private async whoami(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    const stores = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [user.id]);
    return { id: user.id, role: r?.name || '', owner: isOwnerRole(r?.name), storeIds: stores.map((s: any) => s.store_id) as number[] };
  }

  private async enabledFor(businessId: number | null): Promise<boolean> {
    if (!businessId) return false;
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = 'alerts_telegram' and active and not archive`);
    return String(s?.setting_value ?? 'on').toLowerCase() !== 'off';
  }

  async me(user: any) {
    const [c] = await this.manager.query(`select status, handle, min_severity, quiet_from, quiet_to, to_char(linked_on, 'YYYY-MM-DD"T"HH24:MI:SSOF') as linked_on from user_channel where user_id = $1 and channel = $2`, [user.id, CHANNEL]);
    const businessId = await businessOfUser(this.manager, user.id);
    return {
      configured: this.telegram.configured, enabled: await this.enabledFor(businessId), bot: this.telegram.configured ? await this.telegram.username() : null,
      linked: !!c && c.status !== 'STOPPED', status: c?.status ?? null, handle: c?.handle ?? null, since: c?.linked_on ?? null,
      min_severity: c?.min_severity ?? 'warning', quiet_from: c ? c.quiet_from : '22:00', quiet_to: c ? c.quiet_to : '07:00',
    };
  }

  /** a one-time link that opens the bot with a token; pressing Start there connects this person */
  async link(user: any) {
    if (!this.telegram.configured) throw new BadRequestException('Telegram alerts are not set up on this server yet. Ask your administrator to add the shop\'s Telegram bot.');
    const bot = await this.telegram.username();
    if (!bot) throw new BadRequestException('The Telegram bot could not be reached. Try again in a minute.');
    const token = randomBytes(24).toString('base64url');
    await this.manager.query(`delete from channel_link_token where user_id = $1 and channel = $2 and used_on is null`, [user.id, CHANNEL]);
    const [r] = await this.manager.query(
      `insert into channel_link_token (token_hash, user_id, channel, expires_on) values ($1, $2, $3, now() + make_interval(mins => $4)) returning expires_on`, [hash(token), user.id, CHANNEL, TOKEN_MINUTES]);
    return { url: `https://t.me/${bot}?start=${token}`, bot, expires_on: r.expires_on, minutes: TOKEN_MINUTES };
  }

  async unlink(user: any) {
    await this.manager.query(`delete from user_channel where user_id = $1 and channel = $2`, [user.id, CHANNEL]);
    await this.manager.query(`delete from channel_link_token where user_id = $1 and channel = $2`, [user.id, CHANNEL]);
    return this.me(user);
  }

  async savePrefs(user: any, body: any) {
    const [c] = await this.manager.query(`select id from user_channel where user_id = $1 and channel = $2`, [user.id, CHANNEL]);
    if (!c) throw new BadRequestException('Connect Telegram first.');
    const sev = body?.min_severity ?? 'warning';
    if (!SEVERITIES.includes(sev)) throw new BadRequestException('Choose the level: info, warning or critical.');
    const none = (v: any) => v === null || v === undefined || String(v).trim() === '';
    const from = none(body?.quiet_from) ? null : String(body.quiet_from).trim();
    const to = none(body?.quiet_to) ? null : String(body.quiet_to).trim();
    if ((from !== null && toMinutes(from) === null) || (to !== null && toMinutes(to) === null) || ((from === null) !== (to === null))) throw new BadRequestException('Quiet hours need a start and an end, such as 22:00 and 07:00 (or leave both empty).');
    await this.manager.query(`update user_channel set min_severity = $2, quiet_from = $3, quiet_to = $4 where id = $1`, [c.id, sev, from, to]);
    return this.me(user);
  }

  /** a message to the person's own Telegram, sent at once, to check it works */
  async test(user: any) {
    if (!this.telegram.configured) throw new BadRequestException('Telegram alerts are not set up on this server yet.');
    const [c] = await this.manager.query(`select chat_id, status from user_channel where user_id = $1 and channel = $2`, [user.id, CHANNEL]);
    if (!c || c.status !== 'ACTIVE') throw new BadRequestException('Connect Telegram first.');
    try {
      await this.telegram.send(c.chat_id, 'This is a test from the shop\'s app. Alerts will come to this chat.');
    } catch (e: any) {
      if (e instanceof ChannelError && e.blocked) await this.manager.query(`update user_channel set status = 'BLOCKED' where user_id = $1 and channel = $2`, [user.id, CHANNEL]);
      throw new BadRequestException(`The test message did not go: ${e?.message}`);
    }
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------------------ the owner's view
  async overview(user: any) {
    const w = await this.whoami(user);
    if (!w.owner) throw new ForbiddenException('Only the owner sees how alerts are sent.');
    const businessId = await businessOfUser(this.manager, user.id);
    const staff = await this.manager.query(
      `select u.id, u.full_name as name, uc.status, uc.handle, uc.min_severity, uc.last_sent_on
         from user_channel uc join app_user u on u.id = uc.user_id where uc.channel = $1 and (${BUSINESS_OF_USER_SQL}) = $2 order by u.full_name`, [CHANNEL, businessId]);
    const recent = await this.manager.query(
      `select o.id, u.full_name as recipient, o.severity, o.title, o.status, o.attempts, o.last_error, o.created_on, o.sent_on
         from message_outbox o join app_user u on u.id = o.recipient_user_id where o.business_id = $1 and o.channel = $2 order by o.id desc limit 30`, [businessId, CHANNEL]);
    const [n] = await this.manager.query(
      `select count(*) filter (where status = 'SENT')::int as sent, count(*) filter (where status = 'PENDING')::int as pending,
              count(*) filter (where status = 'FAILED')::int as failed, count(*) filter (where status = 'SKIPPED')::int as skipped
         from message_outbox where business_id = $1 and channel = $2 and created_on > now() - interval '7 days'`, [businessId, CHANNEL]);
    return { configured: this.telegram.configured, enabled: await this.enabledFor(businessId), bot: this.telegram.configured ? await this.telegram.username() : null, config: this.configState(), shift: await this.shiftSwitches(), staff, recent, week: n };
  }

  /** the shift messages: on for each of opening and closing unless set to off; the full version for the store group is off unless set to on */
  private async shiftSwitches(): Promise<{ open: boolean; close: boolean; group_full: boolean }> {
    const rows = await this.manager.query(`select setting_key, setting_value from app_setting where setting_key in ('shift_open_message', 'shift_close_message', 'shift_group_full') and active and not archive`);
    const get = (k: string, d: string) => String(rows.find((r: any) => r.setting_key === k)?.setting_value ?? d).toLowerCase();
    return { open: get('shift_open_message', 'on') !== 'off', close: get('shift_close_message', 'on') !== 'off', group_full: get('shift_group_full', 'off') === 'on' };
  }

  async saveShiftSwitches(user: any, body: any) {
    const w = await this.whoami(user);
    if (!w.owner) throw new ForbiddenException('Only the owner can switch this.');
    const cur = await this.shiftSwitches();
    const pick = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);
    const next = { open: pick(body?.open, cur.open), close: pick(body?.close, cur.close), group_full: pick(body?.group_full, cur.group_full) };
    const put = (k: string, v: string, d: string) => this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, description, created_by, updated_by) values ('alerts', $1, $2, $3, $4, $4)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [k, v, d, user.id]);
    await put('shift_open_message', next.open ? 'on' : 'off', 'Telegram message when a shift opens');
    await put('shift_close_message', next.close ? 'on' : 'off', 'Telegram message when a shift closes');
    await put('shift_group_full', next.group_full ? 'on' : 'off', 'The store group gets the full shift message (names and amounts)');
    await this.audit.record({ userId: user.id, action: 'telegram.shift_messages', summary: `shift messages: open ${next.open ? 'on' : 'off'}, close ${next.close ? 'on' : 'off'}, full version for the group ${next.group_full ? 'on' : 'off'}`, details: next });
    return this.overview(user);
  }

  async setEnabled(user: any, on: boolean) {
    const w = await this.whoami(user);
    if (!w.owner) throw new ForbiddenException('Only the owner can switch this.');
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, description, created_by, updated_by) values ('alerts', 'alerts_telegram', $1, 'Alerts also go to staff Telegram', $2, $2)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [on ? 'on' : 'off', user.id]);
    return this.overview(user);
  }

  // ------------------------------------------------------------------------------------------------ queueing an alert
  /** writes the alert to the outbox for each connected person who can see it and wants that level (called when an alert opens, or becomes critical) */
  async notifyAlert(a: AlertToSend): Promise<number> {
    if (!this.telegram.configured || !(await this.enabledFor(a.businessId))) return 0;
    const people = await this.manager.query(
      `select uc.user_id, uc.chat_id, uc.min_severity, uc.quiet_from, uc.quiet_to, r.name as role, coalesce(np.language, 'en') as language
         from user_channel uc join app_user u on u.id = uc.user_id join app_role r on r.id = u.role_id left join notification_pref np on np.user_id = u.id
        where uc.channel = $1 and uc.status = 'ACTIVE' and u.active and not u.archive and (${BUSINESS_OF_USER_SQL}) = $2`, [CHANNEL, a.businessId]);
    let queued = 0;
    for (const p of people) {
      const stores = await this.manager.query(`select store_id from user_stores where user_id = $1 and active and not archive`, [p.user_id]);
      const who = { id: p.user_id, role: p.role, owner: isOwnerRole(p.role), storeIds: stores.map((s: any) => s.store_id) as number[] };
      if (!canSee(a.recipients, who, a.storeId) || !passesSeverity(p.min_severity, a.severity)) continue;
      const lang: Lang = LANGUAGES.includes(p.language) ? p.language : 'en';
      const text = render(a.code, a.params, lang);
      const now = new Date();
      const quiet = a.severity !== 'critical' && inQuiet(istMinute(now), p.quiet_from, p.quiet_to);
      const [recent] = await this.manager.query(
        `select count(*)::int as n from message_outbox where recipient_user_id = $1 and channel = $2 and status in ('PENDING', 'SENT') and created_on > now() - interval '1 hour'`, [p.user_id, CHANNEL]);
      const capped = overCap(recent.n, a.severity);
      const rows = await this.manager.query(
        `insert into message_outbox (business_id, channel, recipient_user_id, chat_id, kind, ref_type, ref_id, severity, title, body, link, status, send_after, last_error)
         values ($1, $2, $3, $4, $5, 'notification', $6, $7, $8, $9, $10, $11, $12, $13)
         on conflict (channel, recipient_user_id, kind, ref_type, ref_id) where ref_id is not null do nothing returning id`,
        [a.businessId, CHANNEL, p.user_id, p.chat_id, a.kind ?? 'ALERT', a.notificationId, a.severity, text.title.slice(0, 200), text.body, a.link, capped ? 'SKIPPED' : 'PENDING',
          quiet ? quietEnds(now, p.quiet_to) : now, capped ? 'Hourly limit reached' : null]);
      if (rows.length && !capped) queued++;
    }
    if (queued) void this.processOutbox().catch(() => undefined);      // do not wait for the next minute
    return queued;
  }

  // ------------------------------------------------------------------------------------------------ sending from the outbox
  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick() { try { await this.processOutbox(); } catch (e: any) { this.log.error(`Outbox run failed: ${e?.message}`); } }

  /** sends what is due: each message is claimed first (so two runs never send the same one), then sent, then marked */
  async processOutbox(): Promise<number> {
    if (this.working || !this.telegram.configured) return 0;
    this.working = true;
    let sent = 0;
    try {
      const claimed = await this.manager.query(
        `update message_outbox set attempts = attempts + 1, send_after = now() + interval '2 minutes'
          where id in (select id from message_outbox where status = 'PENDING' and channel = $1 and send_after <= now() order by id limit 30 for update skip locked)
          returning id, recipient_user_id, chat_id, severity, title, body, link, attempts`, [CHANNEL]);
      const rows = Array.isArray(claimed[0]) ? claimed[0] : claimed;       // an UPDATE ... RETURNING comes back as [rows, count]
      for (const m of rows) {
        const text = formatAlert({ title: m.title ?? '', body: m.body, severity: m.severity ?? 'warning', link: m.link, baseUrl: this.telegram.baseUrl });
        try {
          const id = await this.telegram.send(m.chat_id, text);
          await this.manager.query(`update message_outbox set status = 'SENT', sent_on = now(), provider_id = $2, last_error = null where id = $1`, [m.id, id]);
          await this.manager.query(`update user_channel set last_sent_on = now() where user_id = $1 and channel = $2`, [m.recipient_user_id, CHANNEL]);
          sent++;
        } catch (e: any) {
          const err = e instanceof ChannelError ? e : new ChannelError(String(e?.message ?? e), false);
          const wait = err.permanent ? null : (err.retryAfterSeconds ? Math.ceil(err.retryAfterSeconds / 60) : retryAfterMinutes(Number(m.attempts)));
          if (wait === null) {
            await this.manager.query(`update message_outbox set status = 'FAILED', last_error = $2 where id = $1`, [m.id, err.message.slice(0, 300)]);
            if (err.blocked) await this.manager.query(`update user_channel set status = 'BLOCKED' where user_id = $1 and channel = $2`, [m.recipient_user_id, CHANNEL]);
          } else {
            await this.manager.query(`update message_outbox set status = 'PENDING', send_after = now() + make_interval(mins => $2::int), last_error = $3 where id = $1`, [m.id, Math.max(1, wait), err.message.slice(0, 300)]);
          }
        }
      }
    } finally { this.working = false; }
    return sent;
  }
}

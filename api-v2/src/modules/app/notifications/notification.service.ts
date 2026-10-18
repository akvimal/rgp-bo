import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { ConsolidatedDigest, DailyDigestBuilder, StoreDigest } from "./daily-digest.builder";
import { formatConsolidatedDaily, formatStoreDaily } from "./message-formatter";
import { TelegramClient } from "./telegram.client";

const TZ = "Asia/Kolkata";
const MAX_AUTO_ATTEMPTS = 3;

const KEY_ENABLED = "notification.daily.enabled";
const KEY_TIME = "notification.daily.time";
const KEY_CONSOLIDATED = "notification.telegram.consolidated_chat_id";

export interface DigestResult {
  scope: string;
  status: "SENT" | "FAILED" | "SKIPPED" | "PREVIEW";
  message?: string;
  error?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private running = false;

  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly telegram: TelegramClient,
    private readonly builder: DailyDigestBuilder,
  ) {}

  /**
   * Ticks every minute and sends once the configured time has passed. The log row per scope makes this
   * idempotent, so an API restart after the send time still delivers (and never double-sends).
   */
  @Cron(CronExpression.EVERY_MINUTE, { timeZone: TZ })
  async tick() {
    if (this.running || !this.telegram.configured) return;
    this.running = true;
    try {
      const settings = await this.settings();
      if (settings[KEY_ENABLED] === "false") return;
      const { date, hhmm } = this.nowInZone();
      if (hhmm < this.normaliseTime(settings[KEY_TIME])) return;
      await this.runDaily({ date, auto: true });
    } catch (e: any) {
      this.logger.error(`Daily digest tick failed: ${e?.message}`);
    } finally {
      this.running = false;
    }
  }

  /** Builds (and unless `preview`, sends) the daily digests. `force` resends scopes already marked SENT. */
  async runDaily(opts: { date?: string; storeid?: number; force?: boolean; preview?: boolean; auto?: boolean } = {}): Promise<DigestResult[]> {
    const date = opts.date ?? this.nowInZone().date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException("date must be YYYY-MM-DD");
    if (!opts.preview && !this.telegram.configured) throw new BadRequestException("TELEGRAM_BOT_TOKEN is not set");

    const stores: { id: number; location: string; telegramchatid: string | null; enabled: boolean }[] = await this.manager.query(`
      select id, location, telegram_chat_id as telegramchatid, telegram_digest_enabled as enabled
      from stores
      where active = true and archive = false
      order by id
    `);

    const digests: StoreDigest[] = [];
    const results: DigestResult[] = [];

    for (const store of stores) {
      const targeted = !opts.storeid || opts.storeid === store.id;
      const routable = !!store.telegramchatid && store.enabled;
      // The consolidated message needs every store, so build all; only deliver to the targeted ones.
      const digest = await this.builder.forStore(store.id, store.location, date);
      digests.push(digest);
      if (!targeted) continue;
      if (!routable && !opts.preview) continue;

      const message = formatStoreDaily(digest, date);
      results.push(await this.deliver("DAILY", date, `store:${store.id}`, store.telegramchatid, message, opts));
    }

    if (!opts.storeid) {
      const settings = await this.settings();
      const chat = (settings[KEY_CONSOLIDATED] || "").trim();
      if (chat || opts.preview) {
        const data: ConsolidatedDigest = await this.builder.consolidated(digests, date);
        results.push(await this.deliver("DAILY", date, "all", chat || null, formatConsolidatedDaily(data, date), opts));
      }
    }
    return results;
  }

  async sendTest(chatId: string) {
    if (!this.telegram.configured) throw new BadRequestException("TELEGRAM_BOT_TOKEN is not set");
    try {
      await this.telegram.send(chatId, "✅ RGP Back Office: Telegram notifications are connected to this chat.");
      return { ok: true };
    } catch (e: any) {
      throw new BadRequestException(e?.message ?? "Telegram send failed");
    }
  }

  async getConfig() {
    const [stores, settings] = await Promise.all([
      this.manager.query(`
        select id, location, telegram_chat_id as telegramchatid, telegram_digest_enabled as telegramdigestenabled
        from stores where active = true and archive = false order by id
      `),
      this.settings(),
    ]);
    return {
      botconfigured: this.telegram.configured,
      dailyenabled: settings[KEY_ENABLED] !== "false",
      dailytime: this.normaliseTime(settings[KEY_TIME]),
      consolidatedchatid: settings[KEY_CONSOLIDATED] || "",
      stores,
    };
  }

  async saveConfig(dto: any, userid: number) {
    if (dto.dailytime !== undefined && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(dto.dailytime).trim())) {
      throw new BadRequestException("dailytime must be HH:mm");
    }
    await this.manager.transaction(async (tx) => {
      for (const s of dto.stores ?? []) {
        await tx.query(
          `update stores set telegram_chat_id = $2, telegram_digest_enabled = $3 where id = $1`,
          [s.id, (s.telegramchatid ?? "").trim() || null, s.telegramdigestenabled ?? true],
        );
      }
      const upsert = (key: string, value: string) => tx.query(`
        insert into app_setting (category, setting_key, setting_value, active, archive, created_by, updated_by)
        values ('notification', $1, $2, true, false, $3, $3)
        on conflict (setting_key) do update set setting_value = excluded.setting_value, updated_by = $3, updated_on = now()
      `, [key, value, userid]);
      if (dto.dailyenabled !== undefined) await upsert(KEY_ENABLED, String(dto.dailyenabled));
      if (dto.dailytime !== undefined) await upsert(KEY_TIME, this.normaliseTime(dto.dailytime));
      if (dto.consolidatedchatid !== undefined) await upsert(KEY_CONSOLIDATED, (dto.consolidatedchatid ?? "").trim());
    });
    return this.getConfig();
  }

  async recentLog(limit = 50) {
    return this.manager.query(
      `select id, kind, period_key as periodkey, scope, status, error, attempts, sent_on as senton
       from notification_log order by sent_on desc, id desc limit $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
  }

  private async deliver(
    kind: string, periodKey: string, scope: string, chatId: string | null, message: string,
    opts: { force?: boolean; preview?: boolean; auto?: boolean },
  ): Promise<DigestResult> {
    if (opts.preview) return { scope, status: "PREVIEW", message };

    const existing = (await this.manager.query(
      `select status, attempts from notification_log where kind = $1 and period_key = $2 and scope = $3`,
      [kind, periodKey, scope],
    ))[0];
    if (existing && !opts.force) {
      if (existing.status === "SENT") return { scope, status: "SKIPPED" };
      // Scheduler retries a failing destination a few times, then leaves it for a manual resend.
      if (opts.auto && existing.attempts >= MAX_AUTO_ATTEMPTS) return { scope, status: "SKIPPED", error: "max auto attempts reached" };
    }

    try {
      await this.telegram.send(chatId as string, message);
      await this.record(kind, periodKey, scope, "SENT", null);
      return { scope, status: "SENT" };
    } catch (e: any) {
      const error = String(e?.message ?? e).slice(0, 400);
      this.logger.warn(`Digest ${kind} ${periodKey} ${scope} failed: ${error}`);
      await this.record(kind, periodKey, scope, "FAILED", error);
      return { scope, status: "FAILED", error };
    }
  }

  private record(kind: string, periodKey: string, scope: string, status: string, error: string | null) {
    return this.manager.query(`
      insert into notification_log (kind, period_key, scope, status, error)
      values ($1, $2, $3, $4, $5)
      on conflict (kind, period_key, scope)
      do update set status = excluded.status, error = excluded.error,
                    attempts = notification_log.attempts + 1, sent_on = now()
    `, [kind, periodKey, scope, status, error]);
  }

  private async settings(): Promise<Record<string, string>> {
    const rows = await this.manager.query(
      `select setting_key as key, setting_value as value from app_setting
       where setting_key like 'notification.%' and active = true and archive = false`,
    );
    return Object.fromEntries(rows.map((r: any) => [r.key, r.value ?? ""]));
  }

  private normaliseTime(value?: string): string {
    const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
    if (!m || +m[1] > 23 || +m[2] > 59) return "22:30";
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }

  private nowInZone(): { date: string; hhmm: string } {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).formatToParts(new Date()).map((p) => [p.type, p.value]),
    );
    const hour = parts.hour === "24" ? "00" : parts.hour;
    return { date: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${hour}:${parts.minute}` };
  }
}

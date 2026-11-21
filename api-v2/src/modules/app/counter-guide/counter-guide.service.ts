import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { grants, permsOf } from 'src/core/role-rules';
import { formRelation } from '../dictionary/dosage-form';
import { compositionKey } from '../sales/composition-match';
import { SaleSuggestionService } from '../sales/sale-suggestion.service';
import { advise, Answers, AUDIENCES, CardInput, doseSlots, DURATION_LABELS, DURATIONS, GuideCard, ISSUE_ICONS, ISSUE_LABELS, ISSUES, validateCard, WHO, Who, Duration, Issue, Audience } from './counter-guide-rules';
import { STARTER_CARDS } from './counter-guide-seed';

/** how many products are shown under one option at the counter */
const PRODUCTS_PER_OPTION = 4;

type Action = 'view' | 'manage' | 'approve';

/**
 * The Counter guide (docs/planning/COUNTER_GUIDE.md): the cards a pharmacist has approved, and what they say for the answers given at the counter, with the
 * options matched to what is in stock at the store. Prescription-only products are never offered; a card that is not approved is never shown at the counter.
 * Writing and approving cards are separate permissions: the pharmacist's sign-off is its own action, recorded with their name.
 */
@Injectable()
export class CounterGuideService {
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly suggestions: SaleSuggestionService, private readonly audit: AuditService) {}

  // ------------------------------------------------------------------ who may

  private async need(user: any, action: Action): Promise<string> {
    const [role] = await this.manager.query(`select name, permissions from app_role where id = $1`, [user?.roleid || 0]);
    if (!(isOwnerRole(role?.name) || grants(permsOf(role), 'counterguide', action))) {
      throw new ForbiddenException(action === 'approve' ? 'Approving counter guide cards is for the pharmacist.' : 'This is not open to your role.');
    }
    const [u] = await this.manager.query(`select coalesce(full_name, email) as name from app_user where id = $1`, [user?.id || 0]);
    return String(u?.name || '');
  }

  // ------------------------------------------------------------------ reading cards

  private async load(where: string, params: any[]): Promise<(GuideCard & { status: string; version: number; approvedName: string | null; approvedOn: any; sortOrder: number })[]> {
    const cards = await this.manager.query(
      `select id, key, name, name_ta, icon, asks_duration, duration_limit_days, referral_text, referral_text_ta, status, version, approved_name, approved_on, sort_order, updated_on
         from guide_card where ${where} order by sort_order, name`, params);
    if (!cards.length) return [];
    const ids = cards.map((c: any) => c.id);
    const warnings = await this.manager.query(`select id, card_id, text, text_ta, icon from guide_warning where card_id = any($1::int[]) order by sort_order, id`, [ids]);
    const options = await this.manager.query(
      `select id, card_id, composition, composition_key, form, audiences, excludes, dose, days, guidance, guidance_ta, sort_order from guide_option where card_id = any($1::int[]) order by sort_order, id`, [ids]);
    return cards.map((c: any) => ({
      id: c.id, key: c.key, name: c.name, nameTa: c.name_ta, icon: c.icon, asksDuration: c.asks_duration, durationLimitDays: c.duration_limit_days, referralText: c.referral_text, referralTextTa: c.referral_text_ta,
      status: c.status, version: c.version, approvedName: c.approved_name, approvedOn: c.approved_on, sortOrder: c.sort_order,
      warnings: warnings.filter((w: any) => w.card_id === c.id).map((w: any) => ({ id: w.id, text: w.text, textTa: w.text_ta, icon: w.icon })),
      options: options.filter((o: any) => o.card_id === c.id).map((o: any) => ({
        id: o.id, composition: o.composition, compositionKey: o.composition_key, form: o.form, audiences: o.audiences as Audience[], excludes: o.excludes as Issue[], dose: o.dose, days: o.days, guidance: o.guidance, guidanceTa: o.guidance_ta, sortOrder: o.sort_order,
      })),
    }));
  }

  /** the approved cards for the counter: the problem, how long is too long, and its warning signs. The options are not sent: they come only with the advice. */
  async cards() {
    const cards = await this.load(`status = 'APPROVED'`, []);
    return {
      cards: cards.map((c) => ({ id: c.id, key: c.key, name: c.name, nameTa: c.nameTa, icon: c.icon, asksDuration: c.asksDuration, version: c.version, warnings: c.warnings })),
      meta: {
        durations: DURATIONS.map((d) => ({ key: d, label: DURATION_LABELS[d] })),
        issues: ISSUES.map((i) => ({ key: i, label: ISSUE_LABELS[i], icon: ISSUE_ICONS[i] })),
      },
    };
  }

  // ------------------------------------------------------------------ the advice at the counter

  async advise(b: { cardid?: any; who?: any; duration?: any; warnings?: any; issues?: any; storeid?: any }) {
    const who = String(b?.who) as Who;
    if (!(WHO as readonly string[]).includes(who)) throw new BadRequestException('Say who it is for.');
    const [card] = await this.load(`id = $1 and status = 'APPROVED'`, [Number(b?.cardid) || 0]);
    if (!card) throw new NotFoundException('That card is not available.');
    const answers: Answers = {
      who,
      duration: (DURATIONS as readonly string[]).includes(String(b?.duration)) ? (String(b.duration) as Duration) : null,
      warnings: (Array.isArray(b?.warnings) ? b.warnings : []).map(Number).filter((n: number) => Number.isInteger(n)),
      issues: (Array.isArray(b?.issues) ? b.issues : []).map(String).filter((i: string) => (ISSUES as readonly string[]).includes(i)) as Issue[],
    };
    let result;
    try { result = advise(card, answers); } catch (e: any) { throw new BadRequestException(e.message); }
    const head = { card: { id: card.id, key: card.key, name: card.name, nameTa: card.nameTa, icon: card.icon, version: card.version }, who };
    if (result.refer) return { ...head, refer: true, reasons: result.reasons, text: result.text, textTa: result.textTa ?? null };

    const storeId = Number(b?.storeid) || null;
    let withheld = 0;
    const options: { id: number; composition: string; form: string | null; dose: string | null; doseSlots: { amount: string; when: 'bf' | 'af' | null }[] | null; days: number | null; guidance: string | null; guidanceTa: string | null; inStock: boolean; products: any[]; notStocked: { title: string }[] }[] = [];
    for (const o of result.options) {
      const mk = compositionKey(o.composition);
      let products: any[] = [], notStocked: { title: string }[] = [];
      if (mk && mk.hasStrength && storeId) {
        const m = await this.suggestions.matches(mk, o.form, storeId, null);
        const open = m.same.filter((p: any) => !p.prescription);
        withheld += m.same.length - open.length;
        products = open
          .map((p: any) => ({ productid: p.productid, title: p.title, mfr: p.mfr, batch: p.batch, exp_date: p.exp_date, mrp: p.mrp, price: p.price, pack: p.pack, available: p.available, unitPrice: p.pack > 0 ? p.price / p.pack : p.price, formRelation: p.formRelation, generic: p.generic }))
          .sort((x: any, y: any) => x.unitPrice - y.unitPrice)
          .slice(0, PRODUCTS_PER_OPTION);
        notStocked = products.length ? [] : m.notStocked.slice(0, 3).map((n: any) => ({ title: n.title }));
      }
      options.push({ id: o.id, composition: o.composition, form: o.form, dose: o.dose ?? null, doseSlots: doseSlots(o.dose), days: o.days ?? null, guidance: o.guidance ?? null, guidanceTa: o.guidanceTa ?? null, inStock: products.length > 0, products, notStocked });
    }
    return {
      ...head, refer: false, options, caution: result.caution, prescriptionOnlyWithheld: withheld, stockChecked: !!storeId,
      dropped: result.dropped.map((d) => ({ composition: d.option.composition, because: d.because })),
      anyInStock: options.some((o) => o.inStock),
    };
  }

  // ------------------------------------------------------------------ the cards screen (view, write, approve)

  /** every card with its options and how many products in the catalogue carry each option's composition (so a wrongly written option shows up) */
  async adminList(user: any) {
    await this.need(user, 'view');
    const cards = await this.load(`true`, []);
    const catalogue = await this.suggestions.compositions();
    return {
      cards: cards.map((c) => ({
        ...c,
        options: c.options.map((o) => {
          const mk = compositionKey(o.composition);
          return { ...o, products: mk ? catalogue.filter((p) => p.key === mk.key && formRelation(o.form, p.form) !== 'different').length : 0 };
        }),
      })),
      meta: { audiences: AUDIENCES, issues: ISSUES.map((i) => ({ key: i, label: ISSUE_LABELS[i], icon: ISSUE_ICONS[i] })) },
    };
  }

  private async write(tm: EntityManager, id: number | null, c: CardInput, userId: number) {
    let cardId = id;
    if (id) {
      // editing changes the card: it becomes a new draft version and needs approving again
      await tm.query(
        `update guide_card set key = $2, name = $3, name_ta = $4, icon = $11, asks_duration = $5, duration_limit_days = $6, referral_text = $7, referral_text_ta = $8, sort_order = $9,
                status = 'DRAFT', version = version + 1, approved_by = null, approved_name = null, approved_on = null, updated_by = $10, updated_on = now() where id = $1`,
        [id, c.key, c.name, c.nameTa ?? null, c.asksDuration !== false, c.durationLimitDays, c.referralText, c.referralTextTa ?? null, c.sortOrder ?? 100, userId, c.icon ?? null]);
      await tm.query(`delete from guide_warning where card_id = $1`, [id]);
      await tm.query(`delete from guide_option where card_id = $1`, [id]);
    } else {
      const [r] = await tm.query(
        `insert into guide_card (key, name, name_ta, icon, asks_duration, duration_limit_days, referral_text, referral_text_ta, sort_order, created_by, updated_by) values ($1,$2,$3,$10,$4,$5,$6,$7,$8,$9,$9) returning id`,
        [c.key, c.name, c.nameTa ?? null, c.asksDuration !== false, c.durationLimitDays, c.referralText, c.referralTextTa ?? null, c.sortOrder ?? 100, userId, c.icon ?? null]);
      cardId = r.id;
    }
    let n = 0;
    for (const w of c.warnings) await tm.query(`insert into guide_warning (card_id, text, text_ta, icon, sort_order) values ($1,$2,$3,$5,$4)`, [cardId, w.text, w.textTa ?? null, ++n * 10, w.icon ?? null]);
    n = 0;
    for (const o of c.options) {
      await tm.query(
        `insert into guide_option (card_id, composition, composition_key, form, audiences, excludes, guidance, guidance_ta, sort_order, dose, days) values ($1,$2,$3,$4,$5::text[],$6::text[],$7,$8,$9,$10,$11)`,
        [cardId, o.composition, compositionKey(o.composition)?.key ?? null, o.form ?? null, o.audiences, o.excludes ?? [], o.guidance ?? null, o.guidanceTa ?? null, ++n * 10, o.dose ?? null, o.days ?? null]);
    }
    return cardId as number;
  }

  async save(user: any, id: number | null, body: any) {
    await this.need(user, 'manage');
    const v = validateCard(body);
    if (!v.ok) throw new BadRequestException(v.errors);
    if (id) { const [e] = await this.manager.query(`select id from guide_card where id = $1`, [id]); if (!e) throw new NotFoundException('That card is not there.'); }
    const [dup] = await this.manager.query(`select id from guide_card where lower(key) = $1 and ($2::int is null or id <> $2)`, [v.card.key, id]);
    if (dup) throw new BadRequestException(`A card with the key "${v.card.key}" already exists.`);
    const cardId = await this.manager.transaction((tm) => this.write(tm, id, v.card, user.id));
    await this.audit.record({ userId: user.id, action: id ? 'counterguide.card_edited' : 'counterguide.card_added', entityType: 'guide_card', entityId: cardId, summary: `counter guide card ${id ? 'edited' : 'added'}: ${v.card.name} (draft)`, details: {} });
    return this.adminList(user);
  }

  /** the pharmacist's sign-off: the card, as it stands now, goes to the counter, with their name and the date */
  async approve(user: any, id: number, version?: number) {
    const name = await this.need(user, 'approve');
    const [card] = await this.load(`id = $1`, [id]);
    if (!card) throw new NotFoundException('That card is not there.');
    if (card.status === 'APPROVED') throw new BadRequestException('That card is already approved.');
    if (version !== undefined && Number(version) !== card.version) throw new BadRequestException('The card has changed since you opened it. Open it again and check it before approving.');
    const v = validateCard({ ...card, options: card.options });
    if (!v.ok) throw new BadRequestException(v.errors);
    await this.manager.query(`update guide_card set status = 'APPROVED', approved_by = $2, approved_name = $3, approved_on = now() where id = $1`, [id, user.id, name || 'a pharmacist']);
    await this.audit.record({ userId: user.id, action: 'counterguide.card_approved', entityType: 'guide_card', entityId: id, summary: `counter guide card approved: ${card.name} (version ${card.version}) by ${name}`, details: { version: card.version } });
    return this.adminList(user);
  }

  async retire(user: any, id: number) {
    await this.need(user, 'manage');
    const done = await this.manager.query(`update guide_card set status = 'RETIRED', updated_by = $2, updated_on = now() where id = $1 and status <> 'RETIRED' returning name`, [id, user.id]);
    if (!done.length) throw new NotFoundException('That card is not there or is already retired.');
    await this.audit.record({ userId: user.id, action: 'counterguide.card_retired', entityType: 'guide_card', entityId: id, summary: `counter guide card retired: ${done[0].name}`, details: {} });
    return this.adminList(user);
  }

  async remove(user: any, id: number) {
    await this.need(user, 'manage');
    const done = await this.manager.query(`delete from guide_card where id = $1 and status <> 'APPROVED' returning name`, [id]);
    if (!done.length) throw new BadRequestException('Only a draft or a retired card can be deleted. Retire an approved card first.');
    await this.audit.record({ userId: user.id, action: 'counterguide.card_deleted', entityType: 'guide_card', entityId: id, summary: `counter guide card deleted: ${done[0].name}`, details: {} });
    return this.adminList(user);
  }

  /** adds the starter cards that are not there yet, as drafts for the pharmacist to review */
  async seedStarter(user: any) {
    await this.need(user, 'manage');
    const have = new Set((await this.manager.query(`select lower(key) as key from guide_card`)).map((r: any) => r.key));
    let added = 0, pictures = 0, upgraded = 0;
    await this.manager.transaction(async (tm) => {
      for (const c of STARTER_CARDS) {
        if (have.has(c.key)) {
          // a starter card from before doses existed (none of its options has a dose) gets the starter's options with doses and days. The doses are clinical content, so
          // the card becomes a new draft that the pharmacist approves again. A card whose options already carry a dose has been looked at by a person: it is left alone.
          const [cur] = await tm.query(`select c.id, count(o.id)::int as options, count(o.dose)::int as with_dose from guide_card c left join guide_option o on o.card_id = c.id where lower(c.key) = $1 group by c.id`, [c.key]);
          if (cur && cur.options > 0 && cur.with_dose === 0) {
            await this.replaceOptions(tm, cur.id, c, user.id);
            upgraded++;
          }
          // a starter card already there that has no picture gets the starter's: a picture is not clinical content, so the card's approval and version are left as they are
          const card = await tm.query(`update guide_card set icon = $2 where lower(key) = $1 and icon is null returning id`, [c.key, c.icon ?? null]);
          if (card.length && c.icon) pictures++;
          for (const w of c.warnings) if (w.icon) await tm.query(`update guide_warning set icon = $3 where card_id = (select id from guide_card where lower(key) = $1) and text = $2 and icon is null`, [c.key, w.text, w.icon]);
          continue;
        }
        await this.write(tm, null, c, user.id);
        added++;
      }
    });
    if (added || upgraded) await this.audit.record({ userId: user.id, action: 'counterguide.starter_added', entityType: 'guide_card', entityId: 0, summary: `${added} starter counter guide cards added as drafts, ${upgraded} given doses and days (drafts again)`, details: { added, upgraded } });
    return { added, pictures, upgraded, ...(await this.adminList(user)) };
  }

  /** the options of a card replaced by a starter's, and the card made a new draft (its warnings and wording are left as they are) */
  private async replaceOptions(tm: EntityManager, cardId: number, c: CardInput, userId: number) {
    await tm.query(`delete from guide_option where card_id = $1`, [cardId]);
    let n = 0;
    for (const o of c.options) {
      await tm.query(
        `insert into guide_option (card_id, composition, composition_key, form, audiences, excludes, guidance, guidance_ta, sort_order, dose, days) values ($1,$2,$3,$4,$5::text[],$6::text[],$7,$8,$9,$10,$11)`,
        [cardId, o.composition, compositionKey(o.composition)?.key ?? null, o.form ?? null, o.audiences, o.excludes ?? [], o.guidance ?? null, o.guidanceTa ?? null, ++n * 10, o.dose ?? null, o.days ?? null]);
    }
    await tm.query(`update guide_card set status = 'DRAFT', version = version + 1, approved_by = null, approved_name = null, approved_on = null, updated_by = $2, updated_on = now() where id = $1`, [cardId, userId]);
  }
}

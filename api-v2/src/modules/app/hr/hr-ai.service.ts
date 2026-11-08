import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { AiProvider } from '../alerts/ai-provider';
import { HrKpiEngine, SYSTEM_MEASURES } from './hr-kpi-engine.service';
import { HrKpiService } from './hr-kpi.service';
import { checkCeiling, cleanBands, cleanKpis, cleanRole, simulateBands, summarise } from './hr-ai-draft';

const CEILING_KEY = 'hr.incentive_ceiling_pct';
const clip = (v: any, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const money = (n: number) => Math.round(n);

const ROLE_TOOL = {
  name: 'propose_role',
  description: 'Propose the purpose and the responsibilities of a job role.',
  input_schema: {
    type: 'object',
    properties: {
      purpose: { type: 'string', description: 'One or two sentences on why the role exists.' },
      responsibilities: { type: 'array', items: { type: 'object', properties: {
        text: { type: 'string', description: 'One clear, checkable responsibility, in plain words.' },
        measure: { type: 'string', description: 'The system measure key that measures it, or MANUAL when only a manager can judge it.' },
      }, required: ['text', 'measure'] } },
    },
    required: ['purpose', 'responsibilities'],
  },
};

const KPI_TOOL = {
  name: 'propose_kpis',
  description: 'Propose the KPI measures for a job role, with weights.',
  input_schema: {
    type: 'object',
    properties: {
      kpis: { type: 'array', items: { type: 'object', properties: {
        name: { type: 'string' },
        description: { type: 'string', description: 'For a manager-rated measure: a rating guide saying what 1 and 5 look like. For a system measure: what it counts.' },
        source: { type: 'string', enum: ['SYSTEM', 'MANUAL'] },
        system_key: { type: 'string', description: 'Required for SYSTEM: one of the listed keys.' },
        rule: { type: 'object', description: 'Required for SYSTEM. {kind:"linear", target, floor} for a measure where higher is better or lower is better (target is the full-marks figure, floor the zero-marks figure), or {kind:"steps", steps:[{upto, pct}], otherwise} for a "lower is better" measure.' },
        weight: { type: 'number', description: 'Relative importance; weights are scaled to total 100.' },
        why: { type: 'string', description: 'One short sentence: which responsibility it measures, and how the target was chosen.' },
      }, required: ['name', 'source', 'weight'] } },
    },
    required: ['kpis'],
  },
};

const BAND_TOOL = {
  name: 'propose_bands',
  description: 'Propose incentive bands: a fixed rupee amount for each KPI score range.',
  input_schema: {
    type: 'object',
    properties: {
      bands: { type: 'array', items: { type: 'object', properties: {
        min_percent: { type: 'number', description: 'The KPI score (0 to 100) from which this band applies; the first band starts at 0.' },
        label: { type: 'string' },
        incentive_amount: { type: 'number', description: 'Rupees paid per month in this band.' },
      }, required: ['min_percent', 'label', 'incentive_amount'] } },
      rationale: { type: 'string' },
    },
    required: ['bands'],
  },
};

const SYSTEM_PROMPT = `You help the owner of a small retail business set up job roles, KPIs and incentives for their staff.
Be practical and specific to the business; avoid generic corporate wording. Use plain words an Indian shopkeeper would use.
Never ask for or invent personal details. You only see anonymous totals. Never encourage selling that is bad for the customer (in a pharmacy: never push prescription drugs or substitutes for money alone), and always give weight to accuracy, honesty and customer care.
Always answer by calling the tool.`;

/** The assistant that drafts job roles, KPIs and incentives. It only drafts: the Business Head reviews and approves everything it suggests. */
@Injectable()
export class HrAiService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly audit: AuditService,
    private readonly ai: AiProvider,
    private readonly engine: HrKpiEngine,
    private readonly kpi: HrKpiService,
  ) {}

  private async model(): Promise<string> {
    const [row] = await this.manager.query(`select setting_value from app_setting where setting_key = 'ai.model' and active and not archive`);
    return row?.setting_value || this.ai.defaultModel;
  }

  private async ready(): Promise<string> {
    if (!this.ai.configured) throw new ServiceUnavailableException('The assistant is not switched on. The Business Head can add its key under Settings > Alerts.');
    const m = await this.model();
    if (!m) throw new ServiceUnavailableException('Choose the assistant\'s model under Settings > Alerts first.');
    return m;
  }

  async status() {
    const [c] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive`, [CEILING_KEY]);
    return { configured: this.ai.configured, model: await this.model(), ceiling_pct: c?.setting_value === undefined || c?.setting_value === null ? null : Number(c.setting_value) };
  }

  async setCeiling(pct: any, by: any) {
    const v = pct === null || pct === '' || pct === undefined ? null : Number(pct);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) throw new BadRequestException('The ceiling is between 0 and 100 per cent of the role\'s payroll.');
    if (v === null) await this.manager.query(`update app_setting set active = false, archive = true, setting_value = null where setting_key = $1`, [CEILING_KEY]);
    else await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, created_by, updated_by) values ('hr', $1, $2, $3, $3)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [CEILING_KEY, String(v), by.id]);
    await this.audit.record({ userId: by.id, action: 'hr.incentive_ceiling', summary: v === null ? 'incentive ceiling removed' : `incentive ceiling set to ${v}% of a role's payroll`, details: { pct: v } });
    return this.status();
  }

  private async position(id: any) {
    const [p] = await this.manager.query(
      `select id, name, purpose, responsibilities, active, (select count(*)::int from hr_employee e where e.position_id = hr_position.id and e.status = 'ACTIVE') as staff from hr_position where id = $1`, [Number(id)]);
    if (!p) throw new NotFoundException('Job role not found.');
    return p;
  }

  private async business() {
    const [b] = await this.manager.query(`select business_type, (select count(*)::int from stores where active and not archive) as stores from business limit 1`);
    return { type: b?.business_type || 'pharmacy', stores: b?.stores || 1 };
  }

  /** what the role's staff cost a month: the last runs' earnings, else the role's pay template times its head count */
  private async rolePayroll(p: { id: number; staff: number }): Promise<number> {
    const [r] = await this.manager.query(
      `select coalesce(avg(t.s), 0)::float as v from (select sum(l.earnings_paid) as s from hr_payroll_line l join hr_payroll_run r on r.id = l.run_id
         join hr_employee e on e.id = l.employee_id where e.position_id = $1 group by r.period order by r.period desc limit 3) t`, [p.id]);
    if (r.v > 0) return r.v;
    const [t] = await this.manager.query(`select coalesce(sum(l.amount), 0)::float as v from hr_position_line l join hr_pay_component c on c.id = l.component_id where l.position_id = $1 and c.kind = 'EARNING'`, [p.id]);
    return t.v * p.staff;
  }

  private async audited(user: any, kind: string, p: any) {
    await this.audit.record({ userId: user.id, action: 'hr.ai_drafted', entityType: 'hr_position', entityId: p.id, summary: `assistant drafted ${kind} for ${p.name}`, details: { kind } });
  }

  // ------------------------------------------------------------------------------------------------ 1. the job role
  async draftRole(b: any, user: any) {
    const model = await this.ready();
    const p = await this.position(b?.position_id);
    const biz = await this.business();
    const notes = clip(b?.notes, 300);
    const instruction = [
      `Business: a ${biz.type} with ${biz.stores} store${biz.stores === 1 ? '' : 's'}.`,
      `Job role: "${p.name}" (${p.staff} staff hold it).`,
      p.purpose || p.responsibilities?.length ? `Current description (improve it, do not just repeat it): ${p.purpose || ''} ${(p.responsibilities || []).map((r: any) => r.text).join('; ')}` : '',
      notes ? `Owner's notes: ${notes}` : '',
      `Write the purpose and 5 to 8 responsibilities. Each responsibility must be something a manager could check. For each, say which system measure can measure it (choose from: ${SYSTEM_MEASURES.map((m) => `${m.key} = ${m.label}`).join('; ')}), or MANUAL when only a manager can judge it.`,
    ].filter(Boolean).join('\n');
    const out = await this.ai.call(SYSTEM_PROMPT, instruction, ROLE_TOOL, model, 2000);
    const draft = cleanRole(out);
    if (!draft.responsibilities.length) throw new ServiceUnavailableException('The assistant did not give a usable answer. Try again.');
    await this.audited(user, 'a job description', p);
    return { position: { id: p.id, name: p.name }, draft };
  }

  async saveRole(b: any, user: any) {
    const p = await this.position(b?.position_id);
    const d = cleanRole({ purpose: b?.purpose, responsibilities: b?.responsibilities });
    if (!d.responsibilities.length) throw new BadRequestException('Add at least one responsibility.');
    await this.manager.query(
      `update hr_position set purpose = $2, responsibilities = $3::jsonb, jd_approved_by = $4, jd_approved_on = now() where id = $1`, [p.id, d.purpose || null, JSON.stringify(d.responsibilities), user.id]);
    await this.audit.record({ userId: user.id, action: 'hr.job_description_saved', entityType: 'hr_position', entityId: p.id, summary: `Job description of ${p.name} saved (${d.responsibilities.length} responsibilities)`, details: {} });
    return { ok: true };
  }

  // ------------------------------------------------------------------------------------------------ 2. the KPIs
  async draftKpis(b: any, user: any) {
    const model = await this.ready();
    const p = await this.position(b?.position_id);
    if (!p.responsibilities?.length) throw new BadRequestException('Write and approve the job description first: the KPIs come from the responsibilities.');
    const biz = await this.business();
    const existing = await this.manager.query(`select name, system_key from hr_kpi_metric where active and applies_positions @> array[$1]::int[]`, [p.id]);
    const taken = existing.map((e: any) => e.system_key).filter(Boolean);
    const hist = await this.engine.history(p.id, 3);
    const spread = SYSTEM_MEASURES.map((m) => ({ m, s: summarise(hist.figures[m.key] || []) })).filter((x) => x.s && !taken.includes(x.m.key));
    const instruction = [
      `Business: a ${biz.type} with ${biz.stores} store${biz.stores === 1 ? '' : 's'}.`,
      `Job role: "${p.name}".`,
      `Purpose: ${p.purpose || '-'}`,
      `Responsibilities:\n${p.responsibilities.map((r: any, i: number) => `${i + 1}. ${r.text} (can be measured by: ${r.measure})`).join('\n')}`,
      existing.length ? `This role already has these measures, so do not repeat them: ${existing.map((e: any) => e.name).join('; ')}.` : '',
      `Measures the system can count by itself (use only these keys for SYSTEM measures): ${SYSTEM_MEASURES.filter((m) => !taken.includes(m.key)).map((m) => `${m.key} = ${m.label} (${m.unit}; ${m.direction === 'higher' ? 'higher is better' : 'lower is better'}; ${m.hint})`).join('\n')}`,
      spread.length
        ? `What really happened over the last ${hist.months} months for ${hist.staff} staff of this role (anonymous figures, one per person per month): ${spread.map((x) => `${x.m.key}: median ${x.s!.median}, middle half ${x.s!.p25} to ${x.s!.p75}, range ${x.s!.min} to ${x.s!.max}`).join('; ')}. Set targets from these: full marks should be reachable by a good performer (around the upper quartile for a higher-is-better figure, the lower quartile for a lower-is-better one), and zero marks around the weak end.`
        : `There is not enough history to set numeric targets for this role yet; prefer manager-rated measures, or give round-number targets and say they are a starting guess.`,
      `Propose 4 to 7 measures. Use a system measure wherever one honestly measures a responsibility; otherwise a manager-rated measure with a rating guide. Weights show importance. Include at least one measure about accuracy or customer care.`,
    ].filter(Boolean).join('\n\n');
    const out = await this.ai.call(SYSTEM_PROMPT, instruction, KPI_TOOL, model, 4000);
    const { kpis, dropped } = cleanKpis(out, taken);
    if (!kpis.length) throw new ServiceUnavailableException('The assistant did not give a usable answer. Try again.');
    await this.audited(user, 'KPIs', p);
    return { position: { id: p.id, name: p.name }, kpis, dropped, history: { staff: hist.staff, months: hist.months, measures: spread.map((x) => ({ key: x.m.key, ...x.s! })) } };
  }

  async applyKpis(b: any, user: any) {
    const p = await this.position(b?.position_id);
    const list: any[] = Array.isArray(b?.kpis) ? b.kpis : [];
    if (!list.length) throw new BadRequestException('Nothing to add.');
    const existing = await this.manager.query(`select system_key from hr_kpi_metric where active and applies_positions @> array[$1]::int[]`, [p.id]);
    const { kpis } = cleanKpis({ kpis: list.map((k) => ({ ...k, weight: k.max_points })) }, existing.map((e: any) => e.system_key).filter(Boolean));
    const ids: number[] = [];
    let order = 10;
    for (const k of kpis) {
      const r = await this.kpi.saveMetric(null, { name: k.name, description: k.description, max_points: k.max_points, source: k.source, system_key: k.system_key, rule: k.rule,
        rating_scale: k.rating_scale, applies_positions: [p.id], display_order: order }, user);
      ids.push(Number(r.id)); order += 10;
    }
    await this.audit.record({ userId: user.id, action: 'hr.kpis_from_assistant', entityType: 'hr_position', entityId: p.id, summary: `${ids.length} KPI measures added for ${p.name}`, details: { ids } });
    return { added: ids.length, ids };
  }

  // ------------------------------------------------------------------------------------------------ 3. the incentives
  /** what the proposed bands would have paid over the last full months, and the most they could pay */
  async simulate(b: any) {
    const p = await this.position(b?.position_id);
    const bands = cleanBands({ bands: (Array.isArray(b?.bands) ? b.bands : []).map((x: any) => ({ ...x, incentive_amount: x.incentive_amount })) });
    if (bands.length < 2) throw new BadRequestException('Give at least two bands.');
    const now = new Date();
    const percents: number[] = [];
    let counted = 0;
    for (let i = 1; i <= 3; i++) {
      const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      const rows = await this.engine.draft(period, (e: any) => e.position_id === p.id);
      for (const d of rows) {
        const scored = d.finalised ? d.review?.percent : (d.items.some((x: any) => x.state === 'SCORED') ? d.draft.percent : null);
        if (scored !== null && scored !== undefined) percents.push(Number(scored));
      }
      counted += 1;
    }
    const sim = simulateBands(percents, bands, counted);
    const payroll = await this.rolePayroll(p);
    const st = await this.status();
    const ceiling = checkCeiling(p.staff, sim.top_amount, payroll, st.ceiling_pct);
    return { position: { id: p.id, name: p.name, staff: p.staff }, bands, history: sim, monthly_payroll: money(payroll), ...ceiling, ceiling_pct: st.ceiling_pct };
  }

  async draftBands(b: any, user: any) {
    const model = await this.ready();
    const p = await this.position(b?.position_id);
    if (!p.staff) throw new BadRequestException('No one holds this job role yet.');
    const metrics = await this.manager.query(`select name, max_points::float as max from hr_kpi_metric where active and applies_positions @> array[$1]::int[] order by display_order`, [p.id]);
    const payroll = await this.rolePayroll(p);
    const per = payroll / Math.max(1, p.staff);
    const st = await this.status();
    const biz = await this.business();
    const cap = st.ceiling_pct !== null ? Math.round((payroll * st.ceiling_pct) / 100 / Math.max(1, p.staff)) : null;
    const instruction = [
      `Business: a ${biz.type}.`,
      `Job role: "${p.name}", ${p.staff} staff, average monthly earnings about Rs ${money(per)} each.`,
      metrics.length ? `Their KPI score (0 to 100) comes from: ${metrics.map((m: any) => `${m.name} (${m.max} points)`).join('; ')}.` : `Their KPI score runs from 0 to 100.`,
      `Propose 4 or 5 incentive bands: from which KPI score each band starts, a label, and a FIXED rupee amount paid for that month. The first band starts at 0 and normally pays nothing. Amounts must not fall as the score rises. Make the top band meaningful but affordable: ${cap !== null ? `the owner's ceiling means no one should be paid more than about Rs ${cap} a month on average, so the top band must not exceed that` : `the top band is typically 5 to 12 per cent of monthly earnings`}. Make the middle bands reachable by a steady performer, and the top band by an excellent month only.`,
    ].join('\n');
    const out = await this.ai.call(SYSTEM_PROMPT, instruction, BAND_TOOL, model, 1500);
    const bands = cleanBands(out);
    if (bands.length < 2) throw new ServiceUnavailableException('The assistant did not give a usable answer. Try again.');
    await this.audited(user, 'incentive bands', p);
    return { rationale: clip(out?.rationale, 400), ...(await this.simulate({ position_id: p.id, bands })) };
  }

  async applyBands(b: any, user: any) {
    const sim = await this.simulate(b);
    if (sim.over) throw new BadRequestException(`The top band could pay Rs ${sim.worst_case} in a month if everyone reached it, above your ceiling of Rs ${sim.ceiling} (${sim.ceiling_pct}% of this role's payroll). Lower the amounts or change the ceiling.`);
    await this.kpi.saveBands({ position_id: sim.position.id, bands: sim.bands.map((x) => ({ min_percent: x.min_percent, label: x.label, incentive_percent: 0, incentive_amount: x.incentive_amount })) }, user);
    await this.audit.record({ userId: user.id, action: 'hr.bands_from_assistant', entityType: 'hr_position', entityId: sim.position.id, summary: `incentive bands set for ${sim.position.name} (${sim.bands.length}, top Rs ${sim.history.top_amount})`, details: { bands: sim.bands } });
    return { ok: true, count: sim.bands.length };
  }

  /** every job role with where it has got to, so the owner can go through them one by one */
  async roles() {
    return this.manager.query(
      `select p.id, p.name, p.active, p.purpose, p.responsibilities, (select count(*)::int from hr_employee e where e.position_id = p.id and e.status = 'ACTIVE') as staff,
              (jsonb_array_length(p.responsibilities) > 0) as has_description, p.jd_approved_on,
              (select count(*)::int from hr_kpi_metric m where m.active and m.applies_positions @> array[p.id]::int[]) as measures,
              (select count(*)::int from hr_kpi_band b where b.position_id = p.id) as bands,
              (select count(*)::int from hr_kpi_band b where b.position_id = p.id and b.incentive_amount is not null) as amount_bands
         from hr_position p where p.active order by p.name`);
  }
}

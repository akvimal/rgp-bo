import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { AuditService } from 'src/core/audit/audit.service';

/** off: no second step. optional: people who linked an authenticator use it, the rest sign in as before. required: everyone links one at their next sign-in. */
export type MfaMode = 'off' | 'optional' | 'required';
export const mfaMode = (): MfaMode => {
  const m = String(process.env.MFA_MODE || 'required').toLowerCase();
  return m === 'off' || m === 'optional' ? m : 'required';
};

const MAX_FAILS = 5;
const LOCK_MINUTES = 5;
const STEP_TOKEN_TTL = '5m';
const RECOVERY_CODES = 10;
const STEP_MS = 30_000;

/**
 * The authenticator-app (TOTP, RFC 6238) second step: linking an app, checking a code or a recovery code, pausing sign-in after
 * wrong codes, and the short-lived token that carries a person from the password step to the code step.
 */
@Injectable()
export class MfaService {

  constructor(
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @InjectEntityManager() private readonly manager: EntityManager) {}

  // ---------------------------------------------------------------- the token between password and code

  /** signed with a key of its own, so it can never pass for a real sign-in token (the auth guard cannot verify it) */
  private stepKey() { return `${process.env.JWT_KEY}.mfa-step`; }

  signStepToken(userId: number, scope: 'verify' | 'enrol'): Promise<string> {
    return this.jwt.signAsync({ id: userId, scope }, { secret: this.stepKey(), expiresIn: STEP_TOKEN_TTL });
  }

  async readStepToken(token: string, scope: 'verify' | 'enrol'): Promise<number> {
    try {
      const p: any = await this.jwt.verifyAsync(String(token || ''), { secret: this.stepKey() });
      if (p?.scope === scope && Number.isInteger(Number(p.id))) return Number(p.id);
    } catch { /* falls through */ }
    throw new UnauthorizedException('This sign-in step has expired. Sign in again.');
  }

  // ---------------------------------------------------------------- the secret at rest

  private dataKey(): Buffer {
    return crypto.createHash('sha256').update(`mfa:${process.env.MFA_ENC_KEY || process.env.JWT_KEY}`).digest();
  }

  encrypt(plain: string): string {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this.dataKey(), iv);
    const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
  }

  decrypt(stored: string): string {
    const [iv, tag, enc] = String(stored).split('.').map(s => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', this.dataKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  }

  // ---------------------------------------------------------------- state

  async isEnabled(userId: number): Promise<boolean> {
    const [r] = await this.manager.query(`select mfa_enabled from app_user where id = $1`, [userId]);
    return !!r?.mfa_enabled;
  }

  /** who has an authenticator linked (for the users list) */
  async statusOf(): Promise<{ id: number; enabled: boolean }[]> {
    const rows = await this.manager.query(`select id, mfa_enabled from app_user`);
    return rows.map((r: any) => ({ id: r.id, enabled: !!r.mfa_enabled }));
  }

  private async assertNotLocked(userId: number) {
    const [r] = await this.manager.query(`select 1 from app_user where id = $1 and mfa_locked_until > now()`, [userId]);
    if (r) throw new ForbiddenException('Too many wrong codes. Try again in a few minutes.');
  }

  private async fail(userId: number, ip?: string): Promise<never> {
    const [r] = await this.manager.query(
      `update app_user set mfa_failed_count = mfa_failed_count + 1,
              mfa_locked_until = case when mfa_failed_count + 1 >= $2 then now() + make_interval(mins => $3) else mfa_locked_until end
        where id = $1 returning mfa_failed_count`, [userId, MAX_FAILS, LOCK_MINUTES]);
    this.audit.record({ userId, action: 'auth.mfa_failed', summary: 'wrong code', status: 401, ip });
    if (r && r.mfa_failed_count >= MAX_FAILS) {
      await this.manager.query(`update app_user set mfa_failed_count = 0 where id = $1`, [userId]);
      this.audit.record({ userId, action: 'auth.mfa_locked', summary: `sign-in paused ${LOCK_MINUTES} minutes after ${MAX_FAILS} wrong codes`, status: 403, ip });
    }
    throw new UnauthorizedException('That code is not right. Check the time on your phone and try again.');
  }

  private async pass(userId: number) {
    await this.manager.query(`update app_user set mfa_failed_count = 0, mfa_locked_until = null where id = $1`, [userId]);
  }

  // ---------------------------------------------------------------- linking an app

  /** a new secret and its QR code, kept as pending until a code from the app confirms it */
  async beginEnrol(userId: number) {
    const [u] = await this.manager.query(`select email, mfa_enabled from app_user where id = $1`, [userId]);
    if (!u) throw new UnauthorizedException();
    if (u.mfa_enabled) throw new BadRequestException('An authenticator is already linked. Ask your manager to reset it first.');
    const secret = authenticator.generateSecret(20);
    await this.manager.query(`update app_user set mfa_pending_secret = $2 where id = $1`, [userId, this.encrypt(secret)]);
    const otpauth = authenticator.keyuri(u.email, process.env.MFA_ISSUER || 'RGP Back Office', secret);
    return { secret, otpauth, qr: await QRCode.toDataURL(otpauth, { margin: 1, width: 220 }) };
  }

  /** confirms the pending secret with a code; returns the recovery codes, shown once */
  async confirmEnrol(userId: number, code: string, ip?: string): Promise<string[]> {
    await this.assertNotLocked(userId);
    const [u] = await this.manager.query(`select mfa_pending_secret, mfa_enabled from app_user where id = $1`, [userId]);
    if (!u?.mfa_pending_secret || u.mfa_enabled) throw new BadRequestException('Start the set-up again.');
    const step = this.matchedStep(this.decrypt(u.mfa_pending_secret), code);
    if (step === null) return this.fail(userId, ip);
    const codes = this.newRecoveryCodes();
    await this.manager.query(
      `update app_user set mfa_enabled = true, mfa_secret = mfa_pending_secret, mfa_pending_secret = null, mfa_enrolled_at = now(),
              mfa_last_step = $2, mfa_recovery = $3::jsonb, mfa_failed_count = 0, mfa_locked_until = null where id = $1`,
      [userId, step, JSON.stringify(codes.map(c => this.hashCode(c)))]);
    this.audit.record({ userId, action: 'auth.mfa_enrolled', summary: 'linked an authenticator app', status: 200, ip });
    return codes;
  }

  // ---------------------------------------------------------------- checking a sign-in

  /** a code from the app, or one of the recovery codes; throws when neither is right */
  async verify(userId: number, input: string, ip?: string): Promise<{ usedRecovery: boolean; recoveryLeft: number }> {
    await this.assertNotLocked(userId);
    const [u] = await this.manager.query(`select mfa_secret, mfa_enabled, mfa_last_step, mfa_recovery from app_user where id = $1`, [userId]);
    if (!u?.mfa_enabled || !u.mfa_secret) throw new UnauthorizedException();
    const text = String(input || '').trim();
    const recovery: string[] = Array.isArray(u.mfa_recovery) ? u.mfa_recovery : [];

    if (/^\d{3}\s?\d{3}$/.test(text)) {
      const step = this.matchedStep(this.decrypt(u.mfa_secret), text);
      // the same code twice is a replay, even inside its window
      if (step === null || (u.mfa_last_step !== null && step <= Number(u.mfa_last_step))) return this.fail(userId, ip);
      // guarded on the step, so two simultaneous attempts with one code let only one through
      const done = await this.manager.query(`update app_user set mfa_last_step = $2 where id = $1 and (mfa_last_step is null or mfa_last_step < $2) returning id`, [userId, step]);
      if (!done.length) return this.fail(userId, ip);
      await this.pass(userId);
      return { usedRecovery: false, recoveryLeft: recovery.length };
    }

    const hash = this.hashCode(text);
    if (!recovery.includes(hash)) return this.fail(userId, ip);
    const rest = recovery.filter(h => h !== hash);
    const done = await this.manager.query(`update app_user set mfa_recovery = $2::jsonb where id = $1 and mfa_recovery ? $3 returning id`, [userId, JSON.stringify(rest), hash]);
    if (!done.length) return this.fail(userId, ip);
    await this.pass(userId);
    this.audit.record({ userId, action: 'auth.mfa_recovery_used', summary: `signed in with a recovery code, ${rest.length} left`, status: 200, ip });
    return { usedRecovery: true, recoveryLeft: rest.length };
  }

  // ---------------------------------------------------------------- reset by a manager

  /** unlinks the authenticator: the person links a new one at their next sign-in */
  async reset(userId: number, byUserId: number) {
    await this.manager.query(
      `update app_user set mfa_enabled = false, mfa_secret = null, mfa_pending_secret = null, mfa_last_step = null, mfa_enrolled_at = null,
              mfa_recovery = '[]'::jsonb, mfa_failed_count = 0, mfa_locked_until = null where id = $1`, [userId]);
    this.audit.record({ userId: byUserId, action: 'auth.mfa_reset', summary: `reset the authenticator of user ${userId}`, details: { target: userId }, status: 200 });
    return { reset: true };
  }

  // ---------------------------------------------------------------- the codes themselves

  /**
   * The 30-second step this code belongs to, looking at the current step and one either side (a phone clock a little off); null if none.
   * A code is compared in constant time.
   */
  matchedStep(secret: string, code: string): number | null {
    const given = String(code || '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(given)) return null;
    const now = Math.floor(Date.now() / STEP_MS);
    for (const step of [now, now - 1, now + 1]) {
      const expected = authenticator.clone({ epoch: step * STEP_MS, step: 30, digits: 6, window: 0 }).generate(secret);
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return step;
    }
    return null;
  }

  private newRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODES }, () => {
      const raw = crypto.randomBytes(5).toString('hex').toUpperCase();     // 10 characters
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
  }

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
  }
}

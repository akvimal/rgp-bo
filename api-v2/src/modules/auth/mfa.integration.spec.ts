import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import { Pool } from 'pg';
import { MfaService } from './mfa.service';

/**
 * The SQL of the second step against a real PostgreSQL. Runs only when MFA_TEST_DB_URL names a scratch database that has an app_user table
 * (id, email) with sql/migrations/144_mfa.sql applied. Never point it at real data: it writes to app_user.
 */
const url = process.env.MFA_TEST_DB_URL;
const maybe = url ? describe : describe.skip;

maybe('MfaService against PostgreSQL', () => {
  let pool: Pool;
  let mfa: MfaService;
  let userId: number;
  const audit = { record: jest.fn() };

  const codeNow = (secret: string, stepOffset = 0) =>
    authenticator.clone({ epoch: (Math.floor(Date.now() / 30000) + stepOffset) * 30000, step: 30, digits: 6, window: 0 }).generate(secret);

  beforeAll(() => {
    process.env.JWT_KEY = 'integration-key';
    pool = new Pool({ connectionString: url });
    mfa = new MfaService(new JwtService({ secret: 'integration-key' }), audit as any, { query: (sql: string, params?: any[]) => pool.query(sql, params).then(r => r.rows) } as any);
  });
  afterAll(() => pool.end());

  beforeEach(async () => {
    await pool.query(`delete from app_user where email = 'mfa-it@example.com'`);
    userId = (await pool.query(`insert into app_user(email) values ('mfa-it@example.com') returning id`)).rows[0].id;
    audit.record.mockClear();
  });

  const enrol = async () => {
    const setup = await mfa.beginEnrol(userId);
    const codes = await mfa.confirmEnrol(userId, codeNow(setup.secret));
    return { secret: setup.secret, codes };
  };

  it('links an app: QR and key out, secret stored encrypted, ten recovery codes once', async () => {
    const setup = await mfa.beginEnrol(userId);
    expect(setup.qr).toMatch(/^data:image\/png;base64,/);
    expect(setup.otpauth).toContain('otpauth://totp/');
    const stored = (await pool.query(`select mfa_pending_secret from app_user where id = $1`, [userId])).rows[0].mfa_pending_secret;
    expect(stored).not.toContain(setup.secret);

    const codes = await mfa.confirmEnrol(userId, codeNow(setup.secret));
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    expect(await mfa.isEnabled(userId)).toBe(true);
    const row = (await pool.query(`select mfa_pending_secret, mfa_secret, mfa_recovery from app_user where id = $1`, [userId])).rows[0];
    expect(row.mfa_pending_secret).toBeNull();
    expect(row.mfa_recovery).toHaveLength(10);
    expect(JSON.stringify(row.mfa_recovery)).not.toContain(codes[0].replace('-', ''));    // hashes only
    await expect(mfa.beginEnrol(userId)).rejects.toThrow(/already linked/);
  });

  it('a wrong code does not link the app', async () => {
    const setup = await mfa.beginEnrol(userId);
    await expect(mfa.confirmEnrol(userId, '000000')).rejects.toThrow(/not right/);
    expect(await mfa.isEnabled(userId)).toBe(false);
    expect(setup.secret).toBeTruthy();
  });

  it('accepts the next code but never the same one twice', async () => {
    const { secret } = await enrol();                       // enrolment used this step
    await expect(mfa.verify(userId, codeNow(secret))).rejects.toThrow();            // the same step again: a replay
    await expect(mfa.verify(userId, codeNow(secret, 1))).resolves.toEqual({ usedRecovery: false, recoveryLeft: 10 });
    await expect(mfa.verify(userId, codeNow(secret, 1))).rejects.toThrow();        // and that one is spent too
  });

  it('pauses sign-in after five wrong codes, then refuses even a right one', async () => {
    const { secret } = await enrol();
    for (let i = 0; i < 5; i++) await expect(mfa.verify(userId, '111111')).rejects.toThrow(/not right/);
    await expect(mfa.verify(userId, codeNow(secret, 1))).rejects.toThrow(/Too many/);
    // the pause ends
    await pool.query(`update app_user set mfa_locked_until = now() - interval '1 minute' where id = $1`, [userId]);
    await expect(mfa.verify(userId, codeNow(secret, 1))).resolves.toMatchObject({ usedRecovery: false });
  });

  it('a recovery code works once, in any case and with or without the dash', async () => {
    const { codes } = await enrol();
    await expect(mfa.verify(userId, codes[0].toLowerCase())).resolves.toEqual({ usedRecovery: true, recoveryLeft: 9 });
    await expect(mfa.verify(userId, codes[0])).rejects.toThrow();
    await expect(mfa.verify(userId, codes[1].replace('-', ''))).resolves.toMatchObject({ usedRecovery: true, recoveryLeft: 8 });
  });

  it('two simultaneous tries with one code let only one through', async () => {
    const { secret } = await enrol();
    const code = codeNow(secret, 1);
    const results = await Promise.allSettled([mfa.verify(userId, code), mfa.verify(userId, code), mfa.verify(userId, code)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('a reset unlinks the app so the person links a new one', async () => {
    const { secret } = await enrol();
    await mfa.reset(userId, userId);
    expect(await mfa.isEnabled(userId)).toBe(false);
    await expect(mfa.verify(userId, codeNow(secret, 2))).rejects.toThrow();         // the old app no longer works
    const again = await mfa.beginEnrol(userId);
    expect(again.secret).not.toBe(secret);
  });
});

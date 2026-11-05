import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { AppUser } from 'src/entities/appuser.entity';

import { AuthHelper } from './auth.helper';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { UserService } from '../app/users/user.service';
import { AuditService } from 'src/core/audit/audit.service';
import { MfaService, mfaMode } from './mfa.service';
import { DeviceService } from './device.service';

@Injectable()
export class AuthService {

  @Inject(AuthHelper)
  private readonly helper: AuthHelper;

  constructor(
    private readonly userService: UserService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    private readonly devices: DeviceService){}

  public async login(body: LoginDto, ip?: string, deviceToken?: string): Promise<any | never> {
    const { email, password }: LoginDto = body;
    const scope = body.scope === 'platform' ? 'platform' : 'business';
    const user = await this.userService.findByUsername(email );
    const reject = (reason: string) => {
      this.audit.record({ userId: user?.id ?? null, action: 'auth.login_failed', summary: reason, details: { email }, status: 401, ip });
      throw new UnauthorizedException();
    };
    if (!user) return reject('unknown email');

    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) return reject('wrong password');

    // A deactivated / archived account must not be able to sign in.
    if (user.isActive === false || user.isArchived === true) return reject('inactive account');

    // Platform admins and business users have separate sign-in pages; the wrong page gets the same answer as a wrong password.
    if ((user.role?.name === 'Site Admin') !== (scope === 'platform')) return reject(`wrong sign-in page (${scope})`);

    // the password is right: with MFA on, a token comes only after the code from the person's authenticator app
    const mode = mfaMode();
    if (mode !== 'off') {
      // a registered store PC may skip the second step for the roles the business allows (the password was still needed)
      const device = await this.devices.skipsMfa(deviceToken, user.role?.name, ip);
      if (device) {
        this.audit.record({ userId: user.id, action: 'auth.mfa_skipped_trusted_pc', summary: `second step skipped on store PC "${device.name}"`, details: { deviceid: device.id }, ip });
        return this.signedIn(user, ip, device.id);
      }
      if (await this.mfa.isEnabled(user.id)) return { mfaRequired: true, mfaToken: await this.mfa.signStepToken(user.id, 'verify') };
      if (mode === 'required') return { mfaSetupRequired: true, mfaToken: await this.mfa.signStepToken(user.id, 'enrol') };
    }
    return this.signedIn(user, ip);
  }

  private signedIn(user: AppUser, ip?: string, devid?: number | null) {
    this.userService.update(user.id, { lastlogin: new Date() });
    this.audit.record({ userId: user.id, action: 'auth.login', summary: 'signed in', status: 200, ip });
    return { token: this.helper.generateToken(user, devid) };
  }

  /** a registered store PC signs its linked Counter login in on its own (no password) */
  public async deviceLogin(deviceToken: string | undefined, ip?: string) {
    const { device, userId } = await this.devices.counterLogin(deviceToken, ip);
    const user = await this.userService.findById(userId);
    if (!user || user.isActive === false || user.isArchived === true || user.role?.name !== 'Counter') throw new UnauthorizedException();
    this.audit.record({ userId: user.id, action: 'auth.device_login', summary: `Counter login signed in on store PC "${device.name}"`, details: { deviceid: device.id }, status: 200, ip });
    return this.signedIn(user, ip, device.id);
  }

  /** the person behind a step token, still allowed to sign in */
  private async userOfStep(id: number): Promise<AppUser> {
    const user = await this.userService.findById(id);
    if (!user || user.isActive === false || user.isArchived === true) throw new UnauthorizedException();
    return user;
  }

  /** step 2 of a sign-in: the code from the authenticator app (or a recovery code) */
  public async mfaVerify(mfaToken: string, code: string, ip?: string) {
    const id = await this.mfa.readStepToken(mfaToken, 'verify');
    const user = await this.userOfStep(id);
    const result = await this.mfa.verify(id, code, ip);
    return { ...this.signedIn(user, ip), ...result };
  }

  /** first sign-in with MFA required: the secret and QR code to link an app */
  public async mfaSetup(mfaToken: string) {
    const id = await this.mfa.readStepToken(mfaToken, 'enrol');
    await this.userOfStep(id);
    return this.mfa.beginEnrol(id);
  }

  /** a code from the new app confirms the link; the recovery codes are shown once, and the person is signed in */
  public async mfaEnable(mfaToken: string, code: string, ip?: string) {
    const id = await this.mfa.readStepToken(mfaToken, 'enrol');
    const user = await this.userOfStep(id);
    const recoveryCodes = await this.mfa.confirmEnrol(id, code, ip);
    return { ...this.signedIn(user, ip), recoveryCodes };
  }

  public async changepwd(body: ChangePasswordDto): Promise<any | never> {
    const { email, password, newpassword }: ChangePasswordDto = body;
    const user = await this.userService.findByUsername(email);
    // the same answer for an unknown user and a wrong current password
    const wrong = () => {
      this.audit.record({ userId: user?.id ?? null, action: 'auth.password_change_failed', summary: user ? 'wrong current password' : 'unknown email', details: { email }, status: 401 });
      throw new UnauthorizedException('The username or current password is not correct.');
    };
    if (!user) return wrong();
    if (!this.helper.isPasswordValid(password, user.password)) return wrong();
    if (user.isActive === false || user.isArchived === true) return wrong();

    if (String(newpassword || '').length < 8) throw new BadRequestException('The new password must be at least 8 characters.');
    if (newpassword === password) throw new BadRequestException('The new password must be different from the current one.');

    this.userService.update(user.id, { password: this.helper.encodePassword(newpassword), lastlogin: new Date() });
    this.audit.record({ userId: user.id, action: 'auth.password_changed', summary: 'password changed' });

    // no token: signing in goes through the login (and its second step)
    return { changed: true };
  }

  public async refresh(user: AppUser, devid?: number | null): Promise<{token: string}> {
    this.userService.update(user.id, { lastlogin: new Date() });
    return {token: this.helper.generateToken(user, devid)};
  }
}

import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { AppUser } from 'src/entities/appuser.entity';

import { AuthHelper } from './auth.helper';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { UserService } from '../app/users/user.service';
import { AuditService } from 'src/core/audit/audit.service';

@Injectable()
export class AuthService {

  @Inject(AuthHelper)
  private readonly helper: AuthHelper;

  constructor(
    private readonly userService: UserService,
    private readonly audit: AuditService){}

  public async login(body: LoginDto, ip?: string): Promise<any | never> {
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

    this.userService.update(user.id, { lastlogin: new Date() });
    this.audit.record({ userId: user.id, action: 'auth.login', summary: 'signed in', status: 200, ip });
    return {token: this.helper.generateToken(user)};
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

    return {token: this.helper.generateToken(user)};
  }

  public async refresh(user: AppUser): Promise<{token: string}> {
    this.userService.update(user.id, { lastlogin: new Date() });
    return {token: this.helper.generateToken(user)};
  }
}

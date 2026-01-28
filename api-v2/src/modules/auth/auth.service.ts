import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';

import { AppUser } from 'src/entities/appuser.entity';

import { AuthHelper } from './auth.helper';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';
import { UserService } from '../app/users/user.service';
import { PasswordPolicyService } from './password-policy.service';
import { AuditService } from 'src/core/audit/audit.service';

@Injectable()
export class AuthService {

  @Inject(AuthHelper)
  private readonly helper: AuthHelper;

  @Inject(PasswordPolicyService)
  private readonly passwordPolicy: PasswordPolicyService;

  @Inject(AuditService)
  private readonly auditService: AuditService;

  constructor(
    private readonly userService: UserService){}

  public async register(body: RegisterDto): Promise<AppUser | never> {

    const { name, email }: RegisterDto = body;
    let user = await this.userService.findByUsername(email);

    if (user) {
      throw new HttpException('Conflict', HttpStatus.CONFLICT);
    }

    // Validate password against policy
    const validation = this.passwordPolicy.validatePassword(body['password']);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet policy requirements',
        errors: validation.errors,
      });
    }

    const password = this.helper.encodePassword(body['password']);

    return this.userService.create({
      fullname: name,
      password,
      email,
      passwordChangedOn: new Date(), // Set password change date
    });
  }

  public async login(body: LoginDto): Promise<any | never> {
    const { email, password }: LoginDto = body;
    const user = await this.userService.findByUsername(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    const isLocked = await this.passwordPolicy.isAccountLocked(user);
    if (isLocked) {
      const lockExpiry = user.lockedUntil;
      const minutesRemaining = lockExpiry ? Math.ceil((lockExpiry.getTime() - Date.now()) / (1000 * 60)) : 0;
      throw new HttpException(
        {
          message: `Account is locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`,
          locked: true,
          unlockAt: lockExpiry,
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Validate password
    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) {
      // Increment failed attempts
      await this.passwordPolicy.incrementFailedAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if password has expired
    const passwordExpired = await this.passwordPolicy.checkPasswordExpiry(user);
    if (passwordExpired) {
      throw new HttpException(
        {
          message: 'Your password has expired. Please change your password.',
          passwordExpired: true,
          userId: user.id,
        },
        HttpStatus.FORBIDDEN
      );
    }

    // Check if password expires soon (within 7 days)
    const daysUntilExpiry = await this.passwordPolicy.getDaysUntilExpiry(user);
    const passwordExpiresSoon = daysUntilExpiry <= 7 && daysUntilExpiry > 0;

    // Reset failed attempts on successful login
    await this.passwordPolicy.resetFailedAttempts(user.id);

    // Update last login
    this.userService.update(user.id, { lastlogin: new Date() });

    const token = await this.helper.generateToken(user);

    return {
      token,
      passwordExpiresSoon,
      daysUntilExpiry,
    };
  }

  public async changepwd(body: ChangePasswordDto, ipAddress?: string): Promise<any | never> {
    const { email, password, newpassword }: ChangePasswordDto = body;
    const user = await this.userService.findByUsername(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Validate new password against policy
    const validation = this.passwordPolicy.validatePassword(newpassword);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: 'Password does not meet policy requirements',
        errors: validation.errors,
      });
    }

    // Check password history (prevent reuse)
    const wasUsedBefore = await this.passwordPolicy.checkPasswordHistory(user, newpassword);
    if (wasUsedBefore) {
      throw new BadRequestException('Cannot reuse a recent password. Please choose a different password.');
    }

    // Hash new password
    const newPasswordHash = this.helper.encodePassword(newpassword);

    // Update password history
    const updatedHistory = await this.passwordPolicy.updatePasswordHistory(user, newPasswordHash);

    // Update user with new password and reset password change date
    this.userService.update(user.id, {
      password: newPasswordHash,
      passwordChangedOn: new Date(),
      passwordHistory: updatedHistory,
      lastlogin: new Date(),
    });

    // Log audit
    await this.auditService.logPasswordChange({
      userId: user.id,
      targetUserId: user.id,
      forced: false, // User-initiated password change
      ipAddress: ipAddress,
    });

    return { token: await this.helper.generateToken(user) };
  }

  public async refresh(user: AppUser): Promise<string> {
    this.userService.update(user.id, { lastlogin: new Date() });
    return await this.helper.generateToken(user);
  }
}
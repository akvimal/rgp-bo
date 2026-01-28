import { Body, Controller, Inject, Post, ClassSerializerInterceptor, UseInterceptors, UseGuards, Req, Get, HttpStatus, Param } from '@nestjs/common';
import { Request } from 'express';

import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';

import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserService } from '../app/users/user.service';
import { AppUser } from 'src/entities/appuser.entity';
import { AuthGuard } from './auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PasswordPolicyService } from './password-policy.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {

  @Inject(AuthService)
  private readonly service: AuthService;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(PasswordPolicyService)
  private readonly passwordPolicy: PasswordPolicyService;

  @Post('register')
  @UseInterceptors(ClassSerializerInterceptor)
  private register(@Body() body: RegisterDto): Promise<AppUser | never> {
    return this.service.register(body);
  }

  @Post('login')
  private async login(@Body() body: LoginDto): Promise<AppUser | never> {
      return this.service.login(body);
  }  
  
  @Post('changepwd')
  private async changepwd(@Body() body: ChangePasswordDto, @Req() request: Request): Promise<AppUser | never> {
      const ipAddress = request['clientIp'] || request.ip;
      return this.service.changepwd(body, ipAddress);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  private me( @User() currentUser: any) {
    return this.userService.findBasicDetails(currentUser.id);
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  private refresh(@Req() request: Request): Promise<string | never> {
    return this.service.refresh(<AppUser>request['user']);
  }

  // Security Dashboard Endpoints
  @Get('security/expired-passwords')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get users with expired passwords' })
  @ApiResponse({ status: 200, description: 'List of users with expired passwords' })
  private async getExpiredPasswords(): Promise<any[]> {
    const users = await this.passwordPolicy.getUsersWithExpiredPasswords();
    return users.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullname,
      passwordChangedOn: user.passwordChangedOn,
      passwordAgeDays: Math.floor((Date.now() - user.passwordChangedOn.getTime()) / (1000 * 60 * 60 * 24))
    }));
  }

  @Get('security/locked-accounts')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get currently locked accounts' })
  @ApiResponse({ status: 200, description: 'List of locked accounts' })
  private async getLockedAccounts(): Promise<any[]> {
    const users = await this.passwordPolicy.getLockedAccounts();
    return users.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullname,
      lockedUntil: user.lockedUntil,
      failedLoginAttempts: user.failedLoginAttempts
    }));
  }

  @Get('security/inactive-users/:days')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get inactive users (no login for specified days)' })
  @ApiResponse({ status: 200, description: 'List of inactive users' })
  private async getInactiveUsers(@Param('days') days: number): Promise<any[]> {
    const users = await this.passwordPolicy.getInactiveUsers(days);
    return users.map(user => ({
      id: user.id,
      email: user.email,
      fullName: user.fullname,
      lastLogin: user.lastlogin,
      daysSinceLogin: user.lastlogin ? Math.floor((Date.now() - user.lastlogin.getTime()) / (1000 * 60 * 60 * 24)) : null
    }));
  }

  @Get('security/password-policy')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current password policy configuration' })
  @ApiResponse({ status: 200, description: 'Password policy configuration' })
  private getPasswordPolicy() {
    return this.passwordPolicy.getPasswordPolicy();
  }

  @Post('security/unlock-account/:userId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Unlock a locked user account' })
  @ApiResponse({ status: 200, description: 'Account unlocked successfully' })
  private async unlockAccount(@Param('userId') userId: number, @User() currentUser: any, @Req() request: Request): Promise<{ message: string }> {
    const ipAddress = request['clientIp'] || request.ip;
    await this.passwordPolicy.unlockAccount(userId, currentUser.id, ipAddress);
    return { message: 'Account unlocked successfully' };
  }

  @Post('security/force-password-change/:userId')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Force password change for a user by expiring their password' })
  @ApiResponse({ status: 200, description: 'Password expiry forced successfully' })
  private async forcePasswordChange(@Param('userId') userId: number): Promise<{ message: string }> {
    // Set passwordChangedOn to 91 days ago to force expiry
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 91);

    await this.userService.update(userId, { passwordChangedOn: expiredDate });

    return { message: 'Password change forced successfully. User will be required to change password on next login.' };
  }
}
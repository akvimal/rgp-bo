import { BadRequestException, Body, Controller, Inject, Param, Post, UseGuards, Req, Get, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

import { LoginDto, ChangePasswordDto, MfaCodeDto, MfaTokenDto } from './auth.dto';
import { MfaService } from './mfa.service';

import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from '../app/users/user.service';
import { AppUser } from 'src/entities/appuser.entity';
import { AuthGuard } from './auth.guard';
import { User } from 'src/core/decorator/user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  
  @Inject(AuthService)
  private readonly service: AuthService;
  @Inject(UserService)
  private readonly userService: UserService;
  @Inject(MfaService)
  private readonly mfa: MfaService;

  @Post('login')
  private async login(@Body() body: LoginDto, @Req() request: Request): Promise<AppUser | never> {
      return this.service.login(body, request.ip);
  }  
  
  /** step 2: the code from the authenticator app (or a recovery code) */
  @Post('mfa/verify')
  private mfaVerify(@Body() body: MfaCodeDto, @Req() request: Request) {
    return this.service.mfaVerify(body.mfaToken, body.code, request.ip);
  }

  /** first sign-in with MFA required: a secret and QR code to link an app */
  @Post('mfa/setup')
  private mfaSetup(@Body() body: MfaTokenDto) {
    return this.service.mfaSetup(body.mfaToken);
  }

  /** a code from the new app confirms the link and signs the person in */
  @Post('mfa/enable')
  private mfaEnable(@Body() body: MfaCodeDto, @Req() request: Request) {
    return this.service.mfaEnable(body.mfaToken, body.code, request.ip);
  }

  /** who has an authenticator linked (the users list shows it) */
  @Get('mfa/status')
  @UseGuards(AuthGuard)
  private mfaStatus() {
    return this.mfa.statusOf();
  }

  /** a manager unlinks someone's authenticator (lost phone); the person links a new one at the next sign-in */
  @Post('mfa/reset/:id')
  @UseGuards(AuthGuard)
  private async mfaReset(@Param('id') id: string, @User() currentUser: any) {
    const target = Number(id);
    if (target === Number(currentUser.id)) throw new BadRequestException('Ask another manager to reset your own authenticator.');
    await this.userService.assertCanManage(target, currentUser.id);
    return this.mfa.reset(target, currentUser.id);
  }

  @Post('changepwd')
  private async changepwd(@Body() body: ChangePasswordDto): Promise<AppUser | never> {
      return this.service.changepwd(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  private me( @User() currentUser: any) {
    return this.userService.findBasicDetails(currentUser.id);
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  private refresh(@Req() request: Request): Promise<{token: string} | never> {
    return this.service.refresh(<AppUser>request['user']);
  }
}
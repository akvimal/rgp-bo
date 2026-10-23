import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, Headers, Injectable, Module, Param, Post, Put, Query, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { Db } from './db';
import { TenantsService } from './tenants.service';

const secret = () => process.env.ADMIN_JWT_SECRET || 'change-me';

/** The platform owner signs in with one password (ADMIN_PASSWORD) and gets a short-lived token. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = String(req.headers.authorization || '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    try { jwt.verify(token, secret(), { issuer: 'rgp-control-plane-admin' }); } catch { throw new UnauthorizedException(); }
    return true;
  }
}

@Controller()
export class ApiController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('health') health() { return { ok: true }; }

  @Post('admin/login')
  login(@Body() b: any) {
    const want = process.env.ADMIN_PASSWORD || '';
    const got = String(b?.password || '');
    const ok = want.length >= 8 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!ok) throw new UnauthorizedException('Wrong password.');
    return { token: jwt.sign({ admin: true }, secret(), { expiresIn: '12h', issuer: 'rgp-control-plane-admin' }) };
  }

  @UseGuards(AdminGuard) @Get('plans') plans() { return this.tenants.plans(); }
  @UseGuards(AdminGuard) @Put('plans/:key') savePlan(@Param('key') key: string, @Body() b: any) { return this.tenants.savePlan(key, b); }

  @UseGuards(AdminGuard) @Get('tenants') list() { return this.tenants.list(); }
  @UseGuards(AdminGuard) @Post('tenants') provision(@Body() b: any) { return this.tenants.provision(b); }
  @UseGuards(AdminGuard) @Get('tenants/:slug') get(@Param('slug') slug: string) { return this.tenants.get(slug); }
  @UseGuards(AdminGuard) @Put('tenants/:slug') update(@Param('slug') slug: string, @Body() b: any) { return this.tenants.update(slug, b); }
  @UseGuards(AdminGuard) @Post('tenants/:slug/reset') reset(@Param('slug') slug: string) { return this.tenants.resetDemo(slug); }
  @UseGuards(AdminGuard) @Post('tenants/:slug/extend') extend(@Param('slug') slug: string, @Body() b: any) { return this.tenants.extend(slug, b?.days); }
  @UseGuards(AdminGuard) @Get('demo-template') template() { return this.tenants.templateStatus(); }
  @UseGuards(AdminGuard) @Post('demo-template/capture') capture(@Body() b: any) { return this.tenants.captureTemplate(String(b?.slug || '')); }
  @UseGuards(AdminGuard) @Delete('demos/closed') purge(@Query('confirm') confirm: string) { return this.tenants.purgeClosedDemos(confirm); }
  @UseGuards(AdminGuard) @Post('tenants/:slug/suspend') suspend(@Param('slug') slug: string) { return this.tenants.setStatus(slug, 'suspended'); }
  @UseGuards(AdminGuard) @Post('tenants/:slug/activate') activate(@Param('slug') slug: string) { return this.tenants.setStatus(slug, 'active'); }
  @UseGuards(AdminGuard) @Post('tenants/:slug/close') close(@Param('slug') slug: string) { return this.tenants.setStatus(slug, 'closed'); }
  @UseGuards(AdminGuard) @Delete('tenants/:slug') destroy(@Param('slug') slug: string, @Query('confirm') confirm: string) { return this.tenants.destroy(slug, confirm); }

  /** the .env a customer's containers are started with (read by scripts/tenant-up.sh) */
  @UseGuards(AdminGuard) @Get('tenants/:slug/env')
  async env(@Param('slug') slug: string, @Res() res: any) { res.type('text/plain').send(await this.tenants.envFor(slug)); }

  /** called by a customer's app, authenticated by that customer's own key */
  @Post('tenants/:slug/heartbeat')
  heartbeat(@Param('slug') slug: string, @Headers('x-tenant-key') key: string, @Body() b: any) {
    return this.tenants.heartbeat(slug, key, b?.usage, b?.version);
  }
}

@Module({ controllers: [ApiController], providers: [Db, TenantsService, AdminGuard] })
export class AppModule {}

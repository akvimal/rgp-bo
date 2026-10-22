import { Body, CanActivate, Controller, Delete, ExecutionContext, ForbiddenException, Get, Injectable, Param, ParseIntPipe, Post, Query, SetMetadata, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { PaymentReconService } from './payment-recon.service';

const Needs = (action: string) => SetMetadata('paymentrecon.action', action);
/** a statement is read in memory and not kept: only the payments parsed from it are */
const upload = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

@Injectable()
export class PaymentReconGuard implements CanActivate {
  constructor(private readonly permissions: PermissionService, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const action = this.reflector.get<string>('paymentrecon.action', ctx.getHandler()) || 'view';
    const req = ctx.switchToHttp().getRequest();
    if (!(await this.permissions.can(req.user?.roleid, 'paymentrecon', action))) throw new ForbiddenException('You are not allowed to do that with digital payments.');
    return true;
  }
}

@ApiTags('Digital payments')
@Controller('payment-recon')
@ApiBearerAuth()
@UseGuards(AuthGuard, PaymentReconGuard)
export class PaymentReconController {
  constructor(private readonly service: PaymentReconService) {}

  @Get() @Needs('view') list(@Query() q: any, @User() u: any) { return this.service.list(q, u); }
  @Get('statements') @Needs('import') statements() { return this.service.statements(); }
  @Post('statements/preview') @Needs('import') @UseInterceptors(upload) preview(@UploadedFile() f: any) { return this.service.preview(f); }
  @Post('statements') @Needs('import') @UseInterceptors(upload) importStatement(@UploadedFile() f: any, @User() u: any) { return this.service.importStatement(f, u); }
  @Delete('statements/:id') @Needs('import') removeStatement(@Param('id', ParseIntPipe) id: number, @User() u: any) { return this.service.removeStatement(id, u); }
  @Post('accept') @Needs('verify') accept(@Body() b: any, @User() u: any) { return this.service.acceptSuggestions(b, u); }
  @Post('verify-many') @Needs('verify') verifyMany(@Body() b: any, @User() u: any) { return this.service.verifyMany(b, u); }
  @Post(':saleId') @Needs('verify') record(@Param('saleId', ParseIntPipe) id: number, @Body() b: any, @User() u: any) { return this.service.record(id, b, u); }
  @Delete(':saleId') @Needs('verify') clear(@Param('saleId', ParseIntPipe) id: number, @User() u: any) { return this.service.clear(id, u); }
}

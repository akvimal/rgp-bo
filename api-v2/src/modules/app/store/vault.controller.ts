import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { VaultService } from './vault.service';

@ApiTags('Store Vault')
@Controller('store-vault')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class VaultController {
  constructor(private readonly service: VaultService) {}

  @Post('movements/:id/confirm')
  confirm(@Param('id') id: string, @User() u: any) {
    return this.service.confirm(id, u?.id);
  }

  @Post('movements/:id/reject')
  reject(@Param('id') id: string, @Body() body: any, @User() u: any) {
    return this.service.reject(id, body, u?.id);
  }

  @Get(':storeid')
  state(@Param('storeid', ParseIntPipe) storeid: number, @User() u: any) {
    return this.service.getState(storeid, u?.id);
  }

  @Get(':storeid/movements')
  movements(@Param('storeid', ParseIntPipe) storeid: number, @Query() q: any, @User() u: any) {
    return this.service.getMovements(storeid, q, u?.id);
  }

  @Post(':storeid/opening')
  opening(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.opening(storeid, body, u?.id);
  }

  @Post(':storeid/drop')
  drop(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.drop(storeid, body, u?.id);
  }

  @Post(':storeid/drop-now')
  dropNow(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.dropNow(storeid, body, u?.id);
  }

  @Post(':storeid/deposit')
  deposit(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.deposit(storeid, body, u?.id);
  }

  @Post(':storeid/change')
  change(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.change(storeid, body, u?.id);
  }

  @Post(':storeid/count')
  count(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.count(storeid, body, u?.id);
  }

  @Post(':storeid/adjust')
  adjust(@Param('storeid', ParseIntPipe) storeid: number, @Body() body: any, @User() u: any) {
    return this.service.adjust(storeid, body, u?.id);
  }
}

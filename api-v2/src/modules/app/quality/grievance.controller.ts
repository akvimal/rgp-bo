import { Body, Controller, Get, ParseIntPipe, Param, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { GrievanceService } from './grievance.service';
import { AddNoteDto, CreateGrievanceDto, UpdateGrievanceDto } from './dto/grievance.dto';

// Business Head (all stores) and Store Head (own stores); anyone else gets 403 from scopeFor().
@ApiTags('Grievances')
@Controller('grievances')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class GrievanceController {
  constructor(private readonly service: GrievanceService) {}

  @Get()
  async list(@Query() q: any, @User() user: any) {
    const sc = await this.service.scopeFor(user);
    return this.service.list(sc, {
      status: q.status, category: q.category, severity: q.severity, q: q.q,
      storeid: q.storeid ? +q.storeid : undefined,
      aboutuserid: q.aboutuserid ? +q.aboutuserid : undefined,
      overdue: q.overdue === 'true',
    });
  }

  @Get('summary')
  async summary(@User() user: any) { return this.service.summary(await this.service.scopeFor(user)); }

  @Get('people')
  async people(@User() user: any) { return this.service.people(await this.service.scopeFor(user)); }

  @Get('stores')
  async stores(@User() user: any) { return this.service.stores(await this.service.scopeFor(user)); }

  @Get('customers')
  async customers(@Query('q') q: string, @User() user: any) { return this.service.customers(await this.service.scopeFor(user), q); }

  @Get('bills')
  async bills(@Query('billno', ParseIntPipe) billno: number, @User() user: any) { return this.service.bills(await this.service.scopeFor(user), billno); }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.service.get(await this.service.scopeFor(user), id); }

  @Post()
  async create(@Body() dto: CreateGrievanceDto, @User() user: any) { return this.service.create(await this.service.scopeFor(user), dto); }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGrievanceDto, @User() user: any) {
    return this.service.update(await this.service.scopeFor(user), id, dto);
  }

  @Post(':id/notes')
  async note(@Param('id', ParseIntPipe) id: number, @Body() dto: AddNoteDto, @User() user: any) {
    return this.service.addNote(await this.service.scopeFor(user), id, dto);
  }
}

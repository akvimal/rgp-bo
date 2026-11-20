import { CustomerActionGuard, NeedsCustomers } from './customer-action.guard';
import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from 'src/core/decorator/user.decorator';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { CustomerRelationshipService } from './customer-relationship.service';
import { CustomerPrivacyService } from './customer-privacy.service';
import { CustomerFollowupService } from './customer-followup.service';
import { CustomerTurnaroundService } from './customer-turnaround.service';
import { buildAudienceCsv } from './customer-export';

/** Segments, audiences, the daily contact list and the contact log. A separate path from /customers so ":id" never swallows these. */
@ApiTags('Customer relationships')
@Controller('customer-relations')
@ApiBearerAuth()
@UseGuards(AuthGuard, CustomerActionGuard)
export class CustomerRelationshipController {
  constructor(private readonly relations: CustomerRelationshipService, private readonly privacy: CustomerPrivacyService, private readonly followup: CustomerFollowupService, private readonly turnaround: CustomerTurnaroundService) {}

  /** the audience download carries whole numbers: only those who may read all contact details (the audiences screen itself masks them) */
  private async needAll(user: any) {
    if (!(await this.privacy.canRevealAll(user))) throw new ForbiddenException('Audiences list full contact details: ask a manager.');
  }

  /** the badge (tier, segment, a line of guidance) of each customer in ?ids=1,2,3: open to every login that can see customers, it carries no figures */
  @Get('badges')
  badges(@Query('ids') ids: string) {
    return this.relations.badges(String(ids || '').split(',').map((x) => Number(x)));
  }

  /** the wording of the messages staff send from the contact list */
  @NeedsCustomers('worklist.use')
  @Get('followup-templates')
  templates() { return this.followup.templates(); }

  @NeedsCustomers('followup.wording')
  @Put('followup-templates')
  saveTemplates(@Body() body: any, @User() user: any) { return this.followup.save(user, body); }

  @NeedsCustomers('followup.wording')
  @Post('followup-templates/reset')
  resetTemplates(@User() user: any) { return this.followup.reset(user); }

  @NeedsCustomers('followup.wording')
  @Post('followup-templates/draft')
  draftTemplates(@User() user: any) { return this.followup.draft(user); }

  /** of the customers contacted in a period, who bought again within the window; a person sees their own, a manager everyone's (?userid= for one person) */
  @NeedsCustomers('worklist.use')
  @Get('turnaround')
  turnaroundReport(@Query() q: any, @User() user: any) { return this.turnaround.report(user, q); }

  /** regular customers with no usable mobile number: the ones to ask for a number */
  @NeedsCustomers('worklist.use')
  @Get('cannot-reach')
  cannotReach() { return this.relations.cannotReach(); }

  @NeedsCustomers('worklist.use')
  @Get('summary')
  summary() { return this.relations.summary(); }

  @NeedsCustomers('worklist.use')
  @Get('settings')
  settings() { return this.relations.settings(); }

  @NeedsCustomers('relationships.setup')
  @Put('settings')
  saveSettings(@Body() body: any, @User() user: any) { return this.relations.saveSettings(body, user); }

  @NeedsCustomers('audiences.use')
  @Get('audiences')
  async audiences() { return this.relations.audiences(); }

  @NeedsCustomers('audiences.use')
  @Post('audience')
  async audience(@Body() body: any, @User() user: any) {
    const out = await this.relations.audience(body);
    // a login that may not read every number sees them masked and shows one at a time to call (as on the contact list); the choice to contact is unchanged
    const masked = !(await this.privacy.canRevealAll(user));
    out.members = await this.privacy.protectAll(out.members as any[], user) as any;
    await this.privacy.logBulk(user, 'audience', `${out.audience.label}: ${out.members.length} customers listed${masked ? ' (numbers masked)' : ''}`, { audience: out.audience.key, count: out.members.length, masked });
    return out;
  }

  /**
   * The audience as a CSV to download: the Business Head (or a role granted customers "export") only, at most 2,000 customers, each one a
   * person who can be contacted. The download is kept with who took it and how many, and the file itself names who took it.
   */
  @NeedsCustomers('audiences.use')
  @Post('audience/export')
  async exportAudience(@Body() body: any, @User() user: any) {
    await this.needAll(user);
    if (!(await this.privacy.canExport(user))) throw new ForbiddenException('Downloading customer lists is limited to the Business Head.');
    const out = await this.relations.audience(body);
    const who = await this.privacy.userName(user);
    const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const { csv, count } = buildAudienceCsv(out.members.filter((m) => m.canContact), String(body?.message || ''), who, when);
    await this.privacy.logExport(user, `${out.audience.label}: ${count} customers downloaded`, { audience: out.audience.key, count, filters: { product: body?.product || null, kind: body?.kind || null, months: body?.months || null, locality: body?.locality || null } });
    return { filename: `audience-${out.audience.key}-${new Date().toISOString().slice(0, 10)}.csv`, csv, count };
  }

  /** today's list: numbers are masked for a login that may not read them all, who reveals one at a time to call */
  @NeedsCustomers('worklist.use')
  @Get('worklist')
  async worklist(@User() user: any) {
    const out = await this.relations.worklist();
    out.rows = await this.privacy.protectAll(out.rows, user);
    return out;
  }

  /** the bill screen asks whether to offer the review invitation for a bill, and gets the WhatsApp link ready */
  @NeedsCustomers('worklist.use')
  @Get('review-invite/:saleId')
  reviewInvite(@Param('saleId', ParseIntPipe) saleId: number) { return this.relations.reviewInviteFor(saleId); }

  @NeedsCustomers('worklist.use')
  @Post('review-invite')
  recordReviewInvite(@Body() body: any, @User() user: any) { return this.relations.recordReviewInvite(Number(body?.saleid), user); }

  @NeedsCustomers('worklist.use')
  @Post(':id/snooze')
  snooze(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.relations.snooze(id, body, user); }

  @NeedsCustomers('worklist.use')
  @Post(':id/unsnooze')
  unsnooze(@Param('id', ParseIntPipe) id: number) { return this.relations.unsnooze(id); }

  @NeedsCustomers('worklist.use')
  @Get(':id/care')
  care(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.relations.care(id, user); }

  @NeedsCustomers('worklist.use')
  @Get(':id/profile')
  profile(@Param('id', ParseIntPipe) id: number) { return this.relations.profileOf(id); }

  @NeedsCustomers('worklist.use')
  @Get(':id/contacts')
  contacts(@Param('id', ParseIntPipe) id: number) { return this.relations.contacts(id); }

  @NeedsCustomers('worklist.use')
  @Post(':id/contacts')
  record(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.relations.recordContact(id, body, user); }

  @NeedsCustomers('consent.manage')
  @Put(':id/consent')
  consent(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.relations.setConsent(id, body, user); }
}

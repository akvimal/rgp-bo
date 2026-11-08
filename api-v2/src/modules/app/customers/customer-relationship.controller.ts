import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from 'src/core/decorator/user.decorator';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { CustomerRelationshipService } from './customer-relationship.service';
import { CustomerPrivacyService } from './customer-privacy.service';
import { CustomerFollowupService } from './customer-followup.service';
import { buildAudienceCsv } from './customer-export';

/** Segments, audiences, the daily contact list and the contact log. A separate path from /customers so ":id" never swallows these. */
@ApiTags('Customer relationships')
@Controller('customer-relations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CustomerRelationshipController {
  constructor(private readonly relations: CustomerRelationshipService, private readonly privacy: CustomerPrivacyService, private readonly followup: CustomerFollowupService) {}

  /** the audiences list whole numbers and feed the CSV: only those who may read all contact details */
  private async needAll(user: any) {
    if (!(await this.privacy.canRevealAll(user))) throw new ForbiddenException('Audiences list full contact details: ask a manager.');
  }

  /** the wording of the messages staff send from the contact list */
  @Get('followup-templates')
  templates() { return this.followup.templates(); }

  @Put('followup-templates')
  saveTemplates(@Body() body: any, @User() user: any) { return this.followup.save(user, body); }

  @Post('followup-templates/reset')
  resetTemplates(@User() user: any) { return this.followup.reset(user); }

  @Post('followup-templates/draft')
  draftTemplates(@User() user: any) { return this.followup.draft(user); }

  @Get('summary')
  summary() { return this.relations.summary(); }

  @Get('settings')
  settings() { return this.relations.settings(); }

  @Put('settings')
  saveSettings(@Body() body: any, @User() user: any) { return this.relations.saveSettings(body, user); }

  @Get('audiences')
  async audiences(@User() user: any) { await this.needAll(user); return this.relations.audiences(); }

  @Post('audience')
  async audience(@Body() body: any, @User() user: any) {
    await this.needAll(user);
    const out = await this.relations.audience(body);
    await this.privacy.logBulk(user, 'audience', `${out.audience.label}: ${out.members.length} customers listed`, { audience: out.audience.key, count: out.members.length });
    return out;
  }

  /**
   * The audience as a CSV to download: the Business Head (or a role granted customers "export") only, at most 2,000 customers, each one a
   * person who can be contacted. The download is kept with who took it and how many, and the file itself names who took it.
   */
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
  @Get('worklist')
  async worklist(@User() user: any) {
    const out = await this.relations.worklist();
    out.rows = await this.privacy.protectAll(out.rows, user);
    return out;
  }

  /** the bill screen asks whether to offer the review invitation for a bill, and gets the WhatsApp link ready */
  @Get('review-invite/:saleId')
  reviewInvite(@Param('saleId', ParseIntPipe) saleId: number) { return this.relations.reviewInviteFor(saleId); }

  @Post('review-invite')
  recordReviewInvite(@Body() body: any, @User() user: any) { return this.relations.recordReviewInvite(Number(body?.saleid), user); }

  @Post(':id/snooze')
  snooze(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.relations.snooze(id, body, user); }

  @Post(':id/unsnooze')
  unsnooze(@Param('id', ParseIntPipe) id: number) { return this.relations.unsnooze(id); }

  @Get(':id/care')
  care(@Param('id', ParseIntPipe) id: number, @User() user: any) { return this.relations.care(id, user); }

  @Get(':id/profile')
  profile(@Param('id', ParseIntPipe) id: number) { return this.relations.profileOf(id); }

  @Get(':id/contacts')
  contacts(@Param('id', ParseIntPipe) id: number) { return this.relations.contacts(id); }

  @Post(':id/contacts')
  record(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.relations.recordContact(id, body, user); }

  @Put(':id/consent')
  consent(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() user: any) { return this.relations.setConsent(id, body, user); }
}

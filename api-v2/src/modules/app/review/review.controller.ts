import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { PermissionService } from '../roles/permission.service';
import { ReviewService } from './review.service';

/** The weekly exceptions review, for the people who run the shop: discounts, cancelled bills and returns, and the sign-off. */
@ApiTags('Review')
@Controller('review')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ReviewController {
  constructor(private readonly review: ReviewService, private readonly permissions: PermissionService) {}

  private async assertReviewer(user: any) {
    if (!(await this.permissions.canReview(user.roleid))) throw new ForbiddenException('The weekly review is not open to your role.');
  }

  @Get('week')
  async week(@Query('storeid') storeid: string, @Query('weekstart') weekstart: string, @User() user: any) {
    await this.assertReviewer(user);
    return this.review.week(user, { storeid: /^\d+$/.test(storeid ?? '') ? +storeid : null, weekstart: weekstart || undefined });
  }

  @Post('signoff')
  async signoff(@Body() body: any, @User() user: any) {
    await this.assertReviewer(user);
    return this.review.signoff(user, body);
  }
}

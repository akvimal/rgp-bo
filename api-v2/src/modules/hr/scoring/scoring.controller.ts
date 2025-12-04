import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from '../../../core/decorator/user.decorator';

@Controller('hr/scoring')
@UseGuards(AuthGuard)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post('calculate/:userId')
  calculateMonthlyScore(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.scoringService.calculateMonthlyScore(userId, year, month);
  }

  @Get('user/:userId/monthly')
  getUserMonthlyScore(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.scoringService.getUserMonthlyScore(userId, year, month);
  }

  @Get('my/monthly')
  getMyMonthlyScore(
    @User() user: any,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.scoringService.getUserMonthlyScore(user.id, year, month);
  }

  @Get('leaderboard')
  getCurrentMonthLeaderboard(@Query('limit', ParseIntPipe) limit: number = 50) {
    return this.scoringService.getCurrentMonthLeaderboard(limit);
  }

  @Get('monthly')
  getMonthlyScores(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.scoringService.getMonthlyScores(year, month);
  }

  @Post('batch/calculate')
  batchCalculateMonthlyScores(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.scoringService.batchCalculateMonthlyScores(year, month);
  }
}

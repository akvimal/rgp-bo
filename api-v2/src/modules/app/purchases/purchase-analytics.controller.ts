import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { PurchaseAnalyticsService } from './purchase-analytics.service';
import { PurchaseAnalyticsDto } from './dto/purchase-analytics.dto';

@ApiTags('Purchase Analytics')
@Controller('analytics/purchases')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class PurchaseAnalyticsController {
  constructor(
    private readonly analyticsService: PurchaseAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get comprehensive purchase analytics' })
  @ApiResponse({
    status: 200,
    description: 'Returns purchase analytics including summary, trends, and breakdowns',
    type: PurchaseAnalyticsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAnalytics(): Promise<PurchaseAnalyticsDto> {
    return this.analyticsService.getAnalytics();
  }
}

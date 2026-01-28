import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { ProductAnalyticsService } from './product-analytics.service';
import { ProductAnalyticsDto } from './dto/product-analytics.dto';

@ApiTags('Product Analytics')
@Controller('analytics/products')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ProductAnalyticsController {
  constructor(
    private readonly analyticsService: ProductAnalyticsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get comprehensive product analytics' })
  @ApiResponse({
    status: 200,
    description: 'Returns product analytics including summary, performance, and alerts',
    type: ProductAnalyticsDto,
  })
  async getAnalytics(): Promise<ProductAnalyticsDto> {
    return this.analyticsService.getAnalytics();
  }
}

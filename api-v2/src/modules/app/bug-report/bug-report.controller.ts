import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/auth.guard';
import { BugReportService } from './bug-report.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';

@ApiTags('Bug Reports')
@Controller('bug-reports')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BugReportController {
  constructor(private readonly bugReportService: BugReportService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a bug report' })
  @ApiResponse({
    status: 201,
    description: 'Bug report submitted successfully',
    schema: {
      type: 'object',
      properties: {
        issueUrl: {
          type: 'string',
          example: 'https://github.com/akvimal/rgp-bo/issues/123',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 429, description: 'GitHub API rate limit exceeded' })
  @ApiResponse({ status: 502, description: 'GitHub API error' })
  @ApiResponse({ status: 503, description: 'GitHub service unavailable' })
  async create(
    @Body() createBugReportDto: CreateBugReportDto,
    @Request() req,
  ): Promise<{ issueUrl: string }> {
    const userEmail = req.user.email;
    return this.bugReportService.createBugReport(
      createBugReportDto,
      userEmail,
    );
  }

  @Get('rate-limit')
  @ApiOperation({ summary: 'Get GitHub API rate limit status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Rate limit status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', example: 5000 },
        remaining: { type: 'number', example: 4998 },
        resetTime: { type: 'string', example: '2026-01-18T12:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    return this.bugReportService.getRateLimitStatus();
  }
}

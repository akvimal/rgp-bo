import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BugReportController } from './bug-report.controller';
import { BugReportService } from './bug-report.service';
import { GitHubService } from './github.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [BugReportController],
  providers: [BugReportService, GitHubService],
  exports: [BugReportService],
})
export class BugReportModule {}

import { Injectable, Logger } from '@nestjs/common';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { GitHubService } from './github.service';

@Injectable()
export class BugReportService {
  private readonly logger = new Logger(BugReportService.name);

  constructor(private readonly githubService: GitHubService) {}

  /**
   * Create a bug report by submitting it as a GitHub issue
   * @param dto Bug report data
   * @param userEmail Email of the user reporting the bug
   * @returns GitHub issue URL
   */
  async createBugReport(
    dto: CreateBugReportDto,
    userEmail: string,
  ): Promise<{ issueUrl: string }> {
    try {
      this.logger.log(
        `Creating bug report: "${dto.title}" from user: ${userEmail}`,
      );

      // Format issue title
      const issueTitle = `[User Report] ${dto.title}`;

      // Format issue body
      const issueBody = this.formatIssueBody(dto, userEmail);

      // Create GitHub issue
      const issueUrl = await this.githubService.createIssue(
        issueTitle,
        issueBody,
      );

      this.logger.log(
        `Bug report created successfully: ${issueUrl} by ${userEmail}`,
      );

      return { issueUrl };
    } catch (error) {
      this.logger.error('Failed to create bug report:', error);
      throw error; // Re-throw to let global filter handle it
    }
  }

  /**
   * Get GitHub API rate limit status
   * @returns Rate limit information
   */
  async getRateLimitStatus(): Promise<{
    limit: number;
    remaining: number;
    resetTime: Date;
  }> {
    return this.githubService.getRateLimitStatus();
  }

  /**
   * Format the GitHub issue body with structured sections
   * @param dto Bug report data
   * @param userEmail Email of the user reporting the bug
   * @returns Formatted markdown body
   */
  private formatIssueBody(
    dto: CreateBugReportDto,
    userEmail: string,
  ): string {
    const sections: string[] = [];

    // Description section
    sections.push('## Description');
    sections.push(dto.description);
    sections.push('');

    // Steps to reproduce (if provided)
    if (dto.stepsToReproduce) {
      sections.push('## Steps to Reproduce');
      sections.push(dto.stepsToReproduce);
      sections.push('');
    }

    // System information section
    sections.push('## System Information');
    sections.push('');
    sections.push(`- **Browser**: ${dto.systemInfo.browser}`);
    sections.push(`- **Operating System**: ${dto.systemInfo.os}`);
    sections.push(`- **Current Route**: ${dto.systemInfo.currentRoute}`);
    sections.push(`- **Screen Resolution**: ${dto.systemInfo.screenResolution}`);
    sections.push(`- **Timestamp**: ${dto.systemInfo.timestamp}`);
    sections.push('');
    sections.push(
      '<details><summary>User Agent</summary>',
    );
    sections.push('');
    sections.push('```');
    sections.push(dto.systemInfo.userAgent);
    sections.push('```');
    sections.push('');
    sections.push('</details>');
    sections.push('');

    // Reporter information
    sections.push('## Reporter');
    sections.push(`- **Email**: ${userEmail}`);
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('*This issue was automatically created from a user bug report.*');

    return sections.join('\n');
  }
}

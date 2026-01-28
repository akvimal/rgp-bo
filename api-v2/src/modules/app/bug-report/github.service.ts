import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import {
  GitHubException,
  GitHubRateLimitException,
  GitHubAuthException,
  GitHubNetworkException,
} from '../../../core/exceptions/github.exception';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    if (!token) {
      this.logger.warn(
        'GITHUB_TOKEN not configured. Bug reporting will not work.',
      );
    }

    this.owner = this.configService.get<string>('GITHUB_OWNER') || 'akvimal';
    this.repo = this.configService.get<string>('GITHUB_REPO') || 'rgp-bo';

    this.octokit = new Octokit({
      auth: token,
    });
  }

  /**
   * Create a GitHub issue
   * @param title Issue title
   * @param body Issue body (markdown)
   * @param labels Issue labels
   * @returns GitHub issue URL
   */
  async createIssue(
    title: string,
    body: string,
    labels: string[] = ['bug', 'user-reported'],
  ): Promise<string> {
    try {
      this.logger.log(
        `Creating GitHub issue: ${title} in ${this.owner}/${this.repo}`,
      );

      const response = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels,
      });

      this.logger.log(
        `GitHub issue created successfully: ${response.data.html_url}`,
      );
      return response.data.html_url;
    } catch (error) {
      this.logger.error('Failed to create GitHub issue:', error);
      throw this.classifyError(error);
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
    try {
      const response = await this.octokit.rest.rateLimit.get();
      const { limit, remaining, reset } = response.data.rate;

      return {
        limit,
        remaining,
        resetTime: new Date(reset * 1000),
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit status:', error);
      throw this.classifyError(error);
    }
  }

  /**
   * Classify GitHub API errors into custom exceptions
   * @param error Original error from Octokit
   * @returns Classified custom exception
   */
  private classifyError(error: any): GitHubException {
    // Rate limit error
    if (error.status === 403 && error.message?.includes('rate limit')) {
      const resetTime = error.response?.headers?.['x-ratelimit-reset']
        ? new Date(
            parseInt(error.response.headers['x-ratelimit-reset']) * 1000,
          )
        : undefined;
      return new GitHubRateLimitException(resetTime);
    }

    // Authentication/Authorization errors
    if (error.status === 401 || error.status === 403) {
      return new GitHubAuthException(
        error.message || 'GitHub authentication failed',
      );
    }

    // Network/timeout errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND'
    ) {
      return new GitHubNetworkException('Failed to connect to GitHub API');
    }

    // Generic GitHub error
    return new GitHubException(
      error.message || 'An error occurred while communicating with GitHub API',
    );
  }
}

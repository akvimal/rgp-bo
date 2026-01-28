import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for GitHub API errors
 */
export class GitHubException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_GATEWAY) {
    super(
      {
        statusCode: status,
        message,
        error: 'GitHub API Error',
      },
      status,
    );
  }
}

/**
 * GitHub API rate limit exceeded
 */
export class GitHubRateLimitException extends GitHubException {
  constructor(resetTime?: Date) {
    const message = resetTime
      ? `GitHub API rate limit exceeded. Resets at ${resetTime.toISOString()}`
      : 'GitHub API rate limit exceeded';
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * GitHub authentication/authorization error
 */
export class GitHubAuthException extends GitHubException {
  constructor(message: string = 'GitHub authentication failed') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * GitHub network/connection error
 */
export class GitHubNetworkException extends GitHubException {
  constructor(message: string = 'Failed to connect to GitHub API') {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

import { Logger } from '@nestjs/common';
import {
  RateLimitException,
  AiServiceUnavailableException,
  TokenLimitException,
  InvalidApiKeyException,
  AiApiException,
} from './business.exception';

/**
 * AI API Error Handler Helper
 *
 * Provides utility methods to handle common AI API errors and convert them
 * to appropriate exceptions with proper HTTP status codes and retry information.
 */
export class AiApiErrorHandler {
  private static readonly logger = new Logger(AiApiErrorHandler.name);

  /**
   * Handle AI API errors and throw appropriate exceptions
   *
   * @param error - The error object from the AI API
   * @param serviceName - Name of the AI service (e.g., 'OpenAI', 'OCR Service')
   */
  static handleApiError(error: any, serviceName: string = 'AI API'): never {
    this.logger.error(
      `${serviceName} Error:`,
      error?.message || error,
      error?.stack,
    );

    // Handle rate limit errors (429)
    if (this.isRateLimitError(error)) {
      const retryAfter = this.extractRetryAfter(error);
      throw new RateLimitException(
        `${serviceName} rate limit exceeded. Please try again later.`,
        retryAfter,
      );
    }

    // Handle authentication errors (401, 403)
    if (this.isAuthError(error)) {
      throw new InvalidApiKeyException(serviceName);
    }

    // Handle token/quota limit errors (402, quota exceeded)
    if (this.isQuotaError(error)) {
      throw new TokenLimitException(
        `${serviceName} quota or token limit exceeded. Please check your subscription.`,
      );
    }

    // Handle service unavailable errors (503, 502, 504)
    if (this.isServiceUnavailable(error)) {
      throw new AiServiceUnavailableException(serviceName);
    }

    // Generic AI API error
    const message = this.extractErrorMessage(error, serviceName);
    throw new AiApiException(message, 'AI_API_ERROR');
  }

  /**
   * Check if error is a rate limit error
   */
  private static isRateLimitError(error: any): boolean {
    if (!error) return false;

    const statusCode = error.status || error.statusCode || error.response?.status;
    const errorCode = error.code || error.error?.code || error.response?.data?.error?.code;
    const errorMessage = (error.message || '').toLowerCase();

    return (
      statusCode === 429 ||
      errorCode === 'rate_limit_exceeded' ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    );
  }

  /**
   * Check if error is an authentication error
   */
  private static isAuthError(error: any): boolean {
    if (!error) return false;

    const statusCode = error.status || error.statusCode || error.response?.status;
    const errorCode = error.code || error.error?.code || error.response?.data?.error?.code;
    const errorMessage = (error.message || '').toLowerCase();

    return (
      statusCode === 401 ||
      statusCode === 403 ||
      errorCode === 'invalid_api_key' ||
      errorCode === 'authentication_error' ||
      errorMessage.includes('invalid api key') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication failed')
    );
  }

  /**
   * Check if error is a quota/token limit error
   */
  private static isQuotaError(error: any): boolean {
    if (!error) return false;

    const statusCode = error.status || error.statusCode || error.response?.status;
    const errorCode = error.code || error.error?.code || error.response?.data?.error?.code;
    const errorMessage = (error.message || '').toLowerCase();

    return (
      statusCode === 402 ||
      errorCode === 'insufficient_quota' ||
      errorCode === 'quota_exceeded' ||
      errorMessage.includes('quota') ||
      errorMessage.includes('billing')
    );
  }

  /**
   * Check if error indicates service unavailability
   */
  private static isServiceUnavailable(error: any): boolean {
    if (!error) return false;

    const statusCode = error.status || error.statusCode || error.response?.status;
    const errorMessage = (error.message || '').toLowerCase();

    return (
      statusCode === 503 ||
      statusCode === 502 ||
      statusCode === 504 ||
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('temporarily unavailable') ||
      errorMessage.includes('gateway timeout')
    );
  }

  /**
   * Extract retry-after value from error headers or body
   */
  private static extractRetryAfter(error: any): number | undefined {
    if (!error) return undefined;

    // Check response headers
    const retryAfterHeader =
      error.response?.headers?.['retry-after'] ||
      error.headers?.['retry-after'];

    if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      return isNaN(parsed) ? undefined : parsed;
    }

    // Check error body
    const retryAfterBody =
      error.response?.data?.retry_after ||
      error.error?.retry_after ||
      error.retry_after;

    if (retryAfterBody) {
      const parsed = parseInt(retryAfterBody, 10);
      return isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  /**
   * Extract user-friendly error message
   */
  private static extractErrorMessage(error: any, serviceName: string): string {
    if (!error) {
      return `${serviceName} request failed`;
    }

    // Try to get the most specific error message
    const errorMessage =
      error.response?.data?.error?.message ||
      error.error?.message ||
      error.message ||
      `${serviceName} request failed`;

    // Sanitize message (remove technical details)
    return errorMessage.split('\n')[0].substring(0, 200);
  }

  /**
   * Wrap an AI API call with automatic error handling
   *
   * @param apiCall - Function that makes the AI API call
   * @param serviceName - Name of the AI service
   * @returns Promise with the API response
   */
  static async wrapApiCall<T>(
    apiCall: () => Promise<T>,
    serviceName: string = 'AI API',
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (error) {
      this.handleApiError(error, serviceName);
    }
  }

  /**
   * Check if an error should trigger a retry
   *
   * @param error - The error to check
   * @returns true if the error is retryable
   */
  static isRetryableError(error: any): boolean {
    if (!error) return false;

    return (
      this.isRateLimitError(error) ||
      this.isServiceUnavailable(error) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND'
    );
  }
}

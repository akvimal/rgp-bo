import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Business Logic Exception
 *
 * Use this exception for business rule violations (e.g., insufficient stock,
 * invalid return quantity, expired items).
 *
 * These exceptions indicate the request was understood but cannot be processed
 * due to business logic constraints.
 */
export class BusinessException extends HttpException {
  constructor(message: string, code?: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        error: 'Business Rule Violation',
        code,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

/**
 * Stock Exception
 *
 * Specific exception for stock-related business logic violations
 */
export class StockException extends BusinessException {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_STOCK');
  }
}

/**
 * Return Exception
 *
 * Specific exception for return/refund-related violations
 */
export class ReturnException extends BusinessException {
  constructor(message: string) {
    super(message, 'INVALID_RETURN');
  }
}

/**
 * Expiry Exception
 *
 * Specific exception for expired product handling
 */
export class ExpiryException extends BusinessException {
  constructor(message: string) {
    super(message, 'PRODUCT_EXPIRED');
  }
}

/**
 * AI API Exception
 *
 * Base exception for AI API-related errors (OCR, LLM, etc.)
 * Use this for external AI service integration errors
 */
export class AiApiException extends HttpException {
  constructor(
    message: string,
    code?: string,
    statusCode: HttpStatus = HttpStatus.BAD_GATEWAY,
    public readonly retryAfter?: number,
  ) {
    super(
      {
        statusCode,
        message,
        error: 'AI API Error',
        code,
        retryAfter,
      },
      statusCode,
    );
  }
}

/**
 * Rate Limit Exception
 *
 * Thrown when AI API rate limit is exceeded
 * Includes retry-after information when available
 */
export class RateLimitException extends AiApiException {
  constructor(message?: string, retryAfterSeconds?: number) {
    const defaultMessage = retryAfterSeconds
      ? `Rate limit exceeded. Please retry after ${retryAfterSeconds} seconds.`
      : 'Rate limit exceeded. Please try again later.';

    super(
      message || defaultMessage,
      'RATE_LIMIT_EXCEEDED',
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfterSeconds,
    );
  }
}

/**
 * AI Service Unavailable Exception
 *
 * Thrown when AI service is temporarily unavailable
 */
export class AiServiceUnavailableException extends AiApiException {
  constructor(serviceName: string = 'AI service') {
    super(
      `${serviceName} is temporarily unavailable. Please try again later.`,
      'AI_SERVICE_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * Token Limit Exception
 *
 * Thrown when AI API token/quota limit is exceeded
 */
export class TokenLimitException extends AiApiException {
  constructor(message?: string) {
    super(
      message || 'Token or quota limit exceeded for AI API.',
      'TOKEN_LIMIT_EXCEEDED',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/**
 * Invalid API Key Exception
 *
 * Thrown when AI API key is invalid or expired
 */
export class InvalidApiKeyException extends AiApiException {
  constructor(serviceName: string = 'AI service') {
    super(
      `Invalid or expired API key for ${serviceName}. Please check configuration.`,
      'INVALID_API_KEY',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

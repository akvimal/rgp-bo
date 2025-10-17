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

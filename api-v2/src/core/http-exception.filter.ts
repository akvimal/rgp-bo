import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Global HTTP Exception Filter
 *
 * Catches all exceptions and transforms them into a consistent error response format.
 * Provides proper logging and sanitizes error messages to prevent information leakage.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status code
    const status = this.getHttpStatus(exception);

    // Build error response
    const errorResponse = this.buildErrorResponse(exception, request, status);

    // Log the error (with full details for server logs)
    this.logError(exception, request, status);

    // Send sanitized response to client
    response.status(status).json(errorResponse);
  }

  /**
   * Determine the appropriate HTTP status code
   */
  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof QueryFailedError) {
      // Database errors typically mean bad request or conflict
      return this.getDatabaseErrorStatus(exception);
    }

    // Default to 500 Internal Server Error
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Map database error codes to HTTP status codes
   */
  private getDatabaseErrorStatus(error: QueryFailedError): number {
    const driverError = (error as any).driverError;

    if (!driverError || !driverError.code) {
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // PostgreSQL error codes
    // https://www.postgresql.org/docs/current/errcodes-appendix.html
    const errorCode = driverError.code;

    switch (errorCode) {
      case '23505': // unique_violation
        return HttpStatus.CONFLICT;
      case '23503': // foreign_key_violation
        return HttpStatus.BAD_REQUEST;
      case '23502': // not_null_violation
        return HttpStatus.BAD_REQUEST;
      case '23514': // check_violation
        return HttpStatus.BAD_REQUEST;
      case '22P02': // invalid_text_representation
        return HttpStatus.BAD_REQUEST;
      case '42P01': // undefined_table
        return HttpStatus.INTERNAL_SERVER_ERROR;
      case '42703': // undefined_column
        return HttpStatus.INTERNAL_SERVER_ERROR;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Build a sanitized error response for the client
   */
  private buildErrorResponse(
    exception: unknown,
    request: Request,
    status: number,
  ): object {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // Base response structure
    const response = {
      statusCode: status,
      timestamp,
      path,
      method,
      message: 'An error occurred',
      error: this.getErrorName(status),
    };

    // Add message and details based on exception type
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        response.message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        Object.assign(response, exceptionResponse);
      }
    } else if (exception instanceof QueryFailedError) {
      response.message = this.getSanitizedDatabaseError(exception);
    } else if (exception instanceof Error) {
      // Generic error - sanitize message
      response.message = this.sanitizeErrorMessage(exception.message);
    }

    return response;
  }

  /**
   * Get a sanitized database error message
   * Prevents leaking of sensitive schema information
   */
  private getSanitizedDatabaseError(error: QueryFailedError): string {
    const driverError = (error as any).driverError;

    if (!driverError) {
      return 'Database operation failed';
    }

    const errorCode = driverError.code;
    const constraint = driverError.constraint;

    switch (errorCode) {
      case '23505':
        return constraint
          ? `Duplicate value: ${this.sanitizeConstraintName(constraint)}`
          : 'Duplicate value detected';
      case '23503':
        return 'Referenced record not found or is in use';
      case '23502':
        return 'Required field is missing';
      case '23514':
        return 'Invalid value: constraint violation';
      case '22P02':
        return 'Invalid data format';
      case '40001':
        return 'Concurrent modification detected. Please try again.';
      case '40P01':
        return 'Deadlock detected. Please try again.';
      default:
        if (driverError.severity === 'ERROR') {
          return 'Database operation failed. Please check your input.';
        }
        return 'An unexpected database error occurred';
    }
  }

  /**
   * Sanitize constraint names to make them user-friendly
   */
  private sanitizeConstraintName(constraint: string): string {
    // Remove table prefixes and make readable
    // e.g., "sale_bill_no_unique" -> "bill number"
    return constraint
      .replace(/_unique$/i, '')
      .replace(/_key$/i, '')
      .replace(/^[a-z]+_/i, '')
      .replace(/_/g, ' ')
      .toLowerCase();
  }

  /**
   * Sanitize error messages to prevent information leakage
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove stack traces
    const cleanMessage = message.split('\n')[0];

    // Remove file paths and line numbers
    return cleanMessage
      .replace(/\s+at\s+.*/g, '')
      .replace(/\/[^\s]+:\d+:\d+/g, '')
      .replace(/\([^)]+\.ts:\d+:\d+\)/g, '');
  }

  /**
   * Get error name from status code
   */
  private getErrorName(status: number): string {
    const errorNames = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return errorNames[status] || 'Error';
  }

  /**
   * Log error with full details for debugging
   */
  private logError(exception: unknown, request: Request, status: number) {
    const { method, url, body, query, params, headers } = request;

    const logContext = {
      method,
      url,
      body: this.sanitizeLogData(body),
      query,
      params,
      userAgent: headers['user-agent'],
      ip: request.ip,
    };

    // Log at appropriate level
    if (status >= 500) {
      // Server errors - full details
      this.logger.error(
        `[${method}] ${url} - ${status}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
        JSON.stringify(logContext, null, 2),
      );
    } else if (status >= 400) {
      // Client errors - warning level
      this.logger.warn(
        `[${method}] ${url} - ${status}`,
        exception instanceof Error ? exception.message : JSON.stringify(exception),
        JSON.stringify(logContext, null, 2),
      );
    } else {
      // Informational
      this.logger.log(`[${method}] ${url} - ${status}`);
    }
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    const sanitized = { ...data };

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}

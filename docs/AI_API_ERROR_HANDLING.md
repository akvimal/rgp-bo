# AI API Error Handling Guide

**Date**: 2025-12-05
**Status**: Implemented
**Location**: `api-v2/src/core/exceptions/`

---

## Overview

This guide documents the AI API error handling infrastructure for external AI service integrations (OCR, LLM, etc.). The system provides:

- ✅ Standardized exception classes for AI API errors
- ✅ Automatic rate limit detection and retry-after headers
- ✅ User-friendly error messages
- ✅ Comprehensive logging
- ✅ HTTP status code mapping
- ✅ Helper utilities for error detection

---

## Exception Classes

### Base Exception: `AiApiException`

Base class for all AI API-related errors.

```typescript
import { AiApiException } from '@core/exceptions/business.exception';

throw new AiApiException(
  'AI service request failed',
  'AI_API_ERROR',
  HttpStatus.BAD_GATEWAY,
  60 // optional retry-after in seconds
);
```

**Parameters**:
- `message`: User-friendly error message
- `code`: Machine-readable error code
- `statusCode`: HTTP status code (default: 502 Bad Gateway)
- `retryAfter`: Optional seconds until retry allowed

---

### Rate Limit Exception: `RateLimitException`

Thrown when AI API rate limit is exceeded. Automatically adds `Retry-After` header.

```typescript
import { RateLimitException } from '@core/exceptions/business.exception';

// With retry-after
throw new RateLimitException(
  'OpenAI rate limit exceeded',
  60 // retry after 60 seconds
);

// Without retry-after (uses default)
throw new RateLimitException();
```

**HTTP Status**: `429 Too Many Requests`
**Error Code**: `RATE_LIMIT_EXCEEDED`
**Response Headers**: `Retry-After: <seconds>`

**Response Example**:
```json
{
  "statusCode": 429,
  "timestamp": "2025-12-05T10:30:00.000Z",
  "path": "/purchases/ocr/process",
  "method": "POST",
  "message": "Rate limit exceeded. Please retry after 60 seconds.",
  "error": "Too Many Requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

### Service Unavailable Exception: `AiServiceUnavailableException`

Thrown when AI service is temporarily unavailable.

```typescript
import { AiServiceUnavailableException } from '@core/exceptions/business.exception';

throw new AiServiceUnavailableException('OpenAI');
// Message: "OpenAI is temporarily unavailable. Please try again later."
```

**HTTP Status**: `503 Service Unavailable`
**Error Code**: `AI_SERVICE_UNAVAILABLE`

---

### Token Limit Exception: `TokenLimitException`

Thrown when AI API token or quota limit is exceeded.

```typescript
import { TokenLimitException } from '@core/exceptions/business.exception';

throw new TokenLimitException('OpenAI monthly quota exceeded');
```

**HTTP Status**: `402 Payment Required`
**Error Code**: `TOKEN_LIMIT_EXCEEDED`

---

### Invalid API Key Exception: `InvalidApiKeyException`

Thrown when AI API key is invalid or expired.

```typescript
import { InvalidApiKeyException } from '@core/exceptions/business.exception';

throw new InvalidApiKeyException('OpenAI');
// Message: "Invalid or expired API key for OpenAI. Please check configuration."
```

**HTTP Status**: `401 Unauthorized`
**Error Code**: `INVALID_API_KEY`

---

## AI API Error Handler Helper

The `AiApiErrorHandler` utility class provides automatic error detection and conversion.

### Basic Usage

```typescript
import { AiApiErrorHandler } from '@core/exceptions/ai-api.helper';

async function callOpenAI() {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    return response;
  } catch (error) {
    // Automatically detects error type and throws appropriate exception
    AiApiErrorHandler.handleApiError(error, 'OpenAI');
  }
}
```

### Automatic Error Detection

The helper automatically detects:

**Rate Limit Errors**:
- HTTP 429 status
- Error code: `rate_limit_exceeded`
- Message contains: "rate limit", "too many requests"

**Authentication Errors**:
- HTTP 401, 403 status
- Error code: `invalid_api_key`, `authentication_error`
- Message contains: "invalid api key", "unauthorized"

**Quota Errors**:
- HTTP 402 status
- Error code: `insufficient_quota`, `quota_exceeded`
- Message contains: "quota", "billing"

**Service Unavailable**:
- HTTP 502, 503, 504 status
- Message contains: "service unavailable", "gateway timeout"

### Wrapped API Calls

Automatically wrap AI API calls with error handling:

```typescript
import { AiApiErrorHandler } from '@core/exceptions/ai-api.helper';

const result = await AiApiErrorHandler.wrapApiCall(
  async () => {
    return await openai.chat.completions.create({...});
  },
  'OpenAI'
);
```

### Retry Logic

Check if an error is retryable:

```typescript
import { AiApiErrorHandler } from '@core/exceptions/ai-api.helper';

try {
  await callAiService();
} catch (error) {
  if (AiApiErrorHandler.isRetryableError(error)) {
    // Implement retry logic
    await wait(60000); // Wait 60 seconds
    return await callAiService(); // Retry
  }
  throw error;
}
```

**Retryable Errors**:
- Rate limit errors (429)
- Service unavailable (502, 503, 504)
- Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND)

---

## Complete Service Example

Example OCR service with comprehensive error handling:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AiApiErrorHandler } from '@core/exceptions/ai-api.helper';
import { RateLimitException } from '@core/exceptions/business.exception';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OCR_API_KEY');
    this.apiUrl = this.configService.get<string>('OCR_API_URL');
  }

  /**
   * Process document with OCR using automatic error handling
   */
  async processDocument(fileBuffer: Buffer, documentType: string): Promise<any> {
    return await AiApiErrorHandler.wrapApiCall(async () => {
      const response = await axios.post(
        `${this.apiUrl}/process`,
        {
          file: fileBuffer.toString('base64'),
          document_type: documentType,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return response.data;
    }, 'OCR Service');
  }

  /**
   * Process document with manual error handling and retry logic
   */
  async processDocumentWithRetry(
    fileBuffer: Buffer,
    documentType: string,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.processDocument(fileBuffer, documentType);
      } catch (error) {
        lastError = error;

        this.logger.warn(
          `OCR processing attempt ${attempt}/${maxRetries} failed`,
          error.message
        );

        // Check if error is retryable
        if (!AiApiErrorHandler.isRetryableError(error)) {
          // Not retryable, throw immediately
          throw error;
        }

        // Extract retry delay from rate limit exception
        if (error instanceof RateLimitException && error.retryAfter) {
          const delayMs = error.retryAfter * 1000;
          this.logger.log(`Waiting ${error.retryAfter}s before retry...`);
          await this.delay(delayMs);
        } else if (attempt < maxRetries) {
          // Exponential backoff for other retryable errors
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000);
          this.logger.log(`Waiting ${delayMs}ms before retry...`);
          await this.delay(delayMs);
        }
      }
    }

    // All retries exhausted
    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Frontend Integration

### Handling AI API Errors in Angular

```typescript
import { HttpErrorResponse } from '@angular/common/http';

processDocument(file: File) {
  this.ocrService.processDocument(file).subscribe({
    next: (result) => {
      this.showSuccess('Document processed successfully');
    },
    error: (error: HttpErrorResponse) => {
      if (error.status === 429) {
        // Rate limit error
        const retryAfter = error.error.retryAfter || 60;
        this.showError(
          `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
        );
      } else if (error.status === 503) {
        // Service unavailable
        this.showError(
          'OCR service is temporarily unavailable. Please try again later.'
        );
      } else if (error.status === 402) {
        // Quota exceeded
        this.showError(
          'OCR quota exceeded. Please contact support.'
        );
      } else if (error.status === 401) {
        // Invalid API key
        this.showError(
          'Authentication failed. Please contact support.'
        );
      } else {
        // Generic error
        this.showError(error.error.message || 'Processing failed');
      }
    }
  });
}
```

---

## Configuration

### Environment Variables

Add to `.env`:

```env
# OCR Service
OCR_API_KEY=your_ocr_api_key_here
OCR_API_URL=https://api.ocrservice.com/v1

# OpenAI (if using)
OPENAI_API_KEY=sk-your_openai_key_here
OPENAI_ORG_ID=org-your_org_id_here

# Rate Limiting
AI_API_MAX_RETRIES=3
AI_API_RETRY_DELAY_MS=1000
```

---

## Best Practices

### 1. Always Specify Service Name

```typescript
// Good
AiApiErrorHandler.handleApiError(error, 'OpenAI');

// Bad
AiApiErrorHandler.handleApiError(error);
```

### 2. Implement Retry Logic for Critical Operations

```typescript
// Use wrapApiCall with retry for important operations
async function criticalOcrProcess(file: Buffer) {
  return await AiApiErrorHandler.wrapApiCall(
    async () => await processWithRetry(file),
    'OCR Service'
  );
}
```

### 3. Log AI API Errors

```typescript
catch (error) {
  this.logger.error('OpenAI request failed', error.stack);
  AiApiErrorHandler.handleApiError(error, 'OpenAI');
}
```

### 4. Handle Rate Limits Gracefully

```typescript
catch (error) {
  if (error instanceof RateLimitException) {
    // Queue request for later processing
    await this.queueService.addToQueue(request, error.retryAfter);
    return { status: 'queued', retryAfter: error.retryAfter };
  }
  throw error;
}
```

### 5. Monitor AI API Usage

```typescript
@Injectable()
export class AiApiMonitoringService {
  async trackApiCall(service: string, success: boolean, duration: number) {
    // Log to monitoring system
    await this.metricsService.track({
      service,
      success,
      duration,
      timestamp: new Date(),
    });
  }
}
```

---

## Testing

### Unit Test Example

```typescript
import { Test } from '@nestjs/testing';
import { OcrService } from './ocr.service';
import { RateLimitException } from '@core/exceptions/business.exception';

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OcrService],
    }).compile();

    service = module.get<OcrService>(OcrService);
  });

  it('should throw RateLimitException on 429 error', async () => {
    // Mock axios to return 429
    jest.spyOn(axios, 'post').mockRejectedValue({
      response: { status: 429 },
      message: 'Too Many Requests',
    });

    await expect(
      service.processDocument(Buffer.from('test'), 'invoice')
    ).rejects.toThrow(RateLimitException);
  });

  it('should include retry-after in rate limit exception', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue({
      response: {
        status: 429,
        headers: { 'retry-after': '120' },
      },
    });

    try {
      await service.processDocument(Buffer.from('test'), 'invoice');
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitException);
      expect(error.retryAfter).toBe(120);
    }
  });
});
```

---

## Troubleshooting

### Issue: Rate Limit Exceptions Not Being Caught

**Cause**: Error structure doesn't match detection patterns

**Solution**: Add custom error detection:

```typescript
// Check your AI service's error structure
console.log('Error structure:', JSON.stringify(error, null, 2));

// Add custom detection if needed
if (error.customField === 'rate_limited') {
  throw new RateLimitException('Custom rate limit message', 60);
}
```

### Issue: Retry-After Header Not Appearing

**Cause**: Exception not including retryAfter property

**Solution**: Ensure you're passing retryAfter to the exception:

```typescript
const retryAfter = error.response?.headers?.['retry-after'];
throw new RateLimitException('Rate limited', parseInt(retryAfter) || 60);
```

### Issue: Frontend Not Receiving Retry-After

**Cause**: CORS headers not configured

**Solution**: Add to main.ts:

```typescript
app.enableCors({
  exposedHeaders: ['Retry-After'],
});
```

---

## Summary

✅ **5 Custom Exception Classes** for AI API errors
✅ **Automatic Error Detection** for rate limits, auth, quota, service availability
✅ **Retry-After Header** automatically set for rate limit and service unavailable errors
✅ **Helper Utilities** for wrapping API calls and detecting retryable errors
✅ **Comprehensive Logging** with error details and stack traces
✅ **User-Friendly Messages** with sanitized error information

**Related Files**:
- `api-v2/src/core/exceptions/business.exception.ts` - Exception classes
- `api-v2/src/core/exceptions/ai-api.helper.ts` - Error handler helper
- `api-v2/src/core/http-exception.filter.ts` - Global exception filter

**Last Updated**: 2025-12-05

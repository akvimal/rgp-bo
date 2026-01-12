# Invoice Document Upload & OCR Extraction Feature

## Overview

This feature allows users to upload invoice documents (PDF or images) and automatically extract key invoice details using AI/OCR technology to populate the invoice form. This significantly reduces manual data entry and improves accuracy.

## Features Implemented

### 1. Backend Infrastructure

#### Service Layer (`api-v2/src/modules/app/purchases/invoice-document.service.ts`)
- **InvoiceDocumentService**: Handles document uploads, OCR processing, and data extraction
- Key methods:
  - `create()`: Create invoice document record
  - `extractInvoiceData()`: Trigger OCR extraction
  - `performOcrExtraction()`: Placeholder for AI integration
  - `autoPopulateFromExtractedData()`: Auto-populate invoice from extracted data
  - `updateOcrStatus()`: Update OCR processing status
  - `markForReview()`: Flag documents for manual review

#### Controller Layer (`api-v2/src/modules/app/purchases/invoice-document.controller.ts`)
- **InvoiceDocumentController**: REST API endpoints for document management
- Endpoints:
  - `POST /purchases/documents/upload`: Upload document for new invoice
  - `POST /purchases/invoices/:id/documents/upload`: Upload document for existing invoice
  - `GET /purchases/invoices/:id/documents`: Get all documents for invoice
  - `GET /purchases/documents/:id`: Get document details
  - `GET /purchases/documents/:id/extraction`: Get extraction preview
  - `POST /purchases/documents/:id/extract`: Retry extraction
  - `DELETE /purchases/documents/:id`: Delete document

#### Entities & DTOs
- **PurchaseInvoiceDocument** entity (already exists)
- **CreateInvoiceDocumentDto**: Document creation
- **UpdateOcrStatusDto**: OCR status updates
- **UpdateAutoPopulateDto**: Auto-populate tracking
- **Enums**: OcrStatus, AutoPopulateStatus, InvoiceDocumentType

### 2. Frontend Components

#### Upload Component (`frontend/src/app/secured/purchases/invoices/components/`)
- **invoice-document-upload.component.html**: UI for drag-and-drop upload
- **invoice-document-upload.component.ts**: Upload logic and extraction handling
- Features:
  - Drag and drop file upload
  - File type validation (PDF, JPG, PNG)
  - File size validation (10MB max)
  - Progress indicator during upload
  - Extracted data preview and editing
  - Confidence score display
  - Populate form button

#### Integration
- **invoice-form.component.html**: Upload component integrated into invoice form
- **invoice-form.component.ts**: Handler for extracted data (`handleExtractedData()`)
- **invoices.service.ts**: HTTP methods for upload API calls
- **purchases.module.ts**: Component registration

### 3. Database Schema

Already exists in `purchase_invoice_document` table:
- OCR status tracking
- Extracted data (JSONB)
- Confidence scores
- Auto-populate status
- Manual review flags
- Field mapping
- Document type classification

## How It Works

### User Workflow

1. **Upload Document**
   - User creates a new invoice
   - Drag and drop or select invoice PDF/image
   - System validates file type and size

2. **AI Extraction**
   - Document uploaded to server
   - AI/OCR service extracts key fields:
     - Invoice number
     - Invoice date
     - Vendor name/GSTIN
     - GR number
     - Line items (if available)
     - Amounts (subtotal, tax, total)

3. **Review & Edit**
   - Extracted data displayed for review
   - User can edit any fields
   - Confidence score shown

4. **Populate Form**
   - Click "Populate Form" button
   - Invoice form auto-filled with extracted data
   - Vendor auto-matched if found in system
   - User completes any missing fields
   - Save invoice

5. **Document Tracking**
   - Document linked to invoice
   - OCR status tracked (PENDING, PROCESSING, COMPLETED, FAILED)
   - Can retry extraction if needed
   - Can mark for manual review

## AI Service Integration

### Current Status

The service includes a **placeholder** OCR extraction method. To enable actual AI extraction, you need to integrate one of the following services:

### Option 1: OpenAI GPT-4 Vision

```typescript
// In invoice-document.service.ts, update performOcrExtraction()

import { Configuration, OpenAIApi } from 'openai';
import * as fs from 'fs';

private async performOcrExtraction(filepath: string, docType: string): Promise<any> {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  // Read file as base64
  const imageBuffer = fs.readFileSync(filepath);
  const base64Image = imageBuffer.toString('base64');

  const prompt = `
Extract invoice data from this document. Return a JSON object with:
{
  "confidence": <0-100>,
  "invoice": {
    "invoiceNumber": "string",
    "invoiceDate": "YYYY-MM-DD",
    "vendorName": "string",
    "vendorGstin": "string",
    "grNumber": "string",
    "totalAmount": number,
    "taxAmount": number,
    "subtotal": number
  },
  "items": [
    {
      "productName": "string",
      "batch": "string",
      "quantity": number,
      "rate": number,
      "mrp": number,
      "taxPercent": number,
      "total": number
    }
  ]
}
  `;

  const response = await AiApiErrorHandler.wrapApiCall(
    () => openai.createChatCompletion({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      max_tokens: 1000
    }),
    'OpenAI GPT-4 Vision'
  );

  const content = response.data.choices[0].message.content;
  return JSON.parse(content);
}
```

**Setup:**
```bash
npm install openai
```

Add to `.env`:
```
OPENAI_API_KEY=sk-your-api-key-here
```

### Option 2: Anthropic Claude Vision

```typescript
// In invoice-document.service.ts, update performOcrExtraction()

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

private async performOcrExtraction(filepath: string, docType: string): Promise<any> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Read file as base64
  const imageBuffer = fs.readFileSync(filepath);
  const base64Image = imageBuffer.toString('base64');
  const mediaType = filepath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

  const prompt = `
Extract invoice data from this document. Return ONLY a JSON object with:
{
  "confidence": <0-100>,
  "invoice": {
    "invoiceNumber": "string",
    "invoiceDate": "YYYY-MM-DD",
    "vendorName": "string",
    "vendorGstin": "string",
    "grNumber": "string",
    "totalAmount": number,
    "taxAmount": number,
    "subtotal": number
  },
  "items": [...]
}
  `;

  const message = await AiApiErrorHandler.wrapApiCall(
    () => anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    }),
    'Anthropic Claude Vision'
  );

  const content = message.content[0].text;
  return JSON.parse(content);
}
```

**Setup:**
```bash
npm install @anthropic-ai/sdk
```

Add to `.env`:
```
ANTHROPIC_API_KEY=your-api-key-here
```

### Option 3: OCR.space (Free OCR API)

```typescript
// In invoice-document.service.ts, update performOcrExtraction()

import axios from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';

private async performOcrExtraction(filepath: string, docType: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filepath));
  formData.append('apikey', process.env.OCR_SPACE_API_KEY);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');

  const response = await AiApiErrorHandler.wrapApiCall(
    () => axios.post('https://api.ocr.space/parse/image', formData, {
      headers: formData.getHeaders()
    }),
    'OCR.space'
  );

  const ocrText = response.data.ParsedResults[0].ParsedText;

  // Parse OCR text to extract invoice data
  // This requires custom parsing logic based on text patterns
  return this.parseInvoiceText(ocrText);
}

private parseInvoiceText(text: string): any {
  // Custom logic to extract invoice fields from OCR text
  // Use regex patterns to find invoice number, date, amounts, etc.
  // This is a simplified example:

  const invoiceNumberMatch = text.match(/Invoice\s*(?:No|Number|#)?\s*:?\s*([A-Z0-9-]+)/i);
  const dateMatch = text.match(/Date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  const totalMatch = text.match(/Total\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);

  return {
    confidence: 70, // Lower confidence for OCR.space
    invoice: {
      invoiceNumber: invoiceNumberMatch ? invoiceNumberMatch[1] : null,
      invoiceDate: dateMatch ? this.parseDate(dateMatch[1]) : null,
      totalAmount: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : null,
      vendorName: null, // Would need more sophisticated parsing
    },
    items: [],
    notes: ['OCR extraction used. Please verify all fields carefully.']
  };
}
```

**Setup:**
Get free API key from https://ocr.space/ocrapi

Add to `.env`:
```
OCR_SPACE_API_KEY=your-api-key-here
```

## Configuration

### Environment Variables

Add to `api-v2/.env`:

```env
# AI Service Configuration (choose one)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=...
# OR
OCR_SPACE_API_KEY=...

# File Upload Configuration
FILEUPLOAD_LOCATION=./uploads
MAX_FILE_SIZE=10485760  # 10MB in bytes
```

### Dependencies

Install required packages:

```bash
cd api-v2

# For OpenAI
npm install openai

# OR for Anthropic Claude
npm install @anthropic-ai/sdk

# OR for OCR.space
npm install axios form-data

# For all (if not already installed)
npm install multer @types/multer
```

## Testing

### Manual Testing

1. **Start the application**
   ```bash
   docker-compose up -d
   ```

2. **Create new invoice**
   - Navigate to Purchases > Invoices > New
   - Scroll down to "Upload Invoice Document" section

3. **Upload a test invoice**
   - Drag and drop or select a test invoice PDF/image
   - Click "Extract Data"
   - Review extracted data
   - Edit any incorrect fields
   - Click "Populate Form"
   - Complete and save invoice

### API Testing (Postman)

```bash
# 1. Upload document for new invoice
POST http://localhost:3000/purchases/documents/upload
Headers:
  Authorization: Bearer <token>
  Content-Type: multipart/form-data
Body:
  file: <invoice.pdf>
  doctype: INVOICE_SCAN

# 2. Get extraction result
GET http://localhost:3000/purchases/documents/{documentId}/extraction
Headers:
  Authorization: Bearer <token>

# 3. Retry extraction if needed
POST http://localhost:3000/purchases/documents/{documentId}/extract
Headers:
  Authorization: Bearer <token>
```

## Error Handling

The system includes comprehensive error handling:

- **File validation errors**: Type and size validation
- **AI API errors**: Rate limits, authentication, service unavailable
- **OCR failures**: Marked with FAILED status, can retry
- **Low confidence**: Automatically flagged for manual review

All AI API errors use the `AiApiErrorHandler` which:
- Maps AI service errors to HTTP status codes
- Provides retry information
- Sanitizes error messages for users
- Logs full details server-side

## Security Considerations

1. **File Upload Security**
   - File type whitelist (PDF, JPG, PNG only)
   - File size limits (10MB)
   - Virus scanning recommended (not implemented)
   - Secure file storage with proper permissions

2. **API Keys**
   - Store in environment variables
   - Never commit to version control
   - Rotate regularly
   - Use separate keys for dev/prod

3. **Data Privacy**
   - Invoice data may contain sensitive information
   - Ensure AI service provider compliance
   - Consider on-premise OCR for highly sensitive data

## Future Enhancements

1. **Background Processing**
   - Queue-based OCR processing (Bull, Redis)
   - Webhook notifications when complete
   - Batch processing

2. **Enhanced AI Integration**
   - Support for multiple AI providers
   - Fallback between providers
   - Custom trained models for better accuracy

3. **Line Item Extraction**
   - Automatic product matching
   - Batch number detection
   - Expiry date extraction

4. **Document Management**
   - Multiple documents per invoice
   - Document versioning
   - Document comparison
   - Side-by-side view with form

5. **Accuracy Improvements**
   - User feedback loop to improve extraction
   - Machine learning on corrections
   - Vendor-specific extraction templates

6. **Bulk Upload**
   - Upload multiple invoices at once
   - Automatic invoice creation
   - Review queue

## Troubleshooting

### OCR not working
- Check API key is set correctly
- Verify file path is accessible
- Check AI service status
- Review server logs for errors

### Low extraction accuracy
- Ensure document quality is good
- Try different AI provider
- Add custom parsing logic
- Use manual review for complex invoices

### File upload fails
- Check file size (must be < 10MB)
- Verify file type is supported
- Check FILEUPLOAD_LOCATION permissions
- Review multer configuration

## Support

For issues or questions:
1. Check server logs: `docker logs rgp-bo-api-1`
2. Check browser console for frontend errors
3. Review API response in Network tab
4. Enable debug mode for detailed logs

## Summary

This feature provides a complete end-to-end solution for invoice document upload and AI-powered data extraction. The modular design allows easy integration with various AI services (OpenAI, Anthropic, OCR.space) while maintaining robust error handling and user experience.

The placeholder implementation allows development and testing to continue while AI service integration is completed. Simply replace the `performOcrExtraction()` method with your chosen AI provider's code.

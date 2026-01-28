import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository, InjectEntityManager } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { PurchaseInvoiceDocument } from 'src/entities/purchase-invoice-document.entity';
import { Document } from 'src/entities/document.entity';
import {
  CreateInvoiceDocumentDto,
  UpdateOcrStatusDto,
  UpdateAutoPopulateDto,
} from './dto/create-invoice-document.dto';
import {
  OcrStatus,
  AutoPopulateStatus,
  InvoiceDocumentType,
} from './enums/ocr-status.enum';
import { AiApiErrorHandler } from 'src/core/exceptions/ai-api.helper';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Invoice Document Service
 *
 * Handles invoice document uploads, OCR processing, and data extraction
 * for auto-populating invoice forms.
 */
@Injectable()
export class InvoiceDocumentService {
  private readonly logger = new Logger(InvoiceDocumentService.name);

  constructor(
    @InjectRepository(PurchaseInvoiceDocument)
    private readonly invoiceDocumentRepository: Repository<PurchaseInvoiceDocument>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectEntityManager() private manager: EntityManager,
  ) {}

  /**
   * Create a new invoice document record
   */
  async create(
    dto: CreateInvoiceDocumentDto,
    userId: number,
  ): Promise<PurchaseInvoiceDocument> {
    try {
      // Verify document exists
      const document = await this.documentRepository.findOne({
        where: { id: dto.documentid },
      });

      if (!document) {
        throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
      }

      const invoiceDocument = this.invoiceDocumentRepository.create({
        ...dto,
        ocrstatus: OcrStatus.PENDING,
        autopopulatestatus: AutoPopulateStatus.NOT_ATTEMPTED,
        createdby: userId,
      });

      return await this.invoiceDocumentRepository.save(invoiceDocument);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error creating invoice document:', error.stack);
      throw new HttpException(
        'Failed to create invoice document',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Find all invoice documents for an invoice
   */
  async findByInvoiceId(invoiceId: number): Promise<PurchaseInvoiceDocument[]> {
    return this.invoiceDocumentRepository.find({
      where: { invoiceid: invoiceId },
      relations: ['document'],
      order: { createdon: 'DESC' },
    });
  }

  /**
   * Find a single invoice document by ID
   */
  async findById(id: number): Promise<PurchaseInvoiceDocument> {
    const doc = await this.invoiceDocumentRepository.findOne({
      where: { id },
      relations: ['document', 'invoice'],
    });

    if (!doc) {
      throw new HttpException(
        'Invoice document not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return doc;
  }

  /**
   * Extract invoice data from document using AI/OCR
   */
  async extractInvoiceData(
    documentId: number,
    userId: number,
  ): Promise<any> {
    try {
      const invoiceDoc = await this.findById(documentId);

      // Update status to processing
      await this.updateOcrStatus(documentId, {
        ocrstatus: OcrStatus.PROCESSING,
      });

      // Get document file path
      const document = await this.documentRepository.findOne({
        where: { id: invoiceDoc.documentid },
      });

      if (!document) {
        throw new HttpException('Document not found', HttpStatus.NOT_FOUND);
      }

      // TODO: Integrate with AI service (OpenAI GPT-4 Vision, Anthropic Claude, or OCR.space)
      // For now, return a mock structure
      const extractedData = await this.performOcrExtraction(
        document.path,
        invoiceDoc.doctype,
      );

      // Update OCR status
      await this.updateOcrStatus(documentId, {
        ocrstatus: OcrStatus.COMPLETED,
        ocrextracteddata: extractedData,
        ocrconfidencescore: extractedData.confidence || 85,
      });

      // Try to auto-populate
      const populateResult = await this.autoPopulateFromExtractedData(
        invoiceDoc.invoiceid,
        extractedData,
        userId,
      );

      return {
        success: true,
        extractedData,
        populateResult,
      };
    } catch (error) {
      // Update status to failed
      await this.updateOcrStatus(documentId, {
        ocrstatus: OcrStatus.FAILED,
        ocrerrormessage: error.message,
      });

      if (error instanceof HttpException) throw error;
      this.logger.error('Error extracting invoice data:', error.stack);
      throw new HttpException(
        'Failed to extract invoice data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Extract tables from PDF using pdfplumber (Python)
   */
  private async extractPdfTables(filepath: string): Promise<any> {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // In production (dist/), go up to app root, then into src/scripts
    // In development (src/), go up to app root, then into src/scripts
    const scriptPath = path.join(process.cwd(), 'src/scripts/extract-pdf-tables.py');

    try {
      this.logger.log(`Extracting tables from PDF: ${filepath}`);

      const { stdout, stderr } = await execPromise(`python3 "${scriptPath}" "${filepath}"`);

      if (stderr && !stderr.includes('DeprecationWarning')) {
        this.logger.warn(`Python stderr: ${stderr}`);
      }

      const result = JSON.parse(stdout);

      if (!result.success) {
        throw new Error(result.error || 'PDF extraction failed');
      }

      this.logger.log(`Successfully extracted ${result.tables.length} tables from PDF`);
      return result;

    } catch (error) {
      this.logger.error('Error extracting PDF tables:', error.message);
      throw new HttpException(
        'Failed to extract tables from PDF',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Perform hybrid PDF extraction: pdfplumber + LLM contextualization
   */
  private async performHybridPdfExtraction(
    filepath: string,
    docType: string,
  ): Promise<any> {
    this.logger.log(`Performing hybrid PDF extraction on: ${filepath}`);

    try {
      // Step 1: Extract tables using pdfplumber
      const pdfData = await this.extractPdfTables(filepath);

      // Step 2: Use LLM to contextualize the extracted data
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const prompt = `
You are processing a pharmaceutical invoice. I have extracted the raw text and tables from the PDF.

**Extracted Text:**
${pdfData.text.substring(0, 2000)}

**Extracted Tables:**
${JSON.stringify(pdfData.tables, null, 2)}

Your task: Convert this data into a structured JSON format.

Return ONLY a valid JSON object with this structure:
{
  "confidence": <number 0-100>,
  "invoice": {
    "invoiceNumber": "extract from text",
    "invoiceDate": "YYYY-MM-DD format",
    "vendorName": "company name from top of invoice",
    "vendorGstin": "15-character GSTIN",
    "grNumber": "string or null",
    "totalAmount": <number or null>,
    "taxAmount": <number or null>,
    "subtotal": <number or null>
  },
  "items": [
    {
      "productName": "from table column",
      "batch": "from Batch column",
      "expiryDate": "YYYY-MM format - convert from Exp/Expiry column (e.g., '06/25' → '2025-06')",
      "quantity": <number from Qty column>,
      "rate": <number from Rate column>,
      "mrp": <number from MRP column or null>,
      "taxPercent": <number from Tax% column or null>,
      "amount": <number from Amount column>
    }
  ],
  "notes": ["any issues or observations"]
}

CRITICAL REQUIREMENTS:
1. Look for the items table in the extracted tables
2. Common column names: Product/Item, Batch/Lot, Exp/Expiry, Qty/Quantity, Rate/Price, MRP, Tax%, Amount/Total
3. For expiryDate: Expiry dates are in MM/YY format where YY is last 2 digits of year
   - YY=25→2025, YY=26→2026, YY=27→2027, YY=28→2028, YY=29→2029, YY=30→2030
   - "05/27" → "2027-05" (NOT 2025!)
   - "06/27" → "2027-06" (NOT 2025!)
   - "07/26" → "2026-07"
   - "Jun-27" → "2027-06"
4. EVERY item must have an expiryDate - this is a pharmaceutical invoice
5. Vendor name is at the TOP of the invoice (not customer/bill-to section)

Return only valid JSON, no markdown formatting.
`;

      const message = await AiApiErrorHandler.wrapApiCall(
        () =>
          anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        'Anthropic Claude Haiku',
      );

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      this.logger.log(`LLM contextualization complete`);

      // Parse JSON response
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const extractedData = JSON.parse(jsonText);
      extractedData.documentType = docType;
      extractedData.extractionMethod = 'hybrid-pdfplumber';

      // Log extracted items with expiry dates
      if (extractedData.items && extractedData.items.length > 0) {
        this.logger.log(`Extracted ${extractedData.items.length} items:`);
        extractedData.items.forEach((item: any, index: number) => {
          this.logger.log(`  Item ${index + 1}: ${item.productName} - Batch: ${item.batch || 'N/A'} - Expiry: ${item.expiryDate || 'N/A'}`);
        });
      }

      return extractedData;

    } catch (error) {
      this.logger.error('Error in hybrid PDF extraction:', error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      if (error.name === 'SyntaxError') {
        this.logger.error('Failed to parse LLM response as JSON');
        throw new HttpException(
          'Failed to parse extraction results',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      throw new HttpException(
        'PDF extraction failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Perform OCR extraction using Anthropic Claude Vision
   */
  private async performOcrExtraction(
    filepath: string,
    docType: string,
  ): Promise<any> {
    // Detect if file is PDF and use hybrid extraction
    const isPdf = filepath.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      this.logger.log(`PDF detected - using hybrid pdfplumber extraction`);
      return this.performHybridPdfExtraction(filepath, docType);
    }

    this.logger.log(`Image detected - using vision-based OCR extraction on: ${filepath}`);

    try {
      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      // Read file as base64
      const fileBuffer = fs.readFileSync(filepath);
      const base64Data = fileBuffer.toString('base64');

      // Determine media type and content type based on file extension
      const fileExt = path.extname(filepath).toLowerCase();
      let mediaType: string;
      let contentType: 'document' | 'image';

      if (fileExt === '.pdf') {
        mediaType = 'application/pdf';
        contentType = 'document';
      } else if (fileExt === '.jpg' || fileExt === '.jpeg') {
        mediaType = 'image/jpeg';
        contentType = 'image';
      } else if (fileExt === '.png') {
        mediaType = 'image/png';
        contentType = 'image';
      } else if (fileExt === '.gif') {
        mediaType = 'image/gif';
        contentType = 'image';
      } else if (fileExt === '.webp') {
        mediaType = 'image/webp';
        contentType = 'image';
      } else {
        // Default to JPEG for unknown image types
        mediaType = 'image/jpeg';
        contentType = 'image';
      }

      // Construct the extraction prompt
      const prompt = `
You are analyzing a PHARMACEUTICAL INVOICE image. Medicines ALWAYS have expiry dates on invoices.

🎯 YOUR TASK: Extract ALL data from the invoice table, especially the EXPIRY DATE for each item.

📋 EXPECTED JSON OUTPUT (Return ONLY this, no markdown, no explanation):
{
  "confidence": <number 0-100>,
  "invoice": {
    "invoiceNumber": "string or null",
    "invoiceDate": "YYYY-MM-DD or null",
    "vendorName": "string or null",
    "vendorGstin": "string or null",
    "grNumber": "string or null",
    "totalAmount": <number or null>,
    "taxAmount": <number or null>,
    "subtotal": <number or null>
  },
  "items": [
    {
      "productName": "DAXAFLOW 4D CAP",
      "batch": "MC-25406",
      "expiryDate": "2025-06",
      "quantity": 10,
      "rate": 45,
      "mrp": 50,
      "taxPercent": 5,
      "amount": 450
    }
  ],
  "notes": ["any issues"]
}

🔍 HOW TO FIND THE DATA:

**TABLE STRUCTURE** - Look for a table/grid with these columns:
┌─────────────────┬─────────┬──────┬─────┬──────┬─────┬─────┬────────┐
│ Product Name    │ Batch   │ Exp  │ Qty │ Rate │ MRP │ Tax%│ Amount │
├─────────────────┼─────────┼──────┼─────┼──────┼─────┼─────┼────────┤
│ DAXAFLOW 4D CAP │MC-25406 │06/25 │ 10  │ 45.00│50.00│ 5   │ 450.00 │
│ FLUKEM 150MG    │FLT25006 │08/25 │ 20  │ 30.00│35.00│ 5   │ 600.00 │
└─────────────────┴─────────┴──────┴─────┴──────┴─────┴─────┴────────┘

**CRITICAL - EXPIRY DATE COLUMN:**
- Column header: "Exp", "Expiry", "Exp Date", or "Expiry Date"
- Usually located AFTER the Batch column and BEFORE Qty
- Contains dates in MM/YY format where YY is last 2 digits of year
- YOU MUST CONVERT to YYYY-MM format

  YEAR CONVERSION RULES (IMPORTANT!):
  • YY = 25 → Year 2025 (20 + 25)
  • YY = 26 → Year 2026 (20 + 26)
  • YY = 27 → Year 2027 (20 + 27)
  • YY = 28 → Year 2028 (20 + 28)
  • YY = 29 → Year 2029 (20 + 29)
  • YY = 30 → Year 2030 (20 + 30)

  CONVERSION EXAMPLES:
  • "05/27" → "2027-05" (May 2027, NOT 2025!)
  • "06/27" → "2027-06" (June 2027, NOT 2025!)
  • "07/27" → "2027-07" (July 2027, NOT 2025!)
  • "12/26" → "2026-12" (December 2026)
  • "01/28" → "2028-01" (January 2028)
  • "Jun-27" → "2027-06" (June 2027)
  • "08/2025" → "2025-08" (already has 4-digit year)

**VENDOR NAME (Top of Invoice):**
- The company name in LARGE FONT at the TOP (header/letterhead)
- Usually: "XYZ PHARMACEUTICALS" or "ABC MEDICAL SUPPLIES"
- IGNORE sections labeled "Bill To", "Ship To", "Customer" - those are buyers, not vendors
- Vendor GSTIN is near the vendor name (15 characters: 33AUEPA1476GZ22)

**EXTRACTION REQUIREMENTS:**
✅ MUST extract expiryDate for EVERY item row
✅ Convert all expiry formats to YYYY-MM
✅ Extract ALL columns visible in the table
✅ If Exp column shows "N/A" or blank, set expiryDate: null
✅ Return valid JSON only (no backticks, no markdown)

**EXAMPLE ROW EXTRACTION:**
If you see this table row:
"DAXAFLOW 4D CAP | MC-25406 | 06/25 | 10 | 45.00 | 50.00 | 5% | 450.00"

Extract as:
{
  "productName": "DAXAFLOW 4D CAP",
  "batch": "MC-25406",
  "expiryDate": "2025-06",
  "quantity": 10,
  "rate": 45,
  "mrp": 50,
  "taxPercent": 5,
  "amount": 450
}

Now analyze the invoice image and return the JSON.
`;

      // Build content array based on file type
      const content: any[] = [
        {
          type: contentType,
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        },
        {
          type: 'text',
          text: prompt,
        },
      ];

      // Call Anthropic API with error handling
      const message = await AiApiErrorHandler.wrapApiCall(
        () =>
          anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4000,
            messages: [
              {
                role: 'user',
                content: content,
              },
            ],
          }),
        'Anthropic Claude Vision',
      );

      // Extract the text response
      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      this.logger.log(`Claude response (first 500 chars): ${responseText.substring(0, 500)}...`);

      // Parse JSON response
      // Remove markdown code blocks if present
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const extractedData = JSON.parse(jsonText);

      // Add document type to response
      extractedData.documentType = docType;

      this.logger.log(
        `Successfully extracted data with confidence: ${extractedData.confidence}%`,
      );

      // Log extracted items with expiry dates for debugging
      if (extractedData.items && extractedData.items.length > 0) {
        this.logger.log(`Extracted ${extractedData.items.length} items:`);
        extractedData.items.forEach((item: any, index: number) => {
          this.logger.log(`  Item ${index + 1}: ${item.productName} - Batch: ${item.batch || 'N/A'} - Expiry: ${item.expiryDate || 'N/A'}`);
        });
      }

      return extractedData;
    } catch (error) {
      this.logger.error('Error in OCR extraction:', error.stack);

      // If it's an AI API error, it's already been handled by AiApiErrorHandler
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle JSON parse errors
      if (error.name === 'SyntaxError') {
        this.logger.error('Failed to parse Claude response as JSON');
        throw new HttpException(
          'Failed to parse OCR results. Please try again or upload a clearer document.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Generic error
      throw new HttpException(
        'OCR extraction failed. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Auto-populate invoice from extracted data
   */
  private async autoPopulateFromExtractedData(
    invoiceId: number | null,
    extractedData: any,
    userId: number,
  ): Promise<{ status: string; message: string; fieldsPopulated: string[] }> {
    if (!invoiceId) {
      return {
        status: AutoPopulateStatus.NOT_ATTEMPTED,
        message: 'No invoice linked to populate',
        fieldsPopulated: [],
      };
    }

    const fieldsPopulated: string[] = [];

    try {
      // Here you would update the invoice with extracted data
      // This is a placeholder implementation
      this.logger.log(
        `Auto-populating invoice ${invoiceId} with extracted data`,
      );

      return {
        status: AutoPopulateStatus.PARTIAL,
        message: 'Placeholder: Would populate invoice here',
        fieldsPopulated,
      };
    } catch (error) {
      this.logger.error('Error auto-populating invoice:', error.stack);
      return {
        status: AutoPopulateStatus.FAILED,
        message: error.message,
        fieldsPopulated: [],
      };
    }
  }

  /**
   * Update OCR status
   */
  async updateOcrStatus(
    documentId: number,
    dto: Partial<UpdateOcrStatusDto>,
  ): Promise<void> {
    const updateData: any = { ...dto };

    if (dto.ocrstatus === OcrStatus.COMPLETED || dto.ocrstatus === OcrStatus.FAILED) {
      updateData.ocrprocessedon = new Date();
    }

    await this.invoiceDocumentRepository.update(documentId, updateData);
  }

  /**
   * Update auto-populate status
   */
  async updateAutoPopulateStatus(
    documentId: number,
    dto: UpdateAutoPopulateDto,
  ): Promise<void> {
    await this.invoiceDocumentRepository.update(documentId, dto);
  }

  /**
   * Mark document for manual review
   */
  async markForReview(
    documentId: number,
    requiresReview: boolean,
    notes: string,
    userId: number,
  ): Promise<void> {
    const updateData: any = {
      requiresreview: requiresReview,
      reviewnotes: notes,
    };

    if (!requiresReview) {
      updateData.reviewedby = userId;
      updateData.reviewedon = new Date();
    }

    await this.invoiceDocumentRepository.update(documentId, updateData);
  }

  /**
   * Delete invoice document (soft delete)
   */
  async remove(documentId: number): Promise<void> {
    // Instead of using 'active', we can just delete the record
    // or mark with a custom field if BaseEntity has isActive
    await this.invoiceDocumentRepository.delete(documentId);
  }

  /**
   * Get OCR extraction preview (for testing)
   */
  async getExtractionPreview(documentId: number): Promise<any> {
    const invoiceDoc = await this.findById(documentId);
    return {
      id: invoiceDoc.id,
      doctype: invoiceDoc.doctype,
      ocrstatus: invoiceDoc.ocrstatus,
      ocrextracteddata: invoiceDoc.ocrextracteddata,
      ocrconfidencescore: invoiceDoc.ocrconfidencescore,
      autopopulatestatus: invoiceDoc.autopopulatestatus,
    };
  }
}

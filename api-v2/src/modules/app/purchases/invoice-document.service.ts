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
   * Perform OCR extraction using Anthropic Claude Vision
   */
  private async performOcrExtraction(
    filepath: string,
    docType: string,
  ): Promise<any> {
    this.logger.log(`Performing OCR extraction on: ${filepath}`);

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
Extract invoice data from this ${docType === 'DELIVERY_CHALLAN_SCAN' ? 'delivery challan' : 'invoice'} document.

Return ONLY a valid JSON object (no markdown, no explanation) with the following structure:
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
      "productName": "string",
      "batch": "string or null",
      "quantity": <number>,
      "rate": <number>,
      "mrp": <number or null>,
      "taxPercent": <number or null>,
      "amount": <number>
    }
  ],
  "notes": ["any issues or important observations"]
}

CRITICAL - Vendor vs Customer Distinction:
- **Vendor Name**: THIS IS THE COMPANY AT THE VERY TOP OF THE INVOICE (in the header/letterhead). This is the SELLER who is ISSUING the invoice. Look for the business name in the largest font at the top, usually with their address and contact details below it.
- **DO NOT extract the Customer/Bill To/Ship To name** - ignore any section labeled "Customer", "Bill To", "Buyer", "Ship To" etc.
- **Vendor GSTIN**: The GST number will be RIGHT NEXT to or near the vendor's name at the top. It's exactly 15 characters (format: 33AUEPA1476GZ22).
- **Verify**: The vendor name and GSTIN should be in the SAME section at the TOP of the invoice.

Other fields:
- **Invoice Date**: Use YYYY-MM-DD format. Look for "Date", "Invoice Date", "Bill Date" in the invoice details section.
- **Invoice Number**: Look for "Inv No", "Invoice No", "Bill No" - usually has a prefix like SP, INV, etc.
- **Amounts**: Extract only numeric values (no ₹, Rs). Total = Subtotal + Tax Amount.
- **Line Items**: Extract all products with quantities, rates, and amounts from the table.
- **GR Number**: Goods Receipt Number, if present.
- Set any field to null if not found
- Provide confidence score (0-100)
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

      this.logger.log(`Claude response: ${responseText.substring(0, 200)}...`);

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

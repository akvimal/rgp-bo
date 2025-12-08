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
   * Perform OCR extraction (placeholder for AI integration)
   * TODO: Integrate with actual AI service
   */
  private async performOcrExtraction(
    filepath: string,
    docType: string,
  ): Promise<any> {
    // This is a placeholder. In production, you would:
    // 1. Read the file (PDF/Image)
    // 2. Send to AI service (OpenAI, Anthropic, OCR.space, etc.)
    // 3. Parse the response
    // 4. Return structured data

    this.logger.log(`Performing OCR extraction on: ${filepath}`);

    // Mock extracted data structure
    return {
      confidence: 85,
      documentType: docType,
      invoice: {
        invoiceNumber: null,
        invoiceDate: null,
        vendorName: null,
        vendorGstin: null,
        grNumber: null,
        totalAmount: null,
        taxAmount: null,
        subtotal: null,
      },
      items: [],
      notes: [
        'This is a placeholder extraction.',
        'Integrate with OpenAI GPT-4 Vision, Anthropic Claude Vision, or OCR.space for actual extraction.',
      ],
    };
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

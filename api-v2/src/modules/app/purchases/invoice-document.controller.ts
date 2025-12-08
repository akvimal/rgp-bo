import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { InvoiceDocumentService } from './invoice-document.service';
import { DocumentService } from '../documents/document.service';
import {
  CreateInvoiceDocumentDto,
  UpdateOcrStatusDto,
  UpdateAutoPopulateDto,
  MarkForReviewDto,
} from './dto/create-invoice-document.dto';
import { multerOptions } from '../files/multer.config';

@ApiTags('Invoice Documents')
@Controller('purchases/invoices')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class InvoiceDocumentController {
  constructor(
    private readonly invoiceDocumentService: InvoiceDocumentService,
    private readonly documentService: DocumentService,
  ) {}

  /**
   * Upload and attach document to invoice
   */
  @Post(':invoiceId/documents/upload')
  @ApiOperation({ summary: 'Upload document for invoice with OCR extraction' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Document uploaded and OCR initiated',
  })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadDocument(
    @Param('invoiceId') invoiceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('doctype') doctype: string,
    @User() currentUser: any,
  ) {
    // Step 1: Save file to documents table
    const document = await this.documentService.save({
      name: file.originalname,
      path: file.path,
      extn: file.mimetype,
      alias: file.filename,
      category: 'INVOICE',
      docprops: {},
      uploadprops: {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }
    });

    // Step 2: Create invoice document record
    const invoiceDocument = await this.invoiceDocumentService.create(
      {
        invoiceid: parseInt(invoiceId),
        documentid: document.id,
        doctype: (doctype || 'INVOICE_SCAN') as any,
        uploadsource: 'WEB_UPLOAD',
        originalfilename: file.originalname,
      },
      currentUser.id,
    );

    // Step 3: Trigger OCR extraction asynchronously
    // In production, this should be queued for background processing
    setTimeout(async () => {
      try {
        await this.invoiceDocumentService.extractInvoiceData(
          invoiceDocument.id,
          currentUser.id,
        );
      } catch (error) {
        console.error('Background OCR extraction failed:', error);
      }
    }, 100);

    return {
      success: true,
      message: 'Document uploaded successfully. OCR processing started.',
      documentId: invoiceDocument.id,
      fileInfo: {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    };
  }

  /**
   * Upload document without linking to invoice (for new invoices)
   */
  @Post('documents/upload')
  @ApiOperation({
    summary: 'Upload invoice document without linking (creates new invoice)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Document uploaded and data extracted for new invoice',
  })
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadDocumentForNewInvoice(
    @UploadedFile() file: Express.Multer.File,
    @Body('doctype') doctype: string,
    @User() currentUser: any,
  ) {
    // Step 1: Save file to documents table
    const document = await this.documentService.save({
      name: file.originalname,
      path: file.path,
      extn: file.mimetype,
      alias: file.filename,
      category: 'INVOICE',
      docprops: {},
      uploadprops: {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }
    });

    // Step 2: Create invoice document record (without invoice ID)
    const invoiceDocument = await this.invoiceDocumentService.create(
      {
        documentid: document.id,
        doctype: (doctype || 'INVOICE_SCAN') as any,
        uploadsource: 'WEB_UPLOAD',
        originalfilename: file.originalname,
      },
      currentUser.id,
    );

    // Step 3: Extract data immediately
    const extractionResult =
      await this.invoiceDocumentService.extractInvoiceData(
        invoiceDocument.id,
        currentUser.id,
      );

    return {
      success: true,
      message:
        'Document uploaded and processed successfully. Use extracted data to create invoice.',
      documentId: invoiceDocument.id,
      extractedData: extractionResult.extractedData,
      fileInfo: {
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
    };
  }

  /**
   * Get all documents for an invoice
   */
  @Get(':invoiceId/documents')
  @ApiOperation({ summary: 'Get all documents attached to an invoice' })
  @ApiResponse({ status: 200, description: 'List of invoice documents' })
  async getInvoiceDocuments(@Param('invoiceId') invoiceId: string) {
    return this.invoiceDocumentService.findByInvoiceId(parseInt(invoiceId));
  }

  /**
   * Get document details with OCR results
   */
  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Get invoice document details and OCR results' })
  @ApiResponse({
    status: 200,
    description: 'Document details with extraction data',
  })
  async getDocumentDetails(@Param('documentId') documentId: string) {
    return this.invoiceDocumentService.findById(parseInt(documentId));
  }

  /**
   * Get extraction preview for a document
   */
  @Get('documents/:documentId/extraction')
  @ApiOperation({ summary: 'Get OCR extraction preview' })
  @ApiResponse({ status: 200, description: 'Extracted data preview' })
  async getExtractionPreview(@Param('documentId') documentId: string) {
    return this.invoiceDocumentService.getExtractionPreview(
      parseInt(documentId),
    );
  }

  /**
   * Retry OCR extraction
   */
  @Post('documents/:documentId/extract')
  @ApiOperation({ summary: 'Retry OCR extraction on document' })
  @ApiResponse({ status: 200, description: 'OCR extraction completed' })
  async retryExtraction(
    @Param('documentId') documentId: string,
    @User() currentUser: any,
  ) {
    const result = await this.invoiceDocumentService.extractInvoiceData(
      parseInt(documentId),
      currentUser.id,
    );
    return {
      success: true,
      message: 'OCR extraction completed',
      ...result,
    };
  }

  /**
   * Update OCR status
   */
  @Put('documents/:documentId/ocr-status')
  @ApiOperation({ summary: 'Update OCR status' })
  @ApiResponse({ status: 200, description: 'OCR status updated' })
  async updateOcrStatus(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateOcrStatusDto,
  ) {
    await this.invoiceDocumentService.updateOcrStatus(
      parseInt(documentId),
      dto,
    );
    return { success: true, message: 'OCR status updated' };
  }

  /**
   * Update auto-populate status
   */
  @Put('documents/:documentId/auto-populate')
  @ApiOperation({ summary: 'Update auto-populate status' })
  @ApiResponse({ status: 200, description: 'Auto-populate status updated' })
  async updateAutoPopulateStatus(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateAutoPopulateDto,
  ) {
    await this.invoiceDocumentService.updateAutoPopulateStatus(
      parseInt(documentId),
      dto,
    );
    return { success: true, message: 'Auto-populate status updated' };
  }

  /**
   * Mark document for review
   */
  @Put('documents/:documentId/review')
  @ApiOperation({ summary: 'Mark document for manual review' })
  @ApiResponse({ status: 200, description: 'Review status updated' })
  async markForReview(
    @Param('documentId') documentId: string,
    @Body() dto: MarkForReviewDto,
    @User() currentUser: any,
  ) {
    await this.invoiceDocumentService.markForReview(
      parseInt(documentId),
      dto.requiresreview,
      dto.reviewnotes || '',
      currentUser.id,
    );
    return { success: true, message: 'Review status updated' };
  }

  /**
   * Delete invoice document
   */
  @Delete('documents/:documentId')
  @ApiOperation({ summary: 'Delete invoice document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(@Param('documentId') documentId: string) {
    await this.invoiceDocumentService.remove(parseInt(documentId));
    return { success: true, message: 'Document deleted successfully' };
  }
}

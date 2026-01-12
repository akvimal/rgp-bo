import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

@Injectable()
export class ProductOcrService {
  private readonly logger = new Logger(ProductOcrService.name);

  /**
   * Extract text from image using Tesseract OCR
   */
  async extractTextFromImage(imagePath: string): Promise<string> {
    try {
      this.logger.log(`Starting OCR for image: ${imagePath}`);

      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(imagePath);
      await worker.terminate();

      this.logger.log(`OCR completed. Extracted ${text.length} characters`);
      return text;
    } catch (error) {
      this.logger.error(`OCR failed: ${error.message}`, error.stack);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  /**
   * Parse extracted text and map to product fields
   */
  parseProductInfo(text: string): any {
    this.logger.log('Parsing product information from extracted text');

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const productInfo: any = {
      brand: null,
      mfr: null,
      title: null,
      pack: null,
      hsn: null,
      description: null,
      confidence: 'low'
    };

    // Extract HSN Code (typically 4-8 digits)
    const hsnPattern = /\b(\d{4,8})\b/g;
    const hsnMatches = text.match(hsnPattern);
    if (hsnMatches && hsnMatches.length > 0) {
      // Look for HSN specifically mentioned
      const hsnExplicit = text.match(/HSN[:\s]*(\d{4,8})/i);
      if (hsnExplicit) {
        productInfo.hsn = hsnExplicit[1];
      } else {
        // Take the first 4-8 digit number found
        productInfo.hsn = hsnMatches[0];
      }
    }

    // Extract Pack size (e.g., "10's", "Strip of 10", "1x10")
    const packPatterns = [
      /(\d+)['']s/i,                    // 10's
      /strip\s+of\s+(\d+)/i,            // Strip of 10
      /(\d+)\s*x\s*(\d+)/i,             // 1x10
      /pack\s+of\s+(\d+)/i,             // Pack of 10
      /(\d+)\s+tablets?/i,              // 10 tablets
      /(\d+)\s+capsules?/i,             // 10 capsules
    ];

    for (const pattern of packPatterns) {
      const match = text.match(pattern);
      if (match) {
        productInfo.pack = match[1] || '1';
        break;
      }
    }

    // Extract Manufacturer (common patterns)
    const mfrPatterns = [
      /(?:mfr|manufactured by|mfd by)[:\s]+([^\n]+)/i,
      /(?:manufacturer)[:\s]+([^\n]+)/i,
    ];

    for (const pattern of mfrPatterns) {
      const match = text.match(pattern);
      if (match) {
        productInfo.mfr = match[1].trim().substring(0, 100);
        break;
      }
    }

    // Extract Brand (usually the first prominent text or marked as Brand)
    const brandPattern = /(?:brand)[:\s]+([^\n]+)/i;
    const brandMatch = text.match(brandPattern);
    if (brandMatch) {
      productInfo.brand = brandMatch[1].trim().substring(0, 50);
    } else if (lines.length > 0) {
      // Take first line as potential brand if no explicit brand found
      productInfo.brand = lines[0].substring(0, 50);
    }

    // Generate title from available information
    const titleParts: string[] = [];
    if (productInfo.brand) titleParts.push(productInfo.brand);

    // Look for composition/formulation
    const compositionPattern = /(?:composition|contains)[:\s]+([^\n]+)/i;
    const compositionMatch = text.match(compositionPattern);
    if (compositionMatch) {
      titleParts.push(compositionMatch[1].trim());
    }

    if (titleParts.length > 0) {
      productInfo.title = titleParts.join(' - ').substring(0, 200);
    } else if (lines.length > 0) {
      productInfo.title = lines[0].substring(0, 200);
    }

    // Extract Description (take first few lines or marked description)
    const descLines = lines.slice(0, 3).join(' ');
    productInfo.description = descLines.substring(0, 500);

    // Determine confidence level based on how many fields were found
    const filledFields = Object.values(productInfo).filter(v => v !== null && v !== 'low').length;
    if (filledFields >= 4) {
      productInfo.confidence = 'high';
    } else if (filledFields >= 2) {
      productInfo.confidence = 'medium';
    }

    this.logger.log(`Parsed product info with ${productInfo.confidence} confidence: ${JSON.stringify(productInfo)}`);

    return productInfo;
  }

  /**
   * Process image and return parsed product information
   */
  async processProductImage(imagePath: string): Promise<any> {
    try {
      // Extract text from image
      const extractedText = await this.extractTextFromImage(imagePath);

      // Parse text to product fields
      const productInfo = this.parseProductInfo(extractedText);

      return {
        success: true,
        extractedText,
        productInfo,
        message: `Product information extracted with ${productInfo.confidence} confidence`
      };
    } catch (error) {
      this.logger.error(`Failed to process product image: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        message: 'Failed to extract product information from image'
      };
    }
  }
}

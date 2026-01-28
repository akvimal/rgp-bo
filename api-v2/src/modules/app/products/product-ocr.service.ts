import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import Anthropic from '@anthropic-ai/sdk';
import { AiApiErrorHandler } from 'src/core/exceptions/ai-api.helper';

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
   * Use Claude AI to contextualize and extract structured product info from raw OCR text
   */
  async enhanceWithLLM(rawOcrText: string): Promise<any> {
    try {
      this.logger.log('Using Claude AI to contextualize OCR text');

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const prompt = `
You are extracting product information from OCR text of a medicine/product label or packaging.
The OCR text may be messy, have formatting issues, or contain multiple sections.

**Raw OCR Text:**
${rawOcrText}

Your task: Extract and structure the product information into a clean JSON format.

Return ONLY a valid JSON object with this exact structure:
{
  "confidence": <number 0-100 based on data quality>,
  "product": {
    "brand": "Brand name if available",
    "manufacturer": "Manufacturer/company name (Mfg./Marketed by)",
    "title": "Full product title/name",
    "packSize": "Pack size (e.g., '10', '1x10', 'Strip of 10')",
    "hsnCode": "HSN code if found (4-8 digits)",
    "composition": "Main active ingredients/composition",
    "description": "Brief product description",
    "ingredients": ["list of key ingredients with quantities"],
    "productType": "Type (e.g., 'Tablet', 'Capsule', 'Syrup', 'Supplement')"
  },
  "notes": ["any observations or unclear data points"]
}

CRITICAL REQUIREMENTS:
1. Brand: Usually the most prominent text, or marked as "Brand"
2. Manufacturer: Look for "Mfg.", "Manufactured by", "Marketed by", or company name with address
3. Title: Combine brand + formulation/composition for full product name
4. Pack Size: Look for patterns like "10's", "Strip of 10", "1x10", "Pack of 10"
5. HSN Code: Usually 4-8 digits, may be labeled as "HSN" or "HSN Code"
6. Composition: Main active ingredients (e.g., "Vitamin C 500mg, Zinc 15mg")
7. Product Type: Tablet, Capsule, Syrup, Powder, Injection, Dietary Supplement, etc.
8. If nutritional information is present, extract key nutrients as ingredients
9. Extract product type from context (Tablet, Capsule, Syrup, Supplement, etc.)
10. Set confidence based on how much data was successfully extracted

Return only valid JSON, no markdown formatting or extra text.
`;

      const message = await AiApiErrorHandler.wrapApiCall(
        () =>
          anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2000,
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

      this.logger.log('Claude AI processing complete');

      // Parse JSON response (handle markdown code blocks if present)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const structuredData = JSON.parse(jsonText);

      // Map to our product field names
      return {
        brand: structuredData.product?.brand || null,
        mfr: structuredData.product?.manufacturer || null,
        title: structuredData.product?.title || null,
        pack: structuredData.product?.packSize || null,
        hsn: structuredData.product?.hsnCode || null,
        composition: structuredData.product?.composition || null,
        description: structuredData.product?.description || null,
        ingredients: structuredData.product?.ingredients || [],
        productType: structuredData.product?.productType || null,
        confidence: structuredData.confidence > 70 ? 'high' : structuredData.confidence > 40 ? 'medium' : 'low',
        confidenceScore: structuredData.confidence,
        notes: structuredData.notes || [],
        extractionMethod: 'tesseract-llm-enhanced'
      };

    } catch (error) {
      this.logger.error('Error enhancing OCR with LLM:', error.stack);

      // Fallback to basic parsing if LLM fails
      this.logger.warn('Falling back to basic pattern matching');
      return null;
    }
  }

  /**
   * Process image and return parsed product information (Enhanced with LLM)
   */
  async processProductImage(imagePath: string): Promise<any> {
    try {
      // Step 1: Extract text from image using Tesseract OCR
      const extractedText = await this.extractTextFromImage(imagePath);

      // Step 2: Try to enhance with Claude AI
      let productInfo: any;
      const enhancedInfo = await this.enhanceWithLLM(extractedText);

      if (enhancedInfo) {
        // LLM enhancement successful
        productInfo = enhancedInfo;
        this.logger.log(`Product extracted with LLM enhancement: ${productInfo.confidence} confidence`);
      } else {
        // Fallback to basic pattern matching
        productInfo = this.parseProductInfo(extractedText);
        productInfo.extractionMethod = 'tesseract-pattern-matching';
        this.logger.log(`Product extracted with pattern matching: ${productInfo.confidence} confidence`);
      }

      return {
        success: true,
        extractedText,
        productInfo,
        message: `Product information extracted with ${productInfo.confidence} confidence using ${productInfo.extractionMethod}`
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

  /**
   * Process multiple images together with combined contextualization
   * This approach extracts OCR from all images first, then contextualizes together
   * for better accuracy and consistency across images
   */
  async processMultipleProductImages(imagePaths: string[]): Promise<any> {
    try {
      this.logger.log(`Processing ${imagePaths.length} images with combined contextualization`);

      // Step 1: Extract OCR text from ALL images first
      const ocrResults: { path: string; text: string; success: boolean }[] = [];

      for (const imagePath of imagePaths) {
        try {
          const extractedText = await this.extractTextFromImage(imagePath);
          ocrResults.push({
            path: imagePath,
            text: extractedText,
            success: true
          });
          this.logger.log(`OCR extracted from ${imagePath}: ${extractedText.length} characters`);
        } catch (error) {
          this.logger.error(`Failed to extract OCR from ${imagePath}:`, error.message);
          ocrResults.push({
            path: imagePath,
            text: '',
            success: false
          });
        }
      }

      // Step 2: Combine all OCR texts
      const successfulExtractions = ocrResults.filter(r => r.success);

      if (successfulExtractions.length === 0) {
        return {
          success: false,
          message: 'Failed to extract text from any images',
          ocrResults
        };
      }

      const combinedOcrText = successfulExtractions
        .map((result, index) => `=== Image ${index + 1} (${result.path.split('/').pop()}) ===\n${result.text}`)
        .join('\n\n');

      this.logger.log(`Combined OCR text from ${successfulExtractions.length} images: ${combinedOcrText.length} characters`);

      // Step 3: Single LLM contextualization with all data
      let productInfo: any;
      const enhancedInfo = await this.enhanceMultiImageWithLLM(combinedOcrText, successfulExtractions.length);

      if (enhancedInfo) {
        // LLM enhancement successful
        productInfo = enhancedInfo;
        this.logger.log(`Multi-image product extracted with LLM: ${productInfo.confidence} confidence`);
      } else {
        // Fallback to basic pattern matching on combined text
        productInfo = this.parseProductInfo(combinedOcrText);
        productInfo.extractionMethod = 'multi-image-pattern-matching';
        this.logger.log(`Multi-image product extracted with pattern matching: ${productInfo.confidence} confidence`);
      }

      return {
        success: true,
        imageCount: imagePaths.length,
        successfulExtractions: successfulExtractions.length,
        ocrResults,
        combinedOcrText,
        productInfo,
        message: `Product information extracted from ${successfulExtractions.length} of ${imagePaths.length} images with ${productInfo.confidence} confidence`
      };

    } catch (error) {
      this.logger.error(`Failed to process multiple product images: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        message: 'Failed to extract product information from images'
      };
    }
  }

  /**
   * Enhanced LLM contextualization for multiple images
   * Processes combined OCR text from all images for better consistency
   */
  async enhanceMultiImageWithLLM(combinedOcrText: string, imageCount: number): Promise<any> {
    try {
      this.logger.log(`Using Claude AI to contextualize combined OCR text from ${imageCount} images`);

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const prompt = `
You are extracting product information from OCR text of a medicine/product packaging.
The OCR text below comes from ${imageCount} different images of the SAME product (e.g., front, back, side panels).
The text may be messy, have formatting issues, or contain multiple sections.

**Combined OCR Text from All Images:**
${combinedOcrText}

Your task: Extract and structure the product information into a clean JSON format.
IMPORTANT: Since this is from multiple surfaces of the SAME product, merge and reconcile information intelligently:
- If manufacturer appears in multiple images, use the most complete/accurate version
- If ingredients appear in multiple images, combine them (they're the same product)
- Prefer more specific information over vague information
- If there are conflicts, prefer data from images with clearer text quality

Return ONLY a valid JSON object with this exact structure:
{
  "confidence": <number 0-100 based on data quality and consistency>,
  "product": {
    "brand": "Brand name if available",
    "manufacturer": "Manufacturer/company name (Mfg./Marketed by)",
    "title": "Full product title/name",
    "packSize": "Pack size (e.g., '10', '1x10', 'Strip of 10')",
    "hsnCode": "HSN code if found (4-8 digits)",
    "composition": "Main active ingredients/composition",
    "description": "Brief product description",
    "ingredients": ["list of key ingredients with quantities"],
    "productType": "Type (e.g., 'Tablet', 'Capsule', 'Syrup', 'Supplement')"
  },
  "notes": ["any observations, data conflicts resolved, or unclear data points"]
}

CRITICAL REQUIREMENTS:
1. Brand: Usually the most prominent text, or marked as "Brand"
2. Manufacturer: Look for "Mfg.", "Manufactured by", "Marketed by", or company name with address
   - IMPORTANT: Cross-check manufacturer across all images and use the most complete version
3. Title: Combine brand + formulation/composition for full product name
4. Pack Size: Look for patterns like "10's", "Strip of 10", "1x10", "Pack of 10"
5. HSN Code: Usually 4-8 digits, may be labeled as "HSN" or "HSN Code"
6. Composition: Main active ingredients (e.g., "Vitamin C 500mg, Zinc 15mg")
7. Product Type: Tablet, Capsule, Syrup, Powder, Injection, Dietary Supplement, etc.
8. If nutritional information is present, extract key nutrients as ingredients
9. Combine unique ingredients from all images (deduplicate)
10. Set confidence higher if data is consistent across images
11. In notes, mention if you reconciled any conflicts or merged data from different images

Return only valid JSON, no markdown formatting or extra text.
`;

      const message = await AiApiErrorHandler.wrapApiCall(
        () =>
          anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 2000,
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

      this.logger.log('Claude AI multi-image processing complete');

      // Parse JSON response (handle markdown code blocks if present)
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const structuredData = JSON.parse(jsonText);

      // Map to our product field names
      return {
        brand: structuredData.product?.brand || null,
        mfr: structuredData.product?.manufacturer || null,
        title: structuredData.product?.title || null,
        pack: structuredData.product?.packSize || null,
        hsn: structuredData.product?.hsnCode || null,
        composition: structuredData.product?.composition || null,
        description: structuredData.product?.description || null,
        ingredients: structuredData.product?.ingredients || [],
        productType: structuredData.product?.productType || null,
        confidence: structuredData.confidence > 70 ? 'high' : structuredData.confidence > 40 ? 'medium' : 'low',
        confidenceScore: structuredData.confidence,
        notes: structuredData.notes || [],
        extractionMethod: 'multi-image-llm-enhanced'
      };

    } catch (error) {
      this.logger.error('Error enhancing multi-image OCR with LLM:', error.stack);

      // Fallback to basic parsing if LLM fails
      this.logger.warn('Falling back to basic pattern matching for multi-image');
      return null;
    }
  }
}

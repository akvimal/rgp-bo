# Product OCR with LLM Enhancement

## Overview

The Product OCR feature has been enhanced with Anthropic Claude AI to provide significantly better extraction quality from product labels and packaging images.

## Architecture

### Two-Stage Extraction Process

```
Image Upload
    ↓
Stage 1: Tesseract OCR
    ↓ (Raw Text)
Stage 2: Claude AI Contextualization
    ↓ (Structured Data)
Form Auto-Population
```

### Stage 1: Tesseract OCR
- Extracts raw text from image
- Handles various image formats (JPG, PNG)
- Provides baseline text extraction

### Stage 2: Claude AI Enhancement
- Takes messy OCR text as input
- Uses Anthropic Claude Haiku model
- Understands context and structure
- Extracts clean, structured product information
- Provides confidence scoring
- Handles variations in label layouts

## Extracted Fields

The enhanced system extracts:

| Field | Description | Example |
|-------|-------------|---------|
| **Brand** | Product brand name | "Antex" |
| **Manufacturer** | Company name | "Antex Pharma Pvt Ltd" |
| **Title** | Full product name | "Antex Multivitamin Supplement" |
| **Pack Size** | Packaging quantity | "10's", "Strip of 10" |
| **HSN Code** | HSN/SAC code | "30049099" |
| **Composition** | Active ingredients | "Vitamin C 40mg, Zinc 12mg" |
| **Description** | Product description | "Nutritional supplement for wellness" |
| **Ingredients** | List of ingredients | ["Grape Seed Extract 50mg", "Vitamin C 40mg"] |
| **Product Type** | Type classification | "Tablet", "Capsule", "Supplement" |

## Benefits

### Before (Pattern Matching Only)
- ❌ Struggled with messy OCR text
- ❌ Fixed regex patterns
- ❌ No context understanding
- ❌ Low accuracy on varied layouts
- ❌ Couldn't handle nutritional tables

### After (LLM-Enhanced)
- ✅ Understands context
- ✅ Handles messy/malformed text
- ✅ Adapts to different layouts
- ✅ Extracts from complex structures (tables, nutritional info)
- ✅ High accuracy across formats
- ✅ Confidence scoring
- ✅ Fallback to pattern matching if LLM fails

## Setup Instructions

### 1. Get Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-...`)

### 2. Configure API Key

Edit the `.env` file in the project root:

```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

**Important**: Keep this key secure and never commit it to git!

### 3. Restart Services

```bash
docker-compose down
docker-compose up -d
```

## Usage

### From UI (Products > New Product)

1. Go to **Products > New Product**
2. Find the **"Extract Product Info from Image (OCR)"** section
3. Upload a clear image of the product label/packaging
4. Click **"Extract Info"**
5. System processes:
   - Tesseract extracts text
   - Claude AI structures the data
   - Form fields auto-populate
6. Review and edit extracted information
7. Save the product

### API Endpoint

```http
POST /products/ocr/extract?entity=product&id=temp
Content-Type: multipart/form-data

file: [image file]
```

**Response:**
```json
{
  "success": true,
  "extractedText": "Raw OCR text...",
  "productInfo": {
    "brand": "Antex",
    "mfr": "Antex Pharma Pvt Ltd",
    "title": "Antex Multivitamin Supplement",
    "pack": "10",
    "hsn": "30049099",
    "composition": "Grape Seed Extract, Vitamins",
    "description": "Nutritional supplement",
    "ingredients": ["Grape Seed Extract 50mg", "Vitamin C 40mg"],
    "productType": "Tablet",
    "confidence": "high",
    "confidenceScore": 85,
    "extractionMethod": "tesseract-llm-enhanced"
  },
  "message": "Product information extracted with high confidence using tesseract-llm-enhanced"
}
```

## Confidence Levels

| Level | Score | Meaning |
|-------|-------|---------|
| **High** | > 70% | Most fields extracted successfully |
| **Medium** | 40-70% | Some fields extracted, may need review |
| **Low** | < 40% | Limited extraction, manual entry needed |

## Cost Considerations

### Claude Haiku Model
- **Model**: claude-3-haiku-20240307
- **Cost**: ~$0.00025 per request (very low)
- **Speed**: Fast responses (1-2 seconds)
- **Tokens**: ~2000 tokens per request

### Monthly Estimates
- 100 products/month: ~$0.025 ($0.03)
- 500 products/month: ~$0.125 ($0.15)
- 1000 products/month: ~$0.250 ($0.30)

Very cost-effective for the accuracy improvement!

## Fallback Mechanism

If Claude API is unavailable or fails:
1. System automatically falls back to pattern matching
2. Uses regex-based extraction
3. User gets notified: `extractionMethod: "tesseract-pattern-matching"`
4. Still provides basic extraction capability

## Technical Implementation

### Files Modified
1. `api-v2/src/modules/app/products/product-ocr.service.ts`
   - Added `enhanceWithLLM()` method
   - Updated `processProductImage()` to use LLM
   - Added fallback logic

2. `docker-compose.yml`
   - Enabled `ANTHROPIC_API_KEY` environment variable
   - Fixed `FILEUPLOAD_SIZE_LIMIT` (was 512KB, now 10MB)

3. `api-v2/src/modules/app/files/multer.config.ts`
   - Fixed directory creation with `recursive: true`

### Dependencies
- `@anthropic-ai/sdk@0.71.2` ✅ Already installed
- `tesseract.js@5.1.1` ✅ Already installed

## Troubleshooting

### "Failed to process image. Please try again."

**Possible causes:**

1. **No API Key**
   - Check `.env` file exists
   - Verify `ANTHROPIC_API_KEY` is set
   - Restart containers: `docker-compose restart api`

2. **Invalid API Key**
   - Check key is correct (starts with `sk-ant-`)
   - Verify key is active in Anthropic console
   - Check for spaces/newlines in .env file

3. **File Too Large**
   - Max size: 10MB
   - Compress or resize image if needed

4. **Network Issues**
   - Check internet connection
   - Verify API can reach anthropic.com
   - Check firewall settings

### Check API Configuration

```bash
# Check if API key is loaded
docker exec rgp-bo-api-1 printenv | grep ANTHROPIC_API_KEY

# Check API logs
docker logs rgp-bo-api-1 --tail 50
```

## Example: Medicine Box (Your Test Case)

**Input**: Back of medicine box with nutritional information

**Extracted Text** (Raw OCR):
```
Nutritional Information Per serving of ~~ %RDA* As a Nutraceutical...
Grape Seed Extract 50 mg 100%
Magnesium Oxide 340 mg 100%
Folic Acid 200 mcg 100%
...
```

**Enhanced Output** (After Claude):
```json
{
  "brand": "Antex",
  "mfr": "Antex Pharma Pvt Ltd, Mohali",
  "title": "Antex Multivitamin & Mineral Supplement",
  "pack": "10",
  "hsn": "21069099",
  "composition": "Grape Seed Extract, Vitamins, Minerals",
  "ingredients": [
    "Grape Seed Extract 50mg",
    "Magnesium Oxide 340mg",
    "Folic Acid 200mcg",
    "Vitamin C 40mg",
    "Vitamin E 7.5mg"
  ],
  "productType": "Dietary Supplement",
  "confidence": "high",
  "confidenceScore": 90
}
```

## Future Enhancements

Potential improvements:
- [ ] Support for batch processing multiple products
- [ ] Multi-image support (front + back of packaging)
- [ ] MRP/pricing extraction
- [ ] Expiry date extraction
- [ ] Barcode/QR code reading
- [ ] Multi-language support

## Support

For issues or questions:
1. Check logs: `docker logs rgp-bo-api-1`
2. Verify API key configuration
3. Test with different images
4. Check Anthropic API status: https://status.anthropic.com/

---

**Last Updated**: 2026-01-26
**Version**: 1.0.0 (LLM-Enhanced)

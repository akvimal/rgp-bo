# Product OCR - Comprehensive Guide

**Last Updated:** 2026-01-27
**Version:** 2.1.3

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [User Guide](#user-guide)
4. [Technical Implementation](#technical-implementation)
5. [Enhancements & Fixes](#enhancements--fixes)
6. [Troubleshooting](#troubleshooting)
7. [Version History](#version-history)

---

## Overview

The Product OCR feature enables automated product information extraction from packaging images using Tesseract.js OCR combined with Anthropic Claude AI for intelligent contextualization.

### Key Capabilities

- ✅ **Multi-Image Processing** - Upload and process front, back, and side packaging images
- ✅ **Combined Contextualization** - All images processed together for higher accuracy
- ✅ **Intelligent Data Extraction** - Automatic field population with confidence scoring
- ✅ **Category Auto-Selection** - Determines Medicine vs OTC based on product type
- ✅ **Pack Number Parsing** - Extracts numeric values from text like "1 x 15 Tablets"
- ✅ **Duplicate Detection** - Prevents creating products with existing titles
- ✅ **Delete & Recreate** - Allows recreating products after deletion

---

## Features

### 1. Multi-Image Upload

Upload multiple images of the same product to extract comprehensive information:

- **Front of Box**: Brand name, product title
- **Back of Box**: Ingredients, manufacturer details
- **Side Panel**: HSN code, pack size, batch information
- **Label/Sticker**: MRP, expiry date

**Supported Formats:** JPG, PNG, JPEG
**Max Size:** 10MB per image
**Recommended:** 2-5 images per product

### 2. Combined Contextualization (v2.1)

**How It Works:**
- All images → OCR extraction → Combined text → Single AI call → Structured data

**Benefits:**
- AI sees complete product information from all surfaces at once
- Better cross-referencing and data reconciliation
- Higher accuracy (especially for manufacturer, ingredients)
- **67% cost reduction** compared to per-image processing

### 3. Intelligent Data Merging

Automatically combines data from multiple images:

- **Non-null Priority**: Takes first non-null value found
- **Ingredient Combination**: Merges unique ingredients from all images
- **Confidence Averaging**: Calculates average confidence score
- **Note Aggregation**: Collects all extraction notes

### 4. Auto-Category Selection

Maps product types to categories automatically:

- **Medicine**: Tablet, Capsule, Syrup, Injection, Powder, Cream, Ointment, Drop
- **OTC**: Supplement, Dietary Supplement, Surgical, Personal Care, Device, Treatment

For Medicine category, composition field is auto-populated if available.

### 5. Pack Number Extraction

Intelligently parses pack sizes from various formats:

- `"1 x 15 Tablets"` → 15
- `"15's"` → 15
- `"Strip of 10"` → 10
- `"Pack of 20"` → 20
- `"30 units"` → 30

### 6. Duplicate Prevention

- Checks for existing active products before saving
- Shows user-friendly error with product ID
- Allows editing existing product instead of creating duplicate
- Database-level unique constraint as final safety net

### 7. Delete & Recreate Workflow

- Soft delete: Product marked inactive/archived
- Title modified on deletion: `"Product Name_deleted_1738075200000"`
- Frees original title for new products
- Preserves historical data for audit trail

---

## User Guide

### Step-by-Step Workflow

#### 1. Upload Multiple Images

1. Navigate to **Products > New Product**
2. Find **"Extract Product Info from Images"** section
3. Click file input and select multiple images (Ctrl+Click)
4. Or drag and drop multiple images

#### 2. Extract Information

1. Click **"Extract Info"** button
2. System processes each image with progress indicators
3. Wait for processing to complete

#### 3. Review Individual Results

1. Expand **"Processed Images"** accordion
2. View each image's results:
   - ✅ Success indicator (green check / red X)
   - Confidence level badge
   - Raw OCR text (collapsible)

#### 4. Review Merged Data

**Contextualized Product Information** card displays:
- All extracted fields in clean format
- Organized by category
- Confidence score with badge
- Complete ingredients list
- Any notes or warnings

#### 5. Apply to Form

1. Review the extracted data
2. Click **"Apply to Form"** button
3. Form fields auto-populate:
   - Brand, Manufacturer, Title
   - Pack size (numeric value extracted)
   - Category (auto-selected based on product type)
   - Composition (for Medicine category)
   - HSN code, Product type, Description
4. Edit any fields as needed
5. Click **Save**

#### 6. Handle Duplicates

If trying to save a product with an existing title:
- Error appears: *"Product with title '...' already exists (ID: 123)"*
- Options:
  - Edit the existing product (ID provided)
  - Modify the title to make it unique
  - Delete the old product first (if no stock/POs)

#### 7. Delete and Recreate

To recreate a product after deletion:
1. Delete the existing product (if no active stock or pending POs)
2. Product title modified to: `"Original Title_deleted_1738075200000"`
3. Create new product with the same original title
4. No duplicate error - original title is now free

---

## Technical Implementation

### Frontend Components

**File:** `frontend/src/app/secured/products/components/master/product-form.component.ts`

#### Key Methods

**extractPackNumber()**
```typescript
extractPackNumber(packString: string): number {
  // Supports: "1 x 15", "15's", "Strip of 10", "Pack of 20"
  // Returns numeric value only
}
```

**mapProductTypeToCategory()**
```typescript
mapProductTypeToCategory(productType: string): string {
  // Maps product type → "Medicine" or "OTC"
}
```

**processMultipleImages()**
```typescript
processMultipleImages() {
  // Uploads all images to backend
  // Displays individual and merged results
}
```

**populateFormFromOCR()**
```typescript
populateFormFromOCR(productInfo: any) {
  // Populates form with extracted data
  // Auto-selects category
  // Extracts pack number
  // Sets composition for Medicine
}
```

### Backend API

**File:** `api-v2/src/modules/app/products/product.controller.ts`

#### Endpoints

**POST /products/ocr/extract-multiple**
- Accepts multiple images
- Returns individual OCR results + merged product info
- Single AI call with combined context

**POST /products/ocr/extract** (legacy)
- Single image processing
- Backward compatibility

#### Service Methods

**File:** `api-v2/src/modules/app/products/product.service.ts`

**create()**
```typescript
async create(createProductDto: CreateProductDto, userid) {
  // Check for existing ACTIVE product (ignore archived)
  // Throw BadRequestException if duplicate found
  // Handle PostgreSQL unique constraint violations
}
```

**remove()**
```typescript
async remove(id: number, userid: number) {
  // Check for active stock
  // Check for pending purchase invoices
  // Modify title: append "_deleted_<timestamp>"
  // Soft delete: isActive=false, isArchived=true
}
```

### Database Entity

**File:** `api-v2/src/entities/product.entity.ts`

**Title Field:**
```typescript
@Column("character varying", { name: "title", unique: true, length: 150 })
title: string;
```

**Note:** Increased from 40 to 150 characters to accommodate full product titles.

### API Response Format

```json
{
  "success": true,
  "imageCount": 3,
  "successfulExtractions": 3,
  "ocrResults": [
    {
      "path": "/upload/product/temp/image1.jpg",
      "text": "Raw OCR text from image 1...",
      "success": true
    }
  ],
  "combinedOcrText": "=== Image 1 ===\n...\n\n=== Image 2 ===\n...",
  "productInfo": {
    "brand": "Neurovit",
    "mfr": "Antex Pharma Pvt Ltd",
    "title": "NEUROVIT VITAMINS, MINERALS, ZINC WITH GRAPE SEED EXTRACT TABLETS",
    "pack": "1 x 15 Tablets",
    "hsn": "21069099",
    "productType": "Dietary Supplement",
    "composition": "Vitamins and Minerals",
    "ingredients": ["Vitamin C 40mg", "Zinc 12mg"],
    "description": "Nutritional supplement for wellness",
    "confidence": "high",
    "confidenceScore": 85,
    "extractionMethod": "multi-image-llm-enhanced",
    "notes": ["Reconciled manufacturer from images 2 and 3"]
  },
  "message": "Product information extracted from 3 of 3 images with high confidence"
}
```

---

## Enhancements & Fixes

### Version 2.1.3 (2026-01-27)

#### Pack Field Parsing Enhancement
**Issue:** Input error when OCR returns text like "1 x 15 Tablets" for numeric pack field

**Fix:**
- Implemented `extractPackNumber()` method with regex patterns
- Supports multiple formats: "1 x 15", "15's", "Strip of 10", etc.
- Extracts numeric value only

**Files Modified:**
- `frontend/src/app/secured/products/components/master/product-form.component.ts`

---

#### Category Auto-Selection
**Issue:** Manual category selection required after OCR

**Enhancement:**
- Added `mapProductTypeToCategory()` method
- Automatically determines Medicine vs OTC
- Auto-populates composition field for Medicine category

**Files Modified:**
- `frontend/src/app/secured/products/components/master/product-form.component.ts`

---

#### Duplicate Detection After Delete
**Issue:** "Product already exists" error when recreating product after deletion

**Root Cause:**
- Soft delete didn't modify title
- Database unique constraint on title
- Archived products blocked new products

**Fix:**
- Duplicate check only looks at active products (`isActive=true, isArchived=false`)
- Delete operation modifies title: append `_deleted_<timestamp>`
- Frees original title for new products

**Files Modified:**
- `api-v2/src/modules/app/products/product.service.ts` (create, remove methods)

---

#### Login Redirect After Save
**Issue:** Successful save redirected to login page instead of product list

**Root Cause:**
- Navigation path `/secure/products/list` didn't match routing config
- Actual route: `/secure/products/master/list`
- AuthGuard couldn't match path to permissions

**Fix:**
- Changed `gotoList()` to navigate to correct path

**Files Modified:**
- `frontend/src/app/secured/products/components/master/product-form.component.ts`

---

#### Title Length Limitation
**Issue:** Long product titles truncated, causing false duplicate errors

**Root Cause:**
- Database column limited to 40 characters
- OCR extracted 65-character titles
- Truncation caused duplicate detection issues

**Fix:**
- Increased database column to VARCHAR(150)
- Updated entity definition to length: 150
- Dropped and recreated database views

**Files Modified:**
- `api-v2/src/entities/product.entity.ts`
- Database: `ALTER TABLE product ALTER COLUMN title TYPE VARCHAR(150)`

---

#### Template Undefined Errors
**Issue:** JavaScript error `Cannot read properties of undefined (reading 'confidence')`

**Root Cause:**
- Template accessing properties before checking object exists

**Fix:**
- Added safe navigation operator `?.`
- Changed badges from confidence display to "OCR Complete"/"Failed"
- Added fallback: `{{mergedProductInfo.confidenceScore || 0}}%`

**Files Modified:**
- `frontend/src/app/secured/products/components/master/product-form.component.html`

---

#### Upload Path Issue
**Issue:** OCR not displaying data, logs showed `undefined/undefined` path

**Root Cause:**
- Missing query parameters in API call

**Fix:**
- Added `?entity=product&id=temp` to API URL

**Files Modified:**
- `frontend/src/app/secured/products/components/master/product-form.component.ts`

---

### Version 2.1.0 (2026-01-26)

#### Combined Contextualization
**What Changed:**
- Before: Each image → OCR → LLM → Result, then merge
- After: All images → OCR all → Combine text → Single LLM call

**Benefits:**
- Better cross-referencing
- Higher accuracy
- 67% cost reduction
- Fewer conflicts in merged data

**Cost Comparison:**
- Old: 3 images = 3 API calls = ~$0.00075
- New: 3 images = 1 API call = ~$0.00025

---

## Troubleshooting

### If Extraction Fails for Some Images

**System Behavior:**
- Continues processing remaining images
- Shows failure for specific image
- Merges data from successful extractions only

**User Action:**
- Review error messages
- Re-upload failed images with better quality
- Process again

### If Merged Data Seems Incomplete

**Possible Causes:**
- Poor image quality
- Text not visible/clear
- Unusual packaging layout

**Solutions:**
- Upload additional images
- Ensure text is readable
- Manually fill missing fields

### If Confidence is Low

**What It Means:**
- OCR text quality was poor
- AI had difficulty structuring data

**Action:**
- Review extracted data carefully
- Verify all fields before saving
- Consider re-uploading with better images

### If Pack Field Shows Error

**Error:** "The specified value cannot be parsed"

**Cause:**
- OCR returned text format but field expects number

**Fix:**
- System now automatically extracts numeric value
- If still shows error, manually enter pack number

### If Duplicate Error Persists After Delete

**Check:**
1. Was product actually deleted? (Check product list)
2. Does product have active stock? (Prevents deletion)
3. Does product have pending POs? (Prevents deletion)
4. Try hard refresh (Ctrl+F5) in browser

**Manual Database Cleanup:**
```sql
-- Check for deleted products with same title
SELECT id, title, is_active, is_archived
FROM product
WHERE title LIKE '%PRODUCT_NAME%';

-- Manually rename if needed
UPDATE product
SET title = title || '_deleted_' || EXTRACT(EPOCH FROM NOW())::bigint
WHERE id = <PRODUCT_ID>;
```

---

## Best Practices

### Image Selection

**Recommended:**
- ✅ Clear, well-lit images
- ✅ Text in focus
- ✅ Minimal glare/reflection
- ✅ Straight-on angle
- ✅ High resolution (at least 1024px width)

**Avoid:**
- ❌ Blurry or out-of-focus images
- ❌ Heavy shadows
- ❌ Extreme angles
- ❌ Low resolution
- ❌ Obscured text

### Image Combination Strategy

**Optimal Setup (Medicine Box):**
1. **Front**: Brand name, product name, main visual
2. **Back**: Full ingredients list, manufacturer, nutritional info
3. **Side/Bottom**: HSN code, batch info, MRP

**For Simple Products:**
- 1-2 images usually sufficient
- Front + one detail image

**For Complex Products:**
- 3-5 images for comprehensive coverage
- Include all text-heavy surfaces

### Data Verification

**Always Review:**
- Brand and manufacturer names
- Product title (complete and accurate)
- Pack size (numeric value correct)
- HSN code (8 digits)
- Category (Medicine vs OTC)
- Composition/ingredients

**Common OCR Errors:**
- Number confusion: 0/O, 1/I, 5/S, 8/B
- Similar letters: rn/m, cl/d, vv/w
- Missing spaces or extra characters

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.3 | 2026-01-27 | Pack parsing, category auto-selection, enhanced duplicate detection |
| 2.1.2 | 2026-01-26 | Duplicate detection, delete fixes, title length increase |
| 2.1.1 | 2026-01-26 | Login redirect fix, template error fixes |
| 2.1.0 | 2026-01-26 | Combined contextualization approach, cost reduction |
| 2.0.0 | 2026-01-26 | Multi-image support, per-image LLM processing |
| 1.0.0 | 2026-01-25 | Initial OCR feature with single image support |

---

## Future Enhancements

Potential improvements:
- [ ] Image preview thumbnails before upload
- [ ] Drag-and-drop image reordering
- [ ] Remove individual images after upload
- [ ] Edit extracted data before applying to form
- [ ] Save extraction history for products
- [ ] Batch product processing (multiple products at once)
- [ ] OCR quality pre-check with warnings
- [ ] Image enhancement/preprocessing (brightness, contrast)
- [ ] Support for additional languages (currently English only)
- [ ] Barcode/QR code detection and extraction

---

**For deployment instructions, see:** [VPS_DEPLOYMENT_GUIDE.md](../VPS_DEPLOYMENT_GUIDE.md)
**For project context, see:** [CLAUDE.md](../CLAUDE.md)

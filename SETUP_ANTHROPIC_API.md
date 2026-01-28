# Quick Setup: Anthropic API for Product OCR

## ✅ What's Been Implemented

The Product OCR feature has been enhanced with Anthropic Claude AI:

1. **Two-stage extraction**: Tesseract OCR → Claude AI → Structured Data
2. **Better accuracy**: Handles messy OCR text intelligently
3. **Automatic fallback**: Falls back to pattern matching if API fails
4. **10MB file size limit**: Increased from 512KB
5. **Directory auto-creation**: Fixed upload directory creation bug

## 🔑 Setup Your Anthropic API Key

### Step 1: Get Your API Key

1. Go to: **https://console.anthropic.com/**
2. Sign up or log in
3. Click **"Get API keys"** or navigate to API Keys section
4. Click **"Create Key"**
5. Copy your key (starts with `sk-ant-api03-...`)

### Step 2: Add Key to .env File

Open the `.env` file in the project root directory:

```bash
# Edit D:\workspace\rgp-bo\.env
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE
```

**Important**: Replace `your_api_key_here` with your actual API key!

### Step 3: Restart Services

```bash
# In your project directory
docker-compose down
docker-compose up -d
```

### Step 4: Verify Setup

Check if the key is loaded:
```bash
docker exec rgp-bo-api-1 printenv | grep ANTHROPIC_API_KEY
```

You should see your API key (not "your_api_key_here").

## 🧪 Test the Feature

1. Go to **Products > New Product** (http://localhost:8000)
2. Scroll to **"Extract Product Info from Image (OCR)"**
3. Upload a medicine box image
4. Click **"Extract Info"**
5. Watch it extract structured data!

## 💰 Cost Information

**Model**: Claude Haiku (fastest & cheapest)
- ~$0.00025 per product extraction
- 100 products = $0.03
- 1000 products = $0.30/month

Very affordable for the quality improvement!

## 🔧 Troubleshooting

### If extraction still fails:

1. **Check API key is set**:
   ```bash
   docker exec rgp-bo-api-1 printenv | grep ANTHROPIC
   ```
   Should show your actual key, not "your_api_key_here"

2. **Check API logs**:
   ```bash
   docker logs rgp-bo-api-1 --tail 50
   ```
   Look for Claude-related errors

3. **Restart containers**:
   ```bash
   docker-compose restart api
   ```

4. **Verify API key is valid**:
   - Log in to https://console.anthropic.com/
   - Check API Keys section
   - Ensure key is active

### Without API Key

The feature will still work using basic pattern matching, but with lower accuracy. You'll see:
```json
{
  "extractionMethod": "tesseract-pattern-matching"
}
```

With the API key configured, you'll see:
```json
{
  "extractionMethod": "tesseract-llm-enhanced"
}
```

## 📚 Full Documentation

See `PRODUCT_OCR_LLM_ENHANCEMENT.md` for complete technical documentation.

---

**Ready to test?** Add your API key and try uploading a product image!

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { AppError } from '../middleware/errorHandler.js';

// Initialize AI clients
const genAI = process.env.GOOGLE_AI_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

class AIService {
  constructor() {
    this.geminiModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }) : null;
    this.preferredProvider = process.env.AI_PROVIDER || 'gemini'; // 'gemini' or 'openai'
  }

  /**
   * Analyze product images and generate listing details
   */
  async analyzeProductImages(images, modelNumber = null, additionalInfo = null) {
    try {
      // Validate that we have either images or model number
      if ((!images || images.length === 0) && !modelNumber) {
        throw new AppError('Either images or model number is required', 400);
      }
      if (this.preferredProvider === 'gemini' && this.geminiModel) {
        return await this.analyzeWithGemini(images, modelNumber, additionalInfo);
      } else if (this.preferredProvider === 'openai' && openai) {
        return await this.analyzeWithGPT4(images, modelNumber, additionalInfo);
      } else {
        throw new AppError('AI service not configured', 500);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new AppError('Failed to analyze product images', 500);
    }
  }

  /**
   * Analyze with Google Gemini
   */
  async analyzeWithGemini(images, modelNumber, additionalInfo) {
    const prompt = this.buildPrompt(modelNumber, additionalInfo);

    // If no images provided, analyze based on model number only
    if (!images || images.length === 0) {
      const result = await this.geminiModel.generateContent([prompt]);
      const response = await result.response;
      const text = response.text();
      return this.parseAIResponse(text, 'gemini');
    }

    // Convert images to Gemini format
    const imageParts = await Promise.all(
      images.map(async (imageUrl) => {
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: response.headers.get('content-type') || 'image/jpeg',
          },
        };
      })
    );

    const result = await this.geminiModel.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    return this.parseAIResponse(text, 'gemini');
  }

  /**
   * Analyze with OpenAI GPT-4 Vision
   */
  async analyzeWithGPT4(images, modelNumber, additionalInfo) {
    const prompt = this.buildPrompt(modelNumber, additionalInfo);

    // If no images provided, use regular GPT-4 (not vision)
    if (!images || images.length === 0) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing product specifications and creating detailed, accurate marketplace listings. Always provide honest condition assessments and accurate product information.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      return this.parseAIResponse(response.choices[0].message.content, 'openai');
    }

    const messages = [
      {
        role: 'system',
        content: 'You are an expert at analyzing product images and creating detailed, accurate marketplace listings. Always provide honest condition assessments and accurate product information.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(url => ({
            type: 'image_url',
            image_url: { url, detail: 'high' },
          })),
        ],
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 1500,
      temperature: 0.3,
    });

    return this.parseAIResponse(response.choices[0].message.content, 'openai');
  }

  /**
   * Build analysis prompt
   */
  buildPrompt(modelNumber, additionalInfo) {
    const productIdentifier = modelNumber || 'the product shown in the images';
    
    let prompt = `Act as a senior e-commerce content strategist and marketplace listing expert.

Generate premium marketplace content for this product: **${productIdentifier}**

Deliver the output in strict JSON format with the following structure:

{
  "seoTitle": "SEO-optimised product title (80-120 chars) - include brand, model, key features",
  "keyFeatures": [
    "6-10 bullet points focused on real benefits, not just specs",
    "Emphasise build quality, energy efficiency, hygiene, durability, capacity, quiet operation",
    "Each point should highlight value and user benefits"
  ],
  "productDescription": "2-3 paragraphs, premium tone. Clear, helpful, professional — no hype. Explain who it's ideal for and why. (200-300 words)",
  "specifications": {
    "brand": "Product brand",
    "model": "Product model",
    "modelNumber": "Full model number",
    "category": "Product category (Electronics, Fashion, Home Appliances, Furniture, Sports, Automotive, etc.)",
    "subCategory": "Specific subcategory",
    "dimensions": "Product dimensions (L x W x H)",
    "weight": "Product weight",
    "capacity": "Capacity/Size if applicable",
    "color": "Product color/finish",
    "material": "Primary materials used",
    "year": "Year/manufacture date",
    "condition": "Current condition assessment",
    "powerSpecs": "Power requirements/battery (if applicable)",
    "connectivity": "Connection types/ports (if applicable)",
    "compatibility": "Compatible systems/models (if applicable)",
    "warranty": "Warranty information (if known)",
    "origin": "Country of manufacture (if visible)",
    "certifications": "Safety certifications/standards (if visible)",
    "allSpecs": {
      "Generate ALL product-specific specifications here as key-value pairs": "Include every technical detail, feature, measurement, rating, etc. based on product type",
      "For Electronics": "Screen size, resolution, processor, RAM, storage, battery, OS, etc.",
      "For Appliances": "Energy rating, capacity, dimensions, load type, RPM, noise level, etc.",
      "For Furniture": "Dimensions, material, weight capacity, assembly required, style, etc.",
      "For Clothing": "Size, fit, fabric composition, care instructions, style, etc.",
      "For Vehicles/Parts": "Make, model, year, VIN, mileage, engine, transmission, etc.",
      "Be comprehensive": "Include everything visible or known about this specific product"
    }
  },
  "shortMarketplaceSummary": "1 concise paragraph for eBay/FB Marketplace/Google Shopping (50-80 words)",
  "longSeoDescription": "1-2 paragraphs targeting search keywords. Avoid repetition from earlier sections. Focus on benefits and search intent. (150-200 words)",
  "seoKeywords": {
    "primary": ["3-5 primary keywords"],
    "secondary": ["5-7 secondary keywords"],
    "longTail": ["5-8 long-tail keywords phrases"]
  },
  "marketplaceTags": ["20-30 relevant tags for marketplace categorisation"],
  "condition": "new|like-new|excellent|good|fair|poor|for-parts",
  "conditionNotes": "Specific condition details if visible, any defects or wear",
  "suggestedPrice": {
    "min": 0,
    "max": 0,
    "currency": "USD",
    "reasoning": "Brief price justification based on condition and market value"
  },
  "warnings": ["Any safety or authenticity concerns if applicable"],
  "confidence": 0.95
}

**Tone & Style Guidelines:**
- Sounds like premium retail (Appliances Online / The Good Guys / JB Hi-Fi)
- Clean, confident, premium tone
- Australia context where relevant
- Zero fluff, zero overly-salesy language
- Use straightforward language, high trust, high clarity
- Focus on durability, hygiene, efficiency and real user benefits

**Important:**
- Write as if product details are known
- Focus on high-intent keywords and conversion
- Make content suitable for Facebook Marketplace, eBay, Google Shopping & website product pages
- Include keywords that improve search ranking
- Avoid repeated sentences across sections
- **CRITICAL: Generate ALL possible specifications for this product type**
- Extract every technical detail visible or known
- Fill the "allSpecs" object with comprehensive product-specific details
- Be thorough - more specifications = better listings`;

    if (modelNumber) {
      prompt += `\n\n**Product Model Number:** ${modelNumber}\n\nLook up this exact model and provide:
- ALL technical specifications from manufacturer
- Complete feature list
- Every measurement and rating
- All compatibility information
- Full performance specifications
- Any certifications or standards
- Complete material/construction details
- Everything a buyer would want to know`;
    } else {
      prompt += `\n\n**Note:** Analyze the product from the images provided.\n\nExtract from images:
- Identify brand, model, and model numbers from labels
- Read all visible text, labels, and tags
- Estimate dimensions from context
- Identify materials from appearance
- Note any visible specifications or ratings
- Capture serial numbers or model codes
- Identify any certifications or safety marks
- Extract ALL visible information`;
    }

    if (additionalInfo) {
      prompt += `\n\n**Additional Context:** ${additionalInfo}`;
    }

    prompt += '\n\nBe accurate and honest about the condition. If you cannot determine certain details from the information provided, indicate that clearly in the confidence score.';

    return prompt;
  }

  /**
   * Parse AI response
   */
  parseAIResponse(text, provider) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and clean the response with new structure
        return {
          // Main title from seoTitle
          title: parsed.seoTitle?.substring(0, 200) || 'Product Listing',
          
          // Use productDescription as main description
          description: parsed.productDescription || '',
          
          // Additional structured content for marketplace
          marketplaceContent: {
            seoTitle: parsed.seoTitle || '',
            keyFeatures: Array.isArray(parsed.keyFeatures) ? parsed.keyFeatures : [],
            productDescription: parsed.productDescription || '',
            shortMarketplaceSummary: parsed.shortMarketplaceSummary || '',
            longSeoDescription: parsed.longSeoDescription || '',
            seoKeywords: {
              primary: Array.isArray(parsed.seoKeywords?.primary) ? parsed.seoKeywords.primary : [],
              secondary: Array.isArray(parsed.seoKeywords?.secondary) ? parsed.seoKeywords.secondary : [],
              longTail: Array.isArray(parsed.seoKeywords?.longTail) ? parsed.seoKeywords.longTail : [],
            },
            marketplaceTags: Array.isArray(parsed.marketplaceTags) ? parsed.marketplaceTags : [],
          },
          
          // Extract category from tags/keywords
          category: {
            main: parsed.specifications?.category || 'Other',
            sub: '',
            tags: Array.isArray(parsed.marketplaceTags) ? parsed.marketplaceTags.slice(0, 10) : [],
          },
          
          condition: this.validateCondition(parsed.condition),
          conditionNotes: parsed.conditionNotes || '',
          
          specifications: {
            brand: parsed.specifications?.brand || '',
            model: parsed.specifications?.model || '',
            modelNumber: parsed.specifications?.modelNumber || '',
            category: parsed.specifications?.category || '',
            subCategory: parsed.specifications?.subCategory || '',
            dimensions: parsed.specifications?.dimensions || '',
            weight: parsed.specifications?.weight || '',
            year: parsed.specifications?.year || null,
            color: parsed.specifications?.color || '',
            size: parsed.specifications?.size || parsed.specifications?.capacity || '',
            material: parsed.specifications?.material || '',
            capacity: parsed.specifications?.capacity || '',
            condition: parsed.specifications?.condition || '',
            powerSpecs: parsed.specifications?.powerSpecs || '',
            connectivity: parsed.specifications?.connectivity || '',
            compatibility: parsed.specifications?.compatibility || '',
            warranty: parsed.specifications?.warranty || '',
            origin: parsed.specifications?.origin || '',
            certifications: parsed.specifications?.certifications || '',
            features: Array.isArray(parsed.keyFeatures) 
              ? parsed.keyFeatures 
              : [],
            allSpecs: parsed.specifications?.allSpecs || {},
          },
          
          suggestedPrice: {
            min: parseFloat(parsed.suggestedPrice?.min) || 0,
            max: parseFloat(parsed.suggestedPrice?.max) || 0,
            currency: parsed.suggestedPrice?.currency || 'USD',
            reasoning: parsed.suggestedPrice?.reasoning || '',
          },
          
          // Combine all keywords
          searchKeywords: [
            ...(Array.isArray(parsed.seoKeywords?.primary) ? parsed.seoKeywords.primary : []),
            ...(Array.isArray(parsed.seoKeywords?.secondary) ? parsed.seoKeywords.secondary : []),
          ],
          
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          confidence: parseFloat(parsed.confidence) || 0.5,
          aiProvider: provider,
          generatedAt: new Date(),
        };
      }

      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Raw text:', text);

      // Return a basic structure if parsing fails
      return {
        title: 'Product for Sale',
        description: text.substring(0, 1000),
        marketplaceContent: {
          seoTitle: '',
          keyFeatures: [],
          productDescription: text.substring(0, 500),
          shortMarketplaceSummary: '',
          longSeoDescription: '',
          seoKeywords: { primary: [], secondary: [], longTail: [] },
          marketplaceTags: [],
        },
        category: { main: 'Other', sub: '', tags: [] },
        condition: 'good',
        conditionNotes: '',
        specifications: {},
        suggestedPrice: { min: 0, max: 0, currency: 'USD', reasoning: '' },
        searchKeywords: [],
        warnings: [],
        confidence: 0.3,
        aiProvider: provider,
        generatedAt: new Date(),
        error: 'Failed to parse structured response',
      };
    }
  }

  /**
   * Validate condition value
   */
  validateCondition(condition) {
    const validConditions = ['new', 'like-new', 'excellent', 'good', 'fair', 'poor', 'for-parts'];
    const normalized = condition?.toLowerCase().replace(/[^a-z-]/g, '');

    if (validConditions.includes(normalized)) {
      return normalized;
    }

    // Try to map common variations
    const conditionMap = {
      'brand new': 'new',
      'mint': 'like-new',
      'very good': 'excellent',
      'used': 'good',
      'acceptable': 'fair',
      'damaged': 'poor',
      'broken': 'for-parts',
    };

    for (const [key, value] of Object.entries(conditionMap)) {
      if (normalized?.includes(key)) {
        return value;
      }
    }

    return 'good'; // Default condition
  }

  /**
   * Generate product title from details
   */
  generateTitle(brand, model, category, additionalDetails = {}) {
    const parts = [];

    if (brand) parts.push(brand);
    if (model) parts.push(model);

    // Add relevant details based on category
    if (category === 'Electronics' && additionalDetails.storage) {
      parts.push(additionalDetails.storage);
    }
    if (category === 'Fashion' && additionalDetails.size) {
      parts.push(`Size ${additionalDetails.size}`);
    }
    if (additionalDetails.color) {
      parts.push(additionalDetails.color);
    }

    return parts.join(' ').substring(0, 200);
  }

  /**
   * Enhance description with SEO keywords
   */
  enhanceDescription(description, keywords) {
    // Add keywords naturally to the description
    const enhanced = description;

    // Add a keyword-rich closing paragraph
    const keywordParagraph = `\n\nPerfect for those searching for ${keywords.slice(0, 3).join(', ')}. ` +
      `This listing includes everything shown in the photos. ` +
      `Keywords: ${keywords.join(', ')}.`;

    return enhanced + keywordParagraph;
  }

  /**
   * Extract text from images using OCR (if needed)
   */
  async extractTextFromImages(images) {
    // This would integrate with an OCR service like Google Cloud Vision
    // For now, return empty array
    return [];
  }

  /**
   * Validate product authenticity
   */
  async checkAuthenticity(brand, model, images) {
    // This could integrate with brand authentication APIs
    // For now, return basic check
    return {
      isAuthentic: true,
      confidence: 0.7,
      warnings: [],
    };
  }
}

// Export singleton instance
export default new AIService();

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
    let prompt = `Analyze these product images and provide detailed information for a marketplace listing.
    
    Please provide the following in JSON format:
    {
      "title": "Concise, descriptive product title (max 80 chars)",
      "description": "Detailed product description including key features, specifications, and condition details (200-500 words)",
      "category": {
        "main": "Main category (Electronics, Fashion, Home, Sports, etc.)",
        "sub": "Subcategory",
        "tags": ["relevant", "search", "tags"]
      },
      "condition": "new|like-new|excellent|good|fair|poor|for-parts",
      "conditionNotes": "Specific condition details, any defects or wear",
      "specifications": {
        "brand": "Product brand",
        "model": "Product model",
        "modelNumber": "Model number if visible",
        "year": "Year if applicable",
        "color": "Product color",
        "size": "Size if applicable",
        "material": "Materials used",
        "features": ["key", "product", "features"]
      },
      "suggestedPrice": {
        "min": "Minimum suggested price in USD",
        "max": "Maximum suggested price in USD",
        "reasoning": "Brief price justification"
      },
      "searchKeywords": ["relevant", "search", "keywords"],
      "warnings": ["Any safety or authenticity concerns"],
      "confidence": 0.95
    }`;

    if (modelNumber) {
      prompt += `\n\nModel Number provided: ${modelNumber}. Use this to look up accurate specifications.`;
    }

    if (additionalInfo) {
      prompt += `\n\nAdditional context: ${additionalInfo}`;
    }

    prompt += '\n\nBe accurate and honest about the condition. If you cannot determine certain details from the images, indicate that clearly.';

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
        
        // Validate and clean the response
        return {
          title: parsed.title?.substring(0, 200) || 'Product Listing',
          description: parsed.description || '',
          category: {
            main: parsed.category?.main || 'Other',
            sub: parsed.category?.sub || '',
            tags: Array.isArray(parsed.category?.tags) ? parsed.category.tags : [],
          },
          condition: this.validateCondition(parsed.condition),
          conditionNotes: parsed.conditionNotes || '',
          specifications: {
            brand: parsed.specifications?.brand || '',
            model: parsed.specifications?.model || '',
            modelNumber: parsed.specifications?.modelNumber || '',
            year: parsed.specifications?.year || null,
            color: parsed.specifications?.color || '',
            size: parsed.specifications?.size || '',
            material: parsed.specifications?.material || '',
            features: Array.isArray(parsed.specifications?.features) 
              ? parsed.specifications.features 
              : [],
          },
          suggestedPrice: {
            min: parseFloat(parsed.suggestedPrice?.min) || 0,
            max: parseFloat(parsed.suggestedPrice?.max) || 0,
            reasoning: parsed.suggestedPrice?.reasoning || '',
          },
          searchKeywords: Array.isArray(parsed.searchKeywords) 
            ? parsed.searchKeywords 
            : [],
          warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
          confidence: parseFloat(parsed.confidence) || 0.5,
          aiProvider: provider,
          generatedAt: new Date(),
        };
      }
      
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.error('Error parsing AI response:', error);
      
      // Return a basic structure if parsing fails
      return {
        title: 'Product for Sale',
        description: text.substring(0, 1000),
        category: { main: 'Other', sub: '', tags: [] },
        condition: 'good',
        conditionNotes: '',
        specifications: {},
        suggestedPrice: { min: 0, max: 0, reasoning: '' },
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

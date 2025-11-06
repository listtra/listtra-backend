import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadListingImages } from '../config/cloudinary.js';
import aiService from '../services/ai.service.js';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

// Analyze product images and generate listing content
router.post(
  '/analyze-product',
  uploadListingImages.array('images', 5),
  [
    body('modelNumber').optional().trim(),
    body('additionalInfo').optional().trim().isLength({ max: 500 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Check that we have either images or model number
    const hasImages = req.files && req.files.length > 0;
    const hasModelNumber = req.body.modelNumber && req.body.modelNumber.trim().length > 0;

    if (!hasImages && !hasModelNumber) {
      return res.status(400).json({
        success: false,
        message: 'Either images or model number is required',
      });
    }

    // Get image URLs from uploaded files (if any)
    const imageUrls = hasImages ? req.files.map(file => file.path) : [];

    // Analyze with AI
    const analysis = await aiService.analyzeProductImages(
      imageUrls,
      req.body.modelNumber,
      req.body.additionalInfo
    );

    // Build comprehensive description from all AI-generated content
    const marketplaceContent = analysis.marketplaceContent || {};
    let fullDescription = '';
    
    // Add product description
    if (marketplaceContent.productDescription) {
      fullDescription += marketplaceContent.productDescription + '\n\n';
    }
    
    // Add key features
    if (marketplaceContent.keyFeatures && marketplaceContent.keyFeatures.length > 0) {
      fullDescription += '🔑 KEY FEATURES:\n';
      marketplaceContent.keyFeatures.forEach(feature => {
        fullDescription += `• ${feature}\n`;
      });
      fullDescription += '\n';
    }
    
    // Add comprehensive specifications
    if (analysis.specifications) {
      fullDescription += '📊 SPECIFICATIONS:\n';
      const specs = analysis.specifications;
      
      // Core specs
      if (specs.brand) fullDescription += `Brand: ${specs.brand}\n`;
      if (specs.model) fullDescription += `Model: ${specs.model}\n`;
      if (specs.modelNumber) fullDescription += `Model Number: ${specs.modelNumber}\n`;
      if (specs.category) fullDescription += `Category: ${specs.category}\n`;
      if (specs.subCategory) fullDescription += `Type: ${specs.subCategory}\n`;
      
      // Physical specs
      if (specs.dimensions) fullDescription += `Dimensions: ${specs.dimensions}\n`;
      if (specs.weight) fullDescription += `Weight: ${specs.weight}\n`;
      if (specs.capacity) fullDescription += `Capacity: ${specs.capacity}\n`;
      if (specs.color) fullDescription += `Color: ${specs.color}\n`;
      if (specs.material) fullDescription += `Material: ${specs.material}\n`;
      
      // Technical specs
      if (specs.powerSpecs) fullDescription += `Power: ${specs.powerSpecs}\n`;
      if (specs.connectivity) fullDescription += `Connectivity: ${specs.connectivity}\n`;
      if (specs.compatibility) fullDescription += `Compatibility: ${specs.compatibility}\n`;
      
      // Additional info
      if (specs.year) fullDescription += `Year: ${specs.year}\n`;
      if (specs.origin) fullDescription += `Made in: ${specs.origin}\n`;
      if (specs.certifications) fullDescription += `Certifications: ${specs.certifications}\n`;
      if (specs.warranty) fullDescription += `Warranty: ${specs.warranty}\n`;
      
      // All additional specs from allSpecs object
      if (specs.allSpecs && typeof specs.allSpecs === 'object') {
        Object.entries(specs.allSpecs).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            fullDescription += `${key}: ${value}\n`;
          }
        });
      }
      
      fullDescription += '\n';
    }
    
    // Add marketplace summary
    if (marketplaceContent.shortMarketplaceSummary) {
      fullDescription += '🛒 QUICK SUMMARY:\n' + marketplaceContent.shortMarketplaceSummary + '\n\n';
    }
    
    // Add Long SEO Description
    if (marketplaceContent.longSeoDescription) {
      fullDescription += '🌐 SEO DESCRIPTION:\n' + marketplaceContent.longSeoDescription + '\n\n';
    }
    
    // Add SEO Keywords
    if (marketplaceContent.seoKeywords) {
      fullDescription += '🔍 KEYWORDS:\n';
      
      if (marketplaceContent.seoKeywords.primary && marketplaceContent.seoKeywords.primary.length > 0) {
        fullDescription += 'Primary: ' + marketplaceContent.seoKeywords.primary.join(', ') + '\n';
      }
      
      if (marketplaceContent.seoKeywords.secondary && marketplaceContent.seoKeywords.secondary.length > 0) {
        fullDescription += 'Secondary: ' + marketplaceContent.seoKeywords.secondary.join(', ') + '\n';
      }
      
      if (marketplaceContent.seoKeywords.longTail && marketplaceContent.seoKeywords.longTail.length > 0) {
        fullDescription += 'Long-tail: ' + marketplaceContent.seoKeywords.longTail.join(', ') + '\n';
      }
      
      fullDescription += '\n';
    }
    
    // Add Marketplace Tags
    if (marketplaceContent.marketplaceTags && marketplaceContent.marketplaceTags.length > 0) {
      fullDescription += '🏷️ TAGS:\n' + marketplaceContent.marketplaceTags.join(', ') + '\n\n';
    }

    // Format response for simplified schema
    const response = {
      title: analysis.title,
      description: fullDescription.trim() || analysis.description,
      model_number: req.body.modelNumber || analysis.specifications?.modelNumber || '',
      photo_url: imageUrls.length > 0 ? imageUrls[0] : '', // Main photo (empty if no images)
      additional_photos: imageUrls.slice(1), // Rest of the photos
      condition: analysis.condition || 'good',
    };

    res.json({
      success: true,
      listing_data: response,
      analysis_details: analysis, // Keep full details for review screen
    });
  })
);

// Generate title from model number and category
router.post(
  '/generate-title',
  [
    body('model_number').optional().trim(),
    body('category').optional().trim(),
    body('brand').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { model_number, category, brand } = req.body;

    const title = aiService.generateTitle(
      brand || '',
      model_number || '',
      category || 'Product'
    );

    res.json({
      success: true,
      title,
    });
  })
);

// Enhance description with SEO
router.post(
  '/enhance-description',
  [
    body('description').notEmpty().isLength({ max: 5000 }),
    body('keywords').isArray().optional(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { description, keywords = [] } = req.body;

    const enhanced = aiService.enhanceDescription(description, keywords);

    res.json({
      success: true,
      description: enhanced,
    });
  })
);

// Analyze single image from URL
router.post(
  '/analyze-url',
  [
    body('image_url').notEmpty().isURL(),
    body('model_number').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { image_url, model_number } = req.body;

    // Analyze image with AI
    const analysis = await aiService.analyzeProductImages(
      [image_url],
      model_number
    );

    // Build comprehensive description from all AI-generated content
    const marketplaceContent = analysis.marketplaceContent || {};
    let fullDescription = '';
    
    if (marketplaceContent.productDescription) {
      fullDescription += marketplaceContent.productDescription + '\n\n';
    }
    
    if (marketplaceContent.keyFeatures && marketplaceContent.keyFeatures.length > 0) {
      fullDescription += '🔑 KEY FEATURES:\n';
      marketplaceContent.keyFeatures.forEach(feature => {
        fullDescription += `• ${feature}\n`;
      });
      fullDescription += '\n';
    }
    
    if (analysis.specifications) {
      fullDescription += '📊 SPECIFICATIONS:\n';
      const specs = analysis.specifications;
      
      // Core specs
      if (specs.brand) fullDescription += `Brand: ${specs.brand}\n`;
      if (specs.model) fullDescription += `Model: ${specs.model}\n`;
      if (specs.modelNumber) fullDescription += `Model Number: ${specs.modelNumber}\n`;
      if (specs.category) fullDescription += `Category: ${specs.category}\n`;
      if (specs.subCategory) fullDescription += `Type: ${specs.subCategory}\n`;
      
      // Physical specs
      if (specs.dimensions) fullDescription += `Dimensions: ${specs.dimensions}\n`;
      if (specs.weight) fullDescription += `Weight: ${specs.weight}\n`;
      if (specs.capacity) fullDescription += `Capacity: ${specs.capacity}\n`;
      if (specs.color) fullDescription += `Color: ${specs.color}\n`;
      if (specs.material) fullDescription += `Material: ${specs.material}\n`;
      
      // Technical specs
      if (specs.powerSpecs) fullDescription += `Power: ${specs.powerSpecs}\n`;
      if (specs.connectivity) fullDescription += `Connectivity: ${specs.connectivity}\n`;
      if (specs.compatibility) fullDescription += `Compatibility: ${specs.compatibility}\n`;
      
      // Additional info
      if (specs.year) fullDescription += `Year: ${specs.year}\n`;
      if (specs.origin) fullDescription += `Made in: ${specs.origin}\n`;
      if (specs.certifications) fullDescription += `Certifications: ${specs.certifications}\n`;
      if (specs.warranty) fullDescription += `Warranty: ${specs.warranty}\n`;
      
      // All additional specs from allSpecs object
      if (specs.allSpecs && typeof specs.allSpecs === 'object') {
        Object.entries(specs.allSpecs).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            fullDescription += `${key}: ${value}\n`;
          }
        });
      }
      
      fullDescription += '\n';
    }
    
    if (marketplaceContent.shortMarketplaceSummary) {
      fullDescription += '🛒 QUICK SUMMARY:\n' + marketplaceContent.shortMarketplaceSummary + '\n\n';
    }
    
    // Add Long SEO Description
    if (marketplaceContent.longSeoDescription) {
      fullDescription += '🌐 SEO DESCRIPTION:\n' + marketplaceContent.longSeoDescription + '\n\n';
    }
    
    // Add SEO Keywords
    if (marketplaceContent.seoKeywords) {
      fullDescription += '🔍 KEYWORDS:\n';
      
      if (marketplaceContent.seoKeywords.primary && marketplaceContent.seoKeywords.primary.length > 0) {
        fullDescription += 'Primary: ' + marketplaceContent.seoKeywords.primary.join(', ') + '\n';
      }
      
      if (marketplaceContent.seoKeywords.secondary && marketplaceContent.seoKeywords.secondary.length > 0) {
        fullDescription += 'Secondary: ' + marketplaceContent.seoKeywords.secondary.join(', ') + '\n';
      }
      
      if (marketplaceContent.seoKeywords.longTail && marketplaceContent.seoKeywords.longTail.length > 0) {
        fullDescription += 'Long-tail: ' + marketplaceContent.seoKeywords.longTail.join(', ') + '\n';
      }
      
      fullDescription += '\n';
    }
    
    // Add Marketplace Tags
    if (marketplaceContent.marketplaceTags && marketplaceContent.marketplaceTags.length > 0) {
      fullDescription += '🏷️ TAGS:\n' + marketplaceContent.marketplaceTags.join(', ') + '\n\n';
    }

    // Format response for simplified schema
    const response = {
      title: analysis.title,
      description: fullDescription.trim() || analysis.description,
      model_number: model_number || analysis.specifications?.modelNumber || '',
      photo_url: image_url,
      condition: analysis.condition || 'good',
    };

    res.json({
      success: true,
      listing_data: response,
      analysis_details: analysis,
    });
  })
);

export default router;
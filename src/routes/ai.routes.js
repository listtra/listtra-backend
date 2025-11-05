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

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required',
      });
    }

    // Get image URLs from uploaded files
    const imageUrls = req.files.map(file => file.path);

    // Analyze images with AI
    const analysis = await aiService.analyzeProductImages(
      imageUrls,
      req.body.modelNumber,
      req.body.additionalInfo
    );

    // Format response for simplified schema
    const response = {
      title: analysis.title,
      description: analysis.description,
      model_number: req.body.modelNumber || analysis.specifications?.modelNumber || '',
      photo_url: imageUrls[0], // Main photo
      additional_photos: imageUrls.slice(1), // Rest of the photos
      ai_metadata: {
        generated: true,
        category: analysis.category?.main || '',
        condition: analysis.condition,
        suggested_price: analysis.suggestedPrice,
        keywords: analysis.searchKeywords || [],
        confidence: analysis.confidence,
      },
    };

    res.json({
      success: true,
      listing_data: response,
      analysis_details: analysis,
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

    // Format response for simplified schema
    const response = {
      title: analysis.title,
      description: analysis.description,
      model_number: model_number || analysis.specifications?.modelNumber || '',
      photo_url: image_url,
      ai_metadata: {
        generated: true,
        category: analysis.category?.main || '',
        condition: analysis.condition,
        suggested_price: analysis.suggestedPrice,
        keywords: analysis.searchKeywords || [],
        confidence: analysis.confidence,
      },
    };

    res.json({
      success: true,
      listing_data: response,
    });
  })
);

export default router;
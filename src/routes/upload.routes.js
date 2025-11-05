import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';
import { 
  uploadListingImages, 
  uploadProfileImage, 
  uploadDocument,
  cloudinaryHelpers 
} from '../config/cloudinary.js';

const router = Router();

// All upload routes require authentication
router.use(authenticate);
router.use(uploadRateLimiter);

// Upload listing images
router.post(
  '/listing-images',
  uploadListingImages.array('images', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images provided',
      });
    }

    const images = req.files.map((file, index) => ({
      url: file.path,
      publicId: file.filename,
      thumbnail: cloudinaryHelpers.getThumbnailUrl(file.filename),
      width: file.width,
      height: file.height,
      format: file.format,
      size: file.size,
      isMain: index === 0,
      order: index,
    }));

    res.json({
      success: true,
      images,
      count: images.length,
    });
  })
);

// Upload profile image
router.post(
  '/profile-image',
  uploadProfileImage.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided',
      });
    }

    const image = {
      url: req.file.path,
      publicId: req.file.filename,
      thumbnail: cloudinaryHelpers.getThumbnailUrl(req.file.filename, 150, 150),
    };

    res.json({
      success: true,
      image,
    });
  })
);

// Upload verification document
router.post(
  '/document',
  uploadDocument.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document provided',
      });
    }

    const document = {
      url: req.file.path,
      publicId: req.file.filename,
      format: req.file.format || req.file.mimetype,
      size: req.file.size,
    };

    res.json({
      success: true,
      document,
    });
  })
);

// Upload from URL
router.post(
  '/from-url',
  asyncHandler(async (req, res) => {
    const { url, folder = 'general' } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required',
      });
    }

    try {
      const result = await cloudinaryHelpers.uploadFromUrl(url, `listtra/${folder}`);

      res.json({
        success: true,
        image: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload from URL',
        error: error.message,
      });
    }
  })
);

// Upload base64 image
router.post(
  '/base64',
  asyncHandler(async (req, res) => {
    const { base64, folder = 'general' } = req.body;

    if (!base64) {
      return res.status(400).json({
        success: false,
        message: 'Base64 string is required',
      });
    }

    try {
      const result = await cloudinaryHelpers.uploadBase64(base64, `listtra/${folder}`);

      res.json({
        success: true,
        image: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload base64 image',
        error: error.message,
      });
    }
  })
);

// Delete image
router.delete(
  '/image/:publicId',
  asyncHandler(async (req, res) => {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required',
      });
    }

    try {
      await cloudinaryHelpers.deleteImage(publicId);

      res.json({
        success: true,
        message: 'Image deleted successfully',
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete image',
        error: error.message,
      });
    }
  })
);

// Delete multiple images
router.post(
  '/delete-batch',
  asyncHandler(async (req, res) => {
    const { publicIds } = req.body;

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Public IDs array is required',
      });
    }

    try {
      const results = await cloudinaryHelpers.deleteImages(publicIds);

      res.json({
        success: true,
        message: `${publicIds.length} images deleted`,
        results,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete images',
        error: error.message,
      });
    }
  })
);

// Get signed URL for private resource
router.get(
  '/signed-url/:publicId',
  asyncHandler(async (req, res) => {
    const { publicId } = req.params;
    const { expiresIn = 3600 } = req.query;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'Public ID is required',
      });
    }

    try {
      const signedUrl = await cloudinaryHelpers.getSignedUrl(
        publicId,
        parseInt(expiresIn)
      );

      res.json({
        success: true,
        url: signedUrl,
        expiresIn: parseInt(expiresIn),
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Failed to generate signed URL',
        error: error.message,
      });
    }
  })
);

export default router;

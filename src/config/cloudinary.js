import  cloudinary from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create storage configurations for different upload types
const createStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'webp']) => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `listtra/${folder}`,
      allowed_formats: allowedFormats,
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    },
  });
};

// Storage for listing images
const listingImageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'listtra/listings',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      public_id: `listing_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
        { width: 1200, height: 1200, crop: 'limit' },
      ],
    };
  },
});

// Storage for profile images
const profileImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'listtra/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'fill', gravity: 'face' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' },
    ],
  },
});

// Storage for verification documents
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'listtra/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto',
    access_mode: 'authenticated', // Secure documents
  },
});

// Create multer instances
export const uploadListingImages = multer({
  storage: listingImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Maximum 10 images per listing
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

export const uploadProfileImage = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

export const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
});

// Cloudinary helper functions
export const cloudinaryHelpers = {
  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  },

  // Delete multiple images
  async deleteImages(publicIds) {
    try {
      const results = await Promise.all(
        publicIds.map(publicId => cloudinary.uploader.destroy(publicId))
      );
      return results;
    } catch (error) {
      console.error('Error deleting images:', error);
      throw error;
    }
  },

  // Generate optimized URL
  getOptimizedUrl(publicId, options = {}) {
    const defaultOptions = {
      quality: 'auto:good',
      fetch_format: 'auto',
      ...options,
    };
    
    return cloudinary.url(publicId, defaultOptions);
  },

  // Generate thumbnail URL
  getThumbnailUrl(publicId, width = 300, height = 300) {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'fill',
      quality: 'auto:low',
      fetch_format: 'auto',
    });
  },

  // Upload image from URL
  async uploadFromUrl(url, folder = 'listtra/general') {
    try {
      const result = await cloudinary.uploader.upload(url, {
        folder,
        resource_type: 'auto',
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      };
    } catch (error) {
      console.error('Error uploading from URL:', error);
      throw error;
    }
  },

  // Upload base64 image
  async uploadBase64(base64String, folder = 'listtra/general') {
    try {
      const result = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${base64String}`,
        { folder }
      );
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      };
    } catch (error) {
      console.error('Error uploading base64:', error);
      throw error;
    }
  },

  // Generate signed URL for private resources
  async getSignedUrl(publicId, expiresIn = 3600) {
    const timestamp = Math.round(new Date().getTime() / 1000) + expiresIn;
    
    const signature = cloudinary.utils.api_sign_request(
      { public_id: publicId, timestamp },
      process.env.CLOUDINARY_API_SECRET
    );
    
    return cloudinary.url(publicId, {
      sign_url: true,
      auth_token: {
        key: process.env.CLOUDINARY_API_KEY,
        duration: expiresIn,
        auth_token: signature,
      },
    });
  },
};

export default cloudinary;

import { Router } from 'express';
import { param, query } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { uploadProfileImage } from '../config/cloudinary.js';
import User from '../models/User.js';
import Listing from '../models/Listing.js';

const router = Router();

// Get user by ID (public profile)
router.get(
  '/:id',
  param('id').isMongoId(),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get user's active listings count
    const listingsCount = await Listing.countDocuments({
      user_id: user._id,
      status: 'active',
    });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        listingsCount,
      },
    });
  })
);

// Get user by email
router.get(
  '/email/:email',
  param('email').isEmail(),
  asyncHandler(async (req, res) => {
    const user = await User.findByEmail(req.params.email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });
  })
);

// Search users
router.get(
  '/',
  [
    query('q').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ];
    }

    const users = await User.find(filter)
      .select('name email avatar_url created_at')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

// Protected routes
router.use(authenticate);

// Upload profile image
router.post(
  '/profile-image',
  uploadProfileImage.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar_url: req.file.path },
      { new: true }
    );

    res.json({
      success: true,
      avatar_url: user.avatar_url,
    });
  })
);

// Get user's listings
router.get(
  '/:id/listings',
  param('id').isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const listings = await Listing.find({
      user_id: req.params.id,
      status: 'active',
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Listing.countDocuments({
      user_id: req.params.id,
      status: 'active',
    });

    res.json({
      success: true,
      listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

export default router;
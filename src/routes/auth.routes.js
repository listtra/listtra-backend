import { Router } from 'express';
import { body } from 'express-validator';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import User from '../models/User.js';

const router = Router();

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      user,
    });
  })
);

// Update current user profile
router.patch(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ max: 100 }),
    body('avatar_url').optional().isURL(),
  ],
  asyncHandler(async (req, res) => {
    const allowedUpdates = ['name', 'avatar_url'];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      user,
    });
  })
);

// Delete account (soft delete - just for future reference, actual deletion handled by Clerk)
router.delete(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    // In production, you might want to:
    // 1. Delete or anonymize all user's listings
    // 2. Remove user from database
    // 3. Notify Clerk to delete the account
    
    // For now, we'll just mark listings as deleted
    const Listing = mongoose.model('Listing');
    await Listing.updateMany(
      { user_id: req.user._id },
      { status: 'deleted' }
    );

    res.json({
      success: true,
      message: 'Account deletion initiated. Your data will be removed shortly.',
    });
  })
);

// Logout (mainly handled client-side with Clerk)
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // Any server-side cleanup can be done here
    // Clerk handles the actual session termination
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

export default router;
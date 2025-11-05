import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { searchRateLimiter } from '../middleware/rateLimiter.js';
import listingController from '../controllers/listing.controller.js';

const router = Router();

// Validation middleware
const validateListing = [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('description').trim().notEmpty().isLength({ max: 5000 }),
  body('photo_url').notEmpty().isURL(),
  body('model_number').optional().trim().isLength({ max: 100 }),
  body('additional_photos').optional().isArray(),
  body('additional_photos.*').optional().isURL(),
];

const validateSearch = [
  query('q').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
];

// Public routes (no auth required)
router.get(
  '/search',
  searchRateLimiter,
  validateSearch,
  asyncHandler(listingController.search)
);

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  asyncHandler(listingController.getAll)
);

router.get(
  '/:id',
  param('id').isMongoId(),
  asyncHandler(listingController.getById)
);

router.get(
  '/user/:userId',
  param('userId').isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('includeInactive').optional().isBoolean(),
  asyncHandler(listingController.getByUser)
);

// Protected routes (require authentication)
router.use(authenticate);

router.post(
  '/',
  validateListing,
  asyncHandler(listingController.create)
);

router.post(
  '/create-with-ai',
  [
    ...validateListing,
    body('category').optional().trim(),
    body('condition').optional().trim(),
    body('suggested_price').optional().isObject(),
    body('keywords').optional().isArray(),
    body('confidence').optional().isFloat({ min: 0, max: 1 }),
  ],
  asyncHandler(listingController.createWithAI)
);

router.put(
  '/:id',
  param('id').isMongoId(),
  validateListing,
  asyncHandler(listingController.update)
);

router.patch(
  '/:id/status',
  param('id').isMongoId(),
  body('status').isIn(['active', 'sold', 'draft']),
  asyncHandler(async (req, res) => {
    req.body = { status: req.body.status };
    return listingController.update(req, res);
  })
);

router.delete(
  '/:id',
  param('id').isMongoId(),
  asyncHandler(listingController.delete)
);

router.post(
  '/:id/mark-sold',
  param('id').isMongoId(),
  asyncHandler(listingController.markSold)
);

router.get(
  '/my/listings',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['active', 'sold', 'draft', 'all']),
  asyncHandler(listingController.getMyListings)
);

export default router;
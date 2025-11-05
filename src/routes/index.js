import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import listingRoutes from './listing.routes.js';
import uploadRoutes from './upload.routes.js';
import aiRoutes from './ai.routes.js';
import { handleClerkWebhook } from '../middleware/clerkWebhook.js';

const router = Router();

// Webhook route (no auth required)
router.post('/webhooks/clerk', handleClerkWebhook);

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/listings', listingRoutes);
router.use('/upload', uploadRoutes);
router.use('/ai', aiRoutes);

// API info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Listtra API v1.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      listings: '/api/listings',
      upload: '/api/upload',
      ai: '/api/ai',
    },
  });
});

export default router;

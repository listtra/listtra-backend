import rateLimit from 'express-rate-limit';

// General rate limiter
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Strict rate limiter for auth endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts. Please try again later.',
  skipSuccessfulRequests: true,
});

// Rate limiter for file uploads
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Upload limit reached. Please try again later.',
});

// Rate limiter for API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'API rate limit exceeded.',
});

// Rate limiter for search endpoints
export const searchRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: 'Search rate limit exceeded.',
});

// Dynamic rate limiter based on user role
export const dynamicRateLimiter = (req, res, next) => {
  const limits = {
    admin: 1000,
    moderator: 500,
    seller: 200,
    user: 100,
    guest: 50,
  };
  
  const userRole = req.user?.role || 'guest';
  const limit = limits[userRole] || limits.guest;
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: limit,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: `Rate limit exceeded. ${userRole} accounts are limited to ${limit} requests per 15 minutes.`,
      });
    },
  });
  
  limiter(req, res, next);
};

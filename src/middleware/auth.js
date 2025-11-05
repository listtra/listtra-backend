import { clerkClient } from '@clerk/express';
import { verifyToken } from '@clerk/backend';
import mongoose from 'mongoose';
import User from '../models/User.js';

// Verify Clerk session and attach user to request
export const authenticate = async (req, res, next) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided',
      });
    }

    const payload = await verifyToken(sessionToken, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session'
      })
    }

    const clerkUserId = payload.sub;

    // Verify the session with Clerk
    // const session = await clerkClient.sessions.verifySession(
    //   sessionToken,
    //   process.env.CLERK_SECRET_KEY
    // );

    // if (!session) {
    //   return res.status(401).json({
    //     success: false,
    //     message: 'Invalid or expired session',
    //   });
    // }

    // Get or create user in our database
    let user = await User.findByClerkId(clerkUserId);

    if (!user) {
      // Fetch user details from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      // Create user in our database
      user = await User.createFromClerk(clerkUser);
    }

    // No need to update last active in simplified model

    // Attach user to request
    req.user = user;
    req.clerkUserId = clerkUserId;
    req.sessionId = payload.sid;

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    // Handle token expiration
    if (error.message?.includes('expired') || error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please login again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return next();
    }

    const session = await clerkClient.sessions.verifySession(
      sessionToken,
      process.env.CLERK_SECRET_KEY
    );

    if (session) {
      const user = await User.findByClerkId(session.userId);
      if (user) {
        req.user = user;
        req.clerkUserId = session.userId;
      }
    }
  } catch (error) {
    // Silent fail for optional auth
    console.log('Optional auth failed:', error.message);
  }

  next();
};

// Role checking not needed in simplified version

// Check if user is the resource owner
export const requireOwnership = (modelName, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = mongoose.model(modelName);
      const resource = await Model.findById(req.params[paramName]);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: `${modelName} not found`,
        });
      }

      // Check ownership based on model
      let isOwner = false;

      // For listings, check user_id field
      if (resource.user_id) {
        isOwner = resource.user_id.toString() === req.user._id.toString();
      }

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource',
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
      });
    }
  };
};

// Additional middleware removed for simplified version

import { Webhook } from 'svix';
import mongoose from 'mongoose';
import User from '../models/User.js';

export const handleClerkWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error('CLERK_WEBHOOK_SECRET is not configured');
    }

    // Get headers
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    // Verify webhook
    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing svix headers',
      });
    }

    const payload = JSON.stringify(req.body);
    const wh = new Webhook(webhookSecret);

    let event;
    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    // Handle different event types
    const { type, data } = event;

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
        
      case 'user.updated':
        await handleUserUpdated(data);
        break;
        
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
        
      case 'session.created':
        await handleSessionCreated(data);
        break;
        
      case 'session.ended':
      case 'session.removed':
      case 'session.revoked':
        await handleSessionEnded(data);
        break;
        
      default:
        console.log(`Unhandled webhook event: ${type}`);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
    });
  }
};

// Handle user created event
async function handleUserCreated(clerkUser) {
  try {
    // Debug: Log the incoming Clerk user data
    console.log('Clerk user data received:', JSON.stringify(clerkUser, null, 2));

    // Handle test events or users without email differently
    if (clerkUser.id?.startsWith('user_test_') || !clerkUser.email_addresses?.length) {
      console.log('Skipping test event or user without email:', clerkUser.id);
      return;
    }

    // Check if user already exists
    const existingUser = await User.findByClerkId(clerkUser.id);
    
    if (existingUser) {
      console.log(`User already exists: ${clerkUser.id}`);
      return;
    }

    // Determine auth provider
    let authProvider = 'google';
    if (clerkUser.external_accounts?.[0]?.provider === 'oauth_apple') {
      authProvider = 'apple';
    }

    // Extract email with multiple fallbacks
    const email = clerkUser.email_addresses?.[0]?.email_address || 
                  clerkUser.primary_email_address_id || 
                  `${clerkUser.id}@clerk.local`;

    // Create new user with simplified schema
    const userData = {
      clerkId: clerkUser.id,
      name: `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() || 
            clerkUser.username || 
            'User',
      email: email,
      auth_provider: authProvider,
      avatar_url: clerkUser.image_url,
      created_at: new Date(),
    };

    // Validate required fields before creating
    if (!userData.email || userData.email.includes('@clerk.local')) {
      console.log('Skipping user creation - no valid email found:', userData);
      return;
    }

    const user = await User.create(userData);
    console.log(`User created successfully: ${user._id} with email: ${user.email}`);
  } catch (error) {
    console.error('Error creating user:', error);
    // Don't throw error for webhook - just log it
    console.error('User data that failed:', clerkUser);
  }
}

// Handle user updated event
async function handleUserUpdated(clerkUser) {
  try {
    console.log('Updating user:', clerkUser.id);
    
    const user = await User.findByClerkId(clerkUser.id);
    
    if (!user) {
      console.log(`User not found for update: ${clerkUser.id}`);
      // Create user if doesn't exist
      return handleUserCreated(clerkUser);
    }

    // Update user data with simplified schema and better email handling
    user.name = `${clerkUser.first_name || ''} ${clerkUser.last_name || ''}`.trim() || 
                clerkUser.username || 
                user.name;
    
    // Only update email if a valid one is provided
    const newEmail = clerkUser.email_addresses?.[0]?.email_address;
    if (newEmail && !newEmail.includes('@clerk.local')) {
      user.email = newEmail;
    }
    
    user.avatar_url = clerkUser.image_url || user.avatar_url;

    await user.save();
    console.log(`User updated successfully: ${user._id}`);
  } catch (error) {
    console.error('Error updating user:', error);
    // Don't throw error for webhook - just log it
  }
}

// Handle user deleted event
async function handleUserDeleted(clerkUser) {
  try {
    const user = await User.findByClerkId(clerkUser.id);
    
    if (!user) {
      console.log(`User not found for deletion: ${clerkUser.id}`);
      return;
    }

    // For simplified schema, we can just delete the user
    // But first, mark all their listings as deleted
    const Listing = mongoose.model('Listing');
    await Listing.updateMany(
      { user_id: user._id },
      { status: 'deleted' }
    );
    
    // Optionally delete the user record
    // await user.deleteOne();
    
    console.log(`User deactivated: ${user._id}`);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

// Handle session created event
async function handleSessionCreated(session) {
  try {
    const user = await User.findByClerkId(session.user_id);
    
    if (user) {
      console.log(`User session created: ${user._id}`);
    }
  } catch (error) {
    console.error('Error handling session created:', error);
  }
}

// Handle session ended event
async function handleSessionEnded(session) {
  try {
    const user = await User.findByClerkId(session.user_id);
    
    if (user) {
      console.log(`User session ended: ${user._id}`);
    }
  } catch (error) {
    console.error('Error handling session ended:', error);
  }
}

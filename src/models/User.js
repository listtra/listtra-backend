import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  auth_provider: {
    type: String,
    required: true,
    enum: ['google', 'apple'],
  },
  avatar_url: {
    type: String,
    default: null,
  },
  // Clerk ID for authentication
  clerkId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false, // We're using created_at instead
});

// Indexes for performance
userSchema.index({ created_at: -1 });

// Methods
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  // Remove sensitive fields from JSON output
  delete userObject.clerkId;
  return userObject;
};

// Static methods
userSchema.statics.findByClerkId = function(clerkId) {
  return this.findOne({ clerkId });
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.createFromClerk = async function(clerkUser) {
  // Determine auth provider from Clerk user data
  let authProvider = 'google'; // default
  if (clerkUser.externalAccounts?.[0]?.provider) {
    const provider = clerkUser.externalAccounts[0].provider;
    if (provider === 'oauth_apple') {
      authProvider = 'apple';
    } else if (provider === 'oauth_google') {
      authProvider = 'google';
    }
  }

  const userData = {
    clerkId: clerkUser.id,
    name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 
          clerkUser.username || 
          'User',
    email: clerkUser.emailAddresses[0]?.emailAddress,
    auth_provider: authProvider,
    avatar_url: clerkUser.imageUrl,
    created_at: new Date(),
  };
  
  return this.create(userData);
};

const User = mongoose.model('User', userSchema);

export default User;
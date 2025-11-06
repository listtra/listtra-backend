import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: 'text',
  },
  model_number: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },
  photo_url: {
    type: String,
    required: false,
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000,
    index: 'text',
  },
  // Additional photos (optional)
  additional_photos: [{
    type: String,
  }],
  // AI-generated metadata (optional, for enhanced features)
  ai_metadata: {
    generated: {
      type: Boolean,
      default: false,
    },
    category: String,
    condition: String,
    suggested_price: {
      min: Number,
      max: Number,
    },
    keywords: [String],
    confidence: Number,
  },
  // Status for soft delete or draft functionality
  status: {
    type: String,
    enum: ['active', 'sold', 'deleted', 'draft'],
    default: 'active',
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
listingSchema.index({ user_id: 1, status: 1 });
listingSchema.index({ created_at: -1 });
listingSchema.index({ title: 'text', description: 'text' });
listingSchema.index({ model_number: 1 });

// Virtual to get user details when populated
listingSchema.virtual('user', {
  ref: 'User',
  localField: 'user_id',
  foreignField: '_id',
  justOne: true,
});

// Methods
listingSchema.methods.toJSON = function() {
  const listing = this.toObject();
  // Clean up the output
  if (listing.ai_metadata && !listing.ai_metadata.generated) {
    delete listing.ai_metadata;
  }
  return listing;
};

listingSchema.methods.markAsSold = async function() {
  this.status = 'sold';
  return this.save();
};

listingSchema.methods.softDelete = async function() {
  this.status = 'deleted';
  return this.save();
};

// Static methods
listingSchema.statics.findActive = function(filter = {}) {
  return this.find({
    ...filter,
    status: 'active',
  }).sort({ created_at: -1 });
};

listingSchema.statics.findByUser = function(userId, includeInactive = false) {
  const filter = { user_id: userId };
  if (!includeInactive) {
    filter.status = 'active';
  }
  return this.find(filter).sort({ created_at: -1 });
};

listingSchema.statics.search = async function(query, options = {}) {
  const {
    page = 1,
    limit = 20,
  } = options;
  
  const filter = {
    status: 'active',
  };
  
  // Text search
  if (query) {
    filter.$text = { $search: query };
  }
  
  const skip = (page - 1) * limit;
  
  const listings = await this.find(filter)
    .sort({ created_at: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user_id', 'name email avatar_url');
  
  const total = await this.countDocuments(filter);
  
  return {
    listings,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const Listing = mongoose.model('Listing', listingSchema);

export default Listing;
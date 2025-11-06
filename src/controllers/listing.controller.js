import Listing from '../models/Listing.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { validationResult } from 'express-validator';

const listingController = {
  // Search listings
  async search(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const {
      q,
      page = 1,
      limit = 20,
    } = req.query;

    const result = await Listing.search(q, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      ...result,
    });
  },

  // Get all active listings
  async getAll(req, res) {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const listings = await Listing.findActive()
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user_id', 'name email avatar_url');

    const total = await Listing.countDocuments({ status: 'active' });

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
  },

  // Get listing by ID
  async getById(req, res) {
    const listing = await Listing.findById(req.params.id)
      .populate('user_id', 'name email avatar_url');

    if (!listing || listing.status === 'deleted') {
      throw new AppError('Listing not found', 404);
    }

    res.json({
      success: true,
      listing,
    });
  },

  // Get listings by user
  async getByUser(req, res) {
    const { page = 1, limit = 20, includeInactive = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const listings = await Listing.findByUser(
      req.params.userId,
      includeInactive === 'true'
    )
      .skip(skip)
      .limit(parseInt(limit));

    const filter = { user_id: req.params.userId };
    if (includeInactive !== 'true') {
      filter.status = 'active';
    }

    const total = await Listing.countDocuments(filter);

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
  },

  // Create listing
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Validate that we have either photo_url or model_number
    if (!req.body.photo_url && !req.body.model_number) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'Either photo_url or model_number is required' }],
      });
    }

    const listingData = {
      user_id: req.user._id,
      title: req.body.title,
      model_number: req.body.model_number || '',
      photo_url: req.body.photo_url || '',
      description: req.body.description,
      additional_photos: req.body.additional_photos || [],
      ai_metadata: req.body.ai_metadata || {},
      status: req.body.status || 'active',
      created_at: new Date(),
    };

    const listing = await Listing.create(listingData);
    await listing.populate('user_id', 'name email avatar_url');

    res.status(201).json({
      success: true,
      listing,
    });
  },

  // Update listing
  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      throw new AppError('Listing not found', 404);
    }

    // Check ownership
    if (listing.user_id.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to update this listing', 403);
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'model_number', 'photo_url', 'description', 'additional_photos', 'status'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        listing[field] = req.body[field];
      }
    });

    // Update AI metadata if provided
    if (req.body.ai_metadata) {
      listing.ai_metadata = { ...listing.ai_metadata, ...req.body.ai_metadata };
    }

    await listing.save();
    await listing.populate('user_id', 'name email avatar_url');

    res.json({
      success: true,
      listing,
    });
  },

  // Delete listing (soft delete)
  async delete(req, res) {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      throw new AppError('Listing not found', 404);
    }

    // Check ownership
    if (listing.user_id.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to delete this listing', 403);
    }

    await listing.softDelete();

    res.json({
      success: true,
      message: 'Listing deleted successfully',
    });
  },

  // Mark as sold
  async markSold(req, res) {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      throw new AppError('Listing not found', 404);
    }

    // Check ownership
    if (listing.user_id.toString() !== req.user._id.toString()) {
      throw new AppError('Not authorized to update this listing', 403);
    }

    await listing.markAsSold();

    res.json({
      success: true,
      message: 'Listing marked as sold',
    });
  },

  // Get my listings
  async getMyListings(req, res) {
    const { page = 1, limit = 20, status = 'active' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { user_id: req.user._id };

    if (status !== 'all') {
      filter.status = status;
    }

    const listings = await Listing.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Listing.countDocuments(filter);

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
  },

  // Create listing with AI analysis
  async createWithAI(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Validate that we have either photo_url or model_number
    if (!req.body.photo_url && !req.body.model_number) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'Either photo_url or model_number is required' }],
      });
    }

    // The AI analysis should be done before this endpoint is called
    // This receives the analyzed data and creates the listing
    const listingData = {
      user_id: req.user._id,
      title: req.body.title,
      model_number: req.body.model_number || '',
      photo_url: req.body.photo_url || '',
      description: req.body.description,
      additional_photos: req.body.additional_photos || [],
      ai_metadata: {
        generated: true,
        category: req.body.category,
        condition: req.body.condition,
        suggested_price: req.body.suggested_price,
        keywords: req.body.keywords || [],
        confidence: req.body.confidence || 0,
      },
      status: 'active',
      created_at: new Date(),
    };

    const listing = await Listing.create(listingData);
    await listing.populate('user_id', 'name email avatar_url');

    res.status(201).json({
      success: true,
      listing,
      message: 'Listing created with AI-generated content',
    });
  },
};

export default listingController;
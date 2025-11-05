# Listtra Backend - AI-Powered Marketplace API

A robust, production-ready backend for an AI-powered marketplace application built with Express.js, MongoDB, and integrated AI services for intelligent product listing creation.

## 🚀 Features

### Core Functionality
- **User Management**: Complete user authentication and profile management via Clerk
- **Listing Management**: Full CRUD operations for product listings with advanced search
- **AI Integration**: Automatic product analysis and description generation using Google Gemini/GPT-4 Vision
- **Image Management**: Cloudinary integration for optimized image storage and delivery

### Security & Performance
- **Authentication**: Secure authentication with Clerk (Apple & Google login)
- **Rate Limiting**: Configurable rate limiting for API endpoints
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Centralized error handling with detailed logging
- **CORS Configuration**: Flexible CORS setup for mobile and web clients

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 6.0+
- Clerk account for authentication
- Cloudinary account for image storage
- Google AI API key (for Gemini) or OpenAI API key (for GPT-4)

## 🛠️ Installation

1. **Clone the repository**
```bash
cd listtra-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/listtra

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI Services
GOOGLE_AI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Frontend URL
FRONTEND_URL=http://localhost:8081
```

4. **Start MongoDB**
```bash
mongod
```

5. **Run the server**
```bash
# Development
npm run dev

# Production
npm start
```

## 📁 Project Structure

```
src/
├── config/           # Configuration files
│   ├── database.js   # MongoDB connection
│   └── cloudinary.js # Cloudinary setup
├── controllers/      # Request handlers
│   └── listing.controller.js
├── middleware/       # Express middleware
│   ├── auth.js       # Authentication
│   ├── errorHandler.js
│   └── rateLimiter.js
├── models/          # MongoDB schemas
│   ├── User.js
│   └── Listing.js
├── routes/          # API routes
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── listing.routes.js
│   ├── upload.routes.js
│   └── ai.routes.js
├── services/        # Business logic
│   └── ai.service.js # AI integration
└── server.js        # Express app setup
```

## 🔌 API Endpoints

### Authentication
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update profile
- `POST /api/auth/become-seller` - Upgrade to seller account

### Listings
- `GET /api/listings/search` - Search listings
- `GET /api/listings/:id` - Get listing details
- `POST /api/listings` - Create listing (auth required)
- `PUT /api/listings/:id` - Update listing (auth required)
- `DELETE /api/listings/:id` - Delete listing (auth required)
- `POST /api/listings/:id/toggle-like` - Like/unlike listing

### AI Services
- `POST /api/ai/analyze-product` - Analyze product images
- `POST /api/ai/generate-title` - Generate product title
- `POST /api/ai/enhance-description` - Enhance description with SEO

### Uploads
- `POST /api/upload/listing-images` - Upload listing images
- `POST /api/upload/profile-image` - Upload profile image
- `DELETE /api/upload/image/:publicId` - Delete image

## 🔒 Security Features

- **Clerk Integration**: Secure authentication with session management
- **Input Validation**: Express-validator for all endpoints
- **MongoDB Injection Prevention**: express-mongo-sanitize
- **XSS Protection**: Helmet.js security headers
- **Rate Limiting**: Configurable limits per endpoint
- **CORS**: Whitelist-based origin control
- **File Upload Security**: Type and size validation

## 🚀 Deployment

### Environment Setup
1. Set all production environment variables
2. Update `MONGODB_URI_PROD` with production database
3. Configure `FRONTEND_URL_PROD` for your app domain

### Deploy to Production
```bash
# Build and start
NODE_ENV=production npm start
```

### Recommended Hosting
- **Server**: Railway, Render, or AWS EC2
- **Database**: MongoDB Atlas
- **File Storage**: Cloudinary (already configured)

## 📊 Database Schema

### User Model
- Clerk integration for auth
- Profile information
- Seller verification
- Statistics tracking
- Saved listings
- Following/followers system

### Listing Model
- Product details
- AI-generated content
- Location-based search
- Image management
- Boost/promotion system
- Condition tracking
- Reserve functionality

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 🔧 Maintenance

### Database Backup
```bash
mongodump --db listtra --out ./backup
```

### Database Restore
```bash
mongorestore --db listtra ./backup/listtra
```

### Logs
- Development: Console output
- Production: Combined log files

## 📝 License

MIT

## 👥 Support

For issues and questions, please create an issue in the repository.

## 🎯 Roadmap

- [ ] WebSocket support for real-time messaging
- [ ] Payment integration (Stripe)
- [ ] Advanced analytics dashboard
- [ ] Email notifications
- [ ] Push notifications
- [ ] Multi-language support
- [ ] Advanced fraud detection
- [ ] Elasticsearch integration

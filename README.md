# CyberCheck Backend API

**Multi-tenant backend API** for business management platform. Serves dashboard and customer websites.

## Features

- 🔐 **Supabase Auth** - Secure authentication
- 🏢 **Multi-Tenant** - Supports unlimited businesses with data isolation
- 🌐 **Domain Resolution** - Routes custom domains to correct business
- 💳 **Stripe Connect** - Payment processing for businesses
- 📊 **Analytics** - Page view and conversion tracking
- 🔌 **OAuth** - Integrations with Google, Facebook, Square, Clover
- 📧 **Webhooks** - Event-driven automation

## API Routes

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout

### Dashboard (Authenticated)
- `GET /api/dashboard/profile` - Get business profile
- `PUT /api/dashboard/profile` - Update profile
- `GET /api/dashboard/analytics` - Get analytics data
- `GET /api/dashboard/seo` - Get SEO settings
- `GET /api/dashboard/social` - Get social media data
- [100+ more endpoints...]

### Public (Customer-Facing)
- `GET /api/public/profile?subdomain=xxx` - Business info
- `GET /api/public/fleet?subdomain=xxx` - Products/inventory
- `POST /api/public/bookings?subdomain=xxx` - Create booking/order
- `GET /api/public/reviews?subdomain=xxx` - Reviews
- `GET /api/public/availability?subdomain=xxx` - Availability

### Analytics
- `POST /api/analytics/pageview` - Track page view
- `POST /api/analytics/conversion` - Track conversion
- `POST /api/analytics/event` - Track custom event

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create `.env` file:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
PORT=3000
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_xxx
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 3. Deploy Database Schema
Run SQL files in Supabase SQL Editor in order:
```bash
01-tables.sql
02-security.sql
03-seed-data.sql
04-ai-webhook.sql
05-storage-policies.sql
06-analytics-seo-social.sql
```

### 4. Start Server
```bash
npm start
# or
node server.js
```

Server runs on `http://localhost:3000`

## Database Schema

- **businesses** - Business accounts (one per customer)
- **users** - User accounts (linked to businesses via site_id)
- **bookings** - Reservations/orders
- **customers** - Customer database
- **fleet_types** - Inventory items (boats, products, services)
- **reviews** - Customer reviews
- **page_views** - Analytics tracking
- **conversions** - Conversion tracking
- **seo_meta_tags** - SEO settings per page
- **social_media_posts** - Social media scheduling
- [40+ more tables...]

## Multi-Tenant Security

- Row Level Security (RLS) on all tables
- Users can only access their own site_id data
- Domain middleware resolves custom domains
- Auth middleware protects dashboard routes

## Dependencies

```json
{
  "express": "^4.22.1",
  "cors": "^2.8.6",
  "dotenv": "^16.6.1",
  "@supabase/supabase-js": "^2.x"
}
```

## License

Proprietary - CyberCheck Platform

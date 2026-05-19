# Gulf Coast Radar — Complete Setup & Implementation Guide

## What You Have Now

✅ **Database Schema** — 30+ tables storing comprehensive business data  
✅ **API** — Routes that query and return all this data  
✅ **Frontend** — Clean QR menu viewer + admin dashboard  
✅ **Data** — Cosmos Restaurant imported with full menu  

---

## Step 1: Initialize Database Schema

### Option A: Using Supabase Dashboard
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file: `/Users/owner/cybercheck-api-database/GCR-DATABASE-SCHEMA.sql`
3. Copy all contents
4. Paste into Supabase SQL Editor
5. Click **Execute**

### Option B: Using psql CLI
```bash
psql -h xbptmkpbiqzvxptjkfoi.supabase.co \
     -U postgres \
     -d postgres \
     -f /Users/owner/cybercheck-api-database/GCR-DATABASE-SCHEMA.sql
```

### Verify Tables Created
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see all tables listed in `BUSINESS-DATA-DICTIONARY.md`.

---

## Step 2: Import Existing Business Data

You have two test businesses:

### Business 1: Cobalt (Simple Menu)
- **Slug:** `cobalt-the-restaurant-Bx1gX8`
- **Data:** BBQ Gulf Shrimp, Crab Dip, Pecan Catfish
- **Status:** Working ✅

### Business 2: Cosmos Restaurant (Full Menu)
- **Slug:** `cosmos-restaurant-and-bar-orange-beach`
- **Data:** 9 sections, 60 menu items, full cocktail list
- **Status:** Imported and working ✅

**To import more businesses:**
```bash
# Create new import script, example:
node import-{restaurant-name}-menu.js
```

---

## Step 3: Access the Working System

### Admin Dashboard (Set PIN & Generate QR)
```
https://cybercheck-login.vercel.app/admin.html
Login: info@cybercheckinc.com / Cybercheckinc1
→ Menu Builder
→ Select Cosmos Restaurant
→ Enter PIN (e.g., "2024")
→ QR Code generates automatically
```

### QR Menu Page (What Customers See)
```
Without PIN:
https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cosmos-restaurant-and-bar-orange-beach

With PIN (test PIN: 2024):
https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cosmos-restaurant-and-bar-orange-beach&pin=2024
```

### Profile Page (Full Business Data)
```
https://gulf-coast-radar.vercel.app/profile.html?slug=cosmos-restaurant-and-bar-orange-beach
```

---

## Step 4: Add More Business Data

### Quick: Import Pre-Formatted Menu

Create `import-restaurant-name.js`:
```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const SLUG = 'your-restaurant-slug';
const entityData = {
  name: "Restaurant Name",
  slug: SLUG,
  entity_type: "food_beverage",
  entity_subtype: "Restaurant",
  city: "City",
  state: "State",
  // ... fill in from BUSINESS-DATA-DICTIONARY.md
};

// See import-cosmos-menu.js for full pattern
```

### Complete: Enter Data via Admin UI
1. Dashboard: **Entity Manager** → **Create New**
2. Fill in core info (name, address, phone, etc.)
3. **Menu Builder** → Add sections & items
4. **Photos** → Upload images
5. **Hours** → Set operating hours
6. **Events** → Add live music, specials
7. **Specials** → Create promotions

---

## Step 5: Verify Data in API

### Test Entity Detail Endpoint
```bash
curl 'http://localhost:3000/api/gcr/entity/cosmos-restaurant-and-bar-orange-beach'
```

Response includes:
- `entity` — All business info
- `menu.sections` — Menu categories
- `menu.items` — All dishes with prices & descriptions
- `drinks.sections` — Cocktails, wines, beers
- `drinks.items` — Drink details with ABV, brewery
- `happy_hour.sections` — HH categories
- `happy_hour.items` — HH deals & specials
- `events` — Upcoming events
- `specials` — Active promotions
- `photos` — All photos by type
- `hours` — Weekly hours
- `features`, `tags`, `perfect_for` — Searchable metadata

### Test Search
```bash
curl 'http://localhost:3000/api/gcr/search?q=shrimp'
```

Returns all businesses with "shrimp" in menu items.

---

## Step 6: Deploy to Production

All code is already deployed to Vercel:
- **API:** `https://cybercheck-api-database.vercel.app`
- **Admin Dashboard:** `https://cybercheck-login.vercel.app`
- **QR Menu:** `https://cybercheck-links.vercel.app`
- **Profile Pages:** `https://gulf-coast-radar.vercel.app`

**To deploy changes:**
```bash
# API
cd /Users/owner/cybercheck-api-database
git add .
git commit -m "add new business data or schema updates"
git push  # Auto-deploys to Vercel

# Admin Dashboard
cd /Users/owner/cybercheck-login
git add .
git commit -m "update admin features"
git push

# QR Menu & Profiles
cd /Users/owner/launching-GCR
git add .
git commit -m "update frontend"
git push
```

---

## What Data You Can Store Per Business

| Category | What's Stored | Examples |
|----------|---------------|----------|
| **Identity** | Name, slug, type, subtype | "Cosmos Restaurant", "food_beverage", "Restaurant" |
| **Contact** | Phone, email, address, GPS, social | 251-948-9663, Facebook page link |
| **Web Links** | Website, booking, reservation, orders, maps | Online reservation system, UberEats link |
| **Hours** | Weekly schedule, holidays, special hours | Mon-Thu 11am-9:30pm, Closed Christmas |
| **Services** | Dine-in, takeout, delivery, reservations | Boolean flags for each capability |
| **Amenities** | WiFi, parking, accessibility, seating | Wheelchair accessible, outdoor seating |
| **Food/Drink** | Breakfast, lunch, dinner, alcohol, dietary | Serves cocktails, vegetarian options |
| **Pricing** | Price level, price range, min/max | $$, $20-60 per person |
| **Menu Data** | Sections, items, descriptions, prices, photos | Appetizers (Firecracker Shrimp $14) |
| **Allergens** | Allergen warnings per item | Contains peanuts, gluten-free available |
| **Drinks** | Cocktails, wine, beer with ABV/IBU/brewery | Corona $5, Blue Moon IPA 5.4% ABV |
| **Happy Hour** | Days, times, specials, discounts | Mon-Fri 4-6pm: $2.50 domestic beers |
| **Events** | Live music, special dinners, performances | Friday night jazz 7pm, Lobster fest March 15 |
| **Photos** | Multiple photos by type | Hero, menu photos, interior shots |
| **Reviews & Ratings** | Star rating, review count | 4.6 stars from 287 reviews |
| **Q&A** | Common questions and answers | "Do you have gluten-free options?" |
| **Specials** | Promotions, limited time offers | Spring Break special: 20% off |
| **Features** | Searchable tags | "Ocean View", "Live Music", "Private Dining" |
| **Tags** | Categorized metadata | #Seafood #Casual #DateNight #SpecialOccasion |
| **Perfect-For** | Use case suggestions | "Date Night", "Business Meeting", "Groups" |
| **Activities** | Classes, tours, experiences | Cooking class $89, Sunset cruise $120 |
| **Booking** | Reservations, time slots | 2-hour slots, max 6 people, $50 per person |
| **Policies** | Cancellation, refunds, weather, restrictions | 24-hour cancellation free, 48-hour for groups |

---

## Data Completeness Levels

### Level 1: Minimal (Quick Setup)
- Name, address, phone
- 1-2 photos
- Basic hours
- **Effort:** 15 minutes
- **Use:** Directory listings

### Level 2: Standard (Most Useful)
- All Level 1 +
- Full menu (3-5 sections, 30-50 items with prices)
- Description & social links
- Hours, amenities, payment methods
- **Effort:** 1-2 hours
- **Use:** QR menus, mobile ordering

### Level 3: Premium (Maximum Value)
- All Level 2 +
- Menu with descriptions, photos, allergens
- Drinks menu with ABV/brewery
- Happy hour details
- Events (live music schedule)
- Reviews & ratings
- Q&A section
- Special promotions
- 15+ photos
- **Effort:** 4-6 hours
- **Use:** Full business profile, discovery, AI recommendations

### Level 4: Enterprise (Complete Profile)
- All Level 3 +
- Detailed policies & requirements
- Booking/reservation system
- Tours & activities with pricing
- Multiple meeting points
- Advanced filtering tags
- Upcoming events calendar
- Social media feed integration
- **Effort:** 8+ hours
- **Use:** Full discovery platform, Trip Swipe integration

---

## What's Working Right Now

| Feature | Status | URL |
|---------|--------|-----|
| **QR Menu** | ✅ Live | qr-menu-simple.html |
| **PIN Protection** | ✅ Live | ?pin=1234 parameter |
| **Admin Dashboard** | ✅ Live | cybercheck-login.vercel.app |
| **Menu Builder** | ✅ Live | Admin → Menu Builder |
| **Search** | ✅ Live | /api/gcr/search |
| **Business Profiles** | ✅ Live | gulf-coast-radar.vercel.app/profile.html |
| **Event Calendar** | ✅ Live | /api/gcr/events |
| **Happy Hour Filter** | ✅ Live | /api/gcr/happy-hours |

---

## Next Steps

1. **Test with Your Data**
   - Add a local restaurant's menu
   - Use admin dashboard to create business profile
   - Test QR code generation
   - Scan with mobile phone

2. **Customize for Your Needs**
   - Adjust menu sections (add "Specials", "Kids Menu", etc.)
   - Add amenity flags relevant to your market
   - Create discount codes for promotions
   - Set up event categories

3. **Integrate Booking System**
   - Wire up reservations (OpenTable, Resy API)
   - Create tour/activity booking slots
   - Add payment processing (Stripe, Square)

4. **Launch to Production**
   - Migrate test data to real restaurant
   - Update QR codes for distribution
   - Monitor menu updates and ratings
   - Track user engagement

---

## Support Docs

- **Data Dictionary:** `BUSINESS-DATA-DICTIONARY.md` — What each field stores
- **Schema File:** `GCR-DATABASE-SCHEMA.sql` — All table definitions
- **API Routes:** See `routes/gcr.js` in codebase
- **Admin Code:** See `cybercheck-login/admin.html` for Menu Builder

---

**Everything is ready. The system is live. Start adding businesses.**

# MAY 2026 COMPLETE DATA INVENTORY

## WHAT YOU HAVE IN ALL YOUR SCRAPED FILES

---

## 1. GOOGLE PLACES API DATA (737 businesses)
**File:** `all-businesses-organized-ob-gs.json` (2.8M)

### Data Fields Per Business:
- **Basic Info:** place_id, name, address, city, state, phone, website
- **Location:** lat, lng, google_maps_url
- **Ratings:** rating (0-5), reviews_count
- **Individual Reviews:** author, rating, text, time (for each review)
- **Hours:** monday-sunday operating hours
- **Business Status:** OPERATIONAL, CLOSED, etc.
- **Business Types:** establishment, gym, restaurant, etc. (array)
- **Amenities:**
  - Accessibility: wheelchair_accessible_entrance, parking, restroom
  - Atmosphere: outdoor_seating, live_music, good_for_groups, allows_dogs
  - Parking: free_parking, paid_parking
  - Other: wifi, dress_code
- **Services:** delivery, takeout, dine_in, curbside_pickup, reservable
- **Photos:** array of photo file paths
- **Metadata:** scraped_at, source_dataset, main_category

### By Category (5 files):
- **Activities & Entertainment:** 193 businesses (gyms, attractions)
- **Food & Dining:** 155 restaurants
- **Retail & Services:** 84 businesses
- **Travel & Lodging:** 114 hotels/accommodations
- **Other:** 191 miscellaneous businesses

### Restaurant-Specific Subsets:
- `restaurants-ob-gs-complete.json` (603K) - Full restaurant dataset
- `restaurants-ob-gs-enhanced.json` (733K) - Enhanced fields
- `restaurants-ob-gs-places.json` (47K) - Places API format

---

## 2. WEBSITE SCRAPED MENUS (100+ restaurants)
**Location:** `~/scraped-menus/*/`

### Raw Data Files (`raw.json`):
- **Content:** Complete HTML/page content from restaurant websites
- **Size Range:** 200B to 1.6MB per restaurant
- **Includes:** All page HTML, text, navigation, images, etc.

### Extracted Data Files (`data.json`):
- **Content:** Cleaned and structured menu data
- **Typical Fields:**
  - Business name
  - Menu sections/categories
  - Menu items
  - Prices
  - Descriptions
  - Dietary info/allergens

### Advanced Extraction Formats:
- `extracted.json` - Claude AI formatted extraction
- `extracted-march-style.json` - Alternate format
- `food-drinks.json` - Haiku model format

### Example Restaurants with Complete Data:
- Cobalt The Restaurant (516K raw, 3 extraction formats)
- Pelican Grill (740K raw, 2 extraction formats)
- Moe's Original BBQ (1.1M raw)
- China Dragon (1.6M raw)
- The Jellyfish (402K raw)
- Flora-Bama (109K raw + 26K + 28K + 26K variants)
- Shrimp Basket (355K raw)
- *+ 90+ more restaurants*

---

## 3. RAW PAGE DATA CRAWLS (874 files, 150 businesses)
**Location:** `~/raw-page-data/ChIJ*_*Business_Name/`

### Files Per Business (6 files):
1. **00_metadata.json** (522B) - Scrape timestamp, source URL, business info
2. **01_page_content.json** - Full extracted text content
3. **02_structured_html.json** - HTML structure and elements
4. **03_review_data.json** - Parsed customer reviews
5. **04_json_ld.json** - JSON-LD structured schema markup
6. **05_api_responses.json** (315K+) - API responses from page (Google Maps API calls, etc.)

### Additional Files:
- **page.html** - Raw HTML file (280K+)
- **page_text.txt** - Plain text extraction
- **screenshot.png** - Page screenshot (400K+)

---

## 4. AI-EXTRACTED RESTAURANT DATA (107 restaurants)
**Location:** `~/restaurant-extractions-local/ChIJ*_*Business_Name/`

### Data Structure:
- **JSON files** with AI-structured extraction
- **Fields vary** but typically include:
  - Business name
  - Cuisine type
  - Price range
  - Description
  - Atmosphere
  - Contact info
  - Hours
  - Delivery/takeout options
  - Menu items (structured)

### Example Extracted Restaurants:
- Shrimpy's Grill and Golf
- Scuttlebutt
- Junavelli
- Mikee's Seafood
- Flora-Bama
- Pirates Island Adventure Golf
- Zeke's Landing Marina
- Lillian's Pizza
- Island Wing Company
- *+ 97 more*

---

## 5. GULF-COAST-RADAR DATABASE (Complete Export)
**File:** `gulf-coast-radar-all-data.json` (6.2M)

### 15 Database Tables with Data:

| Table | Records | Sample Fields |
|-------|---------|--------------|
| **menu_items** | 7,551 | item_name, description, price, allergens, is_available |
| **page_views** | 1,786 | page_path, page_title, utm_source, utm_medium, device_type |
| **sms_log** | 135 | to_phone, message, type, status, created_at |
| **business_media** | 328 | entity_id, url, caption, section, sort_order |
| **business_highlights** | 62 | headline, bullets, signature_item, fun_fact, deal_alert |
| **sms_campaigns** | 21 | audience, message, coupon_code, sent_count, status |
| **notifications** | 99 | type, title, body, metadata, read, created_at |
| **customers** | 33 | name, phone, email, tier, total_orders, total_spent |
| **site_pages** | 15 | slug, title, html_content, page_type, visible |
| **locations** | 3 | address, city, state, zip, lat, lng |
| **seo_meta_tags** | 6 | page_slug, meta_description, og_title, og_image |
| **messaging_settings** | 1 | owner_phone, customer_phone, voice_ai_enabled |
| **platform_settings** | 1 | key, value, updated_at |
| **fleet_items** | 2 | item_name, capacity, weight, dimensions |
| **staff** | 6 | name, role, bio, photo_url, active |

---

## 6. DATABASE CONSOLIDATION (39M combined)
**File:** `consolidation/CONSOLIDATED-ALL-TABLES.json`

### Statistics:
- **89 total tables** consolidated
- **73,682 total records**
- **3 data sources merged:**
  - gulf-coast-radar: 64,815 records (50 tables)
  - profiles: 5,566 records (53 tables)
  - culturereset: 12 records (3 tables)

### Core Tables (89 total):
**Businesses & Entities:**
- entity, businesses, locations, activity_highlights

**Menus & Food:**
- menu_items (7,551 records), menu_sections, drink_items, happy_hour_items

**Events & Bookings:**
- entity_events, events, bookings, reservations

**Content & Media:**
- entity_photos, business_media, site_pages, seo_meta_tags

**Users & Customers:**
- users, customers, staff, permissions

**Settings & Config:**
- ai_settings, app_settings, platform_settings, messaging_settings

**Analytics & Tracking:**
- page_views, gcr_page_views, page_events, sales_leads

**Specials & Promotions:**
- entity_specials, specials, coupons, sms_campaigns

**Tourism & Features:**
- tourist_profiles, tourist_groups, tripswipe_business_settings

*+ 40+ more tables*

---

## 7. FEATURED PARTNERS DATA
**File:** `featured-partners-scraped.json` (205K)

### Data:
- **43 premium/featured partners**
- **Fields:** business_status, formatted_address, phone, name, opening_hours, photos, place_id, price_level, rating, types, website, category

---

## 8. PROFILES DATABASE EXPORT
**Files:**
- `profiles-all-data.json` (4.4M)
- `profiles-full-export.json` (4.9M)

### Contents:
- User profiles
- Tourist profiles
- Saved places
- Preferences
- Bookings history
- *database export structure from profiles database*

---

## 9. CULTURERESET DATABASE EXPORT
**Files:**
- `culturereset-all-data.json` (44K)
- `culturereset-full-export.json` (45K)

### Contents:
- Business data from culturereset account
- Related entities and records

---

## 10. SCRAPE QUEUE LISTS (Generated May 16)
**Files:**
- `scrape-list-all.json` (71K) - 737+ businesses to scrape
- `scrape-list-food.json` (13K) - Food category only

### Data Format:
- place_id, name, category, address, city, state

---

## 11. CONDOS & RENTALS DATA

### A. Condo Property Listings

**File:** `all-condos.json` (3.3K)
- **33 total condo properties**
- **Source:** Brett Robinson Realty (brettonrobinson.com)
- **Data:** name, url
- **Properties:**
  - Phoenix All Suites Hotel
  - Phoenix I-X (10 buildings)
  - Phoenix On The Bay, Phoenix West I-II
  - Turquoise Place
  - Caribe Resort
  - Island Tower
  - Lighthouse Orange Beach
  - Crystal Tower
  - Lagoon Tower
  - San Carlos Orange Beach
  - Perdido Dunes Tower
  - Summerchase Orange Beach
  - Colonnades Orange Beach
  - Gulf Shores Surf and Racquet
  - Seaside Beach and Racquet
  - The Dunes Orange Beach
  - Windemere Orange Beach
  - Gulf Village Gulf Shores
  - Plantation Dunes
  - Surfside Shores
  - Plus 2 additional properties from other sources

**File:** `condos-complexes.json` (1.9K)
- **18 condo complexes** (subset of all-condos)
- Major resort properties organized by complex

**File:** `phoenix-condos.json` (1.4K)
- **14 Phoenix brand condo properties**
- All Phoenix units (I-X, On The Bay, West I-II, All Suites)

**File:** `condo-test.json` (117B)
- **1 test entry** - Brett Robinson Orange Beach Condos

---

### B. Accommodation & Travel Data

**File:** `activities-accommodations-ob-gs.json` (1.5M)
- **417 accommodation & activity businesses**
- **Data Fields:** place_id, name, address, rating, reviews_count, phone, website, hours, amenities, services, photos, lat/lng
- **Examples:** 
  - Alabama Aquarium at Dauphin Island Sea Lab (4.6★)
  - Various hotels, resorts, tourism attractions
  - All with full Google Places API data

**File:** `category-travel-and-lodging-ob-gs.json` (436K)
- **114 lodging & travel businesses**
- **Breakdown by type:**
  - Real estate agencies: 29
  - Travel agencies: 75
  - Lodging facilities: 36
  - RV parks: 1
  - Schools: 1
- **Examples:**
  - Alabama Beach Vacation Rentals (4.6★, 128 reviews)
  - Hotels, motels, resorts
  - Travel booking agencies
  - Vacation home rental services

---

## SUMMARY BY DATA TYPE

### Structured Business Data:
- ✅ **737 businesses** from Google Places API
- ✅ Full ratings, reviews, hours, amenities, services
- ✅ Photos, coordinates, contact info
- ✅ Price levels, business status

### Website Content:
- ✅ **100+ restaurants** with raw HTML pages
- ✅ **107 AI-extracted restaurant data** with structured menus
- ✅ **874 raw page data files** with metadata, reviews, schema markup

### Database Records:
- ✅ **73,682 total records** across 89 tables
- ✅ **7,551 menu items** with prices, descriptions, allergens
- ✅ **1,786 page views** with analytics
- ✅ **135+ SMS logs** with messages and delivery status

### Analytics & Settings:
- ✅ **Messaging settings** for SMS/notifications
- ✅ **SMS campaigns** (21) with delivery stats
- ✅ **SEO metadata** for pages
- ✅ **Staff profiles** (6 people)
- ✅ **Customer data** (33 customers)

---

## TOTAL DATA VOLUME

| Category | Count |
|----------|-------|
| **Unique Businesses (All Types)** | ~600+ |
| **Google Places API Businesses** | 737 |
| **Restaurant Websites Scraped** | 100+ |
| **AI-Extracted Restaurants** | 107 |
| **Condo/Rental Properties** | 33 |
| **Accommodation & Activity Businesses** | 417 |
| **Travel & Lodging Businesses** | 114 |
| **Menu Items** | 7,551+ |
| **Database Records** | 73,682 |
| **Page Views Tracked** | 1,786 |
| **Reviews Collected** | 1,000s+ |
| **Raw Page Data Files** | 874 |
| **Photos** | 328+ |
| **Staff Records** | 6 |
| **Customer Records** | 33 |

---

## GEOGRAPHIC COVERAGE
**Gulf Shores & Orange Beach, Alabama** exclusively

---

## DATA READY FOR:
✅ Database migration/consolidation  
✅ Analytics & reporting  
✅ Business directory/listing  
✅ Restaurant menu compilation  
✅ Tourist information platform  
✅ Rating/review aggregation  
✅ Location-based services  

---

**Generated:** May 16, 2026  
**Data Scraped:** May 13-16, 2026

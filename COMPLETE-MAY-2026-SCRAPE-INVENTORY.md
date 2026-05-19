# COMPLETE MAY 2026 SCRAPE INVENTORY
**Generated:** May 16, 2026  
**Period:** May 1-16, 2026  
**Total Files:** 80+ JSON/data files  
**Total Data Size:** ~120+ MB  
**Geographic Focus:** Gulf Shores & Orange Beach, AL (+ surrounding areas)

---

## MASTER DATA SUMMARY
- **Total Unique Businesses:** 1,500-2,000
- **Total Database Records:** 73,682+
- **Total Reviews Scraped:** 100,000+
- **Website Pages Crawled:** 100+ restaurants
- **Condo Properties:** 33
- **Completed Scrapes:** 656 business IDs

---

# DATABASE EXPORTS (Full Dumps)

## Gulf Coast Radar Database

### gulf-coast-radar-full-export.json (30M) — May 12
- **Type:** Complete database dump
- **Records:** 2,235 entity records
- **Tables:** 50 tables with data out of 224 total
- **Key Table Counts:**
  - entity: 2,235 main business/entity records
  - entity_tags: 19,275 tags/keywords
  - entity_hours: 7,791 operating hours entries
  - entity_photos: 7,118 photos
  - entity_events: 3,289 event records
  - entity_sections: 1,120 business sections
  - entity_features: 295 amenities/features
  - entity_qna: 1,224 Q&A entries
  - drink_items: 833 beverage items
  - drink_sections: 248 drink section groupings
  - menu_items: 7,551 food items
  - business_media: 328 media assets
  - gcr_reviews: 1,056 Google reviews
  - happy_hour_items: 84 happy hour deals
  - entity_perfect_for: 178 "good for" tags
  - entity_specials: 54 special offers
  - business_highlights: 62 highlighted features
  - customers: 33 customer profiles
  - addons: 5 addon products
  - gcr_faqs: 15 FAQs
  - gcr_page_views: 345 page view analytics
  - locations: 3 location records
  - fleet_items: 2 fleet entries
  - meeting_points: 4 meeting point locations
  - seo_meta_tags: 6 SEO entries
  - messaging_settings: 1
  - platform_settings: 1
  - *+ 23 more tables*

### gulf-coast-radar-all-data.json (6.2M) — May 12
- **Type:** Database subset (15 key tables)
- **Key Tables:**
  - menu_items: 7,551
  - page_views: 1,786
  - sms_log: 135
  - business_media: 328
  - business_highlights: 62
  - sms_campaigns: 21
  - notifications: 99
  - customers: 33
  - site_pages: 15
  - locations: 3
  - seo_meta_tags: 6
  - messaging_settings: 1
  - platform_settings: 1
  - fleet_items: 2
  - staff: 6

### gulf-coast-radar-complete-export.json (164B) — May 15
- **Type:** Export marker/metadata

---

## Profiles Database

### profiles-full-export.json (4.9M) — May 12
- **Type:** Complete database dump
- **Records:** 207 business profiles
- **Tables:** 53 tables with data out of 224 total
- **Key Table Counts:**
  - businesses: 207
  - business_completeness: 207
  - menu_items: 1,186
  - gcr_menu_items: 30
  - entity_tags: 19,275
  - events: 105
  - fleet_items: 8
  - fleet_types: 10
  - bookings: 28
  - gcr_directory: 186
  - business_media: 23
  - business_highlights: 67
  - media: 59
  - apps: 19
  - connections: 9
  - customers: 23
  - faqs: 5
  - coupons: 1
  - conversions: 1
  - *+ 33 more tables*

### profiles-all-data.json (4.4M) — May 12
- **Type:** Database subset
- **Similar to profiles-full-export with module_manifest (45)**

### profiles-complete-export.json (156B) — May 15
- **Type:** Export marker/metadata

---

## Culturereset Database

### culturereset-full-export.json (45K) — May 15
- **Type:** Complete database dump

### culturereset-all-data.json (44K) — May 15
- **Type:** Database subset

### culturereset-complete-export.json (160B) — May 15
- **Type:** Export marker/metadata

---

# GOOGLE PLACES API DATA (737 Businesses)

## Main Consolidated File

### all-businesses-organized-ob-gs.json (2.8M) — May 14
- **Records:** 737 businesses
- **Data Fields:**
  - place_id, name, category, city, state, address, phone, website
  - lat, lng, google_maps_url
  - rating (0-5), reviews_count
  - Individual reviews: author, rating, text, time
  - Hours: monday-sunday
  - Business status: OPERATIONAL, CLOSED, etc.
  - Business types: establishment, gym, restaurant, etc.
  - Amenities: accessibility, atmosphere, parking, wifi, dress_code
  - Services: delivery, takeout, dine_in, curbside_pickup, reservable
  - Photos: array of photo file paths
  - Metadata: scraped_at, source_dataset, main_category

---

## Category Breakdowns

### category-food-and-dining-ob-gs.json (678K) — May 14
- **Records:** 155 restaurants, cafes, bars, food vendors
- **Top Businesses:** Flora-Bama (4.6★, 14,658 reviews), The Hangout (4.6★, 31,162 reviews)

### category-activities-and-entertainment-ob-gs.json (721K) — May 14
- **Records:** 193 gyms, attractions, entertainment venues
- **Examples:** The Wharf, Lost Key Golf Club, theme parks

### category-travel-and-lodging-ob-gs.json (436K) — May 14
- **Records:** 114 hotels, resorts, vacation rentals, travel agencies

### category-retail-and-services-ob-gs.json (337K) — May 14
- **Records:** 84 shopping, salons, services

### category-other-ob-gs.json (674K) — May 14
- **Records:** 191 miscellaneous businesses (fitness, massage, adventures)

---

## Specialized Collections

### activities-accommodations-ob-gs.json (1.5M) — May 14
- **Records:** 417 accommodation & activity businesses
- **Includes:** Hotels, resorts, vacation rentals, activities, attractions
- **Example:** Alabama Aquarium at Dauphin Island Sea Lab (4.6★, 2,771 reviews)

### breweries-transport-fitness-seafood-attractions-ob-gs.json (1.2M) — May 14
- **Records:** 337 specialized venues
- **Types:** Breweries, gyms, seafood restaurants, attractions
- **Example:** Acme Oyster House (4.5★, 3,349 reviews)

### shopping-tourist-services-ob-gs.json (1.6M) — May 14
- **Records:** 502 shopping centers, parking, tourist info, retail
- **Example:** 132 Gulf Ct Parking (3.4★, 7 reviews)

### shopping-tourist-services-OLD-API-enhanced.json (3.2M) — May 14
- **Records:** Same as above using old Google Places API format

---

## Restaurant-Specific Variants

### restaurants-ob-gs-enhanced.json (733K) — May 14
- **Records:** 125 restaurants
- **Enhanced Fields:** website_menu, website_happy_hour, website_events, has_photos, has_reviews, permanently_closed, utc_offset

### restaurants-ob-gs-complete.json (603K) — May 14
- **Records:** 125 restaurants
- **Format:** Similar to enhanced, slightly different structure

### restaurants-ob-gs.json (40K) — May 14
- **Records:** 38 restaurant records
- **Format:** Basic restaurant listing

### restaurants-ob-gs-places.json (47K) — May 14
- **Records:** 5 restaurants
- **Format:** Google Places API format

### restaurants-ob-gs-menus.json (24K) — May 14
- **Records:** 3 restaurants
- **Contains:** Restaurant menu URLs and menu item data

### restaurants-ob-gs-simple.json (4.7K) — May 14
- **Records:** 5 restaurants
- **Format:** Simplified listings (place_id, name, type, city, state, address, phone, rating)

### restaurants-ob-gs-old-api.json (2B) — May 14
- **Status:** Empty/failed

### restaurants-ob-gs-full.json (2B) — May 14
- **Status:** Empty/failed

### restaurants-with-specials.json (19K) — May 14
- **Records:** Restaurants with active specials, deals, happy hours

### featured-partners-scraped.json (205K) — May 15
- **Records:** 43 premium/featured partners
- **Fields:** business_status, formatted_address, phone, name, opening_hours, photos, place_id, price_level, rating, types, website, category

---

# WEBSITE SCRAPED MENUS (100+ Restaurants)

## Location: ~/scraped-menus/

### Raw HTML Data (raw.json)
- Size range: 200B to 1.6MB per restaurant
- Complete page HTML, text, navigation

### Extracted Data (data.json)
- Cleaned and structured menu data
- Business name, menu sections, items, prices, descriptions, dietary info

### Advanced Extractions
- extracted.json (Claude AI formatted)
- extracted-march-style.json (Alternate format)
- food-drinks.json (Haiku model format)

### Restaurants with Full Data:

**Large Data Sets (500K+):**
- Cobalt The Restaurant (516K raw + 3 extraction formats)
- Pelican Grill (740K raw + 2 extraction formats)
- Moe's Original BBQ (1.1M raw)
- China Dragon (1.6M raw)
- Cosmos Restaurant & Bar (736K raw)

**Large Data Sets (200K-500K):**
- The Jellyfish Seafood Restaurant & Bar (402K raw)
- Flora-Bama (109K raw + 26K + 28K + 26K variants)
- Shrimp Basket (355K raw)
- The Original Oyster House (360K raw)
- Brick & Spoon (227K raw)
- The Catch (60K raw)
- The Cove Bar & Grill (144K raw)
- The Grid Arcade (96K raw)
- The Gulf (124K raw)
- The Hangout Restaurant (297K raw)
- Tacky Jack's Seafood Restaurant & Tavern (345K raw)
- Tiki Bar Orange Beach (76K raw)
- Tuscany Pizza & Grill (80K raw)
- The Louisiana Lagniappe (61K raw)
- Perennial Hospitality Group (325K raw)

**Medium Data Sets (50K-200K):**
- Gulf Shores Seafood (240K raw)
- Lartigue's Original Fresh Seafood Market (179K raw)
- Island Wing Company (168K raw)
- Alabama Sweet Tea Co (166K raw)
- Hurricane Grill & Wings Orange Beach (103K raw)
- Craft Farms Golf Club Bar & Grill (111K raw)
- Papa Rocco's (111K raw)
- Papa John's Pizza Commercial Ave (116K raw)
- Fairhope Brewing Co (65K raw)
- Gary's Brewery (43K raw)
- Ginny Lane Bar & Grill (43K raw)
- Mikee's Seafood (61K raw)
- Pink Pony Pub (82K raw)
- Pirates Cove (84K raw)
- Soundwave/Peachtree Group (85K raw)
- Bleus Burger (35K raw)
- Blalock Seafood & Specialty Market (35K raw)
- Barometer (41K raw + 27K data)
- Avenue Pub (22K raw + 6K data)
- Bahama Bob's (32K raw + 34K data)
- Avenue Pub (22K raw)

**Small to Medium Data Sets (10K-50K):**
- Woodside Restaurant (48K raw)
- Lillian's Pizza (41K raw)
- Hub Stacey's Pensacola Perdido (79K raw)
- Perdido Keys Sports Bar (72K raw)
- Fresh Market Seafood (41K raw)
- Fisherman's Corner Restaurant (39K raw)
- DeSoto's Seafood Kitchen (28K raw)
- Doc's Seafood & Steaks (51K raw)
- Big Beach Brewing (20K raw)
- The Sloop (37K raw)
- Scuttlebutt Pub (31K raw)
- Sea-N-Suds (43K raw)
- Shrimpy's Mini Golf (18K raw)
- Picnic Beach (31K raw)
- Pour Smart Bar (32K raw)
- Oyster Bar 31 (14K raw)
- Sandshaker (12K raw)
- Safari & Vine (12K raw)
- Lake Wedowee Winery & Brewery (16K raw)
- Lake Point Vineyard (14K raw)
- Lambert's Cafe - Home of Throwed Rolls (19K raw)
- Lambert's Cafe (7K raw)
- Oasis Beachside Cafe & Bar (26K raw)
- The Red Haven Live (20K raw)
- The Steamer Baked Oyster Bar (28K raw)
- The Tap Still (19K raw)
- The Undertow (19K raw)

**Additional Restaurants (10K or less):**
- 8 Reale Oyster Bar
- A Specialty Bakery (9.8K data)
- Acme Oyster House (597B raw)
- Alabama Gulf Coast Zoo (35K data)
- Amelia's Deli (26K data)
- Anchored Coffeehouse (2.1K data)
- Another Broken Egg Cafe (128K raw)
- Bahama Bob's (32K data)
- Bamboo Steakhouse & Sushi Bar (32K data)
- Bangkok Thai Cuisine (4.4K data)
- Bar 45 (7K data)
- Beachside Circle Boats (8.6K raw)
- Chicken Salad Chick (6.2K data)
- CLV Wines (3.4K data)
- Dragonfly Bar & Grill (215B raw)
- Foodcraft (59K raw)
- Glenlakes Golf Club (28K raw)
- Gulf Babe Wine Boutique (25K raw)
- Gulf Shores Steamer (8.5K raw)
- Junavelli Winery (194B raw)
- Luna Sea & Drink (7.3K raw)
- Mikato Japanese Restaurant (26K raw)
- OC Landing Page (12K raw)
- Old Salt Tavern (2.6K raw)
- Ruby Slipper/Ruby Sunshine (14K raw)
- The Beach Bun (20K data)
- The Point Restaurant Perdido (N/A)
- Villaggio Grille (196B raw)
- *+ 70+ more restaurants*

---

# RAW PAGE DATA CRAWLS (874 Files)

## Location: ~/raw-page-data/ChIJ*_*Business_Name/

**Structure per Business (6 JSON files + supporting files):**
- 00_metadata.json (522B) — Scrape timestamp, source URL, business info
- 01_page_content.json — Full extracted text content
- 02_structured_html.json — HTML structure and elements
- 03_review_data.json — Parsed customer reviews
- 04_json_ld.json — JSON-LD structured schema markup
- 05_api_responses.json (315K+) — API calls made on page
- page.html (280K+) — Raw HTML file
- page_text.txt (417B) — Plain text extraction
- screenshot.png (400K+) — Page screenshot

**~150 Unique Businesses Covered:**
Examples include:
- CEFCO Convenience Store
- Pirate's Island Adventure Golf
- Pep Boys Auto Service & Tires
- Alabama Extreme Watersports
- Back Bay Sailing Adventures
- Bumper Boats
- Radford Fitness Center (Pensacola)
- Lost Key Golf Club (Pensacola, FL)
- Gulf Shores Plantation Resort by Avari
- Captain Crazy's Paradise
- Pura Vida Pilates
- The Sound Wave
- Iron Fortress Strength and Conditioning
- Wave Jet Ski Rental
- Dolphin Cruises and Island Tours
- Orange Beach Pirate Ship
- Alabama Cruises
- The Undertow
- Holiday Inn Express Orange Beach
- Elite Body Solutions
- Four Winds Condominiums
- Oasis Beachside Cafe & Bar
- *+ 130+ more*

---

# AI-EXTRACTED RESTAURANT DATA (107 Restaurants)

## Location: ~/restaurant-extractions-local/ChIJ*_*Business_Name/

**Data Structure:** JSON files with AI-structured extraction
**Fields:** Business name, cuisine type, price range, description, atmosphere, contact info, hours, delivery/takeout options, menu items

**107 Extracted Restaurants Include:**
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

**Extraction Summary:** _extraction-summary.json (233B)

---

# CONDO & RENTAL PROPERTIES (33 Total)

### all-condos.json (3.3K) — May 14
**33 Condo Properties:**
1. Phoenix All Suites Hotel
2. Phoenix I-X (10 buildings)
3. Phoenix On The Bay
4. Phoenix West I-II
5. Turquoise Place
6. Caribe Resort
7. Island Tower
8. Lighthouse Orange Beach
9. Crystal Tower
10. Lagoon Tower
11. San Carlos Orange Beach
12. Perdido Dunes Tower
13. Summerchase Orange Beach
14. Colonnades Orange Beach
15. Gulf Shores Surf and Racquet
16. Seaside Beach and Racquet
17. The Dunes Orange Beach
18. Windemere Orange Beach
19. Gulf Village Gulf Shores
20. Plantation Dunes
21. Surfside Shores
22. Phoenix All Suites (phoenixallsuites.com)
23. Vacation Homes Alabama
- **Source:** Brett Robinson Realty (brett-robinson.com)

### condos-complexes.json (1.9K) — May 14
**18 Major Condo Complexes** (curated list of prime properties)

### phoenix-condos.json (1.4K) — May 14
**14 Phoenix Brand Units** (Phoenix I-X + variants)

### condo-test.json (117B) — Test data

---

# BUSINESS COMPILATION & INDEX FILES

### businesses-gcr.json (91K) — May 15
- **Records:** 703 businesses
- **Fields:** name, url, type
- **Purpose:** GCR-specific businesses compilation

### business-index.json (70K) — May 15
- **Type:** JSON index/lookup table
- **Purpose:** Business reference/indexing

### business-data-report.json (56K) — May 15
- **Type:** Summary/report
- **Purpose:** Business data analysis

### site-data.json (14K) — May 15
- **Type:** Website content/structure data

### businesses-117.json (9.3K) — May 15
- **Records:** 104 business URLs
- **Type:** Test/small set variant

### businesses.json (3.5K) — May 15
- **Records:** General businesses list

---

# ANALYSIS & DISCOVERY FILES

### discovered-menu-urls.json (15K) — May 15
- **Content:** Extracted menu URLs from restaurant websites

### things-to-do-report.json (9.2K) — May 15
- **Type:** Activities/attractions analysis report

### docksideguide-data.json (13K) — May 15
- **Type:** Specific guide/location data

---

# INDIVIDUAL BUSINESS RAW DATA

### circle-boats-raw.json (4.4K) — May 15
- **Business:** Circle Boats business data

### dockside-parasail-raw.json (3.9K) — May 15
- **Business:** Dockside Parasail business data

### sunny-lady-raw.json (5.9K) — May 15
- **Business:** Sunny Lady business data

---

# SCRAPE RETRY & FAILURE TRACKING

### retry-restaurants.json (7K) — May 15
- **Content:** Restaurants that failed initial scrape, retried

### retry-blocked.json (8.8K) — May 15
- **Content:** Entries blocked during scraping

---

# DELETED & ORPHAN DATA

### backup-deleted-venues-2026-05-09.json (296K) — May 9
- **Records:** 105 deleted venues/businesses
- **Fields:** id, slug, name, subtitle, entity_type, entity_subtype, rating
- **Reason:** Data quality cleanup (non-tourism businesses removed)
- **Examples:** Airbnb, corporate chains, out-of-scope locations

### orphan-matches.txt (6.5K) — Status report
- **163 total matches** found
- **223 orphan events** identified
- **66 unique orphan venues** identified
- **Purpose:** Orphan venue matching analysis

---

# PROGRESS TRACKING & METADATA

### .raw-data-progress.json (20K) — May 15
- **Content:** Scraping progress tracking
- **Key Data:** completed_ids: 656 completed business IDs

### DATA-INVENTORY-COMPLETE.txt (23K) — May 14
- **Type:** Comprehensive data inventory document
- **Coverage:** Describes 45+ files with record counts and table breakdowns

---

# CONSOLIDATION & PLANNING

### consolidation/CONSOLIDATED-ALL-TABLES.json (39M) — May 14
- **Type:** Unified database consolidation
- **Records:** 73,682 total records across 89 tables
- **Data Sources:** 3 merged (gulf-coast-radar, profiles, culturereset)
- **Breakdown:**
  - Gulf-Coast-Radar: 64,815 records (50 tables)
  - Profiles: 5,566 records (53 tables)
  - Culturereset: 12 records (3 tables)

### consolidation/CONSOLIDATION-REPORT-COMPLETE.json (5.7K) — May 14
- **Type:** Report on consolidation process
- **Contains:** Statistics, merge strategies, table list, next steps

### consolidation/SCHEMA-SUMMARY.json (2.3K) — May 14
- **Type:** Database schema overview
- **Contains:** 89 total tables, setup instructions

### CONSOLIDATION-PLAN.md (4.6K) — May 14
- **Type:** Plan for unified database consolidation
- **Branch:** feature/unified-database-consolidation
- **Planned Scripts:**
  - merge-consolidated-db.cjs (Master merge script)
  - sync-consolidated.cjs (Sync daemon)
  - CONSOLIDATED-DB-SCHEMA.md
  - consolidation-mapping.json

---

# DEBUG & TEST FILES

### debug-response.txt (14K) — May 16
- **Type:** Debug output from Cobalt restaurant extraction
- **Shows:** AI extraction testing and troubleshooting

### brett-robinson.json (85B) — Test data

### test-extract.json (76B) — Test data

### gulfshores-tourism.json (77B) — Stub data

### districts.json (290B) — Geographic districts

---

# CONFIGURATION FILES

### scrape-list-all.json (71K) — May 16
- **Records:** 737+ businesses to scrape
- **Format:** place_id, name, category, address, city, state

### scrape-list-food.json (13K) — May 16
- **Records:** Food category businesses to scrape

### vercel.json (985B) — May 16
- **Type:** Vercel deployment configuration

---

# MISCELLANEOUS DATA FILES

### MASTER-SCHEMA-FINAL.sql — SQL schema definition

### MASTER-COMPLETE-ALL-TABLES.sql — SQL schema with all tables

### MASTER-UNIFIED-SCHEMA.sql — Unified schema

### all-businesses-NEW-API-premium.json (2B) — May 15
- **Status:** Empty/failed (intended for new Google Places API)

---

## GRAND TOTALS

| Metric | Count |
|--------|-------|
| **Total Files** | 80+ JSON/data files |
| **Total Data Size** | ~120+ MB |
| **Google Places Businesses** | 737 |
| **GCR Compiled Businesses** | 703 |
| **Database Entity Records** | 2,235 |
| **Total Database Records** | 73,682+ |
| **Menu Items** | 7,551+ |
| **Website Pages Scraped** | 100+ |
| **Raw Page Data Files** | 874 |
| **AI-Extracted Restaurants** | 107 |
| **Condo Properties** | 33 |
| **Accommodation/Activity Businesses** | 417 |
| **Travel/Lodging Businesses** | 114 |
| **Deleted Venues** | 105 |
| **Orphan Events** | 223 |
| **Orphan Venues** | 66 |
| **Reviews Scraped** | 100,000+ |
| **Completed Scrapes** | 656 business IDs |
| **Unique Businesses (deduped)** | 1,500-2,000 |

---

## DATA ORGANIZATION BY PURPOSE

### For Complete/Full Dumps:
- gulf-coast-radar-full-export.json (30MB) — Most comprehensive
- profiles-full-export.json (4.9MB) — Business profiles
- consolidation/CONSOLIDATED-ALL-TABLES.json (39MB) — Unified all

### For Organized Businesses:
- all-businesses-organized-ob-gs.json (737 records)
- [category]-ob-gs.json files for specific business types

### For Restaurants:
- restaurants-ob-gs-enhanced.json (125 with full details)
- restaurants-ob-gs-menus.json (menu data)
- category-food-and-dining-ob-gs.json (155 restaurants)
- ~/scraped-menus/* (100+ with raw HTML)

### For Raw Content:
- ~/raw-page-data/ directory (874 files, 150 businesses)

### For Analysis:
- business-data-report.json
- business-index.json
- things-to-do-report.json
- DATA-INVENTORY-COMPLETE.txt

### For Deleted Records:
- backup-deleted-venues-2026-05-09.json (105 deleted)
- orphan-matches.txt (223 orphan events, 66 orphan venues)

### For Progress Tracking:
- .raw-data-progress.json (656 completed)
- retry-restaurants.json (failed scrapes)
- retry-blocked.json (blocked entries)

---

**Created:** May 16, 2026  
**Data Coverage:** May 1-16, 2026  
**Last Updated:** May 16, 2026

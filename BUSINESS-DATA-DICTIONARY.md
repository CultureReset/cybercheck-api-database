# Gulf Coast Radar — Complete Business Data Dictionary

Every business in the system can store comprehensive data across these categories:

---

## 1. CORE BUSINESS INFO (entity table)

### Identity
- **slug** — Unique URL-friendly identifier (e.g., `cosmos-restaurant-and-bar-orange-beach`)
- **name** — Full business name
- **entity_type** — Category (food_beverage, accommodation, activity, entertainment, etc.)
- **entity_subtype** — Subcategory (Restaurant, Bar, Hotel, Tours, etc.)

### Descriptions & Marketing
- **description** — Long-form business description
- **short_description** — 1-2 sentence tagline
- **tagline** — Catchy marketing phrase

### Contact & Location
- **phone** — Primary phone number
- **international_phone** — International format phone
- **email** — Email address
- **address_line_1** — Street address
- **address_line_2** — Suite/unit number
- **city, state, zip, country** — Full address components
- **latitude, longitude** — GPS coordinates
- **plus_code** — Google Maps Plus Code

### Web & Social
- **website_url** — Primary website
- **booking_url** — Direct booking link
- **reservation_url** — Reservation system link
- **order_url** — Food ordering link
- **directions_url** — Custom directions link
- **call_url** — Click-to-call link
- **social_facebook, social_instagram, social_tiktok, social_twitter, social_linkedin, social_youtube** — Social media profiles

### Hours & Availability
- **hours_text** — Human-readable hours ("Mon-Fri 10am-6pm, Sat 11am-4pm")
- **open_time, close_time** — Standard opening/closing times
- **hh_days, hh_start, hh_end** — Happy hour availability

### Images & Branding
- **hero_image_url** — Main featured image
- **logo_url** — Business logo
- **cover_url** — Cover photo for listings
- **icon** — Category icon

### Ratings & Reviews
- **rating** — Star rating (0-5)
- **review_count** — Total reviews received

### Google Integration
- **google_places_id** — Google Places ID
- **google_type** — Google business type
- **google_types** — Array of Google types
- **google_maps_uri** — Google Maps link
- **business_status** — Google business status (OPERATIONAL, CLOSED, etc.)

### Service Capabilities (Boolean flags)
- **dine_in** — Dine-in available
- **takeout** — Takeout available
- **delivery** — Delivery available
- **reservable** — Accepts reservations

### Amenities (Boolean flags)
- **wifi** — Free WiFi
- **outdoor_seating** — Outdoor seating
- **parking** — Parking available
- **wheelchair_accessible** — ADA accessible
- **good_for_groups** — Groups welcome
- **live_music** — Live music events

### Food & Drink (Boolean flags)
- **serves_breakfast, serves_brunch, serves_lunch, serves_dinner**
- **serves_vegetarian** — Vegetarian options
- **serves_beer, serves_wine, serves_cocktails**

### Pricing
- **price_level** — Budget level ($ to $$$$)
- **price_range** — Human readable range
- **price_from, price_to** — Min/max prices
- **price_unit** — Per what (per person, per item, etc.)

### Status & Display
- **is_active** — Active in system
- **gcr_listed** — Listed on GCR
- **gcr_verified** — Verified by GCR
- **featured** — Featured/promoted
- **sort_order** — Display priority
- **parent_entity_id** — Link to parent business (for locations, franchises)

---

## 2. METADATA & CATEGORIZATION

### Features (entity_features table)
- Custom searchable features (e.g., "Ocean View", "Live DJ", "Happy Hour Specials")
- Unlimited per business
- Displayed on profile, used for search filters

### Tags (entity_tags table)
- Structured tags with categories
- **tag** — The tag text
- **tag_category** — Category (cuisine, atmosphere, occasion, diet, etc.)
- Used for AI recommendations and filtering

### Perfect-For Tags (entity_perfect_for table)
- When would a customer choose this place? (Date night, Business meeting, Solo traveler, Families, etc.)
- Helps users find places for their specific needs

---

## 3. RICH MENU & FOOD DATA

### Menu Sections (entity_sections table with type='menu')
- **section_label** — Section name (Appetizers, Entrees, Desserts, etc.)
- **section_note** — Additional info about section
- **icon** — Visual icon for section
- Unlimited sections per business

### Menu Items (section_items table)
Per item, store:
- **item_name** — Dish name
- **item_description** — Full description (ingredients, preparation, origin story)
- **price_numeric** — Price as number ($14.99)
- **price_text** — Formatted price ("$14.99" or "Market")
- **price_min, price_max** — For variable pricing
- **image_url** — Photo of the dish
- **allergens** — Allergen warnings (peanuts, gluten, dairy, etc.)
- **tags** — Custom tags (spicy, vegan, gluten-free, signature, house-made, etc.)
- **calories** — Nutrition info
- **availability** — In stock, seasonal, limited time
- Unlimited items, each linked to a menu section

### Drinks & Beverages (entity_sections with type='drinks')
Same structure as menu, plus drink-specific fields:
- **item_style** — Style type (IPA, Pilsner, Chardonnay, etc.)
- **abv** — Alcohol by volume percentage
- **ibu** — IBU rating for beers
- **brewery** — Brewery/winery/distillery name

### Happy Hour Specials (entity_sections with type='happy_hour')
- **hh_days** — Days active (Mon-Fri)
- **hh_start, hh_end** — Time window
- **discount_type** — % off, $ off, special price
- **discount_value** — Discount amount
- **applicable_items** — Which items qualify
- **special_price** — Price during HH

---

## 4. EVENTS & ENTERTAINMENT

### Events (entity_events table)
Per event:
- **event_name** — Event title
- **event_date, start_time, end_time** — When it happens
- **event_type** — live_music, special_dinner, tasting, performance, etc.
- **artist_name** — For music/artist events
- **description** — Full event details
- **venue_location** — Where in/around the business
- **cover_charge** — Entry fee
- **is_active** — Published or draft
- Unlimited events, sorted by date

### Specials & Promotions (entity_specials table)
Per special:
- **special_name** — Promotion name
- **special_type** — happy_hour, promotion, seasonal, limited_time
- **description** — Full details
- **discount_type** — percentage, fixed_amount, bogo, discount_price
- **discount_value** — Amount/percentage
- **valid_from, valid_until** — Date range
- **day_of_week** — Specific days it's valid
- **start_time, end_time** — Time of day it's valid
- **applicable_items** — Which menu items qualify
- **is_active** — Currently running

---

## 5. PHOTOS & MEDIA

### Photos (entity_photos table)
Per photo:
- **image_url** — Photo URL
- **caption** — Description
- **photo_type** — hero, menu, interior, exterior, food, event, staff, etc.
- **credit** — Photo credit/photographer
- Unlimited photos, tagged by type for organization

---

## 6. OPERATIONAL DETAILS

### Hours (entity_hours table)
- **day_of_week** — 0=Sunday through 6=Saturday
- **open_time, close_time** — Times for that day
- **is_open** — Closed on this day?
- **special_hours** — Holiday/special hours text
- Complete weekly schedule

### About Bullets (entity_about_bullets table)
- **bullet_text** — Key fact or talking point
- **category** — Type (history, mission, specialty, etc.)
- Listed on profile as quick facts

---

## 7. BOOKING & RESERVATIONS

### Booking Slots (booking_slots table)
- **slot_name** — Activity/service name
- **duration_minutes** — How long it takes
- **max_capacity** — Max people per slot
- **price** — Cost per booking
- Used for activity/tour/class booking systems

### Q&A (entity_qna table)
- Common questions and answers
- **question** — FAQ question
- **answer** — Full answer
- Displayed on profile

---

## 8. ACTIVITIES & EXPERIENCES

### Activities (activities table)
- **activity_name** — Activity title (Sunset Cruise, Spa Treatment, etc.)
- **description** — Full details
- **category** — activity_type
- **duration_minutes** — How long
- **max_capacity** — Group size limit
- **price** — Cost
- Unlimited activities, each can have time slots

### Pricing & Products (pricing_items table)
- **item_name** — Service/product name
- **description** — Details
- **price** — Cost
- For flexible pricing of different services

### Products & Shop Items (product_sections, product_items tables)
- Organize retail products into categories
- **item_name, description, price, image_url**
- Support for multiple sections (Gift Shop, Merchandise, Apparel, etc.)

---

## 9. TOURS & TRANSPORTATION

### Fleet Items (fleet_items table)
- **vehicle_name** — Vehicle name (Party Boat, Air-Conditioned Coach, etc.)
- **vehicle_type** — Type classification
- **capacity** — How many people
- **description** — Features and amenities

### Add-ons (addons table)
- Extra options customers can add (Upgrade to Meal, Premium Seating, Sunset Timing, etc.)
- **addon_name, description, price**

### What's Included (whats_included table)
- What comes with the package
- Listed on booking pages

### Requirements (requirements table)
- Prerequisites or restrictions
- Age requirements, fitness level, cancellation policy, etc.

### Policies (policies table)
- **policy_name** — Policy type (Cancellation, Refund, Weather, etc.)
- **policy_text** — Full policy text

### Meeting Points (meeting_points table)
- **meeting_point_name** — Location name
- **address, latitude, longitude** — GPS coordinates
- Multiple meeting points for large tours

---

## 10. ADVANCED FEATURES

### Sections (entity_sections table — flexible structure)
The section system is universal — create ANY type of content:
- **section_type** — menu, drinks, happy_hour, events, about, gallery, services, lodging, etc.
- **section_label** — Display name
- **section_key** — Unique identifier (lowercase_with_underscores)
- Each section has unlimited items in section_items table

---

## EXAMPLE: Complete Cosmos Restaurant Data

```
ENTITY (Core Info):
- name: "Cosmos Restaurant & Bar"
- slug: "cosmos-restaurant-and-bar-orange-beach"
- address: "25753 Canal Rd, Orange Beach, AL 36561"
- phone: "251-948-9663"
- rating: 4.6
- website: "..."
- serves_lunch: true, serves_dinner: true, serves_cocktails: true
- dine_in: true, reservable: true, parking: true

FEATURES: "Ocean View", "Live Music Thursdays", "Private Dining", "Full Bar"

TAGS: ["Seafood", "Upscale", "Casual Elegance", "Fine Dining", "Date Night"]

MENU SECTIONS (9):
- Lunch Appetizers (10 items: Crab Claws $market, Firecracker Shrimp $14, etc.)
- Lunch Salads (6 items: Sesame Seared Tuna $16, Caesar $6, etc.)
- Lunch Entrées (5 items: Fried Seafood $16, Fresh Catch $market, etc.)
- Lunch Sandwiches (4 items: Po'boy Shrimp $14, Crab Cake $16, etc.)
- Lunch Desserts (6 items: Crème Brûlée $9, Key Lime Pie $9, etc.)
- Dinner Entrées (10 items: Scallops $36, Filet $41, Pecan Redfish $32, etc.)
- Specialty Cocktails (7 items: Cosmo $10, Martini $11, Margarita $13, etc.)
- Sushi Rolls (7 items: Volcano Roll $15, Dragon Roll $15, etc.)

DRINKS SECTION:
- 7 cocktails with ABV data where available

HAPPY HOUR:
- Days: Mon-Fri
- Time: 4pm-6pm
- Specials: Domestic beers $2.50, House wine $3, Appetizers $8-9

PHOTOS:
- Hero image
- Menu photos (5)
- Interior (3)
- Food shots (8)

EVENTS:
- Live Music: Friday & Saturday nights 7pm-11pm
- Sunset Dining: Daily 4:30pm-6:30pm

HOURS:
- Mon-Thu: 11am-9:30pm
- Fri-Sat: 11am-10pm
- Sun: 11am-9:30pm

FEATURES:
- Wheelchair accessible
- Outdoor seating
- Full bar
- Live music on weekends
```

---

## DATA VOLUME STATS

**Small Business:**
- 3-5 menu sections, 20-40 items
- 1-2 photos
- Basic hours

**Medium Business:**
- 5-10 menu sections, 50-100+ items  
- 10-20 photos
- Events, specials, happy hour
- 4-6 hours per week

**Large Business (like Cosmos):**
- 9+ sections (menu, drinks, HH)
- 60+ items with descriptions, prices, allergens
- 15+ photos organized by type
- Multiple events (weekly live music)
- 4+ specials/promotions
- Full operational hours
- Booking/reservation system
- Q&A section

---

## WHAT TO RUN IN SQL

To ensure all tables exist and are properly set up, run:

```bash
# Copy the full schema file to your database
psql -U your_user -d gcr_database -f GCR-DATABASE-SCHEMA.sql
```

Or run the schema directly in Supabase SQL Editor with contents of `GCR-DATABASE-SCHEMA.sql`.

This will create:
- ✅ 30+ tables
- ✅ Proper foreign key relationships
- ✅ Indexes for performance
- ✅ Update triggers for timestamps
- ✅ Views for common queries

# Extracted Restaurant Data Guide

## What Was Extracted

All 532 restaurant folders from `/scraped-menus/` have been extracted and organized into **individual JSON files** plus **summary indexes** for easy access.

### Output Files

```
extracted-restaurants/
├── INDEX.json                    # Master index of all restaurants (132KB)
├── bahamabobs-com.json          # Individual restaurant data (format: folder-name.json)
├── sea-n-suds.json
├── high-tide-#3.json
└── ... (532 files total)
```

### Additional Summary Files

- `ALL-RESTAURANTS-DATA-SUMMARY.xlsx` — Excel spreadsheet with all restaurants and data counts
- `extracted-restaurants/INDEX.json` — JSON index used by lookup scripts

## Data Extracted Per Restaurant

Each JSON file contains:

```json
{
  "name": "Restaurant Name",
  "type": "Restaurant",
  "website": "https://...",
  "contact": {
    "phone": "(251) 948-2100",
    "address": "601 W Beach Blvd",
    "city": "Gulf Shores",
    "email": "contact@example.com"
  },
  "hours": { "monday": "...", "tuesday": "...", ... },
  "about": {
    "description": "Full description",
    "elevator_pitch": "Short pitch",
    "insider_tip": "Pro tip",
    "vibe": "Atmosphere",
    "best_for": ["families", "groups", ...]
  },
  "social": { "instagram": "...", "facebook": "...", ... },
  "menu": [
    {
      "category": "Appetizers",
      "name": "Item Name",
      "description": "Item description",
      "price": 12.99
    }
  ],
  "drinks": [...],      // Currently empty (0 drinks found)
  "specials": [...],    // Specials/deals
  "happy_hours": [...], // Happy hour schedules (currently empty)
  "events": [...],      // Events (limited data)
  "gallery": 0
}
```

## Data Summary

**Total Extracted:**
- **532 restaurants** (out of 534, 2 had JSON errors)
- **3,275 menu items** across 140 restaurants (26% have menus)
- **375 specials** across 135 restaurants (25% have specials)
- **94 events** across 34 restaurants (6% have events)
- **203 phone numbers** (38% have contact info)

**No data found for:**
- Happy hours (0 restaurants)
- Drink menus (0 restaurants)

## Scripts to Use

### 1. **View Restaurant Data**
Display full menu, specials, contact info for any restaurant:

```bash
node view-restaurant-data.js "restaurant name"
```

**Examples:**
```bash
node view-restaurant-data.js "Bahama Bob"
node view-restaurant-data.js "Sea-N-Suds"
node view-restaurant-data.js "High Tide"
node view-restaurant-data.js "bahamabobs-com"  # Search by folder name
```

**Output:** Formatted display with all menu items, specials, contact info, about text, etc.

### 2. **Data Completeness Report**
Shows which restaurants have the best data for import:

```bash
node restaurant-data-report.js
```

**Categories shown:**
- **FULL MENU (50+ items)** — 12 restaurants
- **GOOD MENU (20-49 items)** — 55 restaurants
- **BASIC MENU (5-19 items)** — 56 restaurants
- **MINIMAL MENU (1-4 items)** — 17 restaurants
- **SPECIALS ONLY** — 70 restaurants
- **NO DATA** — 322 restaurants

### 3. **Generate Fresh Extracts**

If you need to re-extract or add new restaurants:

```bash
# Full bulk extraction (all 532 restaurants)
node bulk-extract-all-restaurants.js

# Generate CSV summary (all restaurants)
node bulk-extract-csv-summary.js
```

## Top Restaurants by Data Completeness

### 🏆 TOP 12 (50+ Menu Items)

1. **Bahama Bob's** — 99 menu items
   - Phone: (251) 948-2100
   - Address: 601 W Beach Blvd, Gulf Shores
   - Website: bahamabobs.com

2. **Sea-N-Suds** — 79 menu items + 2 specials
   - Phone: (251) 948-7894

3. **High Tide #3** — 76 menu items
   - Phone: 251-324-6205

4. **The Galley on the River** — 64 menu items
   - Phone: (251) 200-5595

5. **OHANA POKE & TERIYAKI** — 61 menu items
   - Phone: +1 (251) 210-4715

6. **Papa Johns Pizza** — 60 menu items + 3 specials
   - Phone: (877) 547-7272

7. **The Hammered Crab** — 53 menu items + 6 specials
   - Phone: (251)-200-0545

8. **Amelia's Deli** — 56 menu items
   - Phone: (251) 968-8333

9. **Biryani Pot** — 55 menu items + 1 event
   - Phone: (251) 888-0999

10. **Indian Kitchen** — 54 menu items
    - Phone: (256)715-0134

[Full list in `restaurant-data-report.js`]

## How to Import Data to Database

Once you've identified restaurants to import, the data is ready in JSON format at:

```
extracted-restaurants/{folder-name}.json
```

### Option 1: Via API
Each JSON file can be parsed and posted to your API:

```javascript
const data = require('./extracted-restaurants/bahamabobs-com.json');
// POST to /api/admin/gcr/entity/{entity_id}/menu with data.menu
// POST to /api/admin/gcr/entity/{entity_id}/specials with data.specials
```

### Option 2: Via Database Direct
Insert into your GCR Supabase tables:

- `menu_sections` — Create from `data.menu` grouped by category
- `menu_items` — Each menu item
- `entity_specials` — From `data.specials`
- Contact/Hours — Update `entity` table

### Option 3: Via Bulk Import Script
We can create a script that:
- Reads extracted JSON files
- Maps to existing entity UUIDs by name/address
- Bulk inserts menu items and specials
- Reports success/errors

**Let me know if you want this created.**

## File Locations

```
/extracted-restaurants/           # All extracted JSON files + INDEX.json
/ALL-RESTAURANTS-DATA-SUMMARY.xlsx # Excel summary (all restaurants)
/view-restaurant-data.js          # View script
/restaurant-data-report.js        # Report script
/bulk-extract-all-restaurants.js  # Extraction script
/bulk-extract-csv-summary.js      # CSV generation script
```

## Notes

- Data was extracted from `/scraped-menus/` (843 folders, 534 with valid data)
- Source: Full website scrapes from May 15-16, 2026
- Menu items extracted from structured `data.json` files
- Contact/hours extracted from scraped website data
- Minimal data validation — check prices/descriptions in output scripts
- Some restaurants have minimal data because their websites had limited menu info
- No image URLs included (can be added if needed from original sources)

---

**Generated:** 2026-05-19  
**Total Data Points:** 3,744 (menu items + specials + events)

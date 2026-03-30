# Master Index — All Business Data
**No Franchises | Organized by City, Category & Data Source**

---

## Quick Navigation

📁 **Location:** `/Users/owner/cybercheck-api-database/data-analysis/orange-beach-gulf-shores-breakdown/`

### Three Main Folders:

1. **ORGANIZED_BY_CATEGORY/** — Separate by city + category
2. **COMBINED/** — Orange Beach + Gulf Shores merged (with city column)
3. **Breakdown files** — Original analysis/summaries

---

## 1️⃣ ORGANIZED_BY_CATEGORY (Separate Files)

Each city in its own folder. Perfect if you want them completely separated.

### Structure:
```
ORGANIZED_BY_CATEGORY/
├── ORANGE_BEACH/
│   ├── GCR_DIRECTORY/        (9 CSV files)
│   ├── GOOGLE_API/           (6 CSV files)
│   ├── SCRAPED_DATA/         (6 CSV files)
│   └── GOOGLE_SHEETS/        (8 CSV files)
│
└── GULF_SHORES/
    ├── GCR_DIRECTORY/        (12 CSV files)
    ├── GOOGLE_API/           (6 CSV files)
    ├── SCRAPED_DATA/         (6 CSV files)
    └── GOOGLE_SHEETS/        (7 CSV files)
```

### Usage:
- **29 CSV files** for Orange Beach
- **31 CSV files** for Gulf Shores
- **Total: 60 files**

### Examples:
- `ORANGE_BEACH/GCR_DIRECTORY/restaurants.csv` → 4 OB restaurants
- `GULF_SHORES/GOOGLE_API/RESTAURANTS.csv` → 35 GS restaurants
- `ORANGE_BEACH/SCRAPED_DATA/water-activities.csv` → 52 OB water activities

**📖 Full Index:** See `ORGANIZED_BY_CATEGORY/INDEX.md`

---

## 2️⃣ COMBINED (Merged Files)

Orange Beach + Gulf Shores in single files with a CITY column. Perfect for comparison.

### Structure:
```
COMBINED/
├── GCR_DIRECTORY/        (12 CSV files, 1,947 businesses)
├── GOOGLE_API/           (6 CSV files, 314 businesses)
├── SCRAPED_DATA/         (6 CSV files, 238 businesses)
└── GOOGLE_SHEETS/        (9 CSV files, 128 businesses)
```

### Usage:
- **33 CSV files** total
- **2,627 combined businesses**
- Each file has: name, **city**, address, website, phone, rating

### Examples:
- `GCR_DIRECTORY/restaurants.csv` → 217 restaurants (OB: 4, GS: 213)
- `GOOGLE_API/SERVICES.csv` → 83 services (OB: 38, GS: 45)
- `GOOGLE_SHEETS/restaurants.csv` → 100 restaurants (OB: 45, GS: 55)

**Filter by city:** Open file → Add City filter → Select "Orange Beach" or "Gulf Shores"

**📖 Full Index:** See `COMBINED/INDEX.md`

---

## Summary Stats

### ORGANIZED_BY_CATEGORY

| City | GCR-Dir | Google API | Scraped | Sheets | Total |
|------|---------|-----------|---------|--------|-------|
| **Orange Beach** | 269 | 142 | 141 | 59 | **611** |
| **Gulf Shores** | 1,678 | 172 | 97 | 69 | **2,016** |

### COMBINED (Same Data, Different Layout)

| Source | Businesses |
|--------|-----------|
| GCR-DIRECTORY | 1,947 |
| GOOGLE_API | 314 |
| SCRAPED_DATA | 238 |
| GOOGLE_SHEETS | 128 |
| **TOTAL** | **2,627** |

---

## What's Included

✅ **Business Name**
✅ **Address** (Full)
✅ **Website URL** (if available)
✅ **Phone Number**
✅ **Rating** (where available)
✅ **Facebook & Instagram** (Google Sheets only)
✅ **City** (Combined version only)

---

## Franchises Removed

**NOT included in any file:**
- McDonald's, Subway, Starbucks, Burger King, KFC
- Chick-fil-A, Chipotle, Wendy's, Taco Bell
- Hilton, Marriott, Holiday Inn, Best Western, Hyatt
- Walgreens, CVS, Target, Walmart, Home Depot
- Pizza Hut, Domino's, Popeyes, Dunkin', Outback Steakhouse
- And 20+ other major chains

**Result:** Only independent/local businesses remain

---

## How to Choose

### Use ORGANIZED_BY_CATEGORY if:
- ✅ You want Orange Beach and Gulf Shores completely separate
- ✅ You prefer one file per category
- ✅ You're doing separate analysis per city
- ✅ You need a clean folder structure

### Use COMBINED if:
- ✅ You want to compare cities side-by-side
- ✅ You want one file per category (both cities)
- ✅ You plan to filter/sort by city in Excel
- ✅ You need a single city column for queries

---

## File Sizes

| Folder | Files | Total Size |
|--------|-------|-----------|
| ORGANIZED_BY_CATEGORY/ORANGE_BEACH | 29 | ~98 KB |
| ORGANIZED_BY_CATEGORY/GULF_SHORES | 31 | ~284 KB |
| COMBINED | 33 | ~365 KB |

---

## Category Examples

### GCR-DIRECTORY Categories:
attractions, bars, beach-bars, coffee-sweets, museums, other, parks, public-beach-access, restaurants, services, shopping, tiki-bars

### GOOGLE API Categories:
ACTIVITIES, ATTRACTIONS, LODGING, RESTAURANTS, SERVICES, SHOPPING

### SCRAPED_DATA Categories:
beach-rentals, entertainment, restaurant, shopping, water-activities, water-sports-rental

### GOOGLE_SHEETS Categories:
activities, beach-access, boat-launch, coffee, entertainment, hotels, parking, restaurants, sweets

---

## Sample Queries

### "All restaurants in Orange Beach"
→ Open: `ORGANIZED_BY_CATEGORY/ORANGE_BEACH/GCR_DIRECTORY/restaurants.csv`

### "All restaurants (both cities)"
→ Open: `COMBINED/GCR_DIRECTORY/restaurants.csv` → Filter by city

### "Google API businesses in Gulf Shores"
→ Open any file in `ORGANIZED_BY_CATEGORY/GULF_SHORES/GOOGLE_API/`

### "Water activities (both cities)"
→ Open: `COMBINED/SCRAPED_DATA/water-activities.csv`

### "Bars with ratings"
→ Open: `COMBINED/GCR_DIRECTORY/bars.csv` → Sort by rating

---

## Next Steps

1. **Download the folder** → Use with Excel, Google Sheets, Python, etc.
2. **Filter by city** → (COMBINED version only)
3. **Sort by rating** → Find top-rated businesses
4. **Export to database** → Import into your own system
5. **Analyze coverage** → Which categories have most URLs?

---

## Generated
- **Date:** 2026-03-21
- **Total Businesses:** 2,627 (611 OB + 2,016 GS)
- **Total CSV Files:** 93 (60 organized + 33 combined)
- **Data Sources:** 4 (GCR-Directory, Google API, Scraped Data, Google Sheets)
- **Franchises Filtered:** ~40+ chains removed

---

## Questions?

- **Orange Beach only?** → Use `ORGANIZED_BY_CATEGORY/ORANGE_BEACH/`
- **Gulf Shores only?** → Use `ORGANIZED_BY_CATEGORY/GULF_SHORES/`
- **Both cities together?** → Use `COMBINED/`
- **By data source?** → Choose folder: GCR_DIRECTORY, GOOGLE_API, SCRAPED_DATA, or GOOGLE_SHEETS
- **By category?** → Open corresponding CSV file

**See INDEX.md in each folder for detailed file listings!**

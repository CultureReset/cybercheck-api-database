# Orange Beach vs Gulf Shores — Data Breakdown by Source

## Summary
This analysis compares URL counts across all data sources for two coastal Alabama cities.

---

## 1. GCR-DIRECTORY (merged.json - All Categories)

| Category | Orange Beach | Gulf Shores |
|----------|-------------|-----------|
| Other | 234 / 201 | 1,060 / 871 |
| Bars | 10 / 10 | 69 / 61 |
| Shopping | 11 / 9 | 200 / 159 |
| Coffee/Sweets | 9 / 9 | 63 / 50 |
| Attractions | 14 / 13 | 14 / 13 |
| Restaurants | 4 / 4 | 215 / 185 |
| Services | — | 59 / 45 |
| Beach Bars | 1 / 0 | 6 / 6 |
| Public Beach Access | 1 / 0 | 12 / 7 |
| Museums | — | 2 / 2 |
| Parks | — | 2 / 2 |
| Tiki Bars | 1 / 1 | 1 / 1 |
| **TOTAL** | **285 / 247** | **1,703 / 1,402** |

**Key insight:** Gulf Shores has 6x more businesses in gcr-directory. "Other" category dominates both cities.

---

## 2. GOOGLE API DATA (gcr-organized-scrape.json)

| Category | Orange Beach | Gulf Shores |
|----------|-------------|-----------|
| Services | 42 / 34 | 50 / 41 |
| Restaurants | 41 / 37 | 42 / 39 |
| Shopping | 33 / 25 | 29 / 22 |
| Attractions | 21 / 17 | 36 / 30 |
| Activities | 15 / 10 | 29 / 24 |
| Lodging | 8 / 8 | 7 / 7 |
| **TOTAL** | **160 / 131** | **193 / 163** |

**Key insight:** Google API data is more balanced between cities. Gulf Shores has ~20% more entries.

---

## 3. SCRAPED DATA (master-data.json)

| Metric | Orange Beach | Gulf Shores |
|--------|-------------|-----------|
| Total Businesses | 142 | 97 |
| With Website URL | 132 | 91 |
| **URL Coverage** | **93%** | **94%** |

**Key insight:** Orange Beach has ~45% more scraped data entries. Both have high URL coverage (93-94%).

---

## 4. GOOGLE SHEETS DATA

| Type | Orange Beach | Gulf Shores |
|------|-------------|-----------|
| Total Businesses | 59 | 70 |
| Website URLs | 51 | 57 |
| Facebook URLs | 3 | 3 |
| Instagram URLs | 2 | 3 |
| **Any URL** | **51** | **57** |

**Key insight:** Google Sheets data is curated and similar in size. Social media URLs are minimal in both.

---

## GRAND SUMMARY

| Data Source | Orange Beach (Tot / URL) | Gulf Shores (Tot / URL) | Ratio |
|---|---|---|---|
| gcr-directory | 285 / 247 | 1,703 / 1,402 | 1:6 |
| Google API | 160 / 131 | 193 / 163 | 1:1.2 |
| Scraped data | 142 / 132 | 97 / 91 | 1.5:1 |
| Google Sheets | 59 / 51 | 70 / 57 | 1:1.2 |
| **COMBINED** | **646 / 561** | **2,063 / 1,713** | **1:3.2** |

---

## Data Source Characteristics

### GCR-Directory (merged.json)
- **Purpose:** Complete merged database from Google Cloud directory scrape
- **Coverage:** Broadest - 1,703 Gulf Shores businesses
- **URL Rate:** 82% (Gulf Shores), 87% (Orange Beach)
- **Note:** Heavy "Other" category - may include non-business listings

### Google API (gcr-organized-scrape.json)
- **Purpose:** Google Places API data organized by category
- **Coverage:** Balanced - 160 (OB), 193 (GS)
- **URL Rate:** 82% (Orange Beach), 85% (Gulf Shores)
- **Note:** Clean categorization but limited scope

### Scraped Data (master-data.json)
- **Purpose:** Web-scraped business directory data
- **Coverage:** Orange Beach-heavy - 142 (OB), 97 (GS)
- **URL Rate:** 93-94% both cities
- **Note:** High URL coverage, potentially outdated

### Google Sheets (manual entry)
- **Purpose:** Human-curated business data
- **Coverage:** Similar - 59 (OB), 70 (GS)
- **URL Rate:** 86-81%
- **Note:** Includes social media URLs, highest data quality

---

## Generated: 2026-03-21

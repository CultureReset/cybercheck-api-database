# Orange Beach vs Gulf Shores — URL Data Analysis

**Generated:** 2026-03-21

## Overview

This directory contains a comprehensive breakdown of URL counts for businesses in Orange Beach and Gulf Shores, Alabama, across four distinct data sources:

1. **GCR-Directory** (merged.json) — 1,988 businesses
2. **Google API** (Google Places API) — 353 businesses
3. **Scraped Data** (master-data.json) — 239 businesses
4. **Google Sheets** (manual curated) — 129 businesses

## Files in This Directory

### Primary Analysis Files

- **BREAKDOWN_BY_SOURCE.md** — Main analysis document with tables and insights
- **breakdown.json** — Structured JSON data for programmatic access
- **all_sources_summary.csv** — High-level summary across all sources

### Source-Specific Data

- **gcr_directory_breakdown.csv** — Detailed breakdown by business category
- **google_api_breakdown.csv** — Google API results by category
- *(other CSV files can be added as needed)*

## Quick Stats

### Orange Beach
- **Total Businesses (all sources):** 646
- **With Website URL:** 561 (87%)
- **Largest source:** GCR-Directory (285 businesses)

### Gulf Shores
- **Total Businesses (all sources):** 2,063
- **With Website URL:** 1,713 (83%)
- **Largest source:** GCR-Directory (1,703 businesses)

### Key Finding
Gulf Shores has **3.2x more** businesses across all data sources, but Orange Beach has slightly higher URL coverage (87% vs 83%).

## Data Source Details

### GCR-Directory (merged.json)
- **Coverage:** Broadest dataset with 1,988 total businesses
- **Categories:** 12 categories (restaurants, shopping, bars, attractions, etc.)
- **URL Rate:** 82-87% (Gulf Shores more complete)
- **Note:** Heavy concentration in "Other" category (1,294 of 1,988)

### Google API (gcr-organized-scrape.json)
- **Coverage:** Clean categorized data, 353 total businesses
- **Categories:** 6 main categories (Services, Restaurants, Shopping, Attractions, Activities, Lodging)
- **URL Rate:** 82-85%
- **Note:** Most balanced representation between cities (160 vs 193)

### Scraped Data (master-data.json)
- **Coverage:** 239 total businesses
- **URL Rate:** 93-94% (highest coverage)
- **Note:** Orange Beach-heavy (142 vs 97), likely older/web-scraped data

### Google Sheets (manual entry)
- **Coverage:** 129 total businesses (curated)
- **Includes:** Website, Facebook, Instagram URLs
- **URL Rate:** 81-86%
- **Note:** Highest data quality, includes social media presence

## Usage Examples

### Import CSV to Spreadsheet
Open any `.csv` file in Excel, Google Sheets, or similar tools for analysis/pivot tables.

### Parse JSON Data
```bash
# View summary
cat breakdown.json | jq '.summary'

# Get Orange Beach GCR-Directory data
cat breakdown.json | jq '.data_sources.gcr_directory.totals.orange_beach'
```

### Filter by Category
The CSV files include category breakdowns for detailed analysis by business type.

## Methodology

1. **Data collection:** Queries against each data source
2. **Filtering:** Address field checked for "Orange Beach" or "Gulf Shores" (case-insensitive)
3. **URL detection:** Any website, Google Maps URL, Facebook, or Instagram URL counts as a URL
4. **Deduplication:** NOT performed — counts reflect raw data (overlaps possible)

## Notes & Caveats

- **Overlaps:** Same businesses may appear in multiple sources; totals are NOT unique counts
- **Address matching:** Uses string matching on address field; may miss alternate spellings
- **URL types:** Includes website URLs, Google Maps URLs, social media URLs
- **Data age:** Varies by source; some data may be outdated
- **Categories:** Differ between sources (GCR-Directory vs Google API structure)

## Related Data

Additional analysis available in:
- `/Users/owner/build-main/gcr-directory/` — Raw merged.json files by category
- `/Users/owner/repos/GCRHotMessvTrea/` — Source files and exports
- `/Users/owner/repos/GCR-Working-Jan2026/` — Alternative dataset

## Future Analysis

Consider:
- [ ] Deduplication across sources
- [ ] URL validation (check for dead links)
- [ ] Social media coverage analysis
- [ ] Category-specific comparisons
- [ ] Temporal analysis (data age)
- [ ] Phone number coverage analysis

---

**Questions?** Check individual source documentation or the JSON structured data for more details.

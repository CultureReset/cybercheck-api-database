# Restaurant Web Scraper & Data Extraction Guide

## Overview

This guide covers how to:
1. Find new restaurants to scrape in Orange Beach & Gulf Shores
2. Scrape their websites for screenshots
3. Extract structured data (menus, hours, contact info, etc.)

---

## Current Status

✓ **125 restaurants already scraped**
- 4,144+ total screenshots
- All organized by slug in `/screenshots/` directory
- Each restaurant has an `index.json` with metadata and page mapping

📋 **38 additional restaurants identified** (not yet scraped)
- See `restaurant-coverage-report.json` for full list

---

## Scripts Available

### 1. **find-new-restaurants.js**
Lists new restaurants not yet scraped.

```bash
node find-new-restaurants.js
```

Output: `restaurant-coverage-report.json`

### 2. **find-restaurant-websites.js**
Attempts to find websites for target restaurants.

```bash
node find-restaurant-websites.js
```

Output: `website-search-results.json` with search instructions

### 3. **batch-scrape-pipeline.js**
Scrapes multiple restaurant websites and saves screenshots.

```bash
# 1. Create config file
cp restaurants-to-scrape.json.example restaurants-to-scrape.json

# 2. Edit to add your websites:
{
  "restaurants": [
    {
      "name": "Restaurant Name",
      "website": "https://www.example.com"
    }
  ]
}

# 3. Run scraper
node batch-scrape-pipeline.js
```

Output: 
- Screenshots in `/screenshots/<restaurant-slug>/`
- Results summary in `scrape-results.json`

### 4. **extract-hammered-crab.js**
Example extraction script - pulls menu, events, catering data from screenshots using Claude's vision.

Adapt this for other restaurants:
```bash
# Copy template
cp extract-hammered-crab.js extract-<restaurant-name>.js

# Edit to target different restaurant folders and sections

# Run
node extract-<restaurant-name>.js
```

Output: `extracted-data.json` in restaurant screenshot folder

---

## Workflow

### Step 1: Find New Restaurants
```bash
node find-new-restaurants.js
```
This shows 38 potential new restaurants. Check `restaurant-coverage-report.json`.

### Step 2: Find Their Websites
```bash
node find-restaurant-websites.js
```
This outputs search queries. Use Google/Yelp to find websites.

### Step 3: Configure Batch Scraper
```bash
# Create config file
cp restaurants-to-scrape.json.example restaurants-to-scrape.json

# Edit restaurants-to-scrape.json with actual website URLs
nano restaurants-to-scrape.json
```

Example format:
```json
{
  "restaurants": [
    {
      "name": "Tackle Box",
      "website": "https://www.tacklebox-restaurant.com"
    },
    {
      "name": "The Packing Plant",
      "website": "https://packingplant-restaurant.com"
    }
  ]
}
```

### Step 4: Run Batch Scraper
```bash
node batch-scrape-pipeline.js
```

This will:
- Visit each website
- Find menu/hours/contact pages
- Screenshot all relevant pages
- Create `index.json` for each restaurant
- Save results to `scrape-results.json`

### Step 5: Extract Data from Screenshots
```bash
# For a single restaurant
cp extract-hammered-crab.js extract-<restaurant-slug>.js

# Edit the file to target different restaurant
nano extract-<restaurant-slug>.js

# Run extraction
node extract-<restaurant-slug>.js
```

This will create `extracted-data.json` with:
- Menu items & pricing
- Hours of operation
- Contact information
- Events
- Catering options
- Special offers

---

## Data Structure

### Screenshots Directory
```
/screenshots/
├── hammered-crab/
│   ├── index.json          # Metadata & page mappings
│   ├── extracted-data.json # Extracted structured data
│   ├── page-001.jpg        # Homepage screenshot 1
│   ├── page-002.jpg        # Homepage screenshot 2
│   ├── page-011.jpg        # Menu page 1
│   └── ...
├── angry-crab-shack/
│   ├── index.json
│   ├── extracted-data.json
│   └── page-*.jpg
└── ...
```

### index.json Format
```json
{
  "slug": "restaurant-name",
  "source_url": "https://www.restaurant.com",
  "scraped_at": "2026-05-18T20:14:28.029Z",
  "pages": [
    {
      "url": "https://www.restaurant.com/menu",
      "files": ["page-001.jpg", "page-002.jpg", ...]
    },
    {
      "url": "https://www.restaurant.com/hours",
      "files": ["page-010.jpg", ...]
    }
  ],
  "total_screenshots": 42
}
```

### extracted-data.json Format
```json
{
  "restaurant": "Restaurant Name",
  "url": "https://www.example.com",
  "scraped_at": "2026-05-18T20:14:28.029Z",
  "sections": {
    "menu": {
      "categories": [
        {
          "name": "Starters",
          "items": [
            {
              "name": "Item Name",
              "price": "$12.99",
              "description": "Description..."
            }
          ]
        }
      ]
    },
    "events": {
      "events": [
        {
          "name": "Event Name",
          "date": "May 25",
          "description": "..."
        }
      ]
    },
    "hours_and_contact": {
      "phone": "(251) 123-4567",
      "address": "123 Main St, Gulf Shores, AL",
      "hours": "11am-11pm daily"
    }
  }
}
```

---

## Tips & Best Practices

### Finding Websites
1. Start with Google Search: `[Restaurant Name] Orange Beach Alabama`
2. Check Yelp or TripAdvisor for website links
3. Check Google My Business listings
4. Look at social media profiles (Facebook, Instagram often have website links)

### Handling Failures
If a scraper fails:
1. Check if the website is accessible in a browser
2. Try increasing timeouts in the script
3. Some sites may block automated access
4. Check `scrape-results.json` for detailed error messages

### Extraction Tips
- Extraction uses Claude's vision capabilities (Opus 4.7)
- Works best with clear, high-contrast menus
- May need manual adjustment for complex layouts
- API rate limits: space out extractions if running many at once

### Storage
- Each restaurant averages 30-50 MB (depending on # of pages)
- 125 restaurants = ~5 GB
- Screenshots are JPG quality 80 (good compression)

---

## Common Issues & Solutions

### Issue: "Address already in use" or permission errors
**Solution**: Ensure puppeteer can access directories
```bash
chmod -R 755 /Users/owner/cybercheck-api-database/screenshots
```

### Issue: Extraction fails with "overloaded_error"
**Solution**: Wait a few minutes and retry, or space out requests
```bash
# Add delays in the extraction script
await new Promise(resolve => setTimeout(resolve, 5000));
```

### Issue: Website blocks scraper
**Solution**: Some sites block automation. Consider:
1. Scraping manually and storing screenshots
2. Using a proxy service
3. Adding realistic delays between requests
4. Checking robots.txt for allowed crawling

### Issue: Screenshots are blank or low quality
**Solution**: Try adjusting in the script:
```javascript
// Increase wait time
await page.waitForTimeout(3000);

// Increase quality
await page.screenshot({
  quality: 95  // Instead of 80
});
```

---

## Next Steps

1. **Identify missing websites** using `find-restaurant-websites.js`
2. **Manually research** websites for the 38 target restaurants
3. **Create `restaurants-to-scrape.json`** with all URLs
4. **Run batch scraper** to capture all screenshots
5. **Extract data** from each restaurant
6. **Organize into database** (SQL/JSON structure TBD)

---

## Questions?

Refer to:
- Specific extraction examples: `extract-hammered-crab.js`
- Coverage report: `restaurant-coverage-report.json`
- Batch results: `scrape-results.json` (after running scraper)
- Website search results: `website-search-results.json`

#!/bin/bash

echo "Opening Google Maps venue lookup in Chrome..."
open -a "Google Chrome" /Users/owner/cybercheck-api-database/consolidation/VENUE-GOOGLE-MAPS-LOOKUP.html

echo ""
echo "✓ Browser opened with venue lookup table"
echo ""
echo "Next steps:"
echo "1. Click 'Search' for each venue to find it on Google Maps"
echo "2. Click the business result to view details"
echo "3. Copy the Place ID from the URL (ChIJ...)"
echo "4. Paste it in the table"
echo "5. When done, click 'Save Results to JSON'"
echo "6. Copy the JSON and save to: consolidation/VENUE-PLACE-IDS-MANUAL.json"

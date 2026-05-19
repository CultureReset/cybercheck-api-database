#!/usr/bin/env node

const fs = require('fs');

const venues = JSON.parse(fs.readFileSync('./consolidation/VENUE-MAPPING.json'));

console.log('='.repeat(80));
console.log('GOOGLE MAPS SEARCH LINKS');
console.log('='.repeat(80) + '\n');

const links = venues.map((venue, i) => {
  const searchQuery = encodeURIComponent(venue);
  const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`;
  
  return {
    index: i + 1,
    venue_name: venue,
    maps_url: mapsUrl
  };
});

// Generate HTML file for easy clicking
let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Google Maps Venue Lookup</title>
  <style>
    body { font-family: Arial; padding: 20px; background: #f5f5f5; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; background: white; }
    th { background: #4285f4; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    a { color: #4285f4; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
    .num { color: #666; width: 40px; }
    .instructions { background: #e3f2fd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Google Maps Venue Lookup (${venues.length} venues)</h1>
    
    <div class="instructions">
      <strong>Instructions:</strong><br>
      1. Click on each venue name to open Google Maps<br>
      2. Find the business in the results<br>
      3. Click on it to see details<br>
      4. Copy the Place ID from the URL (looks like ChIJ...)<br>
      5. Paste it in the "Place ID" field<br>
      6. Save the JSON file when done
    </div>
    
    <table>
      <tr>
        <th class="num">#</th>
        <th>Venue Name</th>
        <th>Google Maps Link</th>
        <th>Place ID (paste here)</th>
      </tr>`;

links.forEach(link => {
  htmlContent += `
      <tr>
        <td class="num">${link.index}</td>
        <td>${link.venue_name}</td>
        <td><a href="${link.maps_url}" target="_blank">Search</a></td>
        <td><input type="text" placeholder="ChIJ..." style="width: 200px; padding: 5px;" id="place_${link.index}"></td>
      </tr>`;
});

htmlContent += `
    </table>
    
    <br>
    <button onclick="saveResults()" style="padding: 10px 20px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">
      Save Results to JSON
    </button>
    
    <pre id="output" style="background: #fff; padding: 15px; margin-top: 20px; border-radius: 4px; display: none;"></pre>
  </div>
  
  <script>
    function saveResults() {
      const results = [];
      const rows = document.querySelectorAll('table tr');
      
      for (let i = 2; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const venueName = cells[1].textContent.trim();
        const placeId = cells[3].querySelector('input').value.trim();
        
        if (placeId) {
          results.push({
            venue_name: venueName,
            place_id: placeId
          });
        }
      }
      
      const json = JSON.stringify(results, null, 2);
      document.getElementById('output').textContent = json;
      document.getElementById('output').style.display = 'block';
      
      console.log('Copy and save this to: consolidation/VENUE-PLACE-IDS-MANUAL.json');
    }
  </script>
</body>
</html>`;

fs.writeFileSync('./consolidation/VENUE-GOOGLE-MAPS-LOOKUP.html', htmlContent);

console.log('Generated: consolidation/VENUE-GOOGLE-MAPS-LOOKUP.html');
console.log('\nQuick reference links:');
links.slice(0, 10).forEach(link => {
  console.log(`${String(link.index).padStart(2)}. ${link.venue_name.padEnd(40)} → ${link.maps_url}`);
});
console.log(`... and ${links.length - 10} more\n`);

fs.writeFileSync('./consolidation/VENUE-SEARCH-LINKS.json', JSON.stringify(links, null, 2));
console.log(`✓ consolidation/VENUE-SEARCH-LINKS.json (${links.length} venues)`);
console.log('✓ consolidation/VENUE-GOOGLE-MAPS-LOOKUP.html (open in browser)\n');
console.log('Instructions:');
console.log('1. Open VENUE-GOOGLE-MAPS-LOOKUP.html in your browser');
console.log('2. Click "Search" for each venue');
console.log('3. Verify it\'s the right business and copy the Place ID from the URL');
console.log('4. Paste Place ID in the table');
console.log('5. Click "Save Results to JSON" when done');

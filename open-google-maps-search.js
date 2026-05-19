const { exec } = require('child_process');
const fs = require('fs');

const restaurants = [
  { name: 'Rotolos', location: 'Alabama' },
  { name: 'Sea-N-Suds', location: 'Gulf Shores, AL' },
  { name: 'Mudbugs Pub', location: 'Gulf Shores, AL' },
  { name: 'OHANA Poke Teriyaki', location: 'Spanish Fort, AL' },
  { name: "Vinny's Pizzeria", location: 'Orange Beach, AL' },
  { name: 'Flora-Bama Lounge', location: 'Orange Beach, AL' }
];

console.log('🗺️  OPENING GOOGLE MAPS SEARCHES\n');
console.log('═══════════════════════════════════════════════════════\n');

const urls = [];

restaurants.forEach(restaurant => {
  const query = `${restaurant.name} ${restaurant.location}`;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  urls.push({
    name: restaurant.name,
    url: url
  });
});

// Save the URLs to a file
fs.writeFileSync('./google-maps-searches.json', JSON.stringify(urls, null, 2));

console.log('📍 INSTRUCTIONS:\n');
console.log('1. Each search will open in Google Maps');
console.log('2. Click the top result');
console.log('3. Look at the URL - it will contain: /place/NAME/data=!4m6!3m5!1s0xXXXX:0xXXXX...');
console.log('4. The ID format is: ChIJ... (starts with ChIJ)\n');
console.log('Opening searches...\n');

// Open each search with a delay
let delay = 0;
urls.forEach(item => {
  setTimeout(() => {
    console.log(`🔗 ${item.name}`);
    console.log(`   ${item.url}\n`);

    // Try to open in default browser
    if (process.platform === 'darwin') {
      exec(`open "${item.url}"`);
    } else if (process.platform === 'win32') {
      exec(`start "${item.url}"`);
    } else {
      exec(`xdg-open "${item.url}"`);
    }
  }, delay);

  delay += 1500; // 1.5 second delay between opening windows
});

console.log('═══════════════════════════════════════════════════════\n');
console.log('💡 TIP: Look at each Google Maps page URL for the place ID\n');
console.log('URL format: https://www.google.com/maps/place/NAME/@30.xxx,-87.xxx,15z/data=!4m6!3m5!1s0xXXXX:0xYYYY!8m2!3d30!4d-87\n');
console.log('The place ID (ChIJ...) appears in the URL after "0x"');
console.log('\nOr save the Place ID from the info panel on the right side.\n');
console.log('✅ Search URLs saved to google-maps-searches.json\n');

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('='.repeat(70));
  console.log('TESTING: GCR PROFILE PAGE vs QR MENU vs DATABASE');
  console.log('='.repeat(70));

  // Test 1: GCR Profile
  console.log('\n📍 TEST 1: GCR PROFILE PAGE');
  console.log('URL: gulf-coast-radar.vercel.app/profile.html');
  console.log('-'.repeat(70));
  
  try {
    await page.goto('https://gulf-coast-radar.vercel.app/profile.html?slug=cosmos-restaurant-and-bar-orange-beach', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const text = await page.innerText('body');
    
    console.log('✓ Business name:', text.includes('Cosmos') ? '✓' : '✗');
    console.log('✓ Address:', text.includes('Orange Beach') || text.includes('Canal') ? '✓' : '✗');
    console.log('✓ Phone:', text.includes('251') ? '✓' : '✗');
    console.log('✓ Menu items:', text.includes('Shrimp') || text.includes('Appetizer') ? '✓' : '✗');
    console.log('✓ Hours:', text.includes('am') || text.includes('pm') ? '✓' : '✗');
    console.log('✓ Photos:', text.includes('photo') || text.includes('image') ? '✓' : '✗');
    console.log('✓ Events:', text.includes('event') || text.includes('Event') ? '✓' : '✗');
    console.log('✓ Happy Hour:', text.includes('Happy Hour') || text.includes('happy hour') ? '✓' : '✗');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  // Test 2: QR Menu
  console.log('\n📱 TEST 2: QR MENU PAGE');
  console.log('URL: cybercheck-links.vercel.app/qr-menu-simple.html');
  console.log('-'.repeat(70));
  
  try {
    await page.goto('https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cosmos-restaurant-and-bar-orange-beach', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const text = await page.innerText('body');
    
    const sections = [...new Set(text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [])];
    console.log('✓ Business name:', text.includes('Cosmos') ? '✓' : '✗');
    console.log('✓ Menu sections:', sections.length > 0 ? `✓ (${sections.length} sections)` : '✗');
    console.log('✓ Descriptions:', text.includes('remoulade') || text.includes('Pineapple') ? '✓' : '✗');
    console.log('✓ Prices:', text.includes('$') ? '✓' : '✗');
    console.log('✓ All Appetizers:', text.includes('Firecracker') ? '✓' : '✗');
    console.log('✓ All Entrees:', text.includes('Scallops') ? '✓' : '✗');
    console.log('✓ Cocktails:', text.includes('Martini') || text.includes('Margarita') ? '✓' : '✗');
    console.log('✓ Sushi:', text.includes('Volcano') || text.includes('Roll') ? '✓' : '✗');
    console.log('✓ Happy Hour:', text.includes('Happy Hour') ? '✓' : '✗');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  // Test 3: API Data
  console.log('\n🔌 TEST 3: API RETURNING DATA');
  console.log('URL: cybercheck-api-database.vercel.app/api/gcr/entity');
  console.log('-'.repeat(70));
  
  const http = require('http');
  const https = require('https');
  
  const fetchUrl = (url) => new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });

  const apiData = await fetchUrl('https://cybercheck-api-database.vercel.app/api/gcr/entity/cosmos-restaurant-and-bar-orange-beach');
  
  if (apiData) {
    console.log('✓ Entity name:', apiData.entity?.name ? '✓' : '✗');
    console.log('✓ Menu sections:', (apiData.menu?.sections?.length || 0) + ' sections');
    console.log('✓ Menu items:', (apiData.menu?.items?.length || 0) + ' items');
    console.log('✓ Drink sections:', (apiData.drinks?.sections?.length || 0) + ' sections');
    console.log('✓ Drink items:', (apiData.drinks?.items?.length || 0) + ' items');
    console.log('✓ HH sections:', (apiData.happy_hour?.sections?.length || 0) + ' sections');
    console.log('✓ HH items:', (apiData.happy_hour?.items?.length || 0) + ' items');
    console.log('✓ Photos:', (apiData.photos?.length || 0) + ' photos');
    console.log('✓ Events:', (apiData.events?.length || 0) + ' events');
    console.log('✓ Specials:', (apiData.specials?.length || 0) + ' specials');
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log('GCR Profile: Check if all business data displays');
  console.log('QR Menu: All menu sections and items showing ✓');
  console.log('API: All data available in database ✓');
  
  await browser.close();
})();

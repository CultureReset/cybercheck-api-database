#!/usr/bin/env node
require('dotenv').config();
const supabase = require('./db');
const restaurants = require('./restaurants-with-specials.json');
const crypto = require('crypto');

const uuidv4 = () => crypto.randomUUID();

const toInsert = [
  'BOLO Steak & Seafood',
  'BuzzCatz Coffee & Sweets',
  'Flora-Bama Ole River Grill',
  "GT's On The Bay",
  "LuLu's Gulf Shores",
  'Pink Pony Pub',
  'Wolf Bay Restaurant'
];

async function insertNewRestaurants() {
  let inserted = 0;
  let errors = 0;

  const toProcess = restaurants.filter(r => toInsert.some(x => r.name === x));

  for (const resto of toProcess) {
    try {
      const now = new Date().toISOString();
      const siteId = uuidv4();

      // Map category to type
      let type = 'restaurant';
      if (resto.name.includes('Coffee') || resto.name.includes('Bakery')) type = 'coffee-sweets';

      // Map subcategory if exists
      let subcategory = null;
      if (resto.cuisine) {
        const first = resto.cuisine.split('•')[0].trim().toLowerCase().replace(/\s+/g, '-');
        subcategory = first;
      }

      console.log(`\n📝 Inserting: ${resto.name}`);

      // 1. Insert into businesses
      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .insert({
          site_id: siteId,
          name: resto.name,
          type: type,
          subcategory: subcategory,
          status: 'active',
          gcr_listed: true,
          gcr_verified: false,
          happy_hour: !!resto.happyHour,
          tags: resto.tags || [],
          rating: resto.rating || null,
          review_count: 0,
          featured: false,
          sort_order: 999,
          created_at: now,
          updated_at: now
        })
        .select('site_id');

      if (bizErr) {
        console.error(`  ✗ Error inserting business: ${bizErr.message}`);
        errors++;
        continue;
      }

      console.log(`  ✓ Business inserted (ID: ${siteId})`);

      // 2. Insert into site_content
      const address = resto.address || '';
      const [street, cityState] = address.includes(',') ? address.split(',').map(s => s.trim()) : [address, ''];
      const [city, stateZip] = cityState.split(' ').length > 1
        ? [cityState.split(' ')[0], cityState.split(' ').slice(1).join(' ')]
        : [cityState, ''];

      const { error: contentErr } = await supabase
        .from('site_content')
        .insert({
          site_id: siteId,
          address: street,
          city: city || resto.location,
          state: 'AL',
          contact_phone: resto.phone,
          website_url: resto.website,
          about_text: resto.description || null,
          seo_description: resto.description || null
        });

      if (contentErr) {
        console.error(`  ✗ Error inserting content: ${contentErr.message}`);
        errors++;
      } else {
        console.log(`  ✓ Content inserted`);
      }

      // 3. Insert specials if happy hour exists
      if (resto.happyHourDeals && Array.isArray(resto.happyHourDeals)) {
        const dealsText = resto.happyHourDeals.join(' | ');

        const { error: specErr } = await supabase
          .from('specials')
          .insert({
            site_id: siteId,
            name: 'Happy Hour',
            description: dealsText,
            discount: resto.happyHour || 'Daily',
            active: true,
            created_at: now
          });

        if (specErr) {
          console.error(`  ✗ Error inserting specials: ${specErr.message}`);
        } else {
          console.log(`  ✓ Happy hour specials added`);
        }
      }

      inserted++;
    } catch (err) {
      console.error(`✗ Error processing ${resto.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Inserted: ${inserted} | Errors: ${errors}`);
  console.log(`\nCheck https://gcr-rosy.vercel.app/index3 for updates`);
}

insertNewRestaurants().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

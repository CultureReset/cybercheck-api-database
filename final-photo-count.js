require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const IMAGE_DIRS = [
  { path: '/Users/owner/cybercheck-api-database/restaurant-photos', type: 'place_id' },
  { path: '/Users/owner/cybercheck-api-database/specialty-photos', type: 'place_id' },
  { path: '/Users/owner/cybercheck-api-database/activity-photos', type: 'place_id' },
  { path: '/Users/owner/cybercheck-api-database/shopping-services-photos', type: 'place_id' },
  { path: '/Users/owner/condos_images', type: 'name' },
  { path: '/Users/owner/vacationhomes_images', type: 'name' },
  { path: '/Users/owner/tripshock_images', type: 'name' },
];

async function main() {
  // Load entities
  const { data: entities } = await db.from('entity').select('id, place_id, name').eq('is_active', true);
  
  const placeIdMap = {};
  const nameMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e;
    if (e.name) {
      const norm = (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (!nameMap[norm]) nameMap[norm] = [];
      nameMap[norm].push(e);
    }
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`FINAL PHOTO COUNT - TIED TO ACTUAL BUSINESSES`);
  console.log(`${'='.repeat(80)}\n`);

  let totalPhotos = 0;
  let matched = 0;
  let unmatched = 0;

  for (const { path: imgDir, type } of IMAGE_DIRS) {
    if (!fs.existsSync(imgDir)) continue;

    const folders = fs.readdirSync(imgDir).filter(f => 
      fs.statSync(path.join(imgDir, f)).isDirectory()
    );

    let dirMatched = 0;
    let dirUnmatched = 0;
    let dirPhotos = 0;

    for (const folder of folders) {
      const imageFolder = path.join(imgDir, folder);
      const files = fs.readdirSync(imageFolder)
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
      
      dirPhotos += files.length;
      totalPhotos += files.length;

      let entity;
      if (type === 'place_id') {
        entity = placeIdMap[folder];
      } else {
        const norm = folder.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        entity = (nameMap[norm] || [])[0];
      }

      if (entity) {
        dirMatched += files.length;
        matched += files.length;
      } else {
        dirUnmatched += files.length;
        unmatched += files.length;
      }
    }

    console.log(`📁 ${path.basename(imgDir)}`);
    console.log(`   Total: ${dirPhotos} photos`);
    console.log(`   ✓ Tied to business: ${dirMatched} (${(dirMatched/dirPhotos*100).toFixed(1)}%)`);
    console.log(`   ✗ NOT tied: ${dirUnmatched} (${(dirUnmatched/dirPhotos*100).toFixed(1)}%)\n`);
  }

  console.log(`${'='.repeat(80)}`);
  console.log(`FINAL TOTALS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Total photos available: ${totalPhotos}`);
  console.log(`  ✓ Tied to businesses: ${matched} (${(matched/totalPhotos*100).toFixed(1)}%)`);
  console.log(`  ✗ NOT tied to business: ${unmatched} (${(unmatched/totalPhotos*100).toFixed(1)}%)`);
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(e => console.error('Error:', e.message));

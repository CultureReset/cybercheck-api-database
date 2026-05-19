require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  // Check entity table structure
  console.log('📊 ENTITY TABLE - Photo fields:');
  const { data: entitySample } = await db.from('entity').select('id, name, hero_image_url, _extra_photos').limit(2);
  
  if (entitySample?.length) {
    console.log(`  - id: entity_id (primary key)`);
    console.log(`  - hero_image_url: main photo (string)`);
    console.log(`  - _extra_photos: additional photos (array)\n`);
    
    console.log('Example:');
    console.log(`  id: ${entitySample[0].id}`);
    console.log(`  name: ${entitySample[0].name}`);
    console.log(`  hero_image_url: ${entitySample[0].hero_image_url}`);
    console.log(`  _extra_photos: ${Array.isArray(entitySample[0]._extra_photos) ? entitySample[0]._extra_photos.length + ' photos' : 'null'}\n`);
  }

  // Check if entity_photos table exists
  console.log('📋 Checking for entity_photos table...');
  const { data: tables, error } = await db.from('entity_photos').select('*').limit(1);
  
  if (error) {
    console.log('  ✗ entity_photos table: Not found or error\n');
  } else {
    console.log('  ✓ entity_photos table: EXISTS\n');
  }

  // Physical storage location
  console.log('💾 SUPABASE STORAGE:');
  console.log('  Bucket: entity-images');
  console.log('  Path structure: entity-images/{entity.id}/{filename}.jpg');
  console.log('  Example: entity-images/abc123/abc123_1716067200000.jpg\n');
}

main().catch(e => console.error('Error:', e.message));

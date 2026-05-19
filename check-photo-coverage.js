require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  const { data: all, error: err1 } = await db.from('entity').select('id, name, hero_image_url').eq('is_active', true);
  
  if (err1) {
    console.error('Error:', err1.message);
    return;
  }

  const withPhotos = (all || []).filter(e => e.hero_image_url);
  const withoutPhotos = (all || []).filter(e => !e.hero_image_url);

  console.log(`\nTOTAL ENTITIES: ${all.length}`);
  console.log(`With photos: ${withPhotos.length} (${(withPhotos.length / all.length * 100).toFixed(1)}%)`);
  console.log(`WITHOUT photos: ${withoutPhotos.length} (${(withoutPhotos.length / all.length * 100).toFixed(1)}%)\n`);

  if (withoutPhotos.length > 0 && withoutPhotos.length <= 50) {
    console.log('Entities missing photos:');
    withoutPhotos.forEach(e => console.log(`  - ${e.name}`));
  } else if (withoutPhotos.length > 50) {
    console.log(`First 20 entities missing photos:`);
    withoutPhotos.slice(0, 20).forEach(e => console.log(`  - ${e.name}`));
  }
}

main().catch(e => console.error('Fatal:', e.message));

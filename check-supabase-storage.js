require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  try {
    const { data, error } = await db.storage.from('entity-images').list('', { limit: 10000 });
    
    if (error) {
      console.error('Error:', error.message);
      return;
    }

    console.log(`\nPhotos in Supabase storage: ${data.length}`);
    
    if (data.length < 20) {
      console.log('\nAll files:');
      data.forEach(f => console.log(`  ${f.name}`));
    }
  } catch (e) {
    console.error('Fatal:', e.message);
  }
}

main();

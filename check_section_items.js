require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function check() {
  const db = getGcrDb();
  
  // Get a sample section_items
  const { data: items, error: itemErr } = await db
    .from('section_items')
    .select('*')
    .limit(3);
  
  console.log('📋 SECTION_ITEMS SAMPLE:');
  if (itemErr) console.log('Error:', itemErr.message);
  else console.log(JSON.stringify(items, null, 2));
  
  console.log('\n---\n');
  
  // Get a sample section_bullets
  const { data: bullets, error: bullErr } = await db
    .from('section_bullets')
    .select('*')
    .limit(3);
  
  console.log('📋 SECTION_BULLETS SAMPLE:');
  if (bullErr) console.log('Error:', bullErr.message);
  else console.log(JSON.stringify(bullets, null, 2));
}

check().catch(console.error);

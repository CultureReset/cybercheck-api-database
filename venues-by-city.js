require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  const { data: entities } = await db.from('entity').select('city, count(*)');

  // Group by city
  const byCityCount = {};
  const { data: all } = await db.from('entity').select('city, name, entity_type, entity_subtype');
  all.forEach(e => {
    if (e.city) byCityCount[e.city] = (byCityCount[e.city] || 0) + 1;
  });

  console.log('\nVenues by city:\n');
  Object.entries(byCityCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => {
      console.log(`  ${count.toString().padStart(4)} venues | ${city}`);
    });
}

main().catch(e => console.error(e.message));

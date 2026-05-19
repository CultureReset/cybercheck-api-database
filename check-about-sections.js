require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('📋 CHECKING FOR ABOUT SECTIONS\n');

  // Count entities
  const { count: totalEntities } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // Count entities WITH about sections
  const { data: entitiesWithAbout } = await supabase
    .from('entity_sections')
    .select('entity_id', { count: 'exact' })
    .eq('section_type', 'rich_text');

  const aboutSet = new Set(entitiesWithAbout?.map(r => r.entity_id) || []);

  // Get entities WITHOUT about
  const { data: noAbout } = await supabase
    .from('entity')
    .select('id, name, slug')
    .eq('is_active', true)
    .limit(10);

  const missingAbout = (noAbout || []).filter(e => !aboutSet.has(e.id));

  console.log(`Total active entities: ${totalEntities}`);
  console.log(`Entities WITH About: ${aboutSet.size}`);
  console.log(`Entities WITHOUT About: ${totalEntities - aboutSet.size}\n`);

  if (missingAbout.length > 0) {
    console.log('Sample entities needing About section:');
    missingAbout.slice(0, 5).forEach(e => {
      console.log(`  - ${e.name} (${e.slug})`);
    });
  }
}

check().catch(e => console.error(e.message));

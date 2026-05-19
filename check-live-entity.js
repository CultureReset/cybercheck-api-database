require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  // Get a business with data
  const { data: entity } = await supabase
    .from('entity')
    .select('id, name, slug, description, hero_image_url, is_active')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!entity) {
    console.log('No active entity found');
    return;
  }

  console.log('📊 SAMPLE ENTITY:\n');
  console.log(`Name: ${entity.name}`);
  console.log(`Slug: ${entity.slug}`);
  console.log(`Description: ${entity.description ? entity.description.substring(0, 100) : 'NONE'}`);
  console.log(`Hero image: ${entity.hero_image_url ? 'YES' : 'NO'}`);
  console.log(`Active: ${entity.is_active}`);

  // Check sections
  const { data: sections } = await supabase
    .from('entity_sections')
    .select('id, section_label, section_type')
    .eq('entity_id', entity.id);

  console.log(`\nSections (${sections?.length || 0}):`);
  (sections || []).forEach(s => {
    console.log(`  - ${s.section_label} (${s.section_type})`);
  });

  // Check what other data exists
  const { count: photos } = await supabase
    .from('entity_media')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entity.id);

  const { count: events } = await supabase
    .from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entity.id);

  const { count: specials } = await supabase
    .from('entity_specials')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entity.id);

  console.log(`\nOther data:`);
  console.log(`  - Photos: ${photos || 0}`);
  console.log(`  - Events: ${events || 0}`);
  console.log(`  - Specials: ${specials || 0}`);
}

check().catch(e => console.error(e.message));

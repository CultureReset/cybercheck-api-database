require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function show() {
  console.log('📊 ORPHANED DATA STRUCTURE\n');
  console.log('═'.repeat(70));

  // Sample event
  console.log('\n📅 SAMPLE EVENT:');
  const { data: event } = await supabase
    .from('entity_events')
    .select('*')
    .limit(1)
    .single();

  if (event) {
    console.log(JSON.stringify(event, null, 2));
  }

  // Sample special
  console.log('\n\n🎉 SAMPLE SPECIAL:');
  const { data: special } = await supabase
    .from('entity_specials')
    .select('*')
    .limit(1)
    .single();

  if (special) {
    console.log(JSON.stringify(special, null, 2));
  }

  // Sample happy hour
  console.log('\n\n🍻 SAMPLE HAPPY HOUR:');
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('*')
    .limit(1)
    .single();

  if (hh) {
    console.log(JSON.stringify(hh, null, 2));
  }

  // Sample section
  console.log('\n\n📋 SAMPLE SECTION:');
  const { data: section } = await supabase
    .from('entity_sections')
    .select('*')
    .limit(1)
    .single();

  if (section) {
    console.log(JSON.stringify(section, null, 2));
  }

  console.log('\n' + '═'.repeat(70));
}

show().catch(e => console.error(e.message));

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get The Bad Alibi
    const { data: biz } = await gcrDb
      .from('entity')
      .select('id, slug, name')
      .eq('slug', 'the-bad-alibi-qUMK94')
      .single();

    console.log(`\n=== ${biz.name} SECTIONS ===\n`);

    // Get ALL sections for this business
    const { data: sections } = await gcrDb
      .from('entity_sections')
      .select('section_type, section_label', { count: 'exact' })
      .eq('entity_id', biz.id)
      .order('section_type');

    const byType = {};
    sections.forEach(s => {
      if (!byType[s.section_type]) byType[s.section_type] = [];
      byType[s.section_type].push(s.section_label);
    });

    Object.entries(byType).forEach(([type, labels]) => {
      console.log(`${type}: ${labels.length} sections`);
      labels.forEach(label => console.log(`  - ${label}`));
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
})();

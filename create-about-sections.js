#!/usr/bin/env node
/**
 * CREATE ABOUT SECTIONS FOR ALL ENTITIES
 * Takes entity.description and creates rich_text About section
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  console.log('📝 CREATING ABOUT SECTIONS\n');

  // Get all active entities with descriptions
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name, description')
    .eq('is_active', true)
    .order('created_at');

  console.log(`Found ${entities.length} entities\n`);

  let created = 0;
  let skipped = 0;

  for (const entity of entities) {
    try {
      const description = entity.description || `Learn more about ${entity.name}`;

      // Create entity_sections record
      const { data: section, error: secError } = await supabase
        .from('entity_sections')
        .insert({
          entity_id: entity.id,
          section_key: 'about',
          section_label: 'About',
          section_type: 'rich_text',
          sort_order: 0,
        })
        .select('id')
        .single();

      if (secError) {
        console.log(`⊘ ${entity.name}: section already exists`);
        skipped++;
        continue;
      }

      // Create section_rich_text record
      const { error: textError } = await supabase
        .from('section_rich_text')
        .insert({
          section_id: section.id,
          body_text: description,
        });

      if (textError) throw textError;

      created++;
      if (created % 100 === 0) console.log(`✓ Created ${created} About sections...`);
    } catch (e) {
      console.error(`✗ ${entity.name}: ${e.message}`);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`✓ Created: ${created}`);
  console.log(`⊘ Skipped: ${skipped}`);
}

main().catch(console.error);

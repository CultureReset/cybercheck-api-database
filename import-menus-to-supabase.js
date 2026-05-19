#!/usr/bin/env node
/**
 * IMPORT MATCHED MENUS TO SUPABASE
 * Takes menus-matched.json and loads menu sections + items into entity_sections + section_items
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  console.log('📥 Importing menus to Supabase...\n');

  const menus = JSON.parse(
    fs.readFileSync('/Users/owner/cybercheck-api-database/menus-matched.json', 'utf8')
  );

  let imported = 0;
  let skipped = 0;
  let errors = [];

  for (const menu of menus) {
    try {
      const { entity_id, menu_data } = menu;

      // Skip if no sections
      if (!menu_data.menu_sections || menu_data.menu_sections.length === 0) {
        skipped++;
        continue;
      }

      // Create section for each menu section
      for (const section of menu_data.menu_sections) {
        const { data: sectionData, error: sectionError } = await supabase
          .from('entity_sections')
          .insert({
            entity_id,
            section_key: section.section_name.toLowerCase().replace(/\s+/g, '-'),
            section_label: section.section_name,
            section_type: 'grouped_items',
            sort_order: 0,
          })
          .select('id')
          .single();

        if (sectionError) throw sectionError;
        if (!sectionData) {
          skipped++;
          continue;
        }

        const section_id = sectionData.id;

        // Create group for this section
        const { data: groupData, error: groupError } = await supabase
          .from('section_groups')
          .insert({
            section_id,
            title: section.section_name,
            sort_order: 0,
          })
          .select('id')
          .single();

        if (groupError) throw groupError;
        const group_id = groupData.id;

        // Insert items
        if (section.items && section.items.length > 0) {
          const items = section.items.map((item, idx) => ({
            section_id,
            group_id,
            item_name: item.name,
            item_description: item.description || null,
            price_text: item.price || null,
            sort_order: idx,
          }));

          const { error: itemsError } = await supabase
            .from('section_items')
            .insert(items);

          if (itemsError) throw itemsError;
        }

        imported++;
      }
    } catch (e) {
      errors.push({
        entity: menu.entity_name,
        error: e.message,
      });
    }
  }

  console.log(`\n✓ Imported: ${imported} menu sections`);
  console.log(`⊘ Skipped: ${skipped} (no data)`);
  if (errors.length > 0) {
    console.log(`✗ Errors: ${errors.length}`);
    errors.slice(0, 5).forEach(e => {
      console.log(`  - ${e.entity}: ${e.error}`);
    });
  }
}

main().catch(console.error);

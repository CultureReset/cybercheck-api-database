#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log('📤 UPLOADING MATCHED MENUS\n');

  const matched = JSON.parse(
    fs.readFileSync('/Users/owner/cybercheck-api-database/menus-matched.json', 'utf8')
  );

  console.log(`${matched.length} restaurants to process\n`);

  let totalItems = 0;

  for (let i = 0; i < matched.length; i++) {
    const m = matched[i];
    const menu = m.menu_data;

    if (!menu.menu_sections || menu.menu_sections.length === 0) {
      console.log(`[${i + 1}/${matched.length}] ${m.entity_name} - no sections`);
      continue;
    }

    const items = [];
    for (const section of menu.menu_sections) {
      for (const item of section.items || []) {
        items.push({
          site_id: m.entity_id,
          name: item.name,
          description: item.description || null,
          price: item.price ? parseFloat(item.price.replace(/[$,]/g, '')) : null,
          category: section.section_name,
          tags: [
            ...(item.dietary_tags || []),
            item.spicy_level ? `spicy_${item.spicy_level}` : null,
          ].filter(Boolean),
          available: true,
        });
      }
    }

    if (items.length === 0) continue;

    const { error } = await gcrDb.from('menu_items').insert(items);

    if (error) {
      console.log(`[${i + 1}/${matched.length}] ${m.entity_name} - ✗ ${error.message.substring(0, 40)}`);
    } else {
      totalItems += items.length;
      console.log(`[${i + 1}/${matched.length}] ${m.entity_name} - ✓ (${items.length})`);
    }
  }

  console.log(`\n✓ Uploaded ${totalItems} menu items!`);
}

main().catch(console.error);

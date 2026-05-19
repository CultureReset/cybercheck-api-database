#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  const matched = JSON.parse(fs.readFileSync('/Users/owner/cybercheck-api-database/menus-matched.json', 'utf8'));
  let totalItems = 0;

  for (const m of matched) {
    const items = [];
    for (const section of m.menu_data.menu_sections || []) {
      for (const item of section.items || []) {
        items.push({
          entity_id: m.entity_id,
          name: item.name,
          description: item.description,
          price: item.price,
          section: section.section_name,
        });
      }
    }

    if (items.length) {
      const { error } = await gcrDb.from('gcr_menu_items').insert(items);
      if (!error) {
        totalItems += items.length;
        console.log(`✓ ${m.entity_name}: ${items.length} items`);
      }
    }
  }

  console.log(`\n✓ UPLOADED ${totalItems} ITEMS`);
}

main().catch(console.error);

#!/usr/bin/env node
require('dotenv').config();
const supabase = require('./db');
const fs = require('fs');
const path = require('path');

const SCRAPED_DIR = '/Users/owner/cybercheck-api-database/scraped-menus';

async function insertMissingMenus() {
  const dirs = fs.readdirSync(SCRAPED_DIR).filter(d => {
    const fullPath = path.join(SCRAPED_DIR, d);
    return fs.statSync(fullPath).isDirectory();
  });

  let inserted = 0, skipped = 0, errors = 0;

  for (const dir of dirs) {
    const dataFile = path.join(SCRAPED_DIR, dir, 'data.json');
    if (!fs.existsSync(dataFile)) continue;

    try {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      if (!data.menu || !data.menu.categories) continue;

      const bizName = data.business_name || data.name;
      if (!bizName) continue;

      // Find matching restaurant in DB
      const { data: biz } = await supabase
        .from('businesses')
        .select('site_id, name')
        .ilike('name', `%${bizName}%`)
        .limit(1);

      if (!biz || !biz[0]) {
        console.log(`⚠ Not found: ${bizName}`);
        skipped++;
        continue;
      }

      const siteId = biz[0].site_id;

      // Check if already has menu items
      const { count } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact' })
        .eq('site_id', siteId);

      if (count && count > 0) {
        console.log(`✓ Already has ${count} menu items: ${biz[0].name}`);
        skipped++;
        continue;
      }

      // Extract and insert menu items
      const menuItems = [];
      for (const cat of data.menu.categories) {
        const catName = cat.name || 'Other';
        const items = cat.items || [];
        for (const item of items.slice(0, 30)) {
          menuItems.push({
            site_id: siteId,
            name: item.name || 'Menu Item',
            description: item.description || '',
            price: item.price || null,
            category: catName,
            available: true,
            sort_order: menuItems.length
          });
        }
      }

      if (menuItems.length === 0) {
        skipped++;
        continue;
      }

      const { error: insertErr } = await supabase
        .from('menu_items')
        .insert(menuItems);

      if (insertErr) {
        console.error(`✗ Error inserting menu for ${biz[0].name}: ${insertErr.message}`);
        errors++;
      } else {
        console.log(`✓ Inserted ${menuItems.length} items for ${biz[0].name}`);
        inserted++;
      }
    } catch (err) {
      console.error(`✗ Error processing ${dir}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Inserted: ${inserted} | Skipped: ${skipped} | Errors: ${errors}`);
}

insertMissingMenus().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ICEHOUSE_SITE_ID = '7318cf9d-2a5f-45d7-868b-7a0e6e7aedb1';

// Simple CSV parser that handles quoted fields
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      const nextChar = lines[i][j + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

async function addMenuItems() {
  const csvPath = path.join(__dirname, '../temp/icehouse_menu.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Loaded ${rows.length} rows from CSV`);

  const items = rows
    .filter(row => row.Type === 'MENU_ITEM' && row.Name)
    .map((row, idx) => ({
      site_id: ICEHOUSE_SITE_ID,
      category: row.Category,
      name: row.Name,
      description: row.Description || null,
      price: parseFloat(row.Price) || 0,
      tags: [],
      sort_order: idx
    }));

  console.log(`\nParsed ${items.length} menu items`);
  console.log(`Inserting into menu_items table...\n`);

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(items)
      .select();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log(`✓ Successfully inserted ${data.length} menu items\n`);

    // Display summary by category
    const categories = {};
    data.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item.name);
    });

    console.log('Menu breakdown by category:');
    Object.entries(categories).forEach(([cat, items]) => {
      console.log(`  ${cat}: ${items.length} items`);
      items.forEach(name => console.log(`    - ${name}`));
    });

    console.log('\n✓ All menu items added successfully!');
  } catch (err) {
    throw err;
  }
}

async function main() {
  try {
    await addMenuItems();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();

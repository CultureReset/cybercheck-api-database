require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

const ENTITY_ID = '7e25082f-e90e-4c89-9f9c-10471c12b628'; // The Sloop
const APPLY = process.argv.includes('--apply');

// Simple CSV parser handling quoted fields
function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  const header = lines[0].split(',');

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = {};
    const fields = [];
    let current = '';
    let inQuote = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"' && !inQuote) inQuote = true;
      else if (c === '"' && inQuote && lines[i][j+1] === '"') { current += '"'; j++; }
      else if (c === '"' && inQuote) inQuote = false;
      else if (c === ',' && !inQuote) { fields.push(current); current = ''; }
      else current += c;
    }
    fields.push(current);
    header.forEach((h, idx) => row[h.trim()] = (fields[idx] || '').trim());
    rows.push(row);
  }
  return rows;
}

function normSection(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normItemName(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function parsePrice(s) {
  if (!s) return null;
  const m = s.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

async function run() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (use --apply to commit) ===\n');

  // Load CSV
  const csv = fs.readFileSync('/Users/owner/cybercheck-api-database/sloop-menu-data.csv', 'utf8');
  const rows = parseCSV(csv);
  const csvItems = rows.filter(r => r.section === 'menu_item' && r.item_name);
  console.log(`CSV menu items: ${csvItems.length}`);

  // Load existing sections
  const { data: existingSections } = await supabase
    .from('menu_sections')
    .select('id, section_name')
    .eq('entity_id', ENTITY_ID);

  const sectionByNorm = {};
  existingSections.forEach(s => {
    sectionByNorm[normSection(s.section_name)] = s;
  });

  console.log(`Existing sections: ${existingSections.length}`);
  existingSections.forEach(s => console.log(`  • ${s.section_name}`));

  // Load existing items
  const { data: existingItems } = await supabase
    .from('menu_items')
    .select('id, item_name, menu_section_id')
    .eq('entity_id', ENTITY_ID);

  // Build lookup: section_id|norm_item_name → item
  const itemBySectionAndName = {};
  existingItems.forEach(it => {
    const k = it.menu_section_id + '|' + normItemName(it.item_name);
    itemBySectionAndName[k] = it;
  });

  // Section name aliases (CSV → DB)
  const sectionAliases = {
    'cheesesteakshoagiessandwiches': 'cheesesteakshoagiessandwiches',
    'cheesesteaks': 'cheesesteakshoagiessandwiches',
    'forthekids': 'forthekids',
    'snacks': 'snacks', // also try snacksappetizers
    'salads': 'salads',
    'cocktails': 'cocktails',
    'spirits': 'spirits'
  };

  const newSections = {};   // norm → section name to create
  const itemsToInsert = []; // items to actually add
  const itemsToSkip = [];   // items already exist

  for (const csvItem of csvItems) {
    const csvCategory = csvItem.category;
    const csvName = csvItem.item_name;
    const norm = normSection(csvCategory);

    // Try to find existing section (with aliases)
    let section = sectionByNorm[norm];
    if (!section && sectionAliases[norm]) section = sectionByNorm[sectionAliases[norm]];
    // Try fuzzy: if "cheesesteaks" -> match any section containing "cheesesteak"
    if (!section) {
      for (const [k, s] of Object.entries(sectionByNorm)) {
        if (k.includes(norm) || norm.includes(k)) { section = s; break; }
      }
    }

    if (!section) {
      // Need to create new section
      if (!newSections[norm]) newSections[norm] = csvCategory;
      itemsToInsert.push({ csvItem, section: { id: null, _newName: csvCategory } });
      continue;
    }

    // Check if item already exists in this section (by name)
    const existingKey = section.id + '|' + normItemName(csvName);
    if (itemBySectionAndName[existingKey]) {
      itemsToSkip.push({ csvName, section: section.section_name });
    } else {
      itemsToInsert.push({ csvItem, section });
    }
  }

  console.log(`\nNew sections to create: ${Object.keys(newSections).length}`);
  Object.values(newSections).forEach(n => console.log(`  + ${n}`));

  console.log(`\nItems to ADD: ${itemsToInsert.length}`);
  itemsToInsert.slice(0, 15).forEach(({ csvItem, section }) => {
    console.log(`  + [${section.section_name || section._newName}] ${csvItem.item_name}${csvItem.price ? ' ' + csvItem.price : ''}`);
  });
  if (itemsToInsert.length > 15) console.log(`  ... and ${itemsToInsert.length - 15} more`);

  console.log(`\nItems to SKIP (already exist): ${itemsToSkip.length}`);
  itemsToSkip.slice(0, 10).forEach(s => console.log(`  - ${s.csvName} (in ${s.section})`));
  if (itemsToSkip.length > 10) console.log(`  ... and ${itemsToSkip.length - 10} more`);

  if (!APPLY) {
    console.log('\nRun with --apply to commit.');
    return;
  }

  // ── APPLY ──────────────────────────────────────────────────
  // Step 1: Create new sections
  const newSectionIdByNorm = {};
  let nextSortOrder = existingSections.length;
  for (const [norm, sectionName] of Object.entries(newSections)) {
    const { data: sec, error } = await supabase
      .from('menu_sections')
      .insert({ entity_id: ENTITY_ID, section_name: sectionName, sort_order: nextSortOrder++ })
      .select('id, section_name')
      .single();
    if (error) { console.log(`❌ Section "${sectionName}" failed: ${error.message}`); continue; }
    newSectionIdByNorm[norm] = sec.id;
    console.log(`✅ Created section: ${sectionName}`);
  }

  // Step 2: Insert items
  const rowsToInsert = itemsToInsert.map((entry, idx) => {
    let sectionId = entry.section.id;
    if (!sectionId && entry.section._newName) {
      const norm = normSection(entry.section._newName);
      sectionId = newSectionIdByNorm[norm];
    }
    if (!sectionId) return null;

    const price = parsePrice(entry.csvItem.price);
    return {
      entity_id: ENTITY_ID,
      menu_section_id: sectionId,
      item_name: entry.csvItem.item_name,
      description: entry.csvItem.description || null,
      price: price,
      price_text: price ? `$${price.toFixed(2)}` : null,
      sort_order: idx,
      is_available: true,
      item_type: 'food'
    };
  }).filter(Boolean);

  let inserted = 0;
  for (let i = 0; i < rowsToInsert.length; i += 100) {
    const chunk = rowsToInsert.slice(i, i + 100);
    const { error } = await supabase.from('menu_items').insert(chunk);
    if (error) console.log(`❌ Insert batch failed: ${error.message}`);
    else inserted += chunk.length;
  }
  console.log(`\n✅ Inserted ${inserted} new items`);
  console.log(`✅ Skipped ${itemsToSkip.length} already-existing items`);
}

run().catch(e => { console.error(e); process.exit(1); });

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

const APPLY = process.argv.includes('--apply');
const INPUT_DIR = '/Users/owner/build-main/Launch gcr';

function parseBusinessData(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet);
  if (data.length === 0) return {};

  // Check if format is key-value (field/value columns) or direct fields
  const firstRow = data[0];
  const keys = Object.keys(firstRow);

  // Format 1: key-value pairs with "field"/"Field" and "value"/"Value" columns
  if ((keys.includes('field') || keys.includes('Field')) && (keys.includes('value') || keys.includes('Value'))) {
    const business = {};
    const keyCol = keys.find(k => k.toLowerCase() === 'field');
    const valCol = keys.find(k => k.toLowerCase() === 'value');
    data.forEach(row => {
      const key = (row[keyCol] || '').toLowerCase().trim();
      const val = (row[valCol] || '').trim();
      if (val && val !== 'Not provided' && val !== 'Not confirmed') {
        business[key] = val;
      }
    });
    return business;
  }

  // Format 2: Direct fields (name, slug, address_line_1, etc.)
  const business = {};
  for (const [key, val] of Object.entries(firstRow)) {
    const v = (val || '').toString().trim();
    if (v && v !== 'Not provided' && v !== 'Not confirmed') {
      business[key.toLowerCase()] = v;
    }
  }
  return business;
}

function parseMenu(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet);
  return data.filter(row => row.section && row.item).map(row => ({
    section: (row.section || '').trim(),
    item: (row.item || '').trim(),
    description: (row.description || '').trim(),
    price: parsePrice(row.price),
  }));
}

function parsePrice(s) {
  if (!s || s === 'Not provided') return null;
  const m = String(s).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function parseEvents(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet);
  return data
    .filter(row => row.event_name && row.event_name !== 'No event data provided')
    .map(row => ({
      event_name: (row.event_name || '').trim(),
      event_date: (row.event_date || '').trim(),
      event_time: (row.event_time || '').trim(),
      event_description: (row.event_description || '').trim(),
    }));
}

function normItemName(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normSection(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findOrCreateEntity(businessData) {
  const slug = businessData.slug;
  const name = businessData.name;

  if (!slug && !name) return null;

  // Try to find by slug first
  if (slug) {
    const { data: existing } = await supabase
      .from('entity')
      .select('id, name, slug')
      .eq('slug', slug)
      .single();

    if (existing) return existing;
  }

  // Try to find by name (case-insensitive)
  if (name) {
    const { data: existing } = await supabase
      .from('entity')
      .select('id, name, slug')
      .ilike('name', name)
      .single();

    if (existing) return existing;
  }

  // Create new entity if not found
  console.log(`  📍 Creating new entity: ${name || slug}`);
  const { data: created, error } = await supabase
    .from('entity')
    .insert({
      name: name || slug,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      entity_subtype: businessData.entity_subtype || 'restaurant',
      description: businessData.short_description || businessData.subtitle || null,
      address_line_1: businessData.address_line_1 || null,
      city: businessData.city || null,
      state: businessData.state || null,
      zip: businessData.zip || null,
      phone: businessData.phone || businessData.restaurant_phone || null,
    })
    .select('id, name, slug')
    .single();

  if (error) {
    console.log(`    ❌ Failed to create entity: ${error.message}`);
    return null;
  }
  return created;
}

async function processFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n🔄 Processing: ${fileName}`);

  let workbook;
  try {
    workbook = xlsx.readFile(filePath);
  } catch (e) {
    console.log(`  ❌ Failed to read file: ${e.message}`);
    return { menuCount: 0, eventCount: 0, skipped: 0 };
  }

  // Parse sheets
  const businessSheet = workbook.Sheets['Business Data'];
  const menuSheet = workbook.Sheets['Menu'] || workbook.Sheets['menu'];
  const eventSheet = workbook.Sheets['Events'] || workbook.Sheets['Events & Notes'];

  if (!businessSheet) {
    console.log('  ❌ Missing Business Data sheet');
    return { menuCount: 0, eventCount: 0, skipped: 0 };
  }

  const businessData = parseBusinessData(businessSheet);
  const menuData = menuSheet ? parseMenu(menuSheet) : [];
  const eventData = eventSheet ? parseEvents(eventSheet) : [];

  // Find or create entity
  const entity = await findOrCreateEntity(businessData);
  if (!entity) {
    console.log('  ❌ Could not find or create entity');
    return { menuCount: 0, eventCount: 0, skipped: 0 };
  }

  const entityId = entity.id;
  console.log(`  ✓ Entity: ${entity.name} (${entityId})`);

  // ── Load existing menu sections ──
  const { data: existingSections } = await supabase
    .from('menu_sections')
    .select('id, section_name')
    .eq('entity_id', entityId);

  const sectionByNorm = {};
  existingSections.forEach(s => {
    sectionByNorm[normSection(s.section_name)] = s;
  });

  // ── Load existing menu items ──
  const { data: existingItems } = await supabase
    .from('menu_items')
    .select('id, item_name, menu_section_id')
    .eq('entity_id', entityId);

  const itemBySectionAndName = {};
  existingItems.forEach(it => {
    const k = it.menu_section_id + '|' + normItemName(it.item_name);
    itemBySectionAndName[k] = it;
  });

  // ── Process menu items ──
  const newSections = {};
  const itemsToInsert = [];

  for (const csvItem of menuData) {
    const norm = normSection(csvItem.section);
    let section = sectionByNorm[norm];

    if (!section) {
      if (!newSections[norm]) newSections[norm] = csvItem.section;
    } else {
      // Check if item already exists
      const existingKey = section.id + '|' + normItemName(csvItem.item);
      if (itemBySectionAndName[existingKey]) {
        continue; // Skip existing
      }
    }

    itemsToInsert.push({
      csvItem,
      section: section || { _newName: csvItem.section },
    });
  }

  let menuInserted = 0;
  if (APPLY && itemsToInsert.length > 0) {
    // Create new sections
    const newSectionIdByNorm = {};
    let nextSortOrder = existingSections.length;

    for (const [norm, sectionName] of Object.entries(newSections)) {
      const { data: sec, error } = await supabase
        .from('menu_sections')
        .insert({
          entity_id: entityId,
          section_name: sectionName,
          sort_order: nextSortOrder++,
        })
        .select('id')
        .single();

      if (!error) newSectionIdByNorm[norm] = sec.id;
    }

    // Insert items
    const rowsToInsert = itemsToInsert.map((entry, idx) => {
      let sectionId = entry.section.id;
      if (!sectionId && entry.section._newName) {
        const norm = normSection(entry.section._newName);
        sectionId = newSectionIdByNorm[norm];
      }
      if (!sectionId) return null;

      const price = entry.csvItem.price;
      return {
        entity_id: entityId,
        menu_section_id: sectionId,
        item_name: entry.csvItem.item,
        description: entry.csvItem.description || null,
        price: price,
        price_text: price ? `$${price.toFixed(2)}` : null,
        sort_order: idx,
        is_available: true,
        item_type: 'food',
      };
    }).filter(Boolean);

    for (let i = 0; i < rowsToInsert.length; i += 100) {
      const chunk = rowsToInsert.slice(i, i + 100);
      const { error } = await supabase.from('menu_items').insert(chunk);
      if (!error) menuInserted += chunk.length;
    }
  }

  console.log(`  📋 Menu items: ${itemsToInsert.length} to add${APPLY ? ` (${menuInserted} inserted)` : ' (dry run)'}`);

  // ── Process events ──
  let eventInserted = 0;
  if (APPLY && eventData.length > 0) {
    const rowsToInsert = eventData.map(e => ({
      entity_id: entityId,
      event_name: e.event_name,
      event_date: e.event_date || null,
      start_time: e.event_time || null,
      description: e.event_description || null,
      is_active: true,
    }));

    for (let i = 0; i < rowsToInsert.length; i += 100) {
      const chunk = rowsToInsert.slice(i, i + 100);
      const { error } = await supabase.from('entity_events').insert(chunk);
      if (!error) eventInserted += chunk.length;
    }
  }

  console.log(`  🎉 Events: ${eventData.length} to add${APPLY ? ` (${eventInserted} inserted)` : ' (dry run)'}`);

  return { menuCount: menuInserted, eventCount: eventInserted, skipped: existingItems.length };
}

async function run() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (use --apply to commit) ===\n');

  const files = fs.readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('.xlsx'))
    .map(f => path.join(INPUT_DIR, f));

  let totalMenus = 0, totalEvents = 0;

  for (const file of files) {
    const result = await processFile(file);
    totalMenus += result.menuCount;
    totalEvents += result.eventCount;
  }

  console.log(`\n✅ Total menu items added: ${totalMenus}`);
  console.log(`✅ Total events added: ${totalEvents}`);

  if (!APPLY) {
    console.log('\nRun with --apply to commit.');
  }
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

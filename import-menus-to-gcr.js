#!/usr/bin/env node
/**
 * Import scraped menu data into GCR Supabase
 *
 * Safety rules:
 * - Never overwrites if existing GCR item count >= new item count
 * - Only replaces if new data has MORE items (better data wins)
 * - Skips folders with no menu categories
 * - Matches scraped folder → GCR entity by name/slug
 */

const fs   = require('fs');
const path = require('path');

const _env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const _key = _env.match(/GCR_SUPABASE_URL=(.+)/)?.[1]?.trim();
const _svc = _env.match(/GCR_SUPABASE_KEY=(.+)/)?.[1]?.trim();

const { createClient } = require('@supabase/supabase-js');
const gcr = createClient(_key, _svc);

const SCRAPED_DIR = path.join(__dirname, 'scraped-menus');

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function findEntity(entities, folder, bizName) {
  const folderSlug = folder.replace(/-(com|net|org|biz)$/, '');
  const bySlug = s => entities.find(e => e.slug === s);
  const byNorm = n => entities.find(e => normalize(e.name) === normalize(n));
  const byFuzz = n => {
    const slug = slugify(n);
    return entities.find(e => slugify(e.name) === slug) ||
      entities.find(e => {
        const words = normalize(n).split(' ').filter(w => w.length > 3);
        return words.length > 0 && words.every(w => normalize(e.name).includes(w));
      });
  };

  return bySlug(folderSlug) ||
    bySlug(folder) ||
    (bizName && byNorm(bizName)) ||
    (bizName && byFuzz(bizName));
}

async function importFolder(folder, entity) {
  const dataPath = path.join(SCRAPED_DIR, folder, 'data.json');
  let data;
  try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch { return { result: 'error', reason: 'bad json' }; }

  const cats = (data.menu || {}).categories || [];
  const newItems = cats.reduce((n, c) => n + (c.items || []).length, 0);

  if (!cats.length || newItems === 0) {
    return { result: 'skip', reason: 'no menu items in scraped data' };
  }

  // Check existing GCR item count
  const { count: existingCount } = await gcr
    .from('menu_items')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', entity.id);

  // Only overwrite if new data has MORE items
  if (existingCount >= newItems) {
    return { result: 'skip', reason: `existing ${existingCount} items >= new ${newItems} items` };
  }

  // Delete existing sections + items for this entity
  const { data: existingSections } = await gcr
    .from('menu_sections')
    .select('id')
    .eq('entity_id', entity.id);

  for (const sec of existingSections || []) {
    await gcr.from('menu_items').delete().eq('menu_section_id', sec.id);
  }
  await gcr.from('menu_sections').delete().eq('entity_id', entity.id);

  // Insert new sections + items
  let totalInserted = 0;
  let sortOrder = 0;

  for (const cat of cats) {
    const items = (cat.items || []).filter(i => i.name);
    if (!cat.name && !items.length) continue;

    const { data: section, error: secErr } = await gcr
      .from('menu_sections')
      .insert({
        entity_id:        entity.id,
        section_name:     cat.name || 'Menu',
        sort_order:       sortOrder++,
        show_on_links_page: true,
      })
      .select()
      .single();

    if (secErr) continue;

    const rows = items.slice(0, 60).map((item, idx) => ({
      entity_id:       entity.id,
      menu_section_id: section.id,
      item_name:       item.name,
      description:     item.description || null,
      price_text:      item.price ? String(item.price) : null,
      price:           parseFloat(item.price) || null,
      is_available:    true,
      sort_order:      idx,
      item_type:       'food',
      tags:            item.dietary?.length ? item.dietary : [],
    }));

    if (rows.length) {
      const { error: itemErr } = await gcr.from('menu_items').insert(rows);
      if (!itemErr) totalInserted += rows.length;
    }
  }

  return { result: 'imported', sections: cats.length, items: totalInserted, replaced: existingCount };
}

async function run() {
  // Load all active GCR entities
  const { data: entities } = await gcr
    .from('entity')
    .select('id, name, slug')
    .eq('is_active', true)
    .limit(1000);

  // Find all folders with data.json
  const folders = fs.readdirSync(SCRAPED_DIR).filter(f => {
    if (f.startsWith('_')) return false;
    const dir = path.join(SCRAPED_DIR, f);
    return fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, 'data.json'));
  });

  console.log(`\nImporting menus from ${folders.length} folders → GCR\n${'═'.repeat(60)}`);
  console.log('Rule: only overwrites if new data has MORE items than existing\n');

  let imported = 0, skipped = 0, noMatch = 0, errors = 0;

  for (const folder of folders) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(SCRAPED_DIR, folder, 'data.json'), 'utf8'));
    } catch { errors++; continue; }

    const entity = await findEntity(entities, folder, data.business_name);

    if (!entity) {
      console.log(`NO MATCH: ${folder} | ${data.business_name || ''}`);
      noMatch++;
      continue;
    }

    const { result, reason, sections, items, replaced } = await importFolder(folder, entity);

    if (result === 'imported') {
      console.log(`✓ ${entity.name} | ${sections} sections, ${items} items${replaced ? ` (replaced ${replaced})` : ''}`);
      imported++;
    } else if (result === 'skip') {
      console.log(`~ ${entity.name} | ${reason}`);
      skipped++;
    } else {
      console.log(`✗ ${entity.name} | ${reason}`);
      errors++;
    }
  }

  // Final GCR counts
  const { count: totalItems } = await gcr.from('menu_items').select('*', { count: 'exact', head: true });
  const { count: entitiesWithMenus } = await gcr.from('menu_sections').select('entity_id', { count: 'exact', head: true });

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Imported:  ${imported}`);
  console.log(`~  Skipped:   ${skipped} (existing data was better or equal)`);
  console.log(`?  No match:  ${noMatch} (not found in GCR)`);
  console.log(`✗  Errors:    ${errors}`);
  console.log(`\nGCR now has ${totalItems} total menu items`);
}

run().catch(console.error);

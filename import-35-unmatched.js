#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);
const SHOTS_DIR = '/Users/owner/cybercheck-api-database/screenshots';

function makeSlug(name) {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim('-').substring(0, 50);
}

async function main() {
  console.log('📥 IMPORTING UNMATCHED RESTAURANTS\n');

  const matched = JSON.parse(fs.readFileSync('/Users/owner/cybercheck-api-database/menus-matched.json', 'utf8'));
  const matchedNames = new Set(matched.map(m => m.entity_name));

  const allFolders = fs.readdirSync(SHOTS_DIR).filter(f => fs.existsSync(path.join(SHOTS_DIR, f, 'menu-detailed.json')));

  const unmatched = [];
  for (const folder of allFolders) {
    const extractedPath = path.join(SHOTS_DIR, folder, 'extracted-data.json');
    if (!fs.existsSync(extractedPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
      if (!data.extracted?.restaurant_name) continue;
      const name = data.extracted.restaurant_name;
      if (!matchedNames.has(name)) {
        unmatched.push({ name, website: data.url || '', phone: data.extracted.contact?.phone || '', address: data.extracted.contact?.address || '', });
      }
    } catch (e) {}
  }

  const withGoogle = JSON.parse(fs.readFileSync('/Users/owner/cybercheck-api-database/unmatched-with-google-ids.json', 'utf8'));
  const googleMap = {};
  withGoogle.forEach(g => { googleMap[g.name.toLowerCase()] = g.google_id; });

  const { data: existing } = await gcrDb.from('entity').select('place_id').eq('is_active', true);
  const existingIds = new Set(existing?.map(e => e.place_id).filter(Boolean) || []);

  let toInsert = [];
  const seenIds = new Set();

  for (const r of unmatched) {
    const gid = googleMap[r.name.toLowerCase()];
    
    if (gid) {
      // Skip if already in DB or seen in this batch
      if (existingIds.has(gid) || seenIds.has(gid)) continue;
      seenIds.add(gid);
    }
    
    toInsert.push({
      name: r.name, slug: makeSlug(r.name) + '-' + Math.random().toString(36).substring(7),
      place_id: gid || null, website_url: r.website, phone: r.phone, address_line_1: r.address,
      entity_type: 'restaurant', entity_subtype: 'restaurant', city: 'Orange Beach', is_active: true,
    });
  }

  console.log(`Total unmatched: ${unmatched.length}`);
  console.log(`Ready to import (deduplicated): ${toInsert.length}\n`);

  if (toInsert.length === 0) { console.log('Nothing to import!'); return; }

  const { data, error } = await gcrDb.from('entity').insert(toInsert).select('id, name');

  if (error) { console.error('❌ Error:', error.message); process.exit(1); }

  console.log(`✓ Successfully imported ${data.length} restaurants!\n`);
  data.forEach((r, i) => { console.log(`  ${i + 1}. ${r.name}`); });

  console.log(`\n✓ Done! Next: node match-menus-to-entities.js`);
}

main().catch(console.error);

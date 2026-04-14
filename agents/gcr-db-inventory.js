#!/usr/bin/env node
// gcr-db-inventory.js — Full GCR database inventory
// Shows every table, row count, and sample columns
// Usage: node agents/gcr-db-inventory.js

require('dotenv').config();
const getGcrDb = require('../gcr-db');
const db = getGcrDb();

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

async function countAndSample(table, sampleFields = '*') {
  const [countRes, sampleRes] = await Promise.all([
    db.from(table).select('count', { count: 'exact', head: true }),
    db.from(table).select(sampleFields).limit(1),
  ]);
  const count = countRes.count ?? '?';
  const cols = sampleRes.data?.[0] ? Object.keys(sampleRes.data[0]) : [];
  return { count, cols, error: countRes.error?.message || sampleRes.error?.message };
}

function row(table, count, cols, error) {
  const color = error ? R : count === 0 ? Y : G;
  const countStr = String(count).padStart(6);
  const colStr = cols.length ? cols.join(', ') : (error || 'error');
  console.log(`  ${color}${countStr}${X}  ${B}${table.padEnd(35)}${X}${D}${colStr}${X}`);
}

async function run() {
  console.log(`\n${B}${C}GCR DATABASE INVENTORY${X}`);
  console.log(`${D}Supabase GCR DB — all tables, counts, columns${X}\n`);

  const tables = [
    // Core businesses
    { name: 'entity' },
    { name: 'entity_features' },
    { name: 'entity_perfect_for' },
    { name: 'entity_tags' },
    { name: 'entity_hours' },
    { name: 'entity_photos' },
    { name: 'entity_about_bullets' },

    // Menu system
    { name: 'menu_sections' },
    { name: 'menu_sub_sections' },
    { name: 'menu_items' },

    // Drinks system
    { name: 'drink_sections' },
    { name: 'drink_items' },

    // Happy hour system
    { name: 'happy_hour_sections' },
    { name: 'happy_hour_items' },

    // Events & specials
    { name: 'entity_events' },
    { name: 'entity_specials' },

    // New system
    { name: 'entity_sections' },
    { name: 'section_groups' },
    { name: 'section_items' },
    { name: 'section_rich_text' },
    { name: 'section_bullets' },
    { name: 'section_cards' },
    { name: 'section_photos' },
    { name: 'section_reviews' },
    { name: 'section_hours' },
    { name: 'section_location' },

    // Site config
    { name: 'gcr_site_config' },
    { name: 'gcr_category_page_config' },
    { name: 'gcr_category_cards' },
    { name: 'gcr_page_assignments' },
    { name: 'gcr_entity_pages' },

    // Bookings / activity / products
    { name: 'activities' },
    { name: 'pricing_items' },
    { name: 'booking_slots' },
    { name: 'fleet_items' },
    { name: 'addons' },
    { name: 'whats_included' },
    { name: 'requirements' },
    { name: 'policies' },
    { name: 'meeting_points' },
    { name: 'entity_qna' },
    { name: 'product_sections' },

    // Users / platform
    { name: 'gcr_users' },
    { name: 'gcr_user_entities' },
    { name: 'gcr_invites' },

    // Analytics / tracking
    { name: 'gcr_scan_events' },
    { name: 'gcr_qr_placements' },
    { name: 'business_embeddings' },
  ];

  console.log(`${D}  COUNT  TABLE                              COLUMNS${X}`);
  console.log(`${D}  ─────  ─────────────────────────────────  ───────${X}`);

  let totalRows = 0;
  let missingTables = [];

  for (const t of tables) {
    const { count, cols, error } = await countAndSample(t.name);
    if (error && error.includes('does not exist')) {
      missingTables.push(t.name);
      console.log(`  ${D}     —  ${t.name.padEnd(35)}[table missing]${X}`);
    } else {
      row(t.name, count, cols, error);
      if (typeof count === 'number') totalRows += count;
    }
  }

  console.log(`\n${B}Total rows across all tables: ${G}${totalRows.toLocaleString()}${X}`);

  if (missingTables.length > 0) {
    console.log(`\n${Y}Tables not yet created (${missingTables.length}):${X}`);
    missingTables.forEach(t => console.log(`  ${Y}—${X} ${t}`));
  }

  // Breakdown of key data
  console.log(`\n${B}${C}── Key Data Quality ──────────────────────────────────${X}`);

  const [activeEnt, inactiveEnt, entWithHero, entNoHero, menuWithPrice, menuNoPrice] = await Promise.all([
    db.from('entity').select('count', { count: 'exact', head: true }).eq('is_active', true),
    db.from('entity').select('count', { count: 'exact', head: true }).eq('is_active', false),
    db.from('entity').select('count', { count: 'exact', head: true }).eq('is_active', true).not('hero_image_url', 'is', null),
    db.from('entity').select('count', { count: 'exact', head: true }).eq('is_active', true).is('hero_image_url', null),
    db.from('menu_items').select('count', { count: 'exact', head: true }).not('price', 'is', null),
    db.from('menu_items').select('count', { count: 'exact', head: true }).is('price', null),
  ]);

  console.log(`  Businesses active:        ${G}${activeEnt.count}${X}`);
  console.log(`  Businesses inactive:      ${Y}${inactiveEnt.count}${X}`);
  console.log(`  Active with hero image:   ${G}${entWithHero.count}${X}`);
  console.log(`  Active WITHOUT hero:      ${R}${entNoHero.count}${X}  ← needs images`);
  console.log(`  Menu items with price:    ${G}${menuWithPrice.count}${X}`);
  console.log(`  Menu items NO price:      ${Y}${menuNoPrice.count}${X}  ← scraped junk`);

  // Top 10 businesses by menu item count
  console.log(`\n${B}${C}── Top 10 Businesses by Menu Items ───────────────────${X}`);
  const { data: topMenuData } = await db.from('menu_items')
    .select('entity_id')
    .limit(10000);

  if (topMenuData) {
    const counts = {};
    topMenuData.forEach(r => { counts[r.entity_id] = (counts[r.entity_id] || 0) + 1; });
    const top10ids = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10).map(([id]) => id);
    const { data: top10ents } = await db.from('entity').select('id, name').in('id', top10ids);
    const nameMap = {};
    (top10ents || []).forEach(e => nameMap[e.id] = e.name);
    Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([id, c]) => {
      console.log(`  ${G}${String(c).padStart(5)}${X} items  ${nameMap[id] || id}`);
    });
  }

  console.log();
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });

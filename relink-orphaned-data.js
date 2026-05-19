#!/usr/bin/env node
/**
 * RELINK ORPHANED DATA
 * Matches events, specials, happy hours, sections to correct entity IDs using place_id
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function relinkEvents() {
  console.log('📅 RELINKING EVENTS...\n');

  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, place_id');

  // Get all entities with place_id
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e.id;
  });

  let relinked = 0;
  let skipped = 0;

  for (const event of events || []) {
    if (!event.place_id) {
      skipped++;
      continue;
    }

    const correctEntityId = placeIdMap[event.place_id];
    if (!correctEntityId) {
      skipped++;
      continue;
    }

    if (event.entity_id === correctEntityId) {
      continue; // Already correct
    }

    const { error } = await supabase
      .from('entity_events')
      .update({ entity_id: correctEntityId })
      .eq('id', event.id);

    if (!error) {
      relinked++;
      if (relinked % 100 === 0) console.log(`✓ Relinked ${relinked} events...`);
    }
  }

  console.log(`✓ Events relinked: ${relinked}\n`);
  return relinked;
}

async function relinkSpecials() {
  console.log('🎉 RELINKING SPECIALS...\n');

  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, place_id');

  // Get all entities with place_id
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e.id;
  });

  let relinked = 0;

  for (const special of specials || []) {
    if (!special.place_id) continue;

    const correctEntityId = placeIdMap[special.place_id];
    if (!correctEntityId || special.entity_id === correctEntityId) continue;

    const { error } = await supabase
      .from('entity_specials')
      .update({ entity_id: correctEntityId })
      .eq('id', special.id);

    if (!error) relinked++;
  }

  console.log(`✓ Specials relinked: ${relinked}\n`);
  return relinked;
}

async function relinkHappyHours() {
  console.log('🍻 RELINKING HAPPY HOURS...\n');

  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, place_id');

  // Get all entities with place_id
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e.id;
  });

  let relinked = 0;

  for (const h of hh || []) {
    if (!h.place_id) continue;

    const correctEntityId = placeIdMap[h.place_id];
    if (!correctEntityId || h.entity_id === correctEntityId) continue;

    const { error } = await supabase
      .from('entity_happy_hours')
      .update({ entity_id: correctEntityId })
      .eq('id', h.id);

    if (!error) relinked++;
  }

  console.log(`✓ Happy hours relinked: ${relinked}\n`);
  return relinked;
}

async function relinkSections() {
  console.log('📋 RELINKING SECTIONS...\n');

  const { data: sections } = await supabase
    .from('entity_sections')
    .select('id, entity_id, place_id');

  // Get all entities with place_id
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e.id;
  });

  let relinked = 0;

  for (const section of sections || []) {
    if (!section.place_id) continue;

    const correctEntityId = placeIdMap[section.place_id];
    if (!correctEntityId || section.entity_id === correctEntityId) continue;

    const { error } = await supabase
      .from('entity_sections')
      .update({ entity_id: correctEntityId })
      .eq('id', section.id);

    if (!error) relinked++;
  }

  console.log(`✓ Sections relinked: ${relinked}\n`);
  return relinked;
}

async function main() {
  console.log('🔗 RELINKING ORPHANED DATA TO NEW ENTITY IDS\n');
  console.log('═'.repeat(60));

  const eventCount = await relinkEvents();
  const specialCount = await relinkSpecials();
  const hhCount = await relinkHappyHours();
  const sectionCount = await relinkSections();

  console.log('═'.repeat(60));
  console.log(`\n✅ COMPLETE`);
  console.log(`\nTotal relinked:`);
  console.log(`  Events: ${eventCount}`);
  console.log(`  Specials: ${specialCount}`);
  console.log(`  Happy Hours: ${hhCount}`);
  console.log(`  Sections: ${sectionCount}`);
  console.log(`\nNow run: node check-events-binding.js`);
}

main().catch(console.error);

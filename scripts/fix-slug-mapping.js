#!/usr/bin/env node
/**
 * FIX SLUG MAPPING
 * Maps old business IDs to new entity slugs
 * Updates all references (specials, events, etc)
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

function normalizeName(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
}

async function main() {
  console.log('\n🔄 FIXING SLUG MAPPING\n');

  // Get old businesses
  const { data: oldBiz } = await old.from('businesses').select('site_id, name, subdomain');
  console.log(`Old businesses: ${oldBiz?.length || 0}`);

  // Get new entities
  const { data: newEnts } = await gcr.from('entity').select('id, slug, name');
  console.log(`New entities: ${newEnts?.length || 0}\n`);

  if (!oldBiz || !newEnts) {
    console.error('❌ Could not load data');
    return;
  }

  // Build mapping: old site_id → new slug
  const mapping = {};
  const newEntByNorm = {};
  newEnts.forEach(e => {
    newEntByNorm[normalizeName(e.name)] = e.slug;
  });

  console.log('📍 Matching businesses by name...\n');
  let matched = 0;
  for (const b of oldBiz) {
    const norm = normalizeName(b.name);
    const slug = newEntByNorm[norm] || b.subdomain;
    mapping[b.site_id] = slug;
    if (newEntByNorm[norm]) {
      matched++;
      console.log(`  ✅ ${b.name} → ${slug}`);
    }
  }

  console.log(`\nMatched: ${matched}/${oldBiz.length}`);

  // Update entity_specials with correct slugs
  console.log('\n📋 Updating entity_specials...');
  const { data: specials } = await gcr.from('entity_specials').select('*');
  let specUpdated = 0;
  for (const s of (specials || [])) {
    // Try to find the entity by ID or name
    const { data: ent } = await gcr.from('entity').select('slug').eq('id', s.entity_id).single();
    if (ent?.slug && ent.slug !== s.entity_slug) {
      await gcr.from('entity_specials').update({ entity_slug: ent.slug }).eq('id', s.id);
      specUpdated++;
    }
  }
  console.log(`  ✅ Updated ${specUpdated} specials`);

  // Update entity_events with correct slugs
  console.log('\n📅 Updating entity_events...');
  const { data: events } = await gcr.from('entity_events').select('*');
  let evUpdated = 0;
  for (const e of (events || [])) {
    const { data: ent } = await gcr.from('entity').select('slug').eq('id', e.entity_id).single();
    if (ent?.slug && ent.slug !== e.entity_slug) {
      await gcr.from('entity_events').update({ entity_slug: ent.slug }).eq('id', e.id);
      evUpdated++;
    }
  }
  console.log(`  ✅ Updated ${evUpdated} events`);

  console.log(`\n${'='*60}`);
  console.log('✅ SLUG MAPPING COMPLETE');
  console.log(`${'='*60}\n`);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * COMPLETE MIGRATION: Pull ALL data from live API → push to NEW Supabase database
 * Merges everything: entities, events, happy hours, specials, menus, photos, etc.
 *
 * Usage:
 *   node migrate-old-to-new-db.js --dry-run
 *   node migrate-old-to-new-db.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const LIVE_API = 'https://cybercheck-api-database.vercel.app/api/gcr';

const newDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function fetchFromLiveApi(endpoint, limit = 10000) {
  try {
    const url = `${LIVE_API}/${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=${limit}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();

    if (Array.isArray(data)) return data;
    if (data.entities) return data.entities;
    if (data.events) return data.events;
    if (data.restaurants) return data.restaurants;
    if (data.activities) return data.activities;
    if (data.happy_hours) return data.happy_hours;
    if (data.specials) return data.specials;
    if (data.results) return data.results;

    return [];
  } catch (e) {
    console.error(`    Error fetching ${endpoint}: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETE MIGRATION: OLD DB → NEW DB${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  let stats = {
    entities: 0,
    events: 0,
    happy_hours: 0,
    specials: 0,
    sections: 0,
    section_bullets: 0,
    errors: 0
  };

  // 1. ENTITIES
  console.log('📊 ENTITIES');
  const entities = await fetchFromLiveApi('entities');
  console.log(`   Found: ${entities.length} entities`);

  if (!DRY_RUN && entities.length > 0) {
    const { data: existing } = await newDb.from('entity').select('id').limit(10000);
    const existingIds = new Set((existing || []).map(e => e.id));

    for (const entity of entities) {
      try {
        const updateData = {
          id: entity.id,
          place_id: entity.place_id,
          name: entity.name,
          slug: entity.slug,
          entity_type: entity.entity_type,
          entity_subtype: entity.entity_subtype,
          description: entity.description,
          phone: entity.phone,
          website_url: entity.website_url,
          address_line_1: entity.address_line_1,
          city: entity.city,
          state: entity.state,
          zip: entity.zip,
          rating: entity.rating,
          review_count: entity.review_count,
          price_range: entity.price_range,
          price_from: entity.price_from,
          price_to: entity.price_to,
          hero_image_url: entity.hero_image_url || entity.cover_url,
          social_instagram: entity.social_instagram,
          social_facebook: entity.social_facebook,
          social_tiktok: entity.social_tiktok,
          email: entity.email,
          is_active: entity.is_active !== false,
          hh_days: entity.hh_days,
          hh_start: entity.hh_start,
          hh_end: entity.hh_end,
          hh_description: entity.hh_description,
          featured: entity.featured || false,
          secondary_types: entity.secondary_types,
          icon: entity.icon
        };

        if (existingIds.has(entity.id)) {
          await newDb.from('entity').update(updateData).eq('id', entity.id);
        } else {
          await newDb.from('entity').insert(updateData);
        }
        stats.entities++;
      } catch (e) {
        console.error(`   ✗ ${entity.name}: ${e.message}`);
        stats.errors++;
      }
    }
  }
  console.log(`   ✓ Processed: ${stats.entities}\n`);

  // 2. EVENTS
  console.log('📅 EVENTS');
  const events = await fetchFromLiveApi('events');
  console.log(`   Found: ${events.length} events`);

  if (!DRY_RUN && events.length > 0) {
    const { data: existingEvents } = await newDb.from('entity_events').select('id').limit(10000);
    const existingEventIds = new Set((existingEvents || []).map(e => e.id));

    for (const event of events) {
      try {
        if (!event.entity_id && (event.entity_name || event.businessName)) {
          const { data: matched } = await newDb
            .from('entity')
            .select('id')
            .ilike('name', `%${event.entity_name || event.businessName}%`)
            .limit(1);
          if (matched?.[0]) event.entity_id = matched[0].id;
        }

        if (!event.entity_id) continue;

        const eventData = {
          id: event.id,
          entity_id: event.entity_id,
          event_name: event.event_name,
          artist_name: event.artist_name,
          event_date: event.event_date,
          start_time: event.start_time,
          end_time: event.end_time,
          description: event.description,
          event_type: event.event_type,
          venue_location: event.venue_location,
          cover_charge: event.cover_charge,
          is_active: event.is_active !== false
        };

        if (existingEventIds.has(event.id)) {
          await newDb.from('entity_events').update(eventData).eq('id', event.id);
        } else {
          await newDb.from('entity_events').insert(eventData);
        }
        stats.events++;
      } catch (e) {
        console.error(`   ✗ Error: ${e.message}`);
        stats.errors++;
      }
    }
  }
  console.log(`   ✓ Processed: ${stats.events}\n`);

  // 3. HAPPY HOURS
  console.log('🍺 HAPPY HOURS');
  const happyHours = await fetchFromLiveApi('happy-hours');
  console.log(`   Found: ${happyHours.length} happy hour records`);

  if (!DRY_RUN && happyHours.length > 0) {
    const { data: existingHH } = await newDb.from('entity_happy_hours').select('id').limit(10000);
    const existingHHIds = new Set((existingHH || []).map(h => h.id));

    for (const hh of happyHours) {
      try {
        const hhData = {
          id: hh.id,
          entity_id: hh.entity_id || hh.id,
          hh_days: hh.hh_days,
          hh_start: hh.hh_start,
          hh_end: hh.hh_end,
          hh_description: hh.hh_description,
          is_active: hh.is_active !== false
        };

        if (existingHHIds.has(hh.id)) {
          await newDb.from('entity_happy_hours').update(hhData).eq('id', hh.id);
        } else {
          await newDb.from('entity_happy_hours').insert(hhData);
        }
        stats.happy_hours++;
      } catch (e) {
        console.error(`   ✗ Error: ${e.message}`);
        stats.errors++;
      }
    }
  }
  console.log(`   ✓ Processed: ${stats.happy_hours}\n`);

  // 4. SPECIALS
  console.log('🎉 SPECIALS');
  const specials = await fetchFromLiveApi('specials');
  console.log(`   Found: ${specials.length} specials`);

  if (!DRY_RUN && specials.length > 0) {
    const { data: existingSpec } = await newDb.from('entity_specials').select('id').limit(10000);
    const existingSpecIds = new Set((existingSpec || []).map(s => s.id));

    for (const special of specials) {
      try {
        if (!special.entity_id && special.entity_name) {
          const { data: matched } = await newDb
            .from('entity')
            .select('id')
            .ilike('name', `%${special.entity_name}%`)
            .limit(1);
          if (matched?.[0]) special.entity_id = matched[0].id;
        }

        if (!special.entity_id) continue;

        const specData = {
          id: special.id,
          entity_id: special.entity_id,
          special_name: special.special_name || special.name,
          description: special.description,
          special_type: special.special_type,
          days: special.days,
          start_time: special.start_time,
          end_time: special.end_time,
          is_active: special.is_active !== false
        };

        if (existingSpecIds.has(special.id)) {
          await newDb.from('entity_specials').update(specData).eq('id', special.id);
        } else {
          await newDb.from('entity_specials').insert(specData);
        }
        stats.specials++;
      } catch (e) {
        console.error(`   ✗ Error: ${e.message}`);
        stats.errors++;
      }
    }
  }
  console.log(`   ✓ Processed: ${stats.specials}\n`);

  // Summary
  console.log(`${'='.repeat(80)}`);
  console.log(`MIGRATION SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  ✓ Entities: ${stats.entities}`);
  console.log(`  ✓ Events: ${stats.events}`);
  console.log(`  ✓ Happy hours: ${stats.happy_hours}`);
  console.log(`  ✓ Specials: ${stats.specials}`);
  console.log(`  ✗ Errors: ${stats.errors}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to actually migrate)\n');
  } else {
    console.log('✓ Migration complete!\n');
    console.log('Next steps:');
    console.log('1. Verify data in new database');
    console.log('2. Update Vercel environment variables');
    console.log('3. Test live site\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});

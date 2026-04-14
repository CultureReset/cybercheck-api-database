#!/usr/bin/env node
/**
 * SUPABASE SCHEMA INSPECTOR
 * Shows all tables, columns, and relationships
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function getSchema(client, dbName) {
  console.log(`\n${'='*60}`);
  console.log(`📊 ${dbName} DATABASE SCHEMA`);
  console.log(`${'='*60}\n`);

  // Known tables to check
  const tablesToCheck = [
    'businesses', 'business_hours', 'business_details', 'business_atmosphere',
    'business_filters', 'business_logistics', 'business_highlights', 'business_attributes',
    'amenities', 'accommodation_details', 'activity_details', 'artists', 'artist_shows',
    'area_guides', 'area_knowledge', 'beaches', 'ai_voice_scripts', 'business_media',
    'section_content', 'specials', 'events', 'reviews', 'menu_items', 'drink_items',
    'entity', 'entity_hours', 'entity_sections', 'entity_specials', 'entity_events',
    'happy_hour_sections', 'happy_hour_items',
  ];

  console.log(`📋 CHECKING TABLES:\n`);

  for (const tableName of tablesToCheck) {
    const { count, error } = await client
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .catch(() => ({ count: null, error: 'not found' }));

    if (error) {
      console.log(`  ❌ ${tableName} - DOES NOT EXIST`);
    } else {
      console.log(`  ✅ ${tableName} - ${count} rows`);
    }
  }
}

async function main() {
  try {
    await getSchema(old, 'OLD DB (mhafixflyffflwjhcgfn)');
    await getSchema(gcr, 'NEW GCR DB (adpnhipmdefutkzzltbs)');

    console.log(`\n${'='*60}`);
    console.log('✅ SCHEMA DUMP COMPLETE');
    console.log(`${'='*60}\n`);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

main();

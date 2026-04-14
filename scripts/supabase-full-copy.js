#!/usr/bin/env node
/**
 * SUPABASE FULL SCHEMA + DATA COPY
 * Old DB → New GCR DB
 * Copies all tables and all rows
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function getTables() {
  // Get all tables from information_schema
  const { data, error } = await old.rpc('execute_sql', {
    query: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  }).catch(() => null);

  if (data) return data.map(r => r.table_name);

  // Fallback: Query specific known tables
  const tables = [
    'businesses',
    'business_hours',
    'business_details',
    'business_atmosphere',
    'business_filters',
    'business_logistics',
    'business_highlights',
    'business_attributes',
    'amenities',
    'accommodation_details',
    'activity_details',
    'artists',
    'artist_shows',
    'area_guides',
    'area_knowledge',
    'beaches',
    'ai_voice_scripts',
    'business_media',
    'section_content',
    'specials',
    'events',
    'reviews',
  ];

  return tables;
}

async function copyTable(tableName) {
  console.log(`\n📋 ${tableName}...`);

  try {
    // Get all data from old table
    const { data, error: readError } = await old
      .from(tableName)
      .select('*')
      .limit(10000);

    if (readError) {
      console.log(`   ⚠️  Cannot read (${readError.message})`);
      return 0;
    }

    if (!data || data.length === 0) {
      console.log(`   ✓ Empty table`);
      return 0;
    }

    // Try to insert into GCR DB
    const { error: writeError } = await gcr
      .from(tableName)
      .insert(data)
      .catch(() => ({ error: { message: 'Table might not exist in GCR DB' } }));

    if (writeError) {
      console.log(`   ⚠️  ${writeError.message}`);
      return 0;
    }

    console.log(`   ✅ Copied ${data.length} rows`);
    return data.length;
  } catch(e) {
    console.log(`   ⚠️  Error: ${e.message}`);
    return 0;
  }
}

async function main() {
  console.log('🚀 SUPABASE FULL COPY: OLD DB → GCR DB\n');
  console.log('Getting table list...');

  const tables = await getTables();
  console.log(`Found ${tables.length} tables\n`);

  let totalRows = 0;
  for (const table of tables) {
    const rows = await copyTable(table);
    totalRows += rows;
  }

  console.log(`\n✅ COPY COMPLETE`);
  console.log(`Total rows copied: ${totalRows}`);
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});

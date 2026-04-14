#!/usr/bin/env node
/**
 * INSPECT OLD DATABASE
 * Shows ALL tables, ALL columns, ALL data
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ALL tables to inspect
const ALL_TABLES = [
  'accommodation_details', 'activity_details', 'activity_log', 'agent_recommendations',
  'ai_chunks', 'ai_responses', 'ai_voice_scripts', 'amenities', 'apps', 'area_guides',
  'area_knowledge', 'artist_shows', 'artists', 'attribution_data', 'audit_log',
  'availability', 'availability_blocks', 'beaches', 'booking_funnel', 'booking_holds',
  'bookings', 'business_atmosphere', 'business_attributes', 'business_data_status',
  'business_details', 'business_filters', 'business_highlights', 'business_logistics',
  'business_media', 'businesses', 'comparisons', 'connections', 'conversions', 'coupons',
  'customers', 'domains', 'emergency_info', 'events', 'faq_items', 'faqs', 'fleet_items',
  'fleet_types', 'gcr_claims', 'gcr_feed_posts', 'gcr_menu_items', 'grocery_and_supplies',
  'hidden_gems', 'hours_exceptions', 'itineraries', 'itinerary_days', 'itinerary_items',
  'itinerary_stops', 'leads', 'live_conditions', 'local_tips', 'locations', 'loyalty_signups',
  'media', 'media_library', 'menu_categories', 'menu_details', 'menu_items', 'menu_subcategories',
  'messages', 'messaging_settings', 'money_saving_tips', 'neighborhoods', 'notifications',
  'orders', 'packages', 'page_views', 'photos', 'platform_config', 'platform_settings',
  'price_guide', 'qa_pairs', 'rental_addons', 'rental_group_rates', 'rental_pricing',
  'rental_time_slots', 'review_answers', 'review_questions', 'reviews', 'robots_config',
  'room_types', 'search_intents', 'seasonal_info', 'seo_keywords', 'seo_meta_tags', 'services',
  'session_events', 'site_apps', 'site_content', 'site_data_store', 'site_pages', 'sitemap_config',
  'sms_campaigns', 'sms_log', 'sms_opt_outs', 'social_media_accounts', 'social_media_analytics',
  'social_media_posts', 'song_requests', 'specials', 'staff', 'support_tickets', 'templates',
  'tourist_agent_state', 'tourist_conversations', 'tourist_memory', 'tourist_preferences',
  'tourist_saved_places', 'tourist_sessions', 'tourist_visits', 'tourists', 'traffic_sources',
  'transportation', 'trip_itineraries', 'users', 'waitlist', 'waitlist_settings', 'waivers',
];

async function inspectTable(tableName) {
  try {
    const { data, error } = await old.from(tableName).select('*');

    if (error) {
      return { table: tableName, rows: 0, columns: 0, error: error.code };
    }

    if (!data || data.length === 0) {
      return { table: tableName, rows: 0, columns: 0, data: [] };
    }

    const columns = Object.keys(data[0]);
    return {
      table: tableName,
      rows: data.length,
      columns: columns.length,
      columnNames: columns,
      data: data
    };
  } catch(e) {
    return { table: tableName, rows: 0, columns: 0, error: e.message };
  }
}

async function main() {
  console.log('\n📊 INSPECTING OLD DATABASE\n');
  console.log(`Total tables to inspect: ${ALL_TABLES.length}\n`);

  const allData = {};
  let totalRows = 0;

  for (const tableName of ALL_TABLES) {
    const result = await inspectTable(tableName);
    allData[tableName] = result;
    totalRows += result.rows;

    if (result.rows > 0) {
      console.log(`✅ ${tableName.padEnd(35)} - ${result.rows.toString().padStart(6)} rows, ${result.columns} columns`);
    } else {
      console.log(`✓  ${tableName.padEnd(35)} - EMPTY`);
    }
  }

  // Write to file
  const outputFile = '/tmp/old-db-full-inspection.json';
  fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2));

  console.log(`\n${'='*70}`);
  console.log(`✅ INSPECTION COMPLETE`);
  console.log(`${'='*70}`);
  console.log(`Total tables: ${ALL_TABLES.length}`);
  console.log(`Total rows: ${totalRows.toLocaleString()}`);
  console.log(`Output file: ${outputFile}`);
  console.log(`Size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB\n`);
  console.log('All data saved. Open the file to see everything.\n');
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});

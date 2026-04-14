#!/usr/bin/env node
/**
 * EXPORT ALL OLD DB DATA
 * Exports every table, every column, every row to JSON
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// All tables from OLD DB
const TABLES = [
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

async function exportTable(tableName) {
  try {
    const { data, error } = await old
      .from(tableName)
      .select('*');

    if (error) {
      console.log(`  ⚠️  ${tableName.padEnd(30)} - Error: ${error.code}`);
      return { table: tableName, rows: 0, error: error.message };
    }

    console.log(`  ✅ ${tableName.padEnd(30)} - ${(data || []).length} rows`);
    return { table: tableName, rows: (data || []).length, data: data || [] };
  } catch(e) {
    console.log(`  ❌ ${tableName.padEnd(30)} - ${e.message}`);
    return { table: tableName, rows: 0, error: e.message };
  }
}

async function main() {
  console.log('\n📥 EXPORTING ALL OLD DB DATA\n');
  console.log(`Exporting ${TABLES.length} tables...\n`);

  const allData = {};
  let totalRows = 0;

  for (const table of TABLES) {
    const result = await exportTable(table);
    allData[table] = result;
    totalRows += result.rows;
  }

  // Write to file
  const outputFile = '/tmp/old-db-export.json';
  fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2));

  console.log(`\n${'='*60}`);
  console.log(`✅ EXPORT COMPLETE`);
  console.log(`${'='*60}`);
  console.log(`Total tables: ${TABLES.length}`);
  console.log(`Total rows: ${totalRows}`);
  console.log(`File: ${outputFile}`);
  console.log(`Size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB\n`);
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});

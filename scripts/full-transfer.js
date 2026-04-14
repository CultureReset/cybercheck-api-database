#!/usr/bin/env node
/**
 * FULL TRANSFER: OLD DB → NEW GCR DB
 * Copies EVERY table, EVERY row, no limits
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

// ALL tables from old DB
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

async function copyAllData() {
  console.log('\n🚀 FULL TRANSFER: OLD → NEW\n');
  console.log(`Transferring ${ALL_TABLES.length} tables...\n`);

  let totalRows = 0;
  let successCount = 0;
  const results = {};

  for (const tableName of ALL_TABLES) {
    try {
      // Get ALL data from old DB (no limit)
      const { data, error: readError } = await old
        .from(tableName)
        .select('*');

      if (readError) {
        console.log(`⚠️  ${tableName.padEnd(30)} - Read error: ${readError.code}`);
        results[tableName] = { rows: 0, status: 'read_error', error: readError.message };
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`✓  ${tableName.padEnd(30)} - Empty`);
        results[tableName] = { rows: 0, status: 'empty' };
        continue;
      }

      // Insert into new DB
      const { error: writeError } = await gcr
        .from(tableName)
        .insert(data, { ignoreDuplicates: false });

      if (writeError) {
        console.log(`⚠️  ${tableName.padEnd(30)} - Write error: ${writeError.code}`);
        results[tableName] = { rows: data.length, status: 'write_error', error: writeError.message };
        continue;
      }

      console.log(`✅ ${tableName.padEnd(30)} - ${data.length.toString().padStart(6)} rows`);
      results[tableName] = { rows: data.length, status: 'success' };
      totalRows += data.length;
      successCount++;

    } catch(e) {
      console.log(`❌ ${tableName.padEnd(30)} - Exception: ${e.message}`);
      results[tableName] = { rows: 0, status: 'exception', error: e.message };
    }
  }

  // Save results
  fs.writeFileSync('/tmp/transfer-results.json', JSON.stringify(results, null, 2));

  console.log(`\n${'='*60}`);
  console.log(`✅ TRANSFER COMPLETE`);
  console.log(`${'='*60}`);
  console.log(`Tables: ${successCount}/${ALL_TABLES.length}`);
  console.log(`Total rows: ${totalRows.toLocaleString()}`);
  console.log(`Results: /tmp/transfer-results.json\n`);
}

copyAllData().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});

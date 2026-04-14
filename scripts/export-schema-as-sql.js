#!/usr/bin/env node
/**
 * EXPORT OLD DB SCHEMA AS SQL
 * Generates CREATE TABLE statements for all tables
 */
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// All 102 tables
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

async function main() {
  console.log('\n📋 EXPORTING SCHEMA FROM OLD DB\n');

  let sql = '';
  sql += `-- OLD DATABASE SCHEMA EXPORT\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Source: mhafixflyffflwjhcgfn (old DB)\n\n`;

  for (const tableName of ALL_TABLES) {
    try {
      const { data, error } = await old.from(tableName).select('*').limit(1);

      if (error) {
        sql += `-- ERROR: Cannot read table ${tableName}\n\n`;
        continue;
      }

      if (!data || data.length === 0) {
        sql += `-- ${tableName} (empty table)\n`;
        sql += `CREATE TABLE IF NOT EXISTS ${tableName} ();\n\n`;
        continue;
      }

      // Get column info from first row
      const columns = Object.keys(data[0]);
      sql += `-- ${tableName} (${columns.length} columns)\n`;
      sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
      sql += columns.map((col, i) => {
        const value = data[0][col];
        let type = 'TEXT';

        if (value === null) type = 'TEXT';
        else if (typeof value === 'boolean') type = 'BOOLEAN';
        else if (typeof value === 'number') {
          if (Number.isInteger(value)) type = 'BIGINT';
          else type = 'NUMERIC';
        }
        else if (value instanceof Date) type = 'TIMESTAMP';
        else if (typeof value === 'object') type = 'JSONB';

        return `  ${col} ${type}`;
      }).join(',\n');
      sql += '\n);\n\n';

    } catch (e) {
      sql += `-- ERROR: ${tableName} - ${e.message}\n\n`;
    }
  }

  const outputFile = '/tmp/old-db-schema.sql';
  fs.writeFileSync(outputFile, sql);

  console.log(`✅ SCHEMA EXPORTED\n`);
  console.log(`File: ${outputFile}`);
  console.log(`Size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB\n`);
  console.log(`NEXT: Copy this SQL and run it in the GCR Supabase SQL editor\n`);
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});

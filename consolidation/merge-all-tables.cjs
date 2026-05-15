#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('='.repeat(100));
console.log('COMPLETE DATABASE CONSOLIDATION - ALL 89 TABLES FROM GCR + PROFILES + CULTURERESET');
console.log('='.repeat(100) + '\n');

// Load all three database exports
console.log('📦 Loading databases...\n');
const gcrExport = JSON.parse(fs.readFileSync(path.join(__dirname, '../gulf-coast-radar-full-export.json')));
const profExport = JSON.parse(fs.readFileSync(path.join(__dirname, '../profiles-full-export.json')));
const crExport = JSON.parse(fs.readFileSync(path.join(__dirname, '../culturereset-full-export.json')));

const gcrData = gcrExport.data || {};
const profData = profExport.data || {};
const crData = crExport.data || {};

console.log(`✓ GCR loaded: ${Object.keys(gcrData).length} tables`);
console.log(`✓ Profiles loaded: ${Object.keys(profData).length} tables`);
console.log(`✓ CultureReset loaded: ${Object.keys(crData).length} tables\n`);

// Merge strategies for different table types
const MERGE_STRATEGIES = {
  // Core entity tables - normalize IDs
  'entity': { strategy: 'normalize', description: 'Main places/entities' },
  'entity_photos': { strategy: 'normalize', description: 'Entity photos' },
  'entity_hours': { strategy: 'normalize', description: 'Operating hours' },
  'entity_events': { strategy: 'normalize', description: 'Entity-hosted events' },
  'entity_sections': { strategy: 'normalize', description: 'Page sections' },
  'entity_tags': { strategy: 'normalize', description: 'Entity tags' },
  'entity_features': { strategy: 'normalize', description: 'Entity features' },
  'entity_perfect_for': { strategy: 'normalize', description: 'Perfect for tags' },
  'entity_qna': { strategy: 'normalize', description: 'Q&A' },
  'entity_specials': { strategy: 'normalize', description: 'Entity specials' },

  // Booking & availability tables
  'bookings': { strategy: 'all_sources', description: 'Booking records' },
  'availability_blocks': { strategy: 'normalize', description: 'Time slot availability' },
  'blackout_dates': { strategy: 'normalize', description: 'Unavailable dates' },
  'booking_slots': { strategy: 'all_sources', description: 'Available booking slots' },

  // Menu tables
  'menu_items': { strategy: 'merge_menus', description: 'All menu items from both DBs' },
  'menu_sections': { strategy: 'normalize', description: 'Menu categories' },
  'menu_categories': { strategy: 'normalize', description: 'Menu categories (alt)' },
  'menu_subcategories': { strategy: 'normalize', description: 'Menu subcategories' },
  'drink_items': { strategy: 'all_sources', description: 'Drink items (GCR)' },
  'drink_sections': { strategy: 'all_sources', description: 'Drink sections (GCR)' },
  'happy_hour_items': { strategy: 'all_sources', description: 'Happy hour items (GCR)' },
  'happy_hour_sections': { strategy: 'all_sources', description: 'Happy hour sections (GCR)' },
  'specials': { strategy: 'all_sources', description: 'Specials (Profiles)' },

  // Pricing & inventory
  'pricing_items': { strategy: 'normalize', description: 'Pricing tiers' },
  'fleet_items': { strategy: 'normalize', description: 'Boats/equipment' },
  'fleet_types': { strategy: 'normalize', description: 'Equipment types' },
  'addons': { strategy: 'all_sources', description: 'Addon services' },

  // Events & entertainment
  'events': { strategy: 'merge_events', description: 'Events from Profiles' },
  'page_events': { strategy: 'all_sources', description: 'Page tracking events (Profiles)' },

  // Reviews & media
  'reviews': { strategy: 'all_sources', description: 'Reviews' },
  'gcr_reviews': { strategy: 'all_sources', description: 'GCR reviews' },
  'entity_photos': { strategy: 'normalize', description: 'Photos' },
  'section_photos': { strategy: 'normalize', description: 'Section photos' },
  'section_reviews': { strategy: 'all_sources', description: 'Section reviews' },

  // User & customer tables
  'users': { strategy: 'merge_users', description: 'Users from Profiles & CultureReset' },
  'customers': { strategy: 'merge_customers', description: 'Customers' },
  'staff': { strategy: 'normalize', description: 'Staff members' },
  'tourist_profiles': { strategy: 'all_sources', description: 'Tourist profiles' },
  'tourist_groups': { strategy: 'all_sources', description: 'Tourist groups' },
  'tourist_group_members': { strategy: 'all_sources', description: 'Group members' },
  'tourist_itineraries': { strategy: 'all_sources', description: 'Itineraries' },
  'tourist_saves': { strategy: 'all_sources', description: 'Saved items' },
  'tourist_setup_questions': { strategy: 'all_sources', description: 'Setup questions' },

  // Business tables
  'businesses': { strategy: 'merge_businesses', description: 'Business accounts' },
  'business_highlights': { strategy: 'all_sources', description: 'Business highlights' },
  'business_media': { strategy: 'normalize', description: 'Business media' },
  'business_completeness': { strategy: 'all_sources', description: 'Data completeness' },
  'tripswipe_business_settings': { strategy: 'all_sources', description: 'TripSwipe settings' },

  // Communications
  'notifications': { strategy: 'all_sources', description: 'Notifications' },
  'messages': { strategy: 'all_sources', description: 'Messages' },
  'messaging_settings': { strategy: 'merge_messaging', description: 'Messaging config' },
  'sms_campaigns': { strategy: 'all_sources', description: 'SMS campaigns' },
  'sms_log': { strategy: 'all_sources', description: 'SMS log' },

  // Content & pages
  'site_pages': { strategy: 'normalize', description: 'Site pages' },
  'site_content': { strategy: 'all_sources', description: 'Site content' },
  'site_data_store': { strategy: 'all_sources', description: 'Data store' },
  'site_apps': { strategy: 'all_sources', description: 'Site apps' },
  'section_items': { strategy: 'normalize', description: 'Section items' },
  'section_location': { strategy: 'normalize', description: 'Section locations' },
  'section_hours': { strategy: 'normalize', description: 'Section hours' },
  'section_bullets': { strategy: 'normalize', description: 'Section bullets' },
  'section_cards': { strategy: 'normalize', description: 'Section cards' },
  'section_groups': { strategy: 'normalize', description: 'Section groups' },
  'section_rich_text': { strategy: 'normalize', description: 'Rich text sections' },

  // FAQs & QA
  'faqs': { strategy: 'all_sources', description: 'FAQs' },
  'gcr_faqs': { strategy: 'all_sources', description: 'GCR FAQs' },

  // Analytics & tracking
  'page_views': { strategy: 'merge_pageviews', description: 'Page views' },
  'gcr_page_views': { strategy: 'all_sources', description: 'GCR page views' },
  'conversions': { strategy: 'all_sources', description: 'Conversions' },
  'sales_leads': { strategy: 'all_sources', description: 'Sales leads' },

  // Connections & integrations
  'connections': { strategy: 'all_sources', description: 'External connections' },
  'coupons': { strategy: 'all_sources', description: 'Coupons' },
  'waivers': { strategy: 'all_sources', description: 'Waivers' },
  'requirements': { strategy: 'all_sources', description: 'Requirements' },

  // Location & meeting
  'locations': { strategy: 'normalize', description: 'Locations' },
  'meeting_points': { strategy: 'normalize', description: 'Meeting points' },

  // SEO & config
  'seo_meta_tags': { strategy: 'normalize', description: 'SEO metadata' },
  'sitemap_config': { strategy: 'all_sources', description: 'Sitemap config' },
  'robots_config': { strategy: 'all_sources', description: 'Robots config' },
  'platform_config': { strategy: 'all_sources', description: 'Platform config' },
  'platform_settings': { strategy: 'all_sources', description: 'Platform settings' },
  'policies': { strategy: 'all_sources', description: 'Policies' },

  // AI & apps
  'ai_settings': { strategy: 'all_sources', description: 'AI settings' },
  'app_settings': { strategy: 'all_sources', description: 'App settings' },
  'apps': { strategy: 'all_sources', description: 'Apps' },
  'module_manifest': { strategy: 'all_sources', description: 'Module manifest' },

  // Directory & other
  'gcr_directory': { strategy: 'all_sources', description: 'GCR directory' },
  'activities': { strategy: 'normalize', description: 'Activities' },
  'update_links': { strategy: 'all_sources', description: 'Update links' }
};

// Helper functions
function normalizeRecord(record) {
  const normalized = { ...record };
  if (normalized.entity_id) {
    normalized.place_id = normalized.entity_id;
    delete normalized.entity_id;
  }
  if (normalized.site_id) {
    normalized.place_id = normalized.site_id;
    delete normalized.site_id;
  }
  return normalized;
}

function merge_menus() {
  const all = [];
  const gcrItems = (gcrData.menu_items || []).map(item => ({
    ...normalizeRecord(item),
    _source: 'gcr',
    item_name: item.item_name || item.name
  }));
  const profItems = (profData.menu_items || []).map(item => ({
    ...normalizeRecord(item),
    _source: 'profiles',
    item_name: item.name || item.item_name
  }));
  return [...gcrItems, ...profItems];
}

function merge_events() {
  const gcrEvents = (gcrData.entity_events || []).map(e => ({
    ...normalizeRecord(e),
    _source: 'gcr',
    _table_source: 'entity_events'
  }));
  const profEvents = (profData.events || []).map(e => ({
    ...normalizeRecord(e),
    _source: 'profiles',
    _table_source: 'events',
    event_name: e.name || e.title
  }));
  return [...gcrEvents, ...profEvents];
}

function merge_users() {
  const profUsers = (profData.users || []).map(u => ({
    ...normalizeRecord(u),
    _source: 'profiles'
  }));
  const crUsers = (crData.users || []).map(u => ({
    ...normalizeRecord(u),
    _source: 'culturereset'
  }));
  return [...profUsers, ...crUsers];
}

function merge_customers() {
  const gcrCustomers = (gcrData.customers || []).map(c => ({
    ...normalizeRecord(c),
    _source: 'gcr'
  }));
  const profCustomers = (profData.customers || []).map(c => ({
    ...normalizeRecord(c),
    _source: 'profiles'
  }));
  return [...gcrCustomers, ...profCustomers];
}

function merge_businesses() {
  const profBusinesses = (profData.businesses || []).map(b => ({
    ...normalizeRecord(b),
    _source: 'profiles'
  }));
  const crBusinesses = (crData.businesses || []).map(b => ({
    ...normalizeRecord(b),
    _source: 'culturereset'
  }));
  return [...profBusinesses, ...crBusinesses];
}

function merge_messaging() {
  const gcrSettings = (gcrData.messaging_settings || []).map(s => ({
    ...normalizeRecord(s),
    _source: 'gcr'
  }));
  const profSettings = (profData.messaging_settings || []).map(s => ({
    ...normalizeRecord(s),
    _source: 'profiles'
  }));
  return [...gcrSettings, ...profSettings];
}

function merge_pageviews() {
  const gcrViews = (gcrData.page_views || []).map(v => ({
    ...normalizeRecord(v),
    _source: 'gcr'
  }));
  const profViews = (profData.page_views || []).map(v => ({
    ...normalizeRecord(v),
    _source: 'profiles'
  }));
  return [...gcrViews, ...profViews];
}

// Create consolidated database
const consolidated = {
  meta: {
    consolidated_at: new Date().toISOString(),
    version: '2.0',
    title: 'COMPLETE UNIFIED DATABASE - ALL TABLES',
    description: 'Complete consolidation of GCR, Profiles, and CultureReset databases',
    sources: ['gulf-coast-radar', 'profiles', 'culturereset'],
    total_tables: 0,
    total_records: 0
  },
  summary: {
    by_source: {
      'gulf-coast-radar': { tables: 0, records: 0, size_mb: 0 },
      'profiles': { tables: 0, records: 0, size_mb: 0 },
      'culturereset': { tables: 0, records: 0, size_mb: 0 }
    },
    by_strategy: {
      'normalize': [],
      'merge_menus': [],
      'merge_events': [],
      'merge_users': [],
      'merge_customers': [],
      'merge_businesses': [],
      'merge_messaging': [],
      'merge_pageviews': [],
      'all_sources': []
    }
  },
  data: {}
};

// Process all tables
console.log('🔄 Processing 89 tables with smart merge strategies...\n');

const allTableNames = new Set([
  ...Object.keys(gcrData),
  ...Object.keys(profData),
  ...Object.keys(crData)
]);

// Initialize all strategy categories
Object.keys(consolidated.summary.by_strategy).forEach(s => {
  if (!Array.isArray(consolidated.summary.by_strategy[s])) {
    consolidated.summary.by_strategy[s] = [];
  }
});

let processedTables = 0;

Array.from(allTableNames).sort().forEach(tableName => {
  const gcrRecords = gcrData[tableName] || [];
  const profRecords = profData[tableName] || [];
  const crRecords = crData[tableName] || [];

  let merged = [];
  let strategy = MERGE_STRATEGIES[tableName]?.strategy || 'all_sources';

  // Apply merge strategy
  if (strategy === 'normalize') {
    merged = [
      ...gcrRecords.map(r => ({ ...normalizeRecord(r), _source: 'gcr' })),
      ...profRecords.map(r => ({ ...normalizeRecord(r), _source: 'profiles' })),
      ...crRecords.map(r => ({ ...normalizeRecord(r), _source: 'culturereset' }))
    ];
  } else if (strategy === 'merge_menus') {
    merged = merge_menus();
  } else if (strategy === 'merge_events') {
    merged = merge_events();
  } else if (strategy === 'merge_users') {
    merged = merge_users();
  } else if (strategy === 'merge_customers') {
    merged = merge_customers();
  } else if (strategy === 'merge_businesses') {
    merged = merge_businesses();
  } else if (strategy === 'merge_messaging') {
    merged = merge_messaging();
  } else if (strategy === 'merge_pageviews') {
    merged = merge_pageviews();
  } else {
    // all_sources - just combine and mark
    merged = [
      ...gcrRecords.map(r => ({ ...r, _source: 'gcr' })),
      ...profRecords.map(r => ({ ...r, _source: 'profiles' })),
      ...crRecords.map(r => ({ ...r, _source: 'culturereset' }))
    ];
  }

  if (merged.length > 0) {
    consolidated.data[tableName] = merged;
    consolidated.meta.total_records += merged.length;
    processedTables++;

    // Track strategy usage
    consolidated.summary.by_strategy[strategy].push(tableName);

    // Update source counts
    if (gcrRecords.length > 0) {
      consolidated.summary.by_source['gulf-coast-radar'].records += gcrRecords.length;
      consolidated.summary.by_source['gulf-coast-radar'].tables++;
    }
    if (profRecords.length > 0) {
      consolidated.summary.by_source['profiles'].records += profRecords.length;
      consolidated.summary.by_source['profiles'].tables++;
    }
    if (crRecords.length > 0) {
      consolidated.summary.by_source['culturereset'].records += crRecords.length;
      consolidated.summary.by_source['culturereset'].tables++;
    }

    const desc = MERGE_STRATEGIES[tableName]?.description || 'Generic table';
    console.log(`  ✓ ${tableName.padEnd(30)} ${merged.length.toString().padStart(6)} records [${strategy}]`);
  }
});

consolidated.meta.total_tables = processedTables;

console.log('\n' + '='.repeat(100));
console.log('💾 SAVING CONSOLIDATED DATABASE\n');

// Save main consolidated database
const consolidationDir = path.join(__dirname);
const outputFile = path.join(consolidationDir, 'CONSOLIDATED-ALL-TABLES.json');

fs.writeFileSync(outputFile, JSON.stringify(consolidated, null, 2));
const fileSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);

console.log(`✓ Saved: CONSOLIDATED-ALL-TABLES.json (${fileSize} MB)\n`);

// Create detailed statistics report
const report = {
  generated_at: new Date().toISOString(),
  consolidation_file: 'CONSOLIDATED-ALL-TABLES.json',
  file_size_mb: parseFloat(fileSize),

  statistics: {
    total_tables_processed: consolidated.meta.total_tables,
    total_records: consolidated.meta.total_records.toLocaleString(),

    by_source: {
      'gulf-coast-radar': {
        tables: consolidated.summary.by_source['gulf-coast-radar'].tables,
        records: consolidated.summary.by_source['gulf-coast-radar'].records.toLocaleString()
      },
      'profiles': {
        tables: consolidated.summary.by_source['profiles'].tables,
        records: consolidated.summary.by_source['profiles'].records.toLocaleString()
      },
      'culturereset': {
        tables: consolidated.summary.by_source['culturereset'].tables,
        records: consolidated.summary.by_source['culturereset'].records.toLocaleString()
      }
    },

    merge_strategies: {
      normalize_ids: {
        count: consolidated.summary.by_strategy.normalize.length,
        tables: consolidated.summary.by_strategy.normalize.slice(0, 5),
        description: 'Normalize entity_id/site_id to place_id'
      },
      custom_merge: {
        count: (consolidated.summary.by_strategy.merge_menus?.length || 0) +
               (consolidated.summary.by_strategy.merge_events?.length || 0) +
               (consolidated.summary.by_strategy.merge_users?.length || 0) +
               (consolidated.summary.by_strategy.merge_customers?.length || 0) +
               (consolidated.summary.by_strategy.merge_businesses?.length || 0) +
               (consolidated.summary.by_strategy.merge_messaging?.length || 0) +
               (consolidated.summary.by_strategy.merge_pageviews?.length || 0),
        tables: [
          ...consolidated.summary.by_strategy.merge_menus || [],
          ...consolidated.summary.by_strategy.merge_events || [],
          ...consolidated.summary.by_strategy.merge_users || [],
          ...consolidated.summary.by_strategy.merge_customers || [],
          ...consolidated.summary.by_strategy.merge_businesses || []
        ],
        description: 'Special merge logic (menus, events, users, etc.)'
      },
      all_sources_combined: {
        count: consolidated.summary.by_strategy.all_sources.length,
        tables: consolidated.summary.by_strategy.all_sources.slice(0, 5),
        description: 'Combine all sources and mark with _source'
      }
    }
  },

  next_steps: [
    '1. Review CONSOLIDATED-ALL-TABLES.json for completeness',
    '2. Create new Supabase project or PostgreSQL database',
    '3. Run: npm run import-consolidated-db (when ready)',
    '4. Verify data integrity on new database',
    '5. Update .env with new database credentials',
    '6. Switch API to use new consolidated database'
  ],

  table_list: Array.from(allTableNames).sort(),

  all_strategies_used: consolidated.summary.by_strategy
};

fs.writeFileSync(
  path.join(consolidationDir, 'CONSOLIDATION-REPORT-COMPLETE.json'),
  JSON.stringify(report, null, 2)
);

console.log('✓ Saved: CONSOLIDATION-REPORT-COMPLETE.json\n');

// Print summary
console.log('='.repeat(100));
console.log('✅ CONSOLIDATION COMPLETE - READY FOR DATABASE IMPORT\n');

console.log('📊 STATISTICS:\n');
console.log(`  Total Tables: ${consolidated.meta.total_tables}`);
console.log(`  Total Records: ${consolidated.meta.total_records.toLocaleString()}`);
console.log(`  File Size: ${fileSize} MB\n`);

console.log('📦 BY SOURCE:\n');
console.log(`  GCR:            ${consolidated.summary.by_source['gulf-coast-radar'].tables} tables, ${consolidated.summary.by_source['gulf-coast-radar'].records.toLocaleString()} records`);
console.log(`  Profiles:       ${consolidated.summary.by_source['profiles'].tables} tables, ${consolidated.summary.by_source['profiles'].records.toLocaleString()} records`);
console.log(`  CultureReset:   ${consolidated.summary.by_source['culturereset'].tables} tables, ${consolidated.summary.by_source['culturereset'].records.toLocaleString()} records\n`);

console.log('🔄 MERGE STRATEGIES USED:\n');
console.log(`  Normalize IDs: ${consolidated.summary.by_strategy.normalize.length} tables`);
console.log(`  Custom merge (menus/events/users): ${(consolidated.summary.by_strategy.merge_menus?.length || 0) + (consolidated.summary.by_strategy.merge_events?.length || 0) + (consolidated.summary.by_strategy.merge_users?.length || 0) + (consolidated.summary.by_strategy.merge_customers?.length || 0) + (consolidated.summary.by_strategy.merge_businesses?.length || 0) + (consolidated.summary.by_strategy.merge_messaging?.length || 0) + (consolidated.summary.by_strategy.merge_pageviews?.length || 0)} tables`);
console.log(`  All sources: ${consolidated.summary.by_strategy.all_sources.length} tables\n`);

console.log('='.repeat(100));
console.log('🚀 Ready for Phase 2: Database Import');
console.log('   Files generated:');
console.log('   - CONSOLIDATED-ALL-TABLES.json (complete data)');
console.log('   - CONSOLIDATION-REPORT-COMPLETE.json (detailed statistics)');
console.log('='.repeat(100) + '\n');

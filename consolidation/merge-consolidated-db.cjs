#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('COMPLETE DATA CONSOLIDATION - ALL TABLES FROM ALL DATABASES');
console.log('='.repeat(80) + '\n');

// Load all three database exports
console.log('Loading databases...\n');
const gcrExport = JSON.parse(fs.readFileSync('./gulf-coast-radar-full-export.json'));
const profExport = JSON.parse(fs.readFileSync('./profiles-full-export.json'));
const crExport = JSON.parse(fs.readFileSync('./culturereset-full-export.json'));

const gcrData = gcrExport.data || {};
const profData = profExport.data || {};
const crData = crExport.data || {};

console.log('✓ GCR loaded: ' + Object.keys(gcrData).length + ' tables');
console.log('✓ Profiles loaded: ' + Object.keys(profData).length + ' tables');
console.log('✓ CultureReset loaded: ' + Object.keys(crData).length + ' tables\n');

// Create consolidated database
const consolidated = {
  consolidated_at: new Date().toISOString(),
  title: 'COMPLETE UNIFIED DATABASE',
  description: 'All data from GCR, Profiles, and CultureReset consolidated into single database',
  sources: ['gulf-coast-radar', 'profiles', 'culturereset'],

  summary: {
    total_tables: 0,
    total_records: 0,
    by_source: {
      'gulf-coast-radar': { tables: 0, records: 0 },
      'profiles': { tables: 0, records: 0 },
      'culturereset': { tables: 0, records: 0 }
    },
    overlap_handling: {
      identical: [],
      normalized: [],
      merged: [],
      separate_by_source: []
    }
  },

  data: {}
};

// Get all unique table names
const allTableNames = new Set([
  ...Object.keys(gcrData),
  ...Object.keys(profData),
  ...Object.keys(crData)
]);

console.log('='.repeat(80));
console.log('CONSOLIDATION STRATEGY\n');

// Define merge strategies
const IDENTICAL_TABLES = [
  'business_highlights',
  'platform_settings'
];

const NORMALIZE_ID_TABLES = [
  'business_media', 'notifications', 'sms_log', 'sms_campaigns',
  'site_pages', 'staff', 'locations', 'seo_meta_tags'
];

const CUSTOM_MERGE_TABLES = {
  'menu_items': 'merge_menu_items',
  'customers': 'merge_customers',
  'page_views': 'merge_page_views',
  'messaging_settings': 'merge_messaging_settings',
  'events': 'merge_events',
  'entity_events': 'merge_all_events',
  'users': 'merge_users',
  'businesses': 'merge_businesses'
};

const SEPARATE_BY_SOURCE = [
  'happy_hour_items', 'happy_hour_sections',  // GCR only
  'specials',                                   // Profiles only
  'fleet_items'                                 // Profiles only
];

// Helper function: normalize entity_id / site_id to place_id
function normalizeRecord(record, table) {
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

// Custom merge functions
function merge_menu_items() {
  const all = [];
  const gcrItems = (gcrData.menu_items || []).map(item => ({
    ...normalizeRecord(item, 'menu_items'),
    _source: 'gcr',
    item_name: item.item_name || item.name,
    category: item.menu_section_id,
    subcategory: item.menu_sub_section_id
  }));
  const profItems = (profData.menu_items || []).map(item => ({
    ...normalizeRecord(item, 'menu_items'),
    _source: 'profiles',
    item_name: item.name || item.item_name
  }));
  all.push(...gcrItems, ...profItems);
  return all;
}

function merge_customers() {
  const all = [];
  const gcrCustomers = (gcrData.customers || []).map(c => ({
    ...normalizeRecord(c, 'customers'),
    _source: 'gcr',
    loyalty_number: c.loyalty_number,
    loyalty_points: c.loyalty_points
  }));
  const profCustomers = (profData.customers || []).map(c => ({
    ...normalizeRecord(c, 'customers'),
    _source: 'profiles'
  }));
  all.push(...gcrCustomers, ...profCustomers);
  return all;
}

function merge_page_views() {
  const all = [];
  const gcrViews = (gcrData.page_views || []).map(v => ({
    ...normalizeRecord(v, 'page_views'),
    _source: 'gcr'
  }));
  const profViews = (profData.page_views || []).map(v => ({
    ...normalizeRecord(v, 'page_views'),
    _source: 'profiles',
    utm_term: v.utm_term,
    utm_content: v.utm_content,
    ip_address: v.ip_address,
    user_id: v.user_id
  }));
  all.push(...gcrViews, ...profViews);
  return all;
}

function merge_messaging_settings() {
  const all = [];
  const gcrSettings = (gcrData.messaging_settings || []).map(s => ({
    ...normalizeRecord(s, 'messaging_settings'),
    _source: 'gcr'
  }));
  const profSettings = (profData.messaging_settings || []).map(s => ({
    ...normalizeRecord(s, 'messaging_settings'),
    _source: 'profiles',
    whatsapp_connected: s.whatsapp_connected,
    whatsapp_access_token: s.whatsapp_access_token,
    whatsapp_phone_number_id: s.whatsapp_phone_number_id,
    whatsapp_waba_id: s.whatsapp_waba_id,
    whatsapp_phone_number: s.whatsapp_phone_number,
    notification_email_2: s.notification_email_2
  }));
  all.push(...gcrSettings, ...profSettings);
  return all;
}

function merge_all_events() {
  const all = [];
  const gcrEvents = (gcrData.entity_events || []).map(e => ({
    ...normalizeRecord(e, 'entity_events'),
    _source: 'gcr',
    _table_source: 'entity_events'
  }));
  const profEvents = (profData.events || []).map(e => ({
    ...normalizeRecord(e, 'events'),
    _source: 'profiles',
    _table_source: 'events',
    event_name: e.name || e.title,
    description: e.description,
    event_date: e.event_date,
    start_time: e.start_time || e.time,
    end_time: e.end_time,
    recurring: e.recurring,
    recurring_day: e.recurring_day,
    category: e.category,
    ticket_url: e.ticket_url,
    kids_friendly: e.kids_friendly,
    pet_friendly: e.pet_friendly,
    age_limit: e.age_limit
  }));
  all.push(...gcrEvents, ...profEvents);
  return all;
}

function merge_users() {
  const all = [];
  const profUsers = (profData.users || []).map(u => ({
    ...normalizeRecord(u, 'users'),
    _source: 'profiles'
  }));
  const crUsers = (crData.users || []).map(u => ({
    ...normalizeRecord(u, 'users'),
    _source: 'culturereset',
    full_name: u.full_name,
    first_name: u.first_name,
    last_name: u.last_name,
    phone: u.phone,
    permissions: u.permissions,
    is_active: u.is_active,
    email_verified: u.email_verified,
    last_login_at: u.last_login_at,
    deleted_at: u.deleted_at,
    business_name: u.business_name
  }));
  all.push(...profUsers, ...crUsers);
  return all;
}

function merge_businesses() {
  const all = [];
  const profBusinesses = (profData.businesses || []).map(b => ({
    ...normalizeRecord(b, 'businesses'),
    _source: 'profiles',
    _table_source: 'profiles_businesses'
  }));
  const crBusinesses = (crData.businesses || []).map(b => ({
    ...normalizeRecord(b, 'businesses'),
    _source: 'culturereset',
    _table_source: 'culturereset_businesses'
  }));
  all.push(...profBusinesses, ...crBusinesses);
  return all;
}

// Process all tables
console.log('Processing tables:\n');

let processedCount = 0;
let totalRecords = 0;

Array.from(allTableNames).sort().forEach(tableName => {
  const gcrRecords = gcrData[tableName] || [];
  const profRecords = profData[tableName] || [];
  const crRecords = crData[tableName] || [];

  let merged = [];
  let strategy = 'copy_all';

  // Determine merge strategy
  if (IDENTICAL_TABLES.includes(tableName)) {
    // Just combine identical tables
    merged = [...gcrRecords, ...profRecords, ...crRecords];
    strategy = 'identical_append';
  } else if (NORMALIZE_ID_TABLES.includes(tableName)) {
    // Normalize entity_id / site_id to place_id
    merged = [
      ...gcrRecords.map(r => normalizeRecord(r, tableName)),
      ...profRecords.map(r => normalizeRecord(r, tableName)),
      ...crRecords.map(r => normalizeRecord(r, tableName))
    ];
    strategy = 'normalize_ids';
  } else if (CUSTOM_MERGE_TABLES[tableName]) {
    // Use custom merge function
    merged = eval(CUSTOM_MERGE_TABLES[tableName] + '()');
    strategy = 'custom_merge';
  } else if (SEPARATE_BY_SOURCE.includes(tableName)) {
    // Keep separate, mark by source
    merged = [
      ...gcrRecords.map(r => ({ ...r, _source: 'gcr' })),
      ...profRecords.map(r => ({ ...r, _source: 'profiles' })),
      ...crRecords.map(r => ({ ...r, _source: 'culturereset' }))
    ];
    strategy = 'source_marked';
  } else {
    // Default: combine all
    merged = [
      ...gcrRecords.map(r => ({ ...r, _source: 'gcr' })),
      ...profRecords.map(r => ({ ...r, _source: 'profiles' })),
      ...crRecords.map(r => ({ ...r, _source: 'culturereset' }))
    ];
    strategy = 'all_sources';
  }

  if (merged.length > 0) {
    consolidated.data[tableName] = merged;
    consolidated.summary.total_records += merged.length;
    totalRecords += merged.length;
    processedCount++;

    // Track strategy
    if (strategy === 'identical_append') {
      consolidated.summary.overlap_handling.identical.push(tableName);
    } else if (strategy === 'normalize_ids') {
      consolidated.summary.overlap_handling.normalized.push(tableName);
    } else if (strategy === 'custom_merge') {
      consolidated.summary.overlap_handling.merged.push(tableName);
    } else if (strategy === 'source_marked') {
      consolidated.summary.overlap_handling.separate_by_source.push(tableName);
    }

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

    console.log(`  ✓ ${tableName}: ${merged.length} records [${strategy}]`);
  }
});

consolidated.summary.total_tables = processedCount;

console.log('\n' + '='.repeat(80));
console.log('SAVING CONSOLIDATED DATABASE\n');

// Ensure directory exists
const consolidationDir = path.join(__dirname);
if (!fs.existsSync(consolidationDir)) {
  fs.mkdirSync(consolidationDir, { recursive: true });
}

// Save consolidated database
const outputFile = path.join(consolidationDir, 'CONSOLIDATED-MASTER.json');
fs.writeFileSync(outputFile, JSON.stringify(consolidated, null, 2));
const fileSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);

console.log(`✓ Saved: CONSOLIDATED-MASTER.json (${fileSize} MB)\n`);

// Create summary report
const report = {
  consolidated_at: new Date().toISOString(),
  file: 'CONSOLIDATED-MASTER.json',
  size_mb: parseFloat(fileSize),

  summary: {
    total_tables: consolidated.summary.total_tables,
    total_records: consolidated.summary.total_records,

    by_source: {
      'gulf-coast-radar': {
        tables: consolidated.summary.by_source['gulf-coast-radar'].tables,
        records: consolidated.summary.by_source['gulf-coast-radar'].records
      },
      'profiles': {
        tables: consolidated.summary.by_source['profiles'].tables,
        records: consolidated.summary.by_source['profiles'].records
      },
      'culturereset': {
        tables: consolidated.summary.by_source['culturereset'].tables,
        records: consolidated.summary.by_source['culturereset'].records
      }
    },

    merge_strategies_used: {
      identical_tables_appended: consolidated.summary.overlap_handling.identical.length,
      normalized_id_fields: consolidated.summary.overlap_handling.normalized.length,
      custom_merged: consolidated.summary.overlap_handling.merged.length,
      marked_by_source: consolidated.summary.overlap_handling.separate_by_source.length
    }
  },

  merge_details: {
    identical_append: consolidated.summary.overlap_handling.identical,
    normalize_ids: consolidated.summary.overlap_handling.normalized,
    custom_merge: consolidated.summary.overlap_handling.merged,
    separate_by_source: consolidated.summary.overlap_handling.separate_by_source
  }
};

fs.writeFileSync(
  path.join(consolidationDir, 'CONSOLIDATION-REPORT.json'),
  JSON.stringify(report, null, 2)
);

console.log('='.repeat(80));
console.log('CONSOLIDATION COMPLETE\n');

console.log('CONSOLIDATED DATABASE STATISTICS:\n');
console.log(`  Total Tables: ${consolidated.summary.total_tables}`);
console.log(`  Total Records: ${consolidated.summary.total_records.toLocaleString()}`);
console.log(`  File Size: ${fileSize} MB\n`);

console.log('BY SOURCE:\n');
console.log(`  GCR:           ${consolidated.summary.by_source['gulf-coast-radar'].tables} tables, ${consolidated.summary.by_source['gulf-coast-radar'].records.toLocaleString()} records`);
console.log(`  Profiles:      ${consolidated.summary.by_source['profiles'].tables} tables, ${consolidated.summary.by_source['profiles'].records.toLocaleString()} records`);
console.log(`  CultureReset:  ${consolidated.summary.by_source['culturereset'].tables} tables, ${consolidated.summary.by_source['culturereset'].records.toLocaleString()} records\n`);

console.log('MERGE STRATEGIES:\n');
console.log(`  Identical append: ${consolidated.summary.overlap_handling.identical.length} tables`);
console.log(`  Normalized IDs: ${consolidated.summary.overlap_handling.normalized.length} tables`);
console.log(`  Custom merged: ${consolidated.summary.overlap_handling.merged.length} tables`);
console.log(`  Marked by source: ${consolidated.summary.overlap_handling.separate_by_source.length} tables\n`);

console.log('='.repeat(80));
console.log('✓ CONSOLIDATION COMPLETE - LOCAL FILES ONLY');
console.log('  Databases untouched');
console.log('  Ready for Phase 2: Upload to new Supabase project');
console.log('='.repeat(80) + '\n');

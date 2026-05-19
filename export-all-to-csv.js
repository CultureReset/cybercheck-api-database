#!/usr/bin/env node
/**
 * EXPORT ALL DATA TO CSV
 * Creates comprehensive CSVs of entities, events, specials, happy hours, sections
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function arrayToCSV(data, columns) {
  const header = columns.join(',');
  const rows = data.map(row =>
    columns.map(col => escapeCSV(row[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

async function exportEntities() {
  console.log('📊 Exporting entities...');

  const { data } = await supabase
    .from('entity')
    .select('id, name, slug, place_id, phone, address_line_1, city, state, zip, latitude, longitude, hero_image_url, description, rating, is_active, gcr_listed, entity_type, entity_subtype')
    .eq('is_active', true)
    .order('name');

  const columns = ['id', 'name', 'slug', 'place_id', 'phone', 'address_line_1', 'city', 'state', 'zip', 'latitude', 'longitude', 'hero_image_url', 'description', 'rating', 'is_active', 'gcr_listed', 'entity_type', 'entity_subtype'];

  const csv = arrayToCSV(data || [], columns);
  fs.writeFileSync('/Users/owner/cybercheck-api-database/export-ENTITIES.csv', csv);
  console.log(`✓ ${(data || []).length} entities`);
}

async function exportEvents() {
  console.log('📅 Exporting events...');

  const { data } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, artist_name, event_date, start_time, end_time, venue_location, description, is_active')
    .order('event_date');

  const columns = ['id', 'entity_id', 'event_name', 'artist_name', 'event_date', 'start_time', 'end_time', 'venue_location', 'description', 'is_active'];

  const csv = arrayToCSV(data || [], columns);
  fs.writeFileSync('/Users/owner/cybercheck-api-database/export-EVENTS.csv', csv);
  console.log(`✓ ${(data || []).length} events`);
}

async function exportSpecials() {
  console.log('🎉 Exporting specials...');

  const { data } = await supabase
    .from('entity_specials')
    .select('id, entity_id, place_id, title, description, type, day_of_week, start_date, end_date, start_time, end_time, discount, is_active')
    .order('created_at');

  const columns = ['id', 'entity_id', 'place_id', 'title', 'description', 'type', 'day_of_week', 'start_date', 'end_date', 'start_time', 'end_time', 'discount', 'is_active'];

  const csv = arrayToCSV(data || [], columns);
  fs.writeFileSync('/Users/owner/cybercheck-api-database/export-SPECIALS.csv', csv);
  console.log(`✓ ${(data || []).length} specials`);
}

async function exportHappyHours() {
  console.log('🍻 Exporting happy hours...');

  const { data } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, place_id, days, start_time, end_time, description')
    .order('created_at');

  const columns = ['id', 'entity_id', 'place_id', 'days', 'start_time', 'end_time', 'description'];

  const csv = arrayToCSV(data || [], columns);
  fs.writeFileSync('/Users/owner/cybercheck-api-database/export-HAPPY_HOURS.csv', csv);
  console.log(`✓ ${(data || []).length} happy hours`);
}

async function exportSections() {
  console.log('📋 Exporting sections...');

  const { data } = await supabase
    .from('entity_sections')
    .select('id, entity_id, place_id, section_key, section_label, section_type, sort_order')
    .order('entity_id, sort_order');

  const columns = ['id', 'entity_id', 'place_id', 'section_key', 'section_label', 'section_type', 'sort_order'];

  const csv = arrayToCSV(data || [], columns);
  fs.writeFileSync('/Users/owner/cybercheck-api-database/export-SECTIONS.csv', csv);
  console.log(`✓ ${(data || []).length} sections`);
}

async function exportSectionContent() {
  console.log('📄 Exporting section content...');

  // Get all section types
  const sections = await supabase.from('entity_sections').select('id, section_type');

  const { data: richText } = await supabase.from('section_rich_text').select('section_id, body_text');
  const { data: bullets } = await supabase.from('section_bullets').select('section_id, bullet_text, sort_order');
  const { data: groups } = await supabase.from('section_groups').select('section_id, title, subtitle, sort_order');
  const { data: items } = await supabase.from('section_items').select('section_id, group_id, item_name, item_description, price_text, sort_order');
  const { data: cards } = await supabase.from('section_cards').select('section_id, title, subtitle, description, image_url, link_url, sort_order');
  const { data: photos } = await supabase.from('section_photos').select('section_id, image_url, caption, sort_order');
  const { data: reviews } = await supabase.from('section_reviews').select('section_id, author_name, rating, review_text, sort_order');
  const { data: hours } = await supabase.from('section_hours').select('section_id, day_of_week, open_time, close_time, is_closed');
  const { data: location } = await supabase.from('section_location').select('section_id, address_line_1, city, state, zip, latitude, longitude');

  let content = {
    rich_text: richText?.length || 0,
    bullets: bullets?.length || 0,
    groups: groups?.length || 0,
    items: items?.length || 0,
    cards: cards?.length || 0,
    photos: photos?.length || 0,
    reviews: reviews?.length || 0,
    hours: hours?.length || 0,
    location: location?.length || 0,
  };

  // Export rich_text
  if (richText && richText.length > 0) {
    const csv = arrayToCSV(richText, ['section_id', 'body_text']);
    fs.writeFileSync('/Users/owner/cybercheck-api-database/export-SECTIONS-RICH_TEXT.csv', csv);
  }

  // Export bullets
  if (bullets && bullets.length > 0) {
    const csv = arrayToCSV(bullets, ['section_id', 'bullet_text', 'sort_order']);
    fs.writeFileSync('/Users/owner/cybercheck-api-database/export-SECTIONS-BULLETS.csv', csv);
  }

  // Export items
  if (items && items.length > 0) {
    const csv = arrayToCSV(items, ['section_id', 'group_id', 'item_name', 'item_description', 'price_text', 'sort_order']);
    fs.writeFileSync('/Users/owner/cybercheck-api-database/export-SECTIONS-ITEMS.csv', csv);
  }

  console.log(`✓ Section content exported`);
  console.log(`  - Rich text: ${content.rich_text}`);
  console.log(`  - Bullets: ${content.bullets}`);
  console.log(`  - Groups: ${content.groups}`);
  console.log(`  - Items: ${content.items}`);
  console.log(`  - Cards: ${content.cards}`);
  console.log(`  - Photos: ${content.photos}`);
  console.log(`  - Reviews: ${content.reviews}`);
  console.log(`  - Hours: ${content.hours}`);
  console.log(`  - Location: ${content.location}`);
}

async function main() {
  console.log('🚀 EXPORTING ALL DATA TO CSV\n');
  console.log('═'.repeat(60));

  await exportEntities();
  await exportEvents();
  await exportSpecials();
  await exportHappyHours();
  await exportSections();
  await exportSectionContent();

  console.log('\n' + '═'.repeat(60));
  console.log('\n✅ COMPLETE\n');
  console.log('Files created:');
  console.log('  - export-ENTITIES.csv');
  console.log('  - export-EVENTS.csv');
  console.log('  - export-SPECIALS.csv');
  console.log('  - export-HAPPY_HOURS.csv');
  console.log('  - export-SECTIONS.csv');
  console.log('  - export-SECTIONS-RICH_TEXT.csv');
  console.log('  - export-SECTIONS-BULLETS.csv');
  console.log('  - export-SECTIONS-ITEMS.csv');
}

main().catch(console.error);

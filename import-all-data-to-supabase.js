#!/usr/bin/env node
/**
 * IMPORT ALL SCRAPED DATA TO SUPABASE
 * Handles menus, events, specials, happy hours
 * Matches by place_id or entity_id
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function importMenus() {
  console.log('\n📋 IMPORTING MENUS...');
  const menus = JSON.parse(fs.readFileSync('/Users/owner/cybercheck-api-database/menus-matched.json', 'utf8'));

  let count = 0;
  for (const menu of menus) {
    if (!menu.menu_data.menu_sections || menu.menu_data.menu_sections.length === 0) continue;

    try {
      for (const section of menu.menu_data.menu_sections) {
        // Create section
        const { data: sectionData, error: sectionError } = await supabase
          .from('entity_sections')
          .insert({
            entity_id: menu.entity_id,
            place_id: menu.place_id,
            section_key: section.section_name.toLowerCase().replace(/\s+/g, '-'),
            section_label: section.section_name,
            section_type: 'grouped_items',
          })
          .select('id')
          .single();

        if (sectionError) continue;

        // Create group
        const { data: groupData } = await supabase
          .from('section_groups')
          .insert({
            section_id: sectionData.id,
            title: section.section_name,
          })
          .select('id')
          .single();

        // Create items
        if (section.items) {
          const items = section.items.map((item, idx) => ({
            section_id: sectionData.id,
            group_id: groupData?.id,
            item_name: item.name,
            item_description: item.description || null,
            price_text: item.price || null,
            sort_order: idx,
          }));
          await supabase.from('section_items').insert(items);
          count++;
        }
      }
    } catch (e) {
      // continue
    }
  }
  console.log(`✓ Imported ${count} menu sections`);
}

async function importEvents() {
  console.log('\n🎵 IMPORTING EVENTS...');
  const events = JSON.parse(fs.readFileSync('/Users/owner/cybercheck-api-database/MASTER-BUSINESSES-WITH-EVENTS.json', 'utf8'));

  let count = 0;
  for (const business of events) {
    if (!business.events || business.events.length === 0) continue;

    // Get entity_id by place_id
    const { data: entity } = await supabase
      .from('entity')
      .select('id')
      .eq('place_id', business.place_id)
      .single();

    if (!entity) continue;

    for (const event of business.events) {
      try {
        await supabase
          .from('entity_events')
          .insert({
            entity_id: entity.id,
            place_id: business.place_id,
            event_name: event.event_name,
            artist_name: event.artist || null,
            event_date: event.start_date || null,
            ticket_url: event.ticket_url || null,
            is_active: true,
          });
        count++;
      } catch (e) {
        // continue
      }
    }
  }
  console.log(`✓ Imported ${count} events`);
}

async function importSpecials() {
  console.log('\n🎉 IMPORTING SPECIALS...');
  const specials = JSON.parse(fs.readFileSync('/Users/owner/cybercheck-api-database/restaurants-with-specials.json', 'utf8'));

  let count = 0;
  for (const restaurant of specials) {
    // Match by name to entity
    const { data: entity } = await supabase
      .from('entity')
      .select('id, place_id')
      .ilike('name', `%${restaurant.name.split(' ')[0]}%`)
      .limit(1)
      .single();

    if (!entity) continue;

    // Import happy hours if present
    if (restaurant.happyHour) {
      try {
        await supabase
          .from('entity_happy_hours')
          .insert({
            entity_id: entity.id,
            place_id: entity.place_id,
            days: 'daily',
            description: restaurant.happyHour,
            is_active: true,
          });
        count++;
      } catch (e) {
        // continue
      }
    }

    // Import specials from events field if present
    if (restaurant.events) {
      try {
        await supabase
          .from('entity_specials')
          .insert({
            entity_id: entity.id,
            place_id: entity.place_id,
            title: 'Special Offer',
            description: restaurant.events,
            type: 'event',
            is_active: true,
          });
        count++;
      } catch (e) {
        // continue
      }
    }
  }
  console.log(`✓ Imported ${count} specials/happy hours`);
}

async function main() {
  console.log('🚀 IMPORTING ALL DATA TO SUPABASE\n');

  await importMenus();
  await importEvents();
  await importSpecials();

  console.log('\n✅ Done!');
}

main().catch(console.error);

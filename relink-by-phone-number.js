#!/usr/bin/env node
/**
 * RELINK ORPHANED DATA BY PHONE NUMBER
 * Matches events, specials, happy hours to entities using phone numbers
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

function normalize(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

async function main() {
  console.log('📞 RELINKING BY PHONE NUMBER\n');

  // Build phone number to entity_id map
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name, phone')
    .eq('is_active', true)
    .not('phone', 'is', null);

  const phoneMap = {};
  (entities || []).forEach(e => {
    const normalized = normalize(e.phone);
    if (normalized) phoneMap[normalized] = { id: e.id, name: e.name };
  });

  console.log(`Entities with phone: ${Object.keys(phoneMap).length}\n`);

  // Try to extract phone numbers from event venue_location strings
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, venue_location');

  const activeIds = new Set((entities || []).map(e => e.id));
  let eventMatches = 0;

  for (const event of events || []) {
    if (activeIds.has(event.entity_id)) continue;
    if (!event.venue_location) continue;

    // Try to extract phone from venue_location string
    const phoneMatch = event.venue_location.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!phoneMatch) continue;

    const foundPhone = normalize(phoneMatch[0]);
    const matchedEntity = phoneMap[foundPhone];

    if (matchedEntity) {
      const { error } = await supabase
        .from('entity_events')
        .update({ entity_id: matchedEntity.id })
        .eq('id', event.id);

      if (!error) {
        eventMatches++;
        if (eventMatches <= 5) {
          console.log(`✓ Event matched: ${event.venue_location} → ${matchedEntity.name}`);
        }
      }
    }
  }

  console.log(`\n📅 EVENTS relinked by phone: ${eventMatches}`);

  // Same for specials - check if we can extract phone
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, title');

  let specialMatches = 0;

  for (const special of specials || []) {
    if (activeIds.has(special.entity_id)) continue;

    // Try title
    const phoneMatch = special.title.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!phoneMatch) continue;

    const foundPhone = normalize(phoneMatch[0]);
    const matchedEntity = phoneMap[foundPhone];

    if (matchedEntity) {
      const { error } = await supabase
        .from('entity_specials')
        .update({ entity_id: matchedEntity.id })
        .eq('id', special.id);

      if (!error) specialMatches++;
    }
  }

  console.log(`🎉 SPECIALS relinked by phone: ${specialMatches}`);

  // Same for happy hours
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, description');

  let hhMatches = 0;

  for (const h of hh || []) {
    if (activeIds.has(h.entity_id)) continue;
    if (!h.description) continue;

    const phoneMatch = h.description.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    if (!phoneMatch) continue;

    const foundPhone = normalize(phoneMatch[0]);
    const matchedEntity = phoneMap[foundPhone];

    if (matchedEntity) {
      const { error } = await supabase
        .from('entity_happy_hours')
        .update({ entity_id: matchedEntity.id })
        .eq('id', h.id);

      if (!error) hhMatches++;
    }
  }

  console.log(`🍻 HAPPY HOURS relinked by phone: ${hhMatches}`);

  console.log(`\n✅ Total relinked: ${eventMatches + specialMatches + hhMatches}`);
}

main().catch(console.error);

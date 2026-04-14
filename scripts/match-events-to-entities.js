#!/usr/bin/env node
// Match standalone events (entity_id=null) to entities by venue name
// Updates entity_id so profile links and images load on the events page

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

// City-only names that should never be treated as venue names
const CITY_BLACKLIST = new Set([
  'foley','orange beach','gulf shores','perdido key','fairhope','pensacola',
  'bon secour','josephine','lillian','elberta','fort morgan','innerarity point',
  'gulf shores al','orange beach al',
]);

// Normalize a name for fuzzy matching
function norm(s) {
  return (s || '').toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two strings are a strong enough match
function isMatch(venueName, entityName) {
  const v = norm(venueName);
  const e = norm(entityName);
  if (!v || !e) return false;
  // Skip city-only names — they are not venues
  if (CITY_BLACKLIST.has(v)) return false;
  // Must be at least 5 chars to match
  if (v.length < 5) return false;
  if (v === e) return true;
  // Lulu's variations
  if (v.startsWith("lulu") && e.startsWith("lulu")) return true;
  // Tacky Jacks
  if (v.includes('tacky jack') && e.includes('tacky jack')) return true;
  // One contains the other (min 6 chars to avoid false positives)
  if (v.length >= 6 && e.includes(v)) return true;
  if (e.length >= 6 && v.includes(e)) return true;
  // First 3 words match (min 8 chars combined)
  const vWords = v.split(' ').slice(0, 3).join(' ');
  const eWords = e.split(' ').slice(0, 3).join(' ');
  if (vWords.length >= 8 && vWords === eWords) return true;
  return false;
}

async function main() {
  // Get all active entities
  const { data: entities, error: entErr } = await supabase
    .from('entity')
    .select('id, name, slug, city, hero_image_url, entity_subtype')
    .eq('is_active', true);

  if (entErr) { console.error('Entities error:', entErr.message); process.exit(1); }
  console.log(`Loaded ${entities.length} entities\n`);

  // Get all standalone events (entity_id = null) with dates
  const { data: events, error: evErr } = await supabase
    .from('entity_events')
    .select('id, event_name, venue_location, entity_id')
    .is('entity_id', null)
    .not('event_date', 'is', null);

  if (evErr) { console.error('Events error:', evErr.message); process.exit(1); }
  console.log(`Found ${events.length} standalone events to match\n`);

  const matched = [];
  const unmatched = [];

  for (const ev of events) {
    const venueName = (ev.venue_location || '').split(',')[0].trim();
    if (!venueName) { unmatched.push(ev); continue; }

    const entity = entities.find(e => isMatch(venueName, e.name));
    if (entity) {
      matched.push({ eventId: ev.id, entityId: entity.id, venue: venueName, entity: entity.name, city: entity.city });
    } else {
      unmatched.push({ venue: venueName, event: ev.event_name });
    }
  }

  console.log(`Matched: ${matched.length} | Unmatched: ${unmatched.length}\n`);

  // Show matches for review
  console.log('MATCHES:');
  matched.forEach(m => console.log(`  ✓ "${m.venue}" → ${m.entity} (${m.city})`));

  // Show top unmatched venues (grouped)
  const unmatchedVenues = {};
  unmatched.forEach(u => { if (u.venue) unmatchedVenues[u.venue] = (unmatchedVenues[u.venue] || 0) + 1; });
  const topUnmatched = Object.entries(unmatchedVenues).sort((a,b)=>b[1]-a[1]).slice(0,20);
  console.log('\nTOP UNMATCHED VENUES (not in entity DB):');
  topUnmatched.forEach(([v, c]) => console.log(`  ${String(c).padStart(2)}x  ${v}`));

  // Update matched events
  if (matched.length === 0) { console.log('\nNothing to update.'); return; }

  console.log(`\nUpdating ${matched.length} events...`);
  let updated = 0;
  for (const m of matched) {
    const { error } = await supabase
      .from('entity_events')
      .update({ entity_id: m.entityId })
      .eq('id', m.eventId);
    if (error) console.error(`  Failed ${m.eventId}:`, error.message);
    else updated++;
  }

  console.log(`\nDone. Updated ${updated} events with entity links.`);
  console.log(`${unmatched.length - Object.keys(unmatchedVenues).length + Object.keys(unmatchedVenues).length} events remain standalone (venue not in DB).`);
}

main().catch(console.error);

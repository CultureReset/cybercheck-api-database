#!/usr/bin/env node
// Normalize all entity_tags in GCR DB
// - Converts all variations to underscore_format
// - Merges duplicates (live-music + live_music + live music → live_music)
// - Removes garbage tags (long sentences, duration strings, etc.)
// - No deletes from entity, no changes to old DB

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

// ── Normalization rules ──────────────────────────────────────────────────────
// Maps any variation → canonical underscore tag
const CANONICAL = {
  // Live music
  'live-music': 'live_music',
  'live music': 'live_music',
  'livemusic': 'live_music',

  // Family / kids
  'family-friendly': 'family_friendly',
  'family friendly': 'family_friendly',
  'kids-friendly': 'kids_friendly',
  'kid-friendly': 'kids_friendly',
  'kid friendly': 'kids_friendly',
  'family fun': 'family_fun',
  'family-fun': 'family_fun',
  'great experience for all ages': 'family_friendly',
  'great activity for ages 6+': 'family_friendly',
  'great activity for the whole family': 'family_friendly',
  'great experience for the entire family': 'family_friendly',

  // Happy hour
  'happy-hour': 'happy_hour',
  'happy hour': 'happy_hour',

  // Water sports
  'water-sports': 'water_sports',
  'water sports': 'water_sports',
  'watersports': 'water_sports',

  // Boat rental
  'boat-rental': 'boat_rental',
  'boat rentals': 'boat_rental',
  'boat-rentals': 'boat_rental',

  // Jet ski
  'jet-ski': 'jet_ski',
  'jet ski': 'jet_ski',
  'jet ski rentals & tours': 'jet_ski',
  'jet ski rentals': 'jet_ski',
  'jet-ski-rentals': 'jet_ski',

  // Dining
  'casual-dining': 'casual_dining',
  'casual dining': 'casual_dining',
  'fine-dining': 'fine_dining',
  'fine dining': 'fine_dining',
  'waterfront-dining': 'waterfront_dining',
  'waterfront dining': 'waterfront_dining',

  // Pet friendly
  'pet-friendly': 'pet_friendly',
  'pet friendly': 'pet_friendly',

  // Outdoor
  'outdoor-seating': 'outdoor_seating',
  'outdoor seating': 'outdoor_seating',

  // Locations (keep as area tags)
  'gulf-shores': 'gulf_shores',
  'orange-beach': 'orange_beach',
  'perdido-key': 'perdido_key',
  'gulf-coast': 'gulf_coast',

  // Dolphin
  'dolphin cruises & tours': 'dolphin_cruises',
  'dolphin-cruises': 'dolphin_cruises',
  'dolphin cruises': 'dolphin_cruises',

  // Sunset
  'sunset cruises & tours': 'sunset_cruises',
  'sunset-cruises': 'sunset_cruises',

  // Parasailing
  'parasailing': 'parasailing',

  // Pontoon
  'pontoon': 'pontoon_rental',

  // Boat tours
  'boat tours': 'boat_tours',
  'boat-tours': 'boat_tours',

  // Sailing
  'sailing': 'sailing',

  // Banana boat
  'banana boat rides': 'banana_boat',
  'banana-boat': 'banana_boat',

  // Kayak / paddle
  'canoe, kayak & paddleboard rentals': 'kayak_rental',
  'kayak rental': 'kayak_rental',
  'kayak-rental': 'kayak_rental',

  // Seafood
  'seafood': 'seafood',
  'fresh-catch': 'fresh_catch',
  'oysters': 'oysters',
  'shrimp': 'shrimp',

  // Food
  'burgers': 'burgers',
  'steaks': 'steaks',
  'lunch': 'lunch',
  'brunch': 'brunch',
  'breakfast': 'breakfast',
  'dinner': 'dinner',
  'dining': 'dining',

  // Drinks
  'cocktails': 'cocktails',
  'full-bar': 'full_bar',
  'full bar': 'full_bar',

  // Vibe
  'date night': 'date_night',
  'date-night': 'date_night',
  'thrill': 'thrill_seekers',
  'thrill-seekers': 'thrill_seekers',

  // Kids menu
  'kids menu': 'kids_menu',
  'kids-menu': 'kids_menu',

  // Other amenities
  'waterfront': 'waterfront',
  'shopping': 'shopping',
  'apparel': 'apparel',
  'gift-cards': 'gift_cards',
  'family-owned': 'family_owned',
  'restaurant': 'restaurant',
};

// Tags to DELETE outright — long sentences, duration strings, junk
const GARBAGE_PATTERNS = [
  /^\d+(\.\d+)?\s*-?\s*\d*\s*hrs?\.?$/i,  // "4 - 8 hrs." "1.5 hrs." "2 hrs."
  /^\d+\s*-\s*\d+\s*hrs?\.?$/i,
  /^(choose from|see the|explore|search for|friendly &|bimini|maps &|noise|fast accel|short no wake|get out on|see dolphins|be the captain|keep an eye|cruise the|enjoy time|just \d+|highly experienced|swim in the|professional &|located at)/i,
];

function isGarbage(tag) {
  return GARBAGE_PATTERNS.some(p => p.test(tag.trim()));
}

function normalize(tag) {
  const t = tag.trim().toLowerCase();
  if (CANONICAL[t]) return CANONICAL[t];
  // Auto-normalize: replace hyphens/spaces with underscores, collapse spaces
  return t.replace(/[\s\-]+/g, '_').replace(/_+/g, '_').replace(/[^a-z0-9_]/g, '');
}

async function main() {
  console.log('Loading all tags...');
  const { data: tags, error } = await gcr.from('entity_tags').select('id, entity_id, tag, tag_category');
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`Total tags: ${tags.length}`);

  let deleted = 0, updated = 0, skipped = 0, merged = 0;

  // Group by entity_id to detect duplicates after normalization
  const byEntity = {};
  tags.forEach(t => {
    if (!byEntity[t.entity_id]) byEntity[t.entity_id] = [];
    byEntity[t.entity_id].push(t);
  });

  for (const [entityId, entityTags] of Object.entries(byEntity)) {
    const seen = new Set(); // canonical tags already processed for this entity

    for (const t of entityTags) {
      // Delete garbage
      if (isGarbage(t.tag)) {
        await gcr.from('entity_tags').delete().eq('id', t.id);
        deleted++;
        continue;
      }

      const canonical = normalize(t.tag);

      // If canonical is empty after normalization, delete
      if (!canonical || canonical.length < 2) {
        await gcr.from('entity_tags').delete().eq('id', t.id);
        deleted++;
        continue;
      }

      // If this entity already has this canonical tag, delete the duplicate
      if (seen.has(canonical)) {
        await gcr.from('entity_tags').delete().eq('id', t.id);
        merged++;
        continue;
      }

      seen.add(canonical);

      // If tag needs updating
      if (canonical !== t.tag) {
        await gcr.from('entity_tags').update({ tag: canonical }).eq('id', t.id);
        updated++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`\nDone:`);
  console.log(`  Updated (normalized): ${updated}`);
  console.log(`  Merged (duplicates removed): ${merged}`);
  console.log(`  Deleted (garbage): ${deleted}`);
  console.log(`  Unchanged: ${skipped}`);

  // Show final top tags
  console.log('\nTop tags after normalization:');
  const { data: final } = await gcr.from('entity_tags').select('tag');
  const counts = {};
  final.forEach(r => { counts[r.tag] = (counts[r.tag]||0)+1; });
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([t,c]) => console.log(`  ${c}\t${t}`));
}

main().catch(console.error);

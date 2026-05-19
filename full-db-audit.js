require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function audit() {
  console.log('🔍 FULL DATABASE AUDIT\n');
  console.log('═'.repeat(60));

  // Entity counts by status
  const { count: totalEntities } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true });

  const { count: activeEntities } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: gcr_listed } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true })
    .eq('gcr_listed', true);

  console.log('\n📊 ENTITIES');
  console.log(`  Total: ${totalEntities}`);
  console.log(`  Active (is_active=true): ${activeEntities}`);
  console.log(`  GCR Listed (gcr_listed=true): ${gcr_listed}`);

  // Sample entity
  const { data: sample } = await supabase
    .from('entity')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (sample) {
    console.log(`\n📍 SAMPLE ENTITY: ${sample.name}`);
    console.log(`  ID: ${sample.id}`);
    console.log(`  Slug: ${sample.slug}`);
    console.log(`  Place ID: ${sample.place_id}`);
    console.log(`  Type: ${sample.entity_type} / ${sample.entity_subtype}`);
    console.log(`  Phone: ${sample.phone || 'none'}`);
    console.log(`  Address: ${sample.address_line_1 || 'none'}`);
    console.log(`  Lat/Lng: ${sample.latitude}/${sample.longitude}`);
    console.log(`  Hero Image: ${sample.hero_image_url ? 'YES' : 'NO'}`);
    console.log(`  Rating: ${sample.rating}`);
    console.log(`  Description: ${sample.description ? sample.description.substring(0, 80) + '...' : 'NONE'}`);
    console.log(`  GCR Listed: ${sample.gcr_listed}`);

    // What content exists for this entity?
    const eid = sample.id;
    const [sections, features, tags, media, events, specials, hh, reviews, hours] = await Promise.all([
      supabase.from('entity_sections').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_features').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_tags').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_media').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_events').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_specials').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_happy_hours').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('entity_reviews').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
      supabase.from('section_hours').select('*', { count: 'exact', head: true }).eq('entity_id', eid),
    ]);

    console.log(`\n📋 CONTENT FOR THIS ENTITY:`);
    console.log(`  Sections: ${sections.count}`);
    console.log(`  Features: ${features.count}`);
    console.log(`  Tags: ${tags.count}`);
    console.log(`  Media: ${media.count}`);
    console.log(`  Events: ${events.count}`);
    console.log(`  Specials: ${specials.count}`);
    console.log(`  Happy Hours: ${hh.count}`);
    console.log(`  Reviews: ${reviews.count}`);
    console.log(`  Hours: ${hours.count}`);
  }

  // Global content counts
  console.log(`\n🌍 GLOBAL CONTENT COUNTS`);
  const [
    sectionCount, featureCount, tagCount, mediaCount,
    eventCount, specialCount, hhCount, reviewCount, hhItemCount
  ] = await Promise.all([
    supabase.from('entity_sections').select('*', { count: 'exact', head: true }),
    supabase.from('entity_features').select('*', { count: 'exact', head: true }),
    supabase.from('entity_tags').select('*', { count: 'exact', head: true }),
    supabase.from('entity_media').select('*', { count: 'exact', head: true }),
    supabase.from('entity_events').select('*', { count: 'exact', head: true }),
    supabase.from('entity_specials').select('*', { count: 'exact', head: true }),
    supabase.from('entity_happy_hours').select('*', { count: 'exact', head: true }),
    supabase.from('entity_reviews').select('*', { count: 'exact', head: true }),
    supabase.from('happy_hour_items').select('*', { count: 'exact', head: true }),
  ]);

  console.log(`  Sections: ${sectionCount.count}`);
  console.log(`  Features: ${featureCount.count}`);
  console.log(`  Tags: ${tagCount.count}`);
  console.log(`  Media: ${mediaCount.count}`);
  console.log(`  Events: ${eventCount.count}`);
  console.log(`  Specials: ${specialCount.count}`);
  console.log(`  Happy Hours: ${hhCount.count}`);
  console.log(`  Reviews: ${reviewCount.count}`);
  console.log(`  HH Items: ${hhItemCount.count}`);

  // Check what's being displayed (is_active + gcr_listed)
  console.log(`\n🚀 WHAT DISPLAYS ON FRONTEND`);
  const { count: displayCount } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('gcr_listed', true);

  console.log(`  Entities that display: ${displayCount}`);
  console.log(`  (is_active=true AND gcr_listed=true)`);

  console.log('\n' + '═'.repeat(60));
}

audit().catch(e => console.error(e.message));

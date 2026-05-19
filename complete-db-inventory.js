require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function inventory() {
  console.log('\n📦 COMPLETE DATABASE INVENTORY\n');
  console.log('═'.repeat(80));

  // === ENTITIES ===
  const { count: totalEntities } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true });

  const { count: activeEntities } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { data: entitySample } = await supabase
    .from('entity')
    .select('id, name, slug, place_id, phone, address_line_1, city, rating, hero_image_url')
    .eq('is_active', true)
    .limit(3);

  console.log('\n🏢 ENTITY TABLE');
  console.log('─'.repeat(80));
  console.log(`Total entities: ${totalEntities}`);
  console.log(`Active (is_active=true): ${activeEntities}`);
  console.log(`\nSample entities:`);
  (entitySample || []).forEach(e => {
    console.log(`  • ${e.name}`);
    console.log(`    ID: ${e.id}`);
    console.log(`    Slug: ${e.slug}`);
    console.log(`    Place ID: ${e.place_id}`);
    console.log(`    Phone: ${e.phone || 'none'}`);
    console.log(`    Address: ${e.address_line_1 || 'none'}`);
    console.log(`    City: ${e.city}`);
    console.log(`    Rating: ${e.rating}`);
  });

  // === ENTITY TAGS ===
  const { count: tagCount } = await supabase
    .from('entity_tags')
    .select('*', { count: 'exact', head: true });

  const { data: tagSample } = await supabase
    .from('entity_tags')
    .select('entity_id, tag, tag_category')
    .limit(5);

  console.log('\n\n🏷️  ENTITY TAGS');
  console.log('─'.repeat(80));
  console.log(`Total tags: ${tagCount}`);
  console.log(`\nSample tags:`);
  (tagSample || []).forEach(t => {
    console.log(`  • ${t.tag} (${t.tag_category})`);
  });

  // === ENTITY FEATURES ===
  const { count: featureCount } = await supabase
    .from('entity_features')
    .select('*', { count: 'exact', head: true });

  console.log('\n\n✨ ENTITY FEATURES');
  console.log('─'.repeat(80));
  console.log(`Total features: ${featureCount}`);

  // === EVENTS ===
  const { count: eventCount } = await supabase
    .from('entity_events')
    .select('*', { count: 'exact', head: true });

  const { count: activeEventCount } = await supabase
    .from('entity_events')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { data: eventSample } = await supabase
    .from('entity_events')
    .select('id, event_name, artist_name, event_date, start_time, venue_location')
    .eq('is_active', true)
    .order('event_date', { ascending: false })
    .limit(3);

  console.log('\n\n📅 EVENTS');
  console.log('─'.repeat(80));
  console.log(`Total events: ${eventCount}`);
  console.log(`Active events: ${activeEventCount}`);
  console.log(`\nUpcoming events:`);
  (eventSample || []).forEach(e => {
    console.log(`  • ${e.event_name}`);
    console.log(`    Artist: ${e.artist_name || 'N/A'}`);
    console.log(`    Date: ${e.event_date}`);
    console.log(`    Time: ${e.start_time}`);
    console.log(`    Venue: ${e.venue_location}`);
  });

  // === SPECIALS ===
  const { count: specialCount } = await supabase
    .from('entity_specials')
    .select('*', { count: 'exact', head: true });

  const { count: activeSpecialCount } = await supabase
    .from('entity_specials')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { data: specialSample } = await supabase
    .from('entity_specials')
    .select('id, title, description, type, day_of_week, discount')
    .eq('is_active', true)
    .limit(3);

  console.log('\n\n🎉 SPECIALS');
  console.log('─'.repeat(80));
  console.log(`Total specials: ${specialCount}`);
  console.log(`Active specials: ${activeSpecialCount}`);
  console.log(`\nSample specials:`);
  (specialSample || []).forEach(s => {
    console.log(`  • ${s.title}`);
    console.log(`    Description: ${s.description || 'N/A'}`);
    console.log(`    Type: ${s.type || 'N/A'}`);
    console.log(`    Day: ${s.day_of_week || 'N/A'}`);
    console.log(`    Discount: ${s.discount || 'N/A'}`);
  });

  // === HAPPY HOURS ===
  const { count: hhCount } = await supabase
    .from('entity_happy_hours')
    .select('*', { count: 'exact', head: true });

  const { data: hhSample } = await supabase
    .from('entity_happy_hours')
    .select('id, days, start_time, end_time, description')
    .limit(3);

  console.log('\n\n🍻 HAPPY HOURS');
  console.log('─'.repeat(80));
  console.log(`Total happy hours: ${hhCount}`);
  console.log(`\nSample happy hours:`);
  (hhSample || []).forEach(h => {
    console.log(`  • Days: ${h.days}`);
    console.log(`    Time: ${h.start_time} - ${h.end_time}`);
    console.log(`    Description: ${h.description}`);
  });

  // === SECTIONS ===
  const { count: sectionCount } = await supabase
    .from('entity_sections')
    .select('*', { count: 'exact', head: true });

  const { data: sectionTypes } = await supabase
    .from('entity_sections')
    .select('section_type')
    .order('section_type');

  const typeCount = {};
  (sectionTypes || []).forEach(s => {
    typeCount[s.section_type] = (typeCount[s.section_type] || 0) + 1;
  });

  console.log('\n\n📋 SECTIONS');
  console.log('─'.repeat(80));
  console.log(`Total sections: ${sectionCount}`);
  console.log(`By type:`);
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`  • ${type}: ${count}`);
  });

  // === SECTION CONTENT ===
  const { count: richTextCount } = await supabase
    .from('section_rich_text')
    .select('*', { count: 'exact', head: true });

  const { count: bulletsCount } = await supabase
    .from('section_bullets')
    .select('*', { count: 'exact', head: true });

  const { count: groupsCount } = await supabase
    .from('section_groups')
    .select('*', { count: 'exact', head: true });

  const { count: itemsCount } = await supabase
    .from('section_items')
    .select('*', { count: 'exact', head: true });

  const { count: photosCount } = await supabase
    .from('section_photos')
    .select('*', { count: 'exact', head: true });

  const { count: reviewsCount } = await supabase
    .from('section_reviews')
    .select('*', { count: 'exact', head: true });

  const { count: hoursCount } = await supabase
    .from('section_hours')
    .select('*', { count: 'exact', head: true });

  console.log('\n\n📄 SECTION CONTENT');
  console.log('─'.repeat(80));
  console.log(`Rich text blocks: ${richTextCount}`);
  console.log(`Bullet points: ${bulletsCount}`);
  console.log(`Groups: ${groupsCount}`);
  console.log(`Items (menu, etc): ${itemsCount}`);
  console.log(`Photos: ${photosCount}`);
  console.log(`Reviews: ${reviewsCount}`);
  console.log(`Hours: ${hoursCount}`);

  // === MEDIA ===
  const { count: mediaCount } = await supabase
    .from('entity_media')
    .select('*', { count: 'exact', head: true });

  console.log('\n\n🖼️  MEDIA');
  console.log('─'.repeat(80));
  console.log(`Total media files: ${mediaCount}`);

  // === REVIEWS ===
  const { count: reviewsTableCount } = await supabase
    .from('entity_reviews')
    .select('*', { count: 'exact', head: true });

  console.log('\n\n⭐ REVIEWS');
  console.log('─'.repeat(80));
  console.log(`Total reviews: ${reviewsTableCount}`);

  // === GRAND TOTAL ===
  console.log('\n\n' + '═'.repeat(80));
  console.log('\n📊 GRAND TOTAL\n');

  const grandTotal = totalEntities + eventCount + specialCount + hhCount + 
                     sectionCount + bulletsCount + itemsCount + mediaCount + 
                     tagCount + featureCount + reviewsTableCount;

  console.log(`Entities: ${totalEntities}`);
  console.log(`Events: ${eventCount}`);
  console.log(`Specials: ${specialCount}`);
  console.log(`Happy Hours: ${hhCount}`);
  console.log(`Sections: ${sectionCount}`);
  console.log(`Bullets: ${bulletsCount}`);
  console.log(`Items: ${itemsCount}`);
  console.log(`Media: ${mediaCount}`);
  console.log(`Tags: ${tagCount}`);
  console.log(`Features: ${featureCount}`);
  console.log(`Reviews: ${reviewsTableCount}`);
  console.log(`\n─────────────`);
  console.log(`TOTAL RECORDS: ${grandTotal}`);
  console.log('\n' + '═'.repeat(80));
}

inventory().catch(console.error);

#!/usr/bin/env node
/**
 * COMPREHENSIVE DATA AUDIT
 * Compare all entities with all associated data
 * Shows matches, orphans, coverage, and data quality
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function audit() {
  console.log('🔍 COMPREHENSIVE DATA AUDIT\n');
  console.log('═'.repeat(70));

  // === ENTITIES ===
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name, phone, address_line_1, description, hero_image_url, place_id')
    .eq('is_active', true);

  const totalEntities = entities?.length || 0;
  const activeIds = new Set((entities || []).map(e => e.id));

  console.log(`\n📊 ENTITIES: ${totalEntities}`);
  console.log('─'.repeat(70));

  // Analyze entity data quality
  const withPhone = (entities || []).filter(e => e.phone && e.phone.trim()).length;
  const withAddress = (entities || []).filter(e => e.address_line_1).length;
  const withDesc = (entities || []).filter(e => e.description).length;
  const withImage = (entities || []).filter(e => e.hero_image_url).length;
  const withPlaceId = (entities || []).filter(e => e.place_id).length;

  console.log(`Phone: ${withPhone}/${totalEntities} (${((withPhone/totalEntities)*100).toFixed(1)}%)`);
  console.log(`Address: ${withAddress}/${totalEntities} (${((withAddress/totalEntities)*100).toFixed(1)}%)`);
  console.log(`Description: ${withDesc}/${totalEntities} (${((withDesc/totalEntities)*100).toFixed(1)}%)`);
  console.log(`Hero Image: ${withImage}/${totalEntities} (${((withImage/totalEntities)*100).toFixed(1)}%)`);
  console.log(`Place ID: ${withPlaceId}/${totalEntities} (${((withPlaceId/totalEntities)*100).toFixed(1)}%)`);

  // === EVENTS ===
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, artist_name, event_date, place_id');

  const totalEvents = events?.length || 0;
  const eventsWithActive = (events || []).filter(e => activeIds.has(e.entity_id)).length;
  const eventsOrphaned = totalEvents - eventsWithActive;

  console.log(`\n📅 EVENTS: ${totalEvents}`);
  console.log('─'.repeat(70));
  console.log(`Tied to active entities: ${eventsWithActive}/${totalEvents}`);
  console.log(`Orphaned: ${eventsOrphaned}/${totalEvents}`);
  console.log(`Coverage: ${((eventsWithActive/totalEvents)*100).toFixed(1)}%`);

  // === SPECIALS ===
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, title, place_id');

  const totalSpecials = specials?.length || 0;
  const specialsWithActive = (specials || []).filter(s => activeIds.has(s.entity_id)).length;
  const specialsOrphaned = totalSpecials - specialsWithActive;

  console.log(`\n🎉 SPECIALS: ${totalSpecials}`);
  console.log('─'.repeat(70));
  console.log(`Tied to active entities: ${specialsWithActive}/${totalSpecials}`);
  console.log(`Orphaned: ${specialsOrphaned}/${totalSpecials}`);
  console.log(`Coverage: ${((specialsWithActive/totalSpecials)*100).toFixed(1)}%`);

  // === HAPPY HOURS ===
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, days, place_id');

  const totalHH = hh?.length || 0;
  const hhWithActive = (hh || []).filter(h => activeIds.has(h.entity_id)).length;
  const hhOrphaned = totalHH - hhWithActive;

  console.log(`\n🍻 HAPPY HOURS: ${totalHH}`);
  console.log('─'.repeat(70));
  console.log(`Tied to active entities: ${hhWithActive}/${totalHH}`);
  console.log(`Orphaned: ${hhOrphaned}/${totalHH}`);
  console.log(`Coverage: ${((hhWithActive/totalHH)*100).toFixed(1)}%`);

  // === SECTIONS ===
  const { data: sections } = await supabase
    .from('entity_sections')
    .select('id, entity_id, section_type, place_id');

  const totalSections = sections?.length || 0;
  const sectionsWithActive = (sections || []).filter(s => activeIds.has(s.entity_id)).length;
  const sectionsOrphaned = totalSections - sectionsWithActive;

  // Count by type
  const sectionsByType = {};
  (sections || []).forEach(s => {
    sectionsByType[s.section_type] = (sectionsByType[s.section_type] || 0) + 1;
  });

  console.log(`\n📋 SECTIONS: ${totalSections}`);
  console.log('─'.repeat(70));
  console.log(`Tied to active entities: ${sectionsWithActive}/${totalSections}`);
  console.log(`Orphaned: ${sectionsOrphaned}/${totalSections}`);
  console.log(`Coverage: ${((sectionsWithActive/totalSections)*100).toFixed(1)}%`);
  console.log(`By type:`);
  Object.entries(sectionsByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });

  // === SUMMARY ===
  console.log(`\n${'═'.repeat(70)}`);
  console.log('\n📈 SUMMARY:\n');

  const totalData = totalEntities + totalEvents + totalSpecials + totalHH + totalSections;
  const linkedData = totalEntities + eventsWithActive + specialsWithActive + hhWithActive + sectionsWithActive;
  const orphanedData = eventsOrphaned + specialsOrphaned + hhOrphaned + sectionsOrphaned;

  console.log(`Total records: ${totalData}`);
  console.log(`Properly linked: ${linkedData} (${((linkedData/totalData)*100).toFixed(1)}%)`);
  console.log(`Orphaned: ${orphanedData} (${((orphanedData/totalData)*100).toFixed(1)}%)`);

  // === ENTITY COVERAGE ===
  console.log(`\n📊 ENTITY CONTENT COVERAGE:\n`);

  const entitiesWithContent = new Set([
    ...eventsWithActive > 0 ? (events || []).filter(e => activeIds.has(e.entity_id)).map(e => e.entity_id) : [],
    ...specialsWithActive > 0 ? (specials || []).filter(s => activeIds.has(s.entity_id)).map(s => s.entity_id) : [],
    ...hhWithActive > 0 ? (hh || []).filter(h => activeIds.has(h.entity_id)).map(h => h.entity_id) : [],
    ...sectionsWithActive > 0 ? (sections || []).filter(s => activeIds.has(s.entity_id)).map(s => s.entity_id) : [],
  ]);

  const entitiesWithoutContent = totalEntities - entitiesWithContent.size;

  console.log(`Entities WITH content: ${entitiesWithContent.size}/${totalEntities} (${((entitiesWithContent.size/totalEntities)*100).toFixed(1)}%)`);
  console.log(`Entities WITHOUT content: ${entitiesWithoutContent}/${totalEntities} (${((entitiesWithoutContent/totalEntities)*100).toFixed(1)}%)`);

  // === SAVE REPORT ===
  const report = `COMPREHENSIVE DATA AUDIT REPORT
Generated: ${new Date().toISOString()}

═══════════════════════════════════════════════════════════════

ENTITIES: ${totalEntities}
  Phone: ${withPhone}/${totalEntities} (${((withPhone/totalEntities)*100).toFixed(1)}%)
  Address: ${withAddress}/${totalEntities} (${((withAddress/totalEntities)*100).toFixed(1)}%)
  Description: ${withDesc}/${totalEntities} (${((withDesc/totalEntities)*100).toFixed(1)}%)
  Hero Image: ${withImage}/${totalEntities} (${((withImage/totalEntities)*100).toFixed(1)}%)
  Place ID: ${withPlaceId}/${totalEntities} (${((withPlaceId/totalEntities)*100).toFixed(1)}%)

EVENTS: ${totalEvents}
  Tied to active: ${eventsWithActive}/${totalEvents}
  Orphaned: ${eventsOrphaned}/${totalEvents}
  Coverage: ${((eventsWithActive/totalEvents)*100).toFixed(1)}%

SPECIALS: ${totalSpecials}
  Tied to active: ${specialsWithActive}/${totalSpecials}
  Orphaned: ${specialsOrphaned}/${totalSpecials}
  Coverage: ${((specialsWithActive/totalSpecials)*100).toFixed(1)}%

HAPPY HOURS: ${totalHH}
  Tied to active: ${hhWithActive}/${totalHH}
  Orphaned: ${hhOrphaned}/${totalHH}
  Coverage: ${((hhWithActive/totalHH)*100).toFixed(1)}%

SECTIONS: ${totalSections}
  Tied to active: ${sectionsWithActive}/${totalSections}
  Orphaned: ${sectionsOrphaned}/${totalSections}
  Coverage: ${((sectionsWithActive/totalSections)*100).toFixed(1)}%

SUMMARY:
  Total records: ${totalData}
  Properly linked: ${linkedData} (${((linkedData/totalData)*100).toFixed(1)}%)
  Orphaned: ${orphanedData} (${((orphanedData/totalData)*100).toFixed(1)}%)

ENTITY CONTENT COVERAGE:
  With content: ${entitiesWithContent.size}/${totalEntities} (${((entitiesWithContent.size/totalEntities)*100).toFixed(1)}%)
  Without content: ${entitiesWithoutContent}/${totalEntities} (${((entitiesWithoutContent/totalEntities)*100).toFixed(1)}%)
`;

  fs.writeFileSync('/Users/owner/cybercheck-api-database/DATA-AUDIT-REPORT.txt', report);

  console.log(`\n✅ Report saved: DATA-AUDIT-REPORT.txt`);
}

audit().catch(console.error);

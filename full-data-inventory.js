require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');

async function getFullInventory() {
  try {
    const db = getGcrDb();

    console.log('📊 COMPLETE GCR DATABASE INVENTORY\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Count entities
    const { data: entities, count: entityCount } = await db
      .from('entity')
      .select('id', { count: 'exact' });

    console.log(`🏢 ENTITIES: ${entityCount}\n`);

    // Count by section type
    const { data: sections } = await db
      .from('entity_sections')
      .select('section_type');

    const sectionCounts = {};
    sections?.forEach(s => {
      sectionCounts[s.section_type] = (sectionCounts[s.section_type] || 0) + 1;
    });

    console.log('📚 SECTIONS BY TYPE:\n');
    Object.entries(sectionCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Count section items by type
    const { data: items } = await db
      .from('section_items')
      .select('item_type');

    const itemCounts = {};
    items?.forEach(i => {
      itemCounts[i.item_type] = (itemCounts[i.item_type] || 0) + 1;
    });

    console.log(`\n🍽️  MENU ITEMS BY TYPE:\n`);
    Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    const totalMenuItems = Object.values(itemCounts).reduce((a, b) => a + b, 0);
    console.log(`\n  TOTAL ITEMS: ${totalMenuItems}\n`);

    // Count specials
    const { count: specialCount } = await db
      .from('entity_specials')
      .select('id', { count: 'exact' });

    console.log(`🎯 SPECIALS: ${specialCount}\n`);

    // Count events
    const { count: eventCount } = await db
      .from('entity_events')
      .select('id', { count: 'exact' });

    console.log(`🎪 EVENTS: ${eventCount}\n`);

    // Count happy hour items
    const { data: hhItems } = await db
      .from('section_items')
      .select('*')
      .eq('item_type', 'hh_item');

    console.log(`🍻 HAPPY HOUR ITEMS: ${hhItems?.length || 0}\n`);

    // Count features, tags, perfect_for
    const { count: featureCount } = await db
      .from('entity_features')
      .select('id', { count: 'exact' });

    const { count: tagCount } = await db
      .from('entity_tags')
      .select('id', { count: 'exact' });

    const { count: perfectForCount } = await db
      .from('entity_perfect_for')
      .select('id', { count: 'exact' });

    console.log(`✨ FEATURES: ${featureCount}`);
    console.log(`🏷️  TAGS: ${tagCount}`);
    console.log(`💕 PERFECT FOR: ${perfectForCount}\n`);

    // Get photos
    const { count: photoCount } = await db
      .from('section_photos')
      .select('id', { count: 'exact' });

    console.log(`📸 PHOTOS: ${photoCount}\n`);

    // Detailed breakdown by entity
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📋 DETAILED BREAKDOWN BY ENTITY\n');

    const inventory = [];

    for (const entity of entities) {
      const { data: ent } = await db
        .from('entity')
        .select('*')
        .eq('id', entity.id)
        .single();

      // Count sections
      const { count: secCount } = await db
        .from('entity_sections')
        .select('id', { count: 'exact' })
        .eq('entity_id', entity.id);

      // Count section items
      const { data: sectionIds } = await db
        .from('entity_sections')
        .select('id')
        .eq('entity_id', entity.id);

      let menuItemCount = 0;
      if (sectionIds && sectionIds.length > 0) {
        for (const sec of sectionIds) {
          const { count: itemCount } = await db
            .from('section_items')
            .select('id', { count: 'exact' })
            .eq('section_id', sec.id);
          menuItemCount += itemCount || 0;
        }
      }

      // Count specials
      const { count: specCount } = await db
        .from('entity_specials')
        .select('id', { count: 'exact' })
        .eq('entity_id', entity.id);

      // Count events
      const { count: evtCount } = await db
        .from('entity_events')
        .select('id', { count: 'exact' })
        .eq('entity_id', entity.id);

      // Count features
      const { count: featCount } = await db
        .from('entity_features')
        .select('id', { count: 'exact' })
        .eq('entity_id', entity.id);

      console.log(`${ent.name}`);
      if (secCount > 0) console.log(`  📚 Sections: ${secCount}`);
      if (menuItemCount > 0) console.log(`  🍽️  Menu items: ${menuItemCount}`);
      if (specCount > 0) console.log(`  🎯 Specials: ${specCount}`);
      if (evtCount > 0) console.log(`  🎪 Events: ${evtCount}`);
      if (featCount > 0) console.log(`  ✨ Features: ${featCount}`);
      console.log();

      inventory.push({
        name: ent.name,
        id: entity.id,
        sections: secCount || 0,
        menu_items: menuItemCount,
        specials: specCount || 0,
        events: evtCount || 0,
        features: featCount || 0
      });
    }

    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📊 GRAND TOTALS\n');
    console.log(`Entities:        ${entityCount}`);
    console.log(`Menu items:      ${totalMenuItems}`);
    console.log(`Specials:        ${specialCount}`);
    console.log(`Events:          ${eventCount}`);
    console.log(`Happy hours:     ${hhItems?.length || 0}`);
    console.log(`Features:        ${featureCount}`);
    console.log(`Tags:            ${tagCount}`);
    console.log(`Perfect for:     ${perfectForCount}`);
    console.log(`Photos:          ${photoCount}\n`);

    // Save to file
    fs.writeFileSync('./FULL-DATA-INVENTORY.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        entities: entityCount,
        total_menu_items: totalMenuItems,
        specials: specialCount,
        events: eventCount,
        happy_hour_items: hhItems?.length || 0,
        features: featureCount,
        tags: tagCount,
        perfect_for: perfectForCount,
        photos: photoCount
      },
      by_entity: inventory
    }, null, 2));

    console.log('✅ Full inventory saved to FULL-DATA-INVENTORY.json\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getFullInventory();

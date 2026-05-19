require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function verifyImport() {
  try {
    const db = getGcrDb();

    console.log('🔍 VERIFYING IMPORT\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Get list of our restaurants
    const restaurants = [
      'Wolf Bay', 'Rotolo\'s', 'The Crab Trap', 'Sea-N-Suds', 'Mikato',
      'Pink Pony Pub', 'The Sloop', 'Icehouse Tap Room', 'Mudbugs Pub',
      'OHANA', 'Vinny\'s', 'Mile Marker 158', 'COASTAL', 'Pelican Grill',
      'POUR Smart Bar', 'Villaggio Grille', 'Louisiana Lagniappe', 'Flora-Bama Lounge', 'Sail Wild Hearts'
    ];

    console.log('📊 CHECKING ENTITIES\n');

    let totalMenuItems = 0;
    let entitiesFound = 0;
    let withMenus = 0;

    for (const name of restaurants) {
      // Search for entity
      const { data: entities } = await db
        .from('entity')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(1);

      if (entities && entities.length > 0) {
        const entity = entities[0];
        entitiesFound++;

        console.log(`✅ ${entity.name}`);
        console.log(`   ID: ${entity.id}`);
        console.log(`   Slug: ${entity.slug}`);
        console.log(`   Phone: ${entity.phone || 'N/A'}`);
        if (entity.place_id) console.log(`   Place ID: ${entity.place_id}`);

        // Count menu items in sections
        const { data: sections } = await db
          .from('entity_sections')
          .select('id')
          .eq('entity_id', entity.id);

        if (sections && sections.length > 0) {
          let sectionMenuItems = 0;

          for (const section of sections) {
            const { data: items } = await db
              .from('section_items')
              .select('id')
              .eq('section_id', section.id);

            if (items) {
              sectionMenuItems += items.length;
            }
          }

          if (sectionMenuItems > 0) {
            withMenus++;
            totalMenuItems += sectionMenuItems;
            console.log(`   📚 Menu items: ${sectionMenuItems}`);
          }
        }

        console.log();
      } else {
        console.log(`❌ ${name} - NOT FOUND\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log(`✅ Entities in DB:           ${entitiesFound}/${restaurants.length}`);
    console.log(`📚 Entities with menus:      ${withMenus}`);
    console.log(`🍽️  Total menu items:        ${totalMenuItems}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyImport();

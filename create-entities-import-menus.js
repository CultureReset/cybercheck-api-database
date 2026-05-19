require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');

const placeIds = JSON.parse(fs.readFileSync('./ALL-PLACE-IDS-FINAL.json', 'utf8'));

// Restaurant info
const restaurants = {
  'Wolf Bay': { city: 'Orange Beach', phone: '(251) 965-5129' },
  'Rotolo\'s': { city: 'Unknown', phone: '' },
  'The Crab Trap': { city: 'Perdido Key', phone: '' },
  'Sea-N-Suds': { city: 'Gulf Shores', phone: '(251) 948-7894' },
  'Mikato': { city: 'Gulf Shores', phone: '(251) 968-2525' },
  'Pink Pony Pub': { city: 'Gulf Shores', phone: '(251) 948-6371' },
  'The Sloop': { city: 'Gulf Shores', phone: '(251) 500-1007' },
  'Icehouse Tap Room': { city: 'Gulf Shores', phone: '(251) 200-0157' },
  'Mudbugs Pub': { city: 'Gulf Shores', phone: '(251) 948-8081' },
  'OHANA': { city: 'Spanish Fort', phone: '+1 (251) 210-4715' },
  'Vinny\'s': { city: 'Orange Beach', phone: '(866)-743-7669' },
  'Mile Marker 158': { city: 'Orange Beach', phone: '251-224-6500 ext. 4' },
  'COASTAL': { city: 'Orange Beach', phone: '(251) 240-6001' },
  'Pelican Grill': { city: 'Orange Beach', phone: '(251) 483-3665' },
  'POUR Smart Bar': { city: 'Orange Beach', phone: '(251) 284-6747' },
  'Villaggio Grille': { city: 'Orange Beach', phone: '251.224.6510' },
  'Louisiana Lagniappe': { city: 'Orange Beach', phone: '251.981.2258' },
  'Flora-Bama Lounge': { city: 'Orange Beach', phone: '' },
  'Sail Wild Hearts': { city: 'Orange Beach', phone: '251-981-6700' }
};

async function createEntitiesAndImport() {
  try {
    const db = getGcrDb();

    console.log('🏢 CREATING ENTITIES AND IMPORTING MENUS\n');
    console.log('═══════════════════════════════════════════════════════\n');

    const results = [];
    let totalMenuItems = 0;
    let entitiesCreated = 0;
    let menusImported = 0;

    for (const [name, info] of Object.entries(restaurants)) {
      try {
        console.log(`⬆️  ${name}`);

        // Check if entity already exists
        const { data: existing } = await db
          .from('entity')
          .select('id')
          .ilike('name', `%${name.split(' ')[0]}%`)
          .limit(1);

        let entityId;
        if (existing && existing.length > 0) {
          entityId = existing[0].id;
          console.log(`   ℹ️  Already in DB: ${entityId}`);
        } else {
          // Create new entity
          let placeId = placeIds[name];
          // Truncate place_id if too long (varchar(100))
          if (placeId && placeId.length > 100) {
            placeId = placeId.substring(0, 100);
          }

          const { data: newEntity, error: entityError } = await db
            .from('entity')
            .insert({
              name: name,
              slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              entity_type: 'business',
              entity_subtype: 'restaurant',
              place_id: placeId || null,
              phone: info.phone || null,
              hero_image_url: null,
              is_active: true
            })
            .select();

          if (entityError) {
            console.log(`   ❌ Error: ${entityError.message}`);
            continue;
          }

          entityId = newEntity[0].id;
          entitiesCreated++;
          console.log(`   ✅ Created: ${entityId}`);
        }

        // Load extracted menu data
        const folderMap = {
          'Wolf Bay': 'wolf-bay-restaurant-at-orange-beach',
          'Rotolo\'s': 'rotolos-com',
          'The Crab Trap': 'crabtrapflorida-com',
          'Sea-N-Suds': 'sea-n-suds',
          'Mikato': 'mikatojapanese-com',
          'Pink Pony Pub': 'pinkponypub-net',
          'The Sloop': 'the-sloop',
          'Icehouse Tap Room': 'icehousegs-com',
          'Mudbugs Pub': 'mudbugs-dive-bar',
          'OHANA': 'ohana-poke-teriyaki',
          'Vinny\'s': 'vinny-s-pizzeria',
          'Mile Marker 158': 'milemarker158-com',
          'COASTAL': 'coastalorangebeach-com',
          'Pelican Grill': 'pelicangrillob-com',
          'POUR Smart Bar': 'pour-smart-bar',
          'Villaggio Grille': 'villaggiogrille-com',
          'Louisiana Lagniappe': 'thelouisianalagniappe-com',
          'Flora-Bama Lounge': 'florabama-com',
          'Sail Wild Hearts': 'sailwildhearts-com'
        };

        const folder = folderMap[name];
        const extractedPath = `./extracted-restaurants/${folder}.json`;

        if (!fs.existsSync(extractedPath)) {
          console.log(`   ⏭️  No extracted data\n`);
          continue;
        }

        const extracted = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));

        // Import menu
        if (extracted.menu && extracted.menu.length > 0) {
          const categories = {};
          extracted.menu.forEach(item => {
            if (!categories[item.category]) {
              categories[item.category] = [];
            }
            categories[item.category].push(item);
          });

          let menuItemsAdded = 0;

          for (const [categoryName, items] of Object.entries(categories)) {
            const sectionKey = categoryName.toLowerCase().replace(/\s+/g, '_');

            // Check if section already exists
            let { data: existingSection } = await db
              .from('entity_sections')
              .select('id')
              .eq('entity_id', entityId)
              .eq('section_key', sectionKey)
              .limit(1);

            let sectionId;
            if (existingSection && existingSection.length > 0) {
              sectionId = existingSection[0].id;
            } else {
              const { data: sectionData, error: sectionError } = await db
                .from('entity_sections')
                .insert({
                  entity_id: entityId,
                  section_key: sectionKey,
                  section_label: categoryName,
                  section_type: 'menu',
                  sort_order: 0
                })
                .select();

              if (sectionError) {
                console.log(`   ⚠️  Section error: ${sectionError.message}`);
                continue;
              }

              sectionId = sectionData[0].id;
            }

            const itemsToInsert = items.map((item, idx) => ({
              section_id: sectionId,
              item_name: item.name || 'Unnamed',
              item_description: item.description || '',
              price_numeric: item.price ? parseFloat(item.price) : null,
              sort_order: idx,
              item_type: 'food'
            }));

            const { error: itemsError } = await db
              .from('section_items')
              .insert(itemsToInsert);

            if (!itemsError) {
              menuItemsAdded += items.length;
            }
          }

          totalMenuItems += menuItemsAdded;
          if (menuItemsAdded > 0) {
            menusImported++;
            console.log(`   ✅ ${menuItemsAdded} menu items imported`);
          }
        }

        // Import specials
        if (extracted.specials && extracted.specials.length > 0) {
          const { error: specialsError } = await db
            .from('entity_specials')
            .insert(
              extracted.specials.map(special => ({
                entity_id: entityId,
                title: special.name || 'Special',
                description: special.description || '',
                type: 'promotion',
                discount: special.discount || '',
                days: special.valid_days || '',
                start_time: special.valid_times || '',
                is_active: true
              }))
            );

          if (!specialsError) {
            console.log(`   ✅ ${extracted.specials.length} specials`);
          }
        }

        // Import events
        if (extracted.events && extracted.events.length > 0) {
          const { error: eventsError } = await db
            .from('entity_events')
            .insert(
              extracted.events.map(event => ({
                entity_id: entityId,
                event_name: event.name || 'Event',
                description: event.description || '',
                event_date: event.day || null,
                start_time: event.time || '',
                recurring: event.frequency ? true : false,
                is_active: true
              }))
            );

          if (!eventsError) {
            console.log(`   ✅ ${extracted.events.length} events`);
          }
        }

        console.log();
        results.push({ status: 'success', name, entityId });

      } catch (error) {
        console.log(`   ❌ ${error.message}\n`);
        results.push({ status: 'error', name, error: error.message });
      }
    }

    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✅ COMPLETE\n');
    console.log(`New entities created: ${entitiesCreated}`);
    console.log(`Menus imported: ${menusImported}`);
    console.log(`Total menu items: ${totalMenuItems}\n`);

    fs.writeFileSync('./ENTITY-CREATION-RESULTS.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total_restaurants: Object.keys(restaurants).length,
        entities_created: entitiesCreated,
        menus_imported: menusImported,
        total_menu_items: totalMenuItems
      },
      results
    }, null, 2));

    console.log('✅ Results saved to ENTITY-CREATION-RESULTS.json\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

createEntitiesAndImport();

require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');

async function createMissingSections() {
  try {
    const db = getGcrDb();

    console.log('🔨 CREATING MISSING SECTIONS\n');
    console.log('═══════════════════════════════════════════════════════\n');

    const { data: entities } = await db
      .from('entity')
      .select('id');

    let eventSectionsCreated = 0;
    let specialSectionsCreated = 0;
    let locationSectionsCreated = 0;
    let errors = 0;

    for (const entity of entities) {
      const entityId = entity.id;

      // Check if entity has events
      const { count: eventCount } = await db
        .from('entity_events')
        .select('id', { count: 'exact' })
        .eq('entity_id', entityId);

      if (eventCount > 0) {
        // Check if events section already exists
        const { data: existingEventSection } = await db
          .from('entity_sections')
          .select('id')
          .eq('entity_id', entityId)
          .eq('section_key', 'events')
          .limit(1);

        if (!existingEventSection || existingEventSection.length === 0) {
          const { error } = await db
            .from('entity_sections')
            .insert({
              entity_id: entityId,
              section_key: 'events',
              section_label: 'Events',
              section_type: 'events',
              sort_order: 10
            });

          if (!error) {
            eventSectionsCreated++;
          } else {
            errors++;
          }
        }
      }

      // Check if entity has specials
      const { count: specialCount } = await db
        .from('entity_specials')
        .select('id', { count: 'exact' })
        .eq('entity_id', entityId);

      if (specialCount > 0) {
        // Check if specials section already exists
        const { data: existingSpecialSection } = await db
          .from('entity_sections')
          .select('id')
          .eq('entity_id', entityId)
          .eq('section_key', 'specials')
          .limit(1);

        if (!existingSpecialSection || existingSpecialSection.length === 0) {
          const { error } = await db
            .from('entity_sections')
            .insert({
              entity_id: entityId,
              section_key: 'specials',
              section_label: 'Specials',
              section_type: 'specials',
              sort_order: 5
            });

          if (!error) {
            specialSectionsCreated++;
          } else {
            errors++;
          }
        }
      }

      // Create location section if entity has address data
      const { data: ent } = await db
        .from('entity')
        .select('address_line_1')
        .eq('id', entityId)
        .single();

      if (ent && ent.address_line_1) {
        // Check if location section already exists
        const { data: existingLocationSection } = await db
          .from('entity_sections')
          .select('id')
          .eq('entity_id', entityId)
          .eq('section_key', 'location')
          .limit(1);

        if (!existingLocationSection || existingLocationSection.length === 0) {
          const { error } = await db
            .from('entity_sections')
            .insert({
              entity_id: entityId,
              section_key: 'location',
              section_label: 'Location',
              section_type: 'location',
              sort_order: 20
            });

          if (!error) {
            locationSectionsCreated++;
          } else {
            errors++;
          }
        }
      }

      // Show progress every 100 entities
      if ((entities.indexOf(entity) + 1) % 100 === 0) {
        console.log(`Processed ${entities.indexOf(entity) + 1}/${entities.length}...`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('✅ SECTIONS CREATED\n');
    console.log(`Events sections:    ${eventSectionsCreated}`);
    console.log(`Specials sections:  ${specialSectionsCreated}`);
    console.log(`Location sections:  ${locationSectionsCreated}`);
    console.log(`Total created:      ${eventSectionsCreated + specialSectionsCreated + locationSectionsCreated}`);
    console.log(`Errors:             ${errors}\n`);

    // Save results
    fs.writeFileSync('./SECTIONS-CREATION-RESULTS.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        event_sections: eventSectionsCreated,
        special_sections: specialSectionsCreated,
        location_sections: locationSectionsCreated,
        total: eventSectionsCreated + specialSectionsCreated + locationSectionsCreated,
        errors
      }
    }, null, 2));

    console.log('✅ Results saved to SECTIONS-CREATION-RESULTS.json\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

createMissingSections();

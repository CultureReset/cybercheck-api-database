require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');
const path = require('path');

async function importMenus() {
  try {
    const db = getGcrDb();

    console.log('📥 IMPORTING MENUS FOR EXACT MATCHES\n');

    const matchResults = JSON.parse(fs.readFileSync('./match-results.json', 'utf8'));
    const exactMatches = matchResults.exact_matches;

    console.log(`📊 Found ${exactMatches.length} exact matches\n`);
    console.log('═══════════════════════════════════════════════════════\n');

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let totalMenuItems = 0;
    let totalSpecials = 0;
    let totalEvents = 0;

    const results = [];

    // Process each exact match
    for (const match of exactMatches) {
      try {
        const extractedPath = `./extracted-restaurants/${match.folder}.json`;

        if (!fs.existsSync(extractedPath)) {
          console.log(`⏭️  ${match.entity_name} - No extracted file`);
          skipped++;
          continue;
        }

        const extracted = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
        const entityId = match.entity_id;

        // Skip if no menu data
        if (!extracted.menu || extracted.menu.length === 0) {
          console.log(`⏭️  ${match.entity_name} - No menu items`);
          skipped++;
          continue;
        }

        console.log(`⬆️  Importing: ${match.entity_name}`);
        console.log(`   Entity ID: ${entityId}`);
        console.log(`   Menu items: ${extracted.menu.length}`);

        // Group menu items by category and create menu sections
        const categories = {};
        extracted.menu.forEach(item => {
          if (!categories[item.category]) {
            categories[item.category] = [];
          }
          categories[item.category].push(item);
        });

        console.log(`   Categories: ${Object.keys(categories).length}`);

        // Import menu sections and items
        let menuItemsAdded = 0;

        for (const [categoryName, items] of Object.entries(categories)) {
          // Create menu section
          const { data: sectionData, error: sectionError } = await db
            .from('menu_sections')
            .insert({
              entity_id: entityId,
              name: categoryName,
              description: '',
              sort_order: 0,
              is_active: true
            })
            .select();

          if (sectionError) {
            console.log(`      ⚠️  Error creating section "${categoryName}": ${sectionError.message}`);
            continue;
          }

          if (!sectionData || sectionData.length === 0) {
            console.log(`      ⚠️  No section data returned for "${categoryName}"`);
            continue;
          }

          const sectionId = sectionData[0].id;

          // Create menu items for this section
          const menuItemsToInsert = items.map((item, idx) => ({
            menu_section_id: sectionId,
            entity_id: entityId,
            name: item.name || 'Unnamed',
            description: item.description || '',
            price: item.price ? parseFloat(item.price) : null,
            sort_order: idx,
            is_active: true
          }));

          const { data: itemsData, error: itemsError } = await db
            .from('menu_items')
            .insert(menuItemsToInsert);

          if (itemsError) {
            console.log(`      ⚠️  Error adding items to "${categoryName}": ${itemsError.message}`);
          } else {
            menuItemsAdded += items.length;
            console.log(`      ✅ ${items.length} items in "${categoryName}"`);
          }
        }

        totalMenuItems += menuItemsAdded;

        // Import specials if they exist
        if (extracted.specials && extracted.specials.length > 0) {
          const specialsToInsert = extracted.specials.map(special => ({
            entity_id: entityId,
            name: special.name || 'Special',
            description: special.description || '',
            special_type: 'promotion',
            discount: special.discount || '',
            valid_days: special.valid_days || '',
            valid_times: special.valid_times || '',
            is_active: true
          }));

          const { error: specialsError } = await db
            .from('entity_specials')
            .insert(specialsToInsert);

          if (specialsError) {
            console.log(`      ⚠️  Error adding specials: ${specialsError.message}`);
          } else {
            totalSpecials += extracted.specials.length;
            console.log(`      ✅ ${extracted.specials.length} specials`);
          }
        }

        // Import events if they exist
        if (extracted.events && extracted.events.length > 0) {
          const eventsToInsert = extracted.events.map(event => ({
            entity_id: entityId,
            name: event.name || 'Event',
            description: event.description || '',
            event_date: event.day || null,
            event_time: event.time || '',
            recurring: event.frequency ? true : false
          }));

          const { error: eventsError } = await db
            .from('entity_events')
            .insert(eventsToInsert);

          if (eventsError) {
            console.log(`      ⚠️  Error adding events: ${eventsError.message}`);
          } else {
            totalEvents += extracted.events.length;
            console.log(`      ✅ ${extracted.events.length} events`);
          }
        }

        console.log();
        imported++;
        results.push({
          status: 'success',
          entity_id: entityId,
          entity_name: match.entity_name,
          menu_items: menuItemsAdded,
          specials: extracted.specials ? extracted.specials.length : 0,
          events: extracted.events ? extracted.events.length : 0
        });

      } catch (error) {
        console.log(`❌ ${match.entity_name} - ${error.message}\n`);
        failed++;
        results.push({
          status: 'error',
          entity_id: match.entity_id,
          entity_name: match.entity_name,
          error: error.message
        });
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✅ IMPORT COMPLETE\n');
    console.log(`Imported:  ${imported} businesses`);
    console.log(`Skipped:   ${skipped} businesses (no menu data)`);
    console.log(`Failed:    ${failed} businesses (errors)\n`);

    console.log('📊 DATA IMPORTED\n');
    console.log(`Menu items:  ${totalMenuItems}`);
    console.log(`Specials:    ${totalSpecials}`);
    console.log(`Events:      ${totalEvents}`);
    console.log(`\nTotal data points: ${totalMenuItems + totalSpecials + totalEvents}\n`);

    // Save results
    fs.writeFileSync('./IMPORT-RESULTS.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: exactMatches.length,
        imported,
        skipped,
        failed
      },
      data_imported: {
        menu_items: totalMenuItems,
        specials: totalSpecials,
        events: totalEvents
      },
      results
    }, null, 2));

    console.log('✅ Results saved to IMPORT-RESULTS.json\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

importMenus();

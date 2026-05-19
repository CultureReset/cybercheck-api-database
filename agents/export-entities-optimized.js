require('dotenv').config();
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportEntities() {
  try {
    const db = getGcrDb();

    console.log('Fetching all entities...');
    const { data: entities, error: entitiesError } = await db
      .from('entity')
      .select('*')
      .order('name');

    if (entitiesError) throw entitiesError;
    console.log(`✓ Found ${entities.length} entities\n`);

    // Fetch all related data in batch queries
    console.log('Fetching related data in batches...');

    const [
      { data: menuSections },
      { data: menuItems },
      { data: drinkSections },
      { data: drinkItems },
      { data: happyHourSections },
      { data: happyHourItems },
      { data: events },
      { data: specials },
      { data: contentSections },
      { data: allTags },
      { data: allFeatures }
    ] = await Promise.all([
      db.from('menu_sections').select('id, entity_id'),
      db.from('menu_items').select('id, menu_section_id, name, description, price'),
      db.from('drink_sections').select('id, entity_id'),
      db.from('drink_items').select('id, drink_section_id, name, description, price'),
      db.from('happy_hour_sections').select('id, entity_id'),
      db.from('happy_hour_items').select('id, happy_hour_section_id, name, description, price'),
      db.from('entity_events').select('id, entity_id, name, description, event_date'),
      db.from('entity_specials').select('id, entity_id, name, description, special_type, is_active'),
      db.from('entity_sections').select('id, entity_id, section_type, content'),
      db.from('entity_tags').select('entity_id, tag'),
      db.from('entity_features').select('entity_id, feature')
    ]);

    console.log('✓ Fetched all related data\n');

    // Build lookup maps
    const buildCountMap = (items, entityField) => {
      const map = {};
      if (items) {
        items.forEach(item => {
          const id = item[entityField];
          map[id] = (map[id] || 0) + 1;
        });
      }
      return map;
    };

    const buildListMap = (items, entityField, valueField) => {
      const map = {};
      if (items) {
        items.forEach(item => {
          const id = item[entityField];
          if (!map[id]) map[id] = [];
          map[id].push(item[valueField]);
        });
      }
      return map;
    };

    const buildDetailMap = (items, entityField) => {
      const map = {};
      if (items) {
        items.forEach(item => {
          const id = item[entityField];
          if (!map[id]) map[id] = [];
          map[id].push(item);
        });
      }
      return map;
    };

    const menuSectionsByEntity = buildCountMap(menuSections, 'entity_id');
    const drinkSectionsByEntity = buildCountMap(drinkSections, 'entity_id');
    const happyHourSectionsByEntity = buildCountMap(happyHourSections, 'entity_id');

    const menuItemsBySection = buildCountMap(menuItems, 'menu_section_id');
    const drinkItemsBySection = buildCountMap(drinkItems, 'drink_section_id');
    const happyHourItemsBySection = buildCountMap(happyHourItems, 'happy_hour_section_id');

    const totalMenuItems = (entityId) => {
      let count = 0;
      const sections = menuSections?.filter(s => s.entity_id === entityId) || [];
      sections.forEach(s => count += menuItemsBySection[s.id] || 0);
      return count;
    };

    const totalDrinkItems = (entityId) => {
      let count = 0;
      const sections = drinkSections?.filter(s => s.entity_id === entityId) || [];
      sections.forEach(s => count += drinkItemsBySection[s.id] || 0);
      return count;
    };

    const totalHappyHourItems = (entityId) => {
      let count = 0;
      const sections = happyHourSections?.filter(s => s.entity_id === entityId) || [];
      sections.forEach(s => count += happyHourItemsBySection[s.id] || 0);
      return count;
    };

    const eventsByEntity = buildDetailMap(events, 'entity_id');
    const specialsByEntity = buildDetailMap(specials, 'entity_id');
    const sectionsByEntity = buildDetailMap(contentSections, 'entity_id');
    const tagsByEntity = buildListMap(allTags, 'entity_id', 'tag');
    const featuresByEntity = buildListMap(allFeatures, 'entity_id', 'feature');

    // Build CSV rows
    const csvData = [];
    for (const entity of entities) {
      const events_list = (eventsByEntity[entity.id] || [])
        .map(e => `${e.name}${e.event_date ? ` (${e.event_date})` : ''}`)
        .join(' | ');

      const specials_list = (specialsByEntity[entity.id] || [])
        .map(s => `${s.name}${s.special_type ? ` [${s.special_type}]` : ''}`)
        .join(' | ');

      const sections_list = (sectionsByEntity[entity.id] || [])
        .map(s => `${s.section_type}`)
        .join(' | ');

      const row = {
        'Entity ID': entity.id,
        'Status': entity.is_active ? 'ACTIVE' : 'INACTIVE',
        'Name': entity.name || '',
        'Type': entity.type || '',
        'Description': entity.description || '',
        'Address': entity.address || '',
        'City': entity.city || '',
        'State': entity.state || '',
        'Zip': entity.zip || '',
        'Phone': entity.phone || '',
        'Email': entity.email || '',
        'Website': entity.website || '',
        'Mon Hours': `${entity.monday_open || ''} - ${entity.monday_close || ''}`,
        'Tue Hours': `${entity.tuesday_open || ''} - ${entity.tuesday_close || ''}`,
        'Wed Hours': `${entity.wednesday_open || ''} - ${entity.wednesday_close || ''}`,
        'Thu Hours': `${entity.thursday_open || ''} - ${entity.thursday_close || ''}`,
        'Fri Hours': `${entity.friday_open || ''} - ${entity.friday_close || ''}`,
        'Sat Hours': `${entity.saturday_open || ''} - ${entity.saturday_close || ''}`,
        'Sun Hours': `${entity.sunday_open || ''} - ${entity.sunday_close || ''}`,
        'Social - Instagram': entity.instagram || '',
        'Social - Facebook': entity.facebook || '',
        'Social - Twitter': entity.twitter || '',
        'Social - TikTok': entity.tiktok || '',
        'Social - YouTube': entity.youtube || '',
        'Menu Sections': menuSectionsByEntity[entity.id] || 0,
        'Menu Items': totalMenuItems(entity.id),
        'Drink Sections': drinkSectionsByEntity[entity.id] || 0,
        'Drink Items': totalDrinkItems(entity.id),
        'Happy Hour Sections': happyHourSectionsByEntity[entity.id] || 0,
        'Happy Hour Items': totalHappyHourItems(entity.id),
        'Content Sections': sectionsByEntity[entity.id]?.length || 0,
        'Events Count': eventsByEntity[entity.id]?.length || 0,
        'Events': events_list,
        'Specials Count': specialsByEntity[entity.id]?.length || 0,
        'Specials': specials_list,
        'Content Sections Types': sections_list,
        'Tags': (tagsByEntity[entity.id] || []).join('; '),
        'Features': (featuresByEntity[entity.id] || []).join('; '),
        'Hero Image': entity.hero_image_url ? 'YES' : 'NO',
        'Created': entity.created_at || '',
        'Updated': entity.updated_at || ''
      };
      csvData.push(row);
    }

    // Write to Excel
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entities');

    ws['!cols'] = [
      { wch: 36 }, // ID
      { wch: 10 }, // Status
      { wch: 25 }, // Name
      { wch: 15 }, // Type
      { wch: 35 }, // Description
      { wch: 25 }, // Address
      { wch: 15 }, // City
      { wch: 8 },  // State
      { wch: 10 }, // Zip
      { wch: 15 }, // Phone
      { wch: 20 }, // Email
      { wch: 25 }, // Website
      { wch: 20 }, // Hours columns (x7)
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 }, // Social
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 }, // Counts
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 50 }, // Events list
      { wch: 12 },
      { wch: 50 }, // Specials list
      { wch: 30 }, // Sections types
      { wch: 30 }, // Tags
      { wch: 30 }, // Features
      { wch: 10 }, // Hero
      { wch: 20 }, // Dates
      { wch: 20 }
    ];

    const outputPath = '/Users/owner/cybercheck-api-database/ALL-ENTITIES-COMPLETE.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Export completed successfully!`);
    console.log(`📊 Total entities: ${csvData.length}`);
    console.log(`📁 File: ${outputPath}`);

    const active = csvData.filter(e => e.Status === 'ACTIVE').length;
    const inactive = csvData.length - active;
    const withMenus = csvData.filter(e => e['Menu Items'] > 0).length;
    const withEvents = csvData.filter(e => e['Events Count'] > 0).length;
    const withSpecials = csvData.filter(e => e['Specials Count'] > 0).length;

    console.log('\n📈 Summary:');
    console.log(`  Active: ${active}`);
    console.log(`  Inactive: ${inactive}`);
    console.log(`  With menus: ${withMenus}`);
    console.log(`  With events: ${withEvents}`);
    console.log(`  With specials: ${withSpecials}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportEntities();

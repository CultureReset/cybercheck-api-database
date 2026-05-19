require('dotenv').config();
const fs = require('fs');
const path = require('path');
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportAllEntities() {
  try {
    const db = getGcrDb();

    console.log('Fetching all entities...');
    const { data: entities, error: entitiesError } = await db
      .from('entity')
      .select('*')
      .order('name');

    if (entitiesError) throw entitiesError;

    console.log(`Found ${entities.length} entities. Gathering related data...`);

    const csvData = [];
    let processed = 0;

    for (const entity of entities) {
      processed++;
      if (processed % 10 === 0) {
        console.log(`  Processing ${processed}/${entities.length}...`);
      }

      // Get menu sections and items count
      const { data: menuSections } = await db
        .from('menu_sections')
        .select('id')
        .eq('entity_id', entity.id);

      let menuItemCount = 0;
      if (menuSections) {
        for (const section of menuSections) {
          const { data: menuItems } = await db
            .from('menu_items')
            .select('id')
            .eq('menu_section_id', section.id);
          menuItemCount += menuItems ? menuItems.length : 0;
        }
      }

      // Get drink sections and items count
      const { data: drinkSections } = await db
        .from('drink_sections')
        .select('id')
        .eq('entity_id', entity.id);

      let drinkItemCount = 0;
      if (drinkSections) {
        for (const section of drinkSections) {
          const { data: drinkItems } = await db
            .from('drink_items')
            .select('id')
            .eq('drink_section_id', section.id);
          drinkItemCount += drinkItems ? drinkItems.length : 0;
        }
      }

      // Get happy hour count
      const { data: happyHourSections } = await db
        .from('happy_hour_sections')
        .select('id')
        .eq('entity_id', entity.id);

      let happyHourCount = 0;
      if (happyHourSections) {
        for (const section of happyHourSections) {
          const { data: hhItems } = await db
            .from('happy_hour_items')
            .select('id')
            .eq('happy_hour_section_id', section.id);
          happyHourCount += hhItems ? hhItems.length : 0;
        }
      }

      // Get photos count
      const { data: photos } = await db
        .from('entity_photos')
        .select('id')
        .eq('entity_id', entity.id);
      const photoCount = photos ? photos.length : 0;

      // Get sections count
      const { data: sections } = await db
        .from('entity_sections')
        .select('id')
        .eq('entity_id', entity.id);
      const sectionCount = sections ? sections.length : 0;

      // Get events count
      const { data: events } = await db
        .from('entity_events')
        .select('id')
        .eq('entity_id', entity.id);
      const eventCount = events ? events.length : 0;

      // Get specials count
      const { data: specials } = await db
        .from('entity_specials')
        .select('id')
        .eq('entity_id', entity.id);
      const specialCount = specials ? specials.length : 0;

      // Get tags
      const { data: tags } = await db
        .from('entity_tags')
        .select('tag')
        .eq('entity_id', entity.id);
      const tagsList = tags ? tags.map(t => t.tag).join('; ') : '';

      // Get features
      const { data: features } = await db
        .from('entity_features')
        .select('feature')
        .eq('entity_id', entity.id);
      const featuresList = features ? features.map(f => f.feature).join('; ') : '';

      const row = {
        'Entity UUID': entity.id,
        'Status': entity.is_active ? 'ACTIVE' : 'INACTIVE',
        'Business Name': entity.name || '',
        'Slug': entity.slug || '',
        'Type': entity.type || '',
        'Description': entity.description || '',
        'Address': entity.address || '',
        'City': entity.city || '',
        'State': entity.state || '',
        'Zip': entity.zip || '',
        'Phone': entity.phone || '',
        'Email': entity.email || '',
        'Website': entity.website || '',
        'Hero Image URL': entity.hero_image_url || '',
        'Mon Open': entity.monday_open || '',
        'Mon Close': entity.monday_close || '',
        'Tue Open': entity.tuesday_open || '',
        'Tue Close': entity.tuesday_close || '',
        'Wed Open': entity.wednesday_open || '',
        'Wed Close': entity.wednesday_close || '',
        'Thu Open': entity.thursday_open || '',
        'Thu Close': entity.thursday_close || '',
        'Fri Open': entity.friday_open || '',
        'Fri Close': entity.friday_close || '',
        'Sat Open': entity.saturday_open || '',
        'Sat Close': entity.saturday_close || '',
        'Sun Open': entity.sunday_open || '',
        'Sun Close': entity.sunday_close || '',
        'Instagram': entity.instagram || '',
        'Facebook': entity.facebook || '',
        'Twitter': entity.twitter || '',
        'TikTok': entity.tiktok || '',
        'YouTube': entity.youtube || '',
        'Menu Items': menuItemCount,
        'Drink Items': drinkItemCount,
        'Happy Hour Items': happyHourCount,
        'Photos': photoCount,
        'Content Sections': sectionCount,
        'Events': eventCount,
        'Specials': specialCount,
        'Tags': tagsList,
        'Features': featuresList,
        'Created At': entity.created_at || '',
        'Updated At': entity.updated_at || ''
      };

      csvData.push(row);
    }

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Entities');

    // Set column widths for better readability
    const colWidths = {
      'A': 36, // UUID
      'B': 12, // Status
      'C': 25, // Name
      'D': 20, // Slug
      'E': 15, // Type
      'F': 30, // Description
      'G': 25, // Address
      'H': 15, // City
      'I': 8,  // State
      'J': 10  // Zip
    };
    ws['!cols'] = Object.values(colWidths).map(w => ({ wch: w }));

    // Write file
    const outputPath = '/Users/owner/cybercheck-api-database/ALL-ENTITIES-AUDIT.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Export completed!`);
    console.log(`📊 Total entities: ${csvData.length}`);
    console.log(`📁 File: ${outputPath}`);

    const active = csvData.filter(e => e.Status === 'ACTIVE').length;
    const inactive = csvData.length - active;
    const withMenus = csvData.filter(e => e['Menu Items'] > 0).length;
    const withoutMenus = csvData.length - withMenus;

    console.log('\n📈 Summary:');
    console.log(`  Active: ${active}`);
    console.log(`  Inactive: ${inactive}`);
    console.log(`  With menus: ${withMenus}`);
    console.log(`  Without menus: ${withoutMenus}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

exportAllEntities();

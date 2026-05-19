require('dotenv').config();
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportActiveEntities() {
  try {
    const db = getGcrDb();

    console.log('Fetching ACTIVE entities only (displaying on launching-gcr)...');
    const { data: entities } = await db
      .from('entity')
      .select('*')
      .eq('is_active', true)
      .order('name');

    console.log(`✓ Found ${entities.length} ACTIVE entities\n`);
    console.log('Fetching all related data in batches...');

    const entityIds = entities.map(e => e.id);

    const [
      { data: events },
      { data: specials },
      { data: allTags },
      { data: contentSections },
      { data: menuSections },
      { data: drinkSections }
    ] = await Promise.all([
      db.from('entity_events').select('*'),
      db.from('entity_specials').select('*'),
      db.from('entity_tags').select('*'),
      db.from('entity_sections').select('*'),
      db.from('menu_sections').select('*'),
      db.from('drink_sections').select('*')
    ]);

    console.log(`✓ Events: ${events?.length || 0}`);
    console.log(`✓ Specials: ${specials?.length || 0}`);
    console.log(`✓ Tags: ${allTags?.length || 0}`);
    console.log(`✓ Content Sections: ${contentSections?.length || 0}`);
    console.log(`✓ Menu Sections: ${menuSections?.length || 0}`);
    console.log(`✓ Drink Sections: ${drinkSections?.length || 0}\n`);

    // Build lookup maps for active entities
    const eventsByEntity = {};
    const specialsByEntity = {};
    const tagsByEntity = {};
    const sectionsByEntity = {};

    if (events) {
      events.forEach(e => {
        if (entityIds.includes(e.entity_id)) {
          if (!eventsByEntity[e.entity_id]) eventsByEntity[e.entity_id] = [];
          eventsByEntity[e.entity_id].push(e);
        }
      });
    }

    if (specials) {
      specials.forEach(s => {
        if (entityIds.includes(s.entity_id)) {
          if (!specialsByEntity[s.entity_id]) specialsByEntity[s.entity_id] = [];
          specialsByEntity[s.entity_id].push(s);
        }
      });
    }

    if (allTags) {
      allTags.forEach(t => {
        if (entityIds.includes(t.entity_id)) {
          if (!tagsByEntity[t.entity_id]) tagsByEntity[t.entity_id] = [];
          tagsByEntity[t.entity_id].push(t.tag);
        }
      });
    }

    if (contentSections) {
      contentSections.forEach(cs => {
        if (entityIds.includes(cs.entity_id)) {
          if (!sectionsByEntity[cs.entity_id]) sectionsByEntity[cs.entity_id] = [];
          sectionsByEntity[cs.entity_id].push(cs);
        }
      });
    }

    console.log('Building CSV with full details...');

    // Build CSV rows
    const csvData = [];
    for (const entity of entities) {
      const events_list = (eventsByEntity[entity.id] || [])
        .map(e => `${e.name}${e.event_date ? ` (${e.event_date})` : ''}${e.description ? ` - ${e.description.substring(0, 30)}` : ''}`)
        .join(' | ');

      const specials_list = (specialsByEntity[entity.id] || [])
        .map(s => `${s.name}${s.special_type ? ` [${s.special_type}]` : ''}${s.description ? ` - ${s.description.substring(0, 30)}` : ''}`)
        .join(' | ');

      const allTags = (tagsByEntity[entity.id] || []);
      const allSections = (sectionsByEntity[entity.id] || []);

      const row = {
        'Entity UUID': entity.id,
        'Name': entity.name || '',
        'Type': entity.type || '',
        'Subtype': entity.entity_subtype || '',
        'Description': (entity.description || '').substring(0, 150),
        'Address': entity.address || '',
        'City': entity.city || '',
        'State': entity.state || '',
        'Zip': entity.zip || '',
        'Phone': entity.phone || '',
        'Email': entity.email || '',
        'Website': entity.website || '',
        'Mon': `${entity.monday_open || '-'}/${entity.monday_close || '-'}`,
        'Tue': `${entity.tuesday_open || '-'}/${entity.tuesday_close || '-'}`,
        'Wed': `${entity.wednesday_open || '-'}/${entity.wednesday_close || '-'}`,
        'Thu': `${entity.thursday_open || '-'}/${entity.thursday_close || '-'}`,
        'Fri': `${entity.friday_open || '-'}/${entity.friday_close || '-'}`,
        'Sat': `${entity.saturday_open || '-'}/${entity.saturday_close || '-'}`,
        'Sun': `${entity.sunday_open || '-'}/${entity.sunday_close || '-'}`,
        'Instagram': entity.instagram || '',
        'Facebook': entity.facebook || '',
        'Twitter': entity.twitter || '',
        'TikTok': entity.tiktok || '',
        'YouTube': entity.youtube || '',
        'Google Business': entity.google_business_id || '',
        'Menu Sections': menuSections?.filter(m => m.entity_id === entity.id).length || 0,
        'Drink Sections': drinkSections?.filter(d => d.entity_id === entity.id).length || 0,
        'Event Count': (eventsByEntity[entity.id] || []).length,
        'Events': events_list,
        'Special Count': (specialsByEntity[entity.id] || []).length,
        'Specials': specials_list,
        'Content Sections': allSections.length,
        'Section Types': allSections.map(s => s.section_type).join('; '),
        'Tag Count': allTags.length,
        'Tags': allTags.join('; '),
        'Hero Image': entity.hero_image_url ? 'YES' : 'NO',
        'Icon URL': entity.icon || '',
        'Created': entity.created_at?.split('T')[0] || '',
        'Updated': entity.updated_at?.split('T')[0] || ''
      };
      csvData.push(row);
    }

    // Write to Excel with 2 sheets
    // Sheet 1: Summary
    const summaryData = csvData.map(e => ({
      'Name': e.Name,
      'Type': e.Type,
      'City': e.City,
      'Phone': e.Phone,
      'Email': e.Email,
      'Address': e.Address,
      'Events': e['Event Count'],
      'Specials': e['Special Count'],
      'Tags': e['Tag Count'],
      'Sections': e['Content Sections']
    }));

    // Sheet 2: Full detail
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    const ws2 = XLSX.utils.json_to_sheet(csvData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Full Details');

    const outputPath = '/Users/owner/cybercheck-api-database/GCR-ACTIVE-ENTITIES-AUDIT.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Export completed!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`📊 Total ACTIVE: ${csvData.length} entities\n`);

    const withEvents = csvData.filter(e => e['Event Count'] > 0).length;
    const withSpecials = csvData.filter(e => e['Special Count'] > 0).length;
    const withTags = csvData.filter(e => e['Tag Count'] > 0).length;
    const withSections = csvData.filter(e => e['Content Sections'] > 0).length;

    console.log('Summary:');
    console.log(`  With events: ${withEvents}`);
    console.log(`  With specials: ${withSpecials}`);
    console.log(`  With tags: ${withTags}`);
    console.log(`  With sections: ${withSections}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportActiveEntities();

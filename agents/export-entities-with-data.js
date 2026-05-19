require('dotenv').config();
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportEntities() {
  try {
    const db = getGcrDb();

    console.log('Fetching all entities...');
    const { data: entities } = await db
      .from('entity')
      .select('*')
      .order('name');

    console.log(`✓ Found ${entities.length} entities\n`);
    console.log('Fetching related data in batches...');

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

    // Build lookup maps
    const eventsByEntity = {};
    const specialsByEntity = {};
    const tagsByEntity = {};
    const sectionsByEntity = {};

    if (events) {
      events.forEach(e => {
        if (!eventsByEntity[e.entity_id]) eventsByEntity[e.entity_id] = [];
        eventsByEntity[e.entity_id].push(e);
      });
    }

    if (specials) {
      specials.forEach(s => {
        if (!specialsByEntity[s.entity_id]) specialsByEntity[s.entity_id] = [];
        specialsByEntity[s.entity_id].push(s);
      });
    }

    if (allTags) {
      allTags.forEach(t => {
        if (!tagsByEntity[t.entity_id]) tagsByEntity[t.entity_id] = [];
        tagsByEntity[t.entity_id].push(t.tag);
      });
    }

    if (contentSections) {
      contentSections.forEach(cs => {
        if (!sectionsByEntity[cs.entity_id]) sectionsByEntity[cs.entity_id] = [];
        sectionsByEntity[cs.entity_id].push(cs);
      });
    }

    console.log('Building CSV data...');

    // Build CSV rows
    const csvData = [];
    for (const entity of entities) {
      const events_list = (eventsByEntity[entity.id] || [])
        .map(e => `${e.name}${e.event_date ? ` (${e.event_date})` : ''}`)
        .join(' | ');

      const specials_list = (specialsByEntity[entity.id] || [])
        .map(s => `${s.name}${s.special_type ? ` [${s.special_type}]` : ''}`)
        .join(' | ');

      const row = {
        'ID': entity.id,
        'Status': entity.is_active ? 'ACTIVE' : 'INACTIVE',
        'Name': entity.name || '',
        'Type': entity.type || '',
        'Description': (entity.description || '').substring(0, 100),
        'Address': entity.address || '',
        'City': entity.city || '',
        'State': entity.state || '',
        'Zip': entity.zip || '',
        'Phone': entity.phone || '',
        'Email': entity.email || '',
        'Website': entity.website || '',
        'Hours Mon': `${entity.monday_open || ''}-${entity.monday_close || ''}`,
        'Hours Tue': `${entity.tuesday_open || ''}-${entity.tuesday_close || ''}`,
        'Hours Wed': `${entity.wednesday_open || ''}-${entity.wednesday_close || ''}`,
        'Hours Thu': `${entity.thursday_open || ''}-${entity.thursday_close || ''}`,
        'Hours Fri': `${entity.friday_open || ''}-${entity.friday_close || ''}`,
        'Hours Sat': `${entity.saturday_open || ''}-${entity.saturday_close || ''}`,
        'Hours Sun': `${entity.sunday_open || ''}-${entity.sunday_close || ''}`,
        'Instagram': entity.instagram || '',
        'Facebook': entity.facebook || '',
        'Twitter': entity.twitter || '',
        'TikTok': entity.tiktok || '',
        'YouTube': entity.youtube || '',
        'Menus': menuSections?.filter(m => m.entity_id === entity.id).length || 0,
        'Drinks': drinkSections?.filter(d => d.entity_id === entity.id).length || 0,
        'Events #': (eventsByEntity[entity.id] || []).length,
        'Events': events_list,
        'Specials #': (specialsByEntity[entity.id] || []).length,
        'Specials': specials_list,
        'Sections #': (sectionsByEntity[entity.id] || []).length,
        'Tags #': (tagsByEntity[entity.id] || []).length,
        'Tags': (tagsByEntity[entity.id] || []).slice(0, 10).join('; '),
        'Hero Image': entity.hero_image_url ? 'YES' : 'NO',
        'Created': entity.created_at?.split('T')[0] || '',
        'Updated': entity.updated_at?.split('T')[0] || ''
      };
      csvData.push(row);
    }

    // Write to Excel
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Entities');

    const outputPath = '/Users/owner/cybercheck-api-database/GCR-ENTITIES-FULL-AUDIT.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Export completed!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`📊 Total: ${csvData.length} entities\n`);

    const active = csvData.filter(e => e.Status === 'ACTIVE').length;
    const withEvents = csvData.filter(e => e['Events #'] > 0).length;
    const withSpecials = csvData.filter(e => e['Specials #'] > 0).length;
    const withTags = csvData.filter(e => e['Tags #'] > 0).length;

    console.log('Summary:');
    console.log(`  Active: ${active} / ${csvData.length}`);
    console.log(`  With events: ${withEvents}`);
    console.log(`  With specials: ${withSpecials}`);
    console.log(`  With tags: ${withTags}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportEntities();

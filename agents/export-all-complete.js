require('dotenv').config();
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportAll() {
  try {
    const db = getGcrDb();

    console.log('⏳ Fetching ALL entities (active + inactive)...\n');

    const { data: entities } = await db
      .from('entity')
      .select('*')
      .order('name');

    console.log(`✓ Total Entities: ${entities.length}`);

    const entityIds = entities.map(e => e.id);

    const [
      { data: events },
      { data: specials },
      { data: allTags },
      { data: contentSections }
    ] = await Promise.all([
      db.from('entity_events').select('*'),
      db.from('entity_specials').select('*'),
      db.from('entity_tags').select('*'),
      db.from('entity_sections').select('*')
    ]);

    console.log(`✓ Events: ${events?.length || 0}`);
    console.log(`✓ Specials: ${specials?.length || 0}`);
    console.log(`✓ Tags: ${allTags?.length || 0}`);
    console.log(`✓ Content Sections: ${contentSections?.length || 0}\n`);

    const buildMap = (items, entityField) => {
      const map = {};
      if (items) items.forEach(item => {
        if (!map[item[entityField]]) map[item[entityField]] = [];
        map[item[entityField]].push(item);
      });
      return map;
    };

    const eventsByEntity = buildMap(events, 'entity_id');
    const specialsByEntity = buildMap(specials, 'entity_id');
    const tagsByEntity = buildMap(allTags, 'entity_id');
    const sectionsByEntity = buildMap(contentSections, 'entity_id');

    console.log('Building export for all 1000 entities...\n');

    const csvData = entities.map(entity => {
      const eventsDetail = (eventsByEntity[entity.id] || [])
        .map(e => `${e.name}|${e.event_date || ''}|${e.description || ''}`)
        .join(' ~ ');

      const specialsDetail = (specialsByEntity[entity.id] || [])
        .map(s => `${s.name}|${s.special_type || ''}|${s.description || ''}`)
        .join(' ~ ');

      const allTagsList = (tagsByEntity[entity.id] || []).map(t => t.tag).join('; ');

      const allSectionsList = (sectionsByEntity[entity.id] || [])
        .map(s => `${s.section_type}`)
        .join('; ');

      return {
        'STATUS': entity.is_active ? '✓ ACTIVE' : '✗ INACTIVE',
        'ID': entity.id,
        'Name': entity.name || '',
        'Type': entity.entity_type || '',
        'Subtype': entity.entity_subtype || '',
        'Description': entity.description || '',
        'Address': entity.address_line_1 || '',
        'Address 2': entity.address_line_2 || '',
        'City': entity.city || '',
        'State': entity.state || '',
        'Zip': entity.zip || '',
        'Phone': entity.phone || '',
        'Website': entity.website_url || '',
        'Instagram': entity.social_instagram || '',
        'Facebook': entity.social_facebook || '',
        'TikTok': entity.social_tiktok || '',
        'Hours': entity.hours_text || '',
        'Google Type': entity.google_type || '',
        'Business Status': entity.business_status || '',
        'Rating': entity.rating || '',
        'Reviews': entity.review_count || 0,
        'Lat': entity.latitude || '',
        'Lon': entity.longitude || '',
        'Events #': (eventsByEntity[entity.id] || []).length,
        'Events': eventsDetail,
        'Specials #': (specialsByEntity[entity.id] || []).length,
        'Specials': specialsDetail,
        'Tags #': (tagsByEntity[entity.id] || []).length,
        'Tags': allTagsList,
        'Sections #': (sectionsByEntity[entity.id] || []).length,
        'Sections': allSectionsList,
        'Featured': entity.featured ? 'YES' : '',
        'Verified': entity.gcr_verified ? 'YES' : '',
        'GCR Listed': entity.gcr_listed ? 'YES' : '',
        'Created': entity.created_at?.split('T')[0] || '',
        'Updated': entity.updated_at?.split('T')[0] || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Entities');

    const outputPath = '/Users/owner/cybercheck-api-database/ALL-1000-ENTITIES.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`✅ Export with ALL 1000 entities created!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`\n📊 ${csvData.length} total entities`);
    console.log(`   ✓ ${csvData.filter(e => e.STATUS.includes('ACTIVE')).length} ACTIVE`);
    console.log(`   ✗ ${csvData.filter(e => e.STATUS.includes('INACTIVE')).length} INACTIVE`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportAll();

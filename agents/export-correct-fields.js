require('dotenv').config();
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportCorrectFields() {
  try {
    const db = getGcrDb();

    console.log('Fetching ACTIVE entities with CORRECT fields...');
    const { data: entities } = await db
      .from('entity')
      .select('*')
      .eq('is_active', true)
      .order('name');

    console.log(`✓ Found ${entities.length} ACTIVE entities\n`);
    console.log('Fetching related data...');

    const entityIds = entities.map(e => e.id);
    const [
      { data: events },
      { data: specials },
      { data: allTags }
    ] = await Promise.all([
      db.from('entity_events').select('*'),
      db.from('entity_specials').select('*'),
      db.from('entity_tags').select('*')
    ]);

    console.log(`✓ Events: ${events?.length || 0}`);
    console.log(`✓ Specials: ${specials?.length || 0}`);
    console.log(`✓ Tags: ${allTags?.length || 0}\n`);

    // Build lookup maps
    const eventsByEntity = {};
    const specialsByEntity = {};
    const tagsByEntity = {};

    events?.forEach(e => {
      if (entityIds.includes(e.entity_id)) {
        if (!eventsByEntity[e.entity_id]) eventsByEntity[e.entity_id] = [];
        eventsByEntity[e.entity_id].push(e);
      }
    });

    specials?.forEach(s => {
      if (entityIds.includes(s.entity_id)) {
        if (!specialsByEntity[s.entity_id]) specialsByEntity[s.entity_id] = [];
        specialsByEntity[s.entity_id].push(s);
      }
    });

    allTags?.forEach(t => {
      if (entityIds.includes(t.entity_id)) {
        if (!tagsByEntity[t.entity_id]) tagsByEntity[t.entity_id] = [];
        tagsByEntity[t.entity_id].push(t.tag);
      }
    });

    console.log('Building CSV with CORRECT fields...\n');

    const csvData = [];
    for (const entity of entities) {
      const events_list = (eventsByEntity[entity.id] || [])
        .map(e => `${e.name}${e.event_date ? ` (${e.event_date})` : ''}`)
        .join(' | ')
        .substring(0, 200);

      const specials_list = (specialsByEntity[entity.id] || [])
        .map(s => `${s.name}${s.special_type ? ` [${s.special_type}]` : ''}`)
        .join(' | ')
        .substring(0, 200);

      const allEntityTags = (tagsByEntity[entity.id] || []);

      const row = {
        'ID': entity.id,
        'Name': entity.name || '',
        'Type': entity.entity_type || '',
        'Subtype': entity.entity_subtype || '',
        'Description': (entity.description || '').substring(0, 120),
        'ADDRESS - Street': entity.address_line_1 || '',
        'ADDRESS - Line 2': entity.address_line_2 || '',
        'ADDRESS - City': entity.city || '',
        'ADDRESS - State': entity.state || '',
        'ADDRESS - Zip': entity.zip || '',
        'ADDRESS - Short': entity.short_address || '',
        'CONTACT - Phone': entity.phone || '',
        'CONTACT - Email': entity.email || '',
        'CONTACT - Website': entity.website_url || '',
        'LOCATION - Lat': entity.latitude || '',
        'LOCATION - Lon': entity.longitude || '',
        'SOCIAL - Instagram': entity.social_instagram || '',
        'SOCIAL - Facebook': entity.social_facebook || '',
        'SOCIAL - TikTok': entity.social_tiktok || '',
        'Google Type': entity.google_type || '',
        'Google ID': entity.place_id || '',
        'Google Maps URL': entity.google_maps_uri || '',
        'Business Status': entity.business_status || '',
        'Rating': entity.rating || '',
        'Reviews': entity.review_count || 0,
        'Hours': entity.hours_text || '',
        'Event Count': (eventsByEntity[entity.id] || []).length,
        'Events': events_list,
        'Specials Count': (specialsByEntity[entity.id] || []).length,
        'Specials': specials_list,
        'Tag Count': allEntityTags.length,
        'Tags (first 10)': allEntityTags.slice(0, 10).join('; '),
        'All Tags': allEntityTags.join('; '),
        'Featured': entity.featured ? 'YES' : 'NO',
        'Verified': entity.gcr_verified ? 'YES' : 'NO',
        'GCR Listed': entity.gcr_listed ? 'YES' : 'NO',
        'Created': entity.created_at?.split('T')[0] || '',
        'Updated': entity.updated_at?.split('T')[0] || ''
      };
      csvData.push(row);
    }

    // Write to Excel
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Active Entities');

    // Auto-size columns
    ws['!cols'] = [
      { wch: 36 }, // ID
      { wch: 25 }, // Name
      { wch: 15 }, // Type
      { wch: 15 }, // Subtype
      { wch: 25 }, // Description
      { wch: 30 }, // Street Address
      { wch: 15 }, // Address Line 2
      { wch: 15 }, // City
      { wch: 8 },  // State
      { wch: 10 }, // Zip
      { wch: 25 }, // Short Address
      { wch: 15 }, // Phone
      { wch: 20 }, // Email
      { wch: 25 }, // Website
      { wch: 12 }, // Lat
      { wch: 12 }, // Lon
      { wch: 25 }, // Instagram
      { wch: 25 }, // Facebook
      { wch: 25 }, // TikTok
      { wch: 15 }, // Google Type
      { wch: 20 }, // Google ID
      { wch: 30 }, // Google Maps URL
      { wch: 15 }, // Business Status
      { wch: 10 }, // Rating
      { wch: 10 }, // Reviews
      { wch: 40 }, // Hours
      { wch: 12 }, // Event Count
      { wch: 50 }, // Events
      { wch: 12 }, // Specials Count
      { wch: 50 }, // Specials
      { wch: 12 }, // Tag Count
      { wch: 40 }, // First 10 Tags
      { wch: 80 }, // All Tags
      { wch: 10 }, // Featured
      { wch: 10 }, // Verified
      { wch: 10 }, // GCR Listed
      { wch: 12 }, // Created
      { wch: 12 }  // Updated
    ];

    const outputPath = '/Users/owner/cybercheck-api-database/GCR-COMPLETE-ENTITY-AUDIT.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`✅ Export completed with CORRECT fields!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`\n📊 ${csvData.length} ACTIVE entities exported\n`);

    const withAddr = csvData.filter(e => e['ADDRESS - Street']).length;
    const withPhone = csvData.filter(e => e['CONTACT - Phone']).length;
    const withEmail = csvData.filter(e => e['CONTACT - Email']).length;
    const withWebsite = csvData.filter(e => e['CONTACT - Website']).length;
    const withEvents = csvData.filter(e => e['Event Count'] > 0).length;
    const withSpecials = csvData.filter(e => e['Specials Count'] > 0).length;
    const withTags = csvData.filter(e => e['Tag Count'] > 0).length;

    console.log('Data Completeness:');
    console.log(`  ✓ With Address: ${withAddr} (${Math.round(withAddr/csvData.length*100)}%)`);
    console.log(`  ✓ With Phone: ${withPhone} (${Math.round(withPhone/csvData.length*100)}%)`);
    console.log(`  ✓ With Email: ${withEmail} (${Math.round(withEmail/csvData.length*100)}%)`);
    console.log(`  ✓ With Website: ${withWebsite} (${Math.round(withWebsite/csvData.length*100)}%)`);
    console.log(`  ✓ With Events: ${withEvents}`);
    console.log(`  ✓ With Specials: ${withSpecials}`);
    console.log(`  ✓ With Tags: ${withTags}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportCorrectFields();

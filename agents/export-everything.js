require('dotenv').config();
const getGcrDb = require('../gcr-db');
const XLSX = require('xlsx');

async function exportEverything() {
  try {
    const db = getGcrDb();

    console.log('⏳ Fetching ALL data for ACTIVE entities...\n');

    const { data: entities } = await db
      .from('entity')
      .select('*')
      .eq('is_active', true)
      .order('name');

    console.log(`✓ Entities: ${entities.length}`);

    const entityIds = entities.map(e => e.id);

    const [
      { data: events },
      { data: specials },
      { data: allTags },
      { data: features },
      { data: contentSections },
      { data: menuSections },
      { data: drinkSections },
      { data: happyHourSections }
    ] = await Promise.all([
      db.from('entity_events').select('*'),
      db.from('entity_specials').select('*'),
      db.from('entity_tags').select('*'),
      db.from('entity_features').select('*'),
      db.from('entity_sections').select('*'),
      db.from('menu_sections').select('*'),
      db.from('drink_sections').select('*'),
      db.from('happy_hour_sections').select('*')
    ]);

    console.log(`✓ Events: ${events?.length || 0}`);
    console.log(`✓ Specials: ${specials?.length || 0}`);
    console.log(`✓ Tags: ${allTags?.length || 0}`);
    console.log(`✓ Features: ${features?.length || 0}`);
    console.log(`✓ Content Sections: ${contentSections?.length || 0}`);
    console.log(`✓ Menu Sections: ${menuSections?.length || 0}`);
    console.log(`✓ Drink Sections: ${drinkSections?.length || 0}`);
    console.log(`✓ Happy Hour Sections: ${happyHourSections?.length || 0}\n`);

    // Build comprehensive lookup maps
    const buildMap = (items, entityField) => {
      const map = {};
      if (items) {
        items.forEach(item => {
          if (!map[item[entityField]]) map[item[entityField]] = [];
          map[item[entityField]].push(item);
        });
      }
      return map;
    };

    const eventsByEntity = buildMap(events, 'entity_id');
    const specialsByEntity = buildMap(specials, 'entity_id');
    const tagsByEntity = buildMap(allTags, 'entity_id');
    const featuresByEntity = buildMap(features, 'entity_id');
    const sectionsByEntity = buildMap(contentSections, 'entity_id');
    const menusByEntity = buildMap(menuSections, 'entity_id');
    const drinksByEntity = buildMap(drinkSections, 'entity_id');
    const hhByEntity = buildMap(happyHourSections, 'entity_id');

    console.log('Building comprehensive export with EVERYTHING...\n');

    const csvData = [];

    for (const entity of entities) {
      // Events - full details
      const eventsDetail = (eventsByEntity[entity.id] || [])
        .map(e => `${e.name}|${e.event_date || 'NO DATE'}|${e.description || 'NO DESC'}`)
        .join(' ~ ');

      // Specials - full details
      const specialsDetail = (specialsByEntity[entity.id] || [])
        .map(s => `${s.name}|${s.special_type || 'N/A'}|${s.description || 'NO DESC'}|Active:${s.is_active}`)
        .join(' ~ ');

      // All tags - complete list
      const allTagsList = (tagsByEntity[entity.id] || []).map(t => t.tag).join('; ');

      // All features
      const allFeaturesList = (featuresByEntity[entity.id] || []).map(f => f.feature).join('; ');

      // Sections - all types
      const allSectionsList = (sectionsByEntity[entity.id] || [])
        .map(s => `${s.section_type}${s.content ? ` (content)` : ''}`)
        .join('; ');

      // Menu sections
      const menuSectionsList = (menusByEntity[entity.id] || [])
        .map(m => m.name || 'Unnamed Section')
        .join('; ');

      // Drink sections
      const drinkSectionsList = (drinksByEntity[entity.id] || [])
        .map(d => d.name || 'Unnamed Drink Section')
        .join('; ');

      // HH sections
      const hhSectionsList = (hhByEntity[entity.id] || [])
        .map(h => h.name || 'Unnamed HH Section')
        .join('; ');

      const row = {
        // Basic Info
        'ID': entity.id,
        'Name': entity.name || '',
        'Type': entity.entity_type || '',
        'Subtype': entity.entity_subtype || '',
        'Slug': entity.slug || '',

        // Full Description
        'Description': entity.description || '',
        'Editorial Summary': entity.editorial_summary || '',
        'Tagline': entity.tagline || '',

        // ADDRESS - COMPLETE
        'Address Line 1': entity.address_line_1 || '',
        'Address Line 2': entity.address_line_2 || '',
        'City': entity.city || '',
        'State': entity.state || '',
        'Zip': entity.zip || '',
        'Short Address': entity.short_address || '',
        'Plus Code': entity.plus_code || '',

        // CONTACT - COMPLETE
        'Phone': entity.phone || '',
        'International Phone': entity.international_phone || '',
        'Email': entity.email || '',
        'Website': entity.website_url || '',
        'Call URL': entity.call_url || '',
        'Directions URL': entity.directions_url || '',

        // LOCATION - COMPLETE
        'Latitude': entity.latitude || '',
        'Longitude': entity.longitude || '',

        // SOCIAL - COMPLETE
        'Instagram': entity.social_instagram || '',
        'Facebook': entity.social_facebook || '',
        'TikTok': entity.social_tiktok || '',

        // BUSINESS DETAILS
        'Google Type': entity.google_type || '',
        'Google ID': entity.place_id || '',
        'Google Maps URL': entity.google_maps_uri || '',
        'Google Types': entity.google_types || '',
        'Business Status': entity.business_status || '',
        'Rating': entity.rating || '',
        'Review Count': entity.review_count || 0,

        // HOURS
        'Hours (Full Text)': entity.hours_text || '',
        'HH Days': entity.hh_days || '',
        'HH Start': entity.hh_start || '',
        'HH End': entity.hh_end || '',
        'HH Description': entity.hh_description || '',

        // SERVICE INFO
        'Outdoor Seating': entity.outdoor_seating ? 'YES' : '',
        'Reservable': entity.reservable ? 'YES' : '',
        'Dine In': entity.dine_in ? 'YES' : '',
        'Takeout': entity.takeout ? 'YES' : '',
        'Delivery': entity.delivery ? 'YES' : '',
        'Good for Groups': entity.good_for_groups ? 'YES' : '',
        'Live Music': entity.live_music ? 'YES' : '',

        // FOOD SERVICE
        'Serves Breakfast': entity.serves_breakfast ? 'YES' : '',
        'Serves Brunch': entity.serves_brunch ? 'YES' : '',
        'Serves Lunch': entity.serves_lunch ? 'YES' : '',
        'Serves Dinner': entity.serves_dinner ? 'YES' : '',
        'Serves Beer': entity.serves_beer ? 'YES' : '',
        'Serves Wine': entity.serves_wine ? 'YES' : '',
        'Serves Cocktails': entity.serves_cocktails ? 'YES' : '',
        'Serves Vegetarian': entity.serves_vegetarian ? 'YES' : '',

        // PRICING
        'Price Level': entity.price_level || '',
        'Price Range': entity.price_range || '',
        'Price From': entity.price_from || '',
        'Price To': entity.price_to || '',
        'Price Unit': entity.price_unit || '',

        // BOOKING & ORDERING
        'Booking URL': entity.booking_url || '',
        'Reservation URL': entity.reservation_url || '',
        'Order URL': entity.order_url || '',
        'Menu': entity.menu || '',

        // IMAGES & MEDIA
        'Hero Image URL': entity.hero_image_url || '',
        'Cover URL': entity.cover_url || '',
        'Logo URL': entity.logo_url || '',
        'Icon': entity.icon || '',
        'Emoji': entity.emoji || '',
        'Extra Photos': entity._extra_photos || '',

        // CONTENT DATA
        'Menu Sections Count': (menusByEntity[entity.id] || []).length,
        'Menu Sections': menuSectionsList,
        'Drink Sections Count': (drinksByEntity[entity.id] || []).length,
        'Drink Sections': drinkSectionsList,
        'Happy Hour Sections Count': (hhByEntity[entity.id] || []).length,
        'Happy Hour Sections': hhSectionsList,
        'Content Sections Count': (sectionsByEntity[entity.id] || []).length,
        'Content Section Types': allSectionsList,

        // TAGS & FEATURES
        'Tags Count': (tagsByEntity[entity.id] || []).length,
        'Tags': allTagsList,
        'Features Count': (featuresByEntity[entity.id] || []).length,
        'Features': allFeaturesList,

        // EVENTS & SPECIALS
        'Events Count': (eventsByEntity[entity.id] || []).length,
        'Events (Name|Date|Desc)': eventsDetail,
        'Specials Count': (specialsByEntity[entity.id] || []).length,
        'Specials (Name|Type|Desc|Active)': specialsDetail,

        // STATUS & FLAGS
        'Is Active': entity.is_active ? 'YES' : 'NO',
        'Featured': entity.featured ? 'YES' : 'NO',
        'GCR Listed': entity.gcr_listed ? 'YES' : 'NO',
        'GCR Verified': entity.gcr_verified ? 'YES' : 'NO',
        'Sort Order': entity.sort_order || 0,

        // METADATA
        'Parent Entity ID': entity.parent_entity_id || '',
        'Sources': entity._sources || '',
        'Created': entity.created_at?.split('T')[0] || '',
        'Updated': entity.updated_at?.split('T')[0] || ''
      };

      csvData.push(row);
    }

    // Write to Excel
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Complete Data');

    const outputPath = '/Users/owner/cybercheck-api-database/GCR-EVERYTHING.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`✅ COMPLETE export created!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`\n📊 ${csvData.length} ACTIVE entities`);
    console.log(`📋 ${Object.keys(csvData[0] || {}).length} columns`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportEverything();

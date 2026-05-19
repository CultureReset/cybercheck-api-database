require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE INVENTORY - NEW DB (xbptmkpbiqzvxptjkfoi)');
  console.log('='.repeat(80) + '\n');

  try {
    // Entities by type
    const { data: entities } = await db.from('entity').select('entity_type, count()').eq('is_active', true);
    const entityTypes = {};
    (entities || []).forEach(e => {
      entityTypes[e.entity_type] = (entityTypes[e.entity_type] || 0) + 1;
    });

    // Total counts
    const counts = await Promise.all([
      db.from('entity').select('id').eq('is_active', true).then(r => ({ entity: r.data?.length || 0 })),
      db.from('entity_events').select('id').then(r => ({ events: r.data?.length || 0 })),
      db.from('entity_specials').select('id').then(r => ({ specials: r.data?.length || 0 })),
      db.from('entity_happy_hours').select('id').then(r => ({ happy_hours: r.data?.length || 0 })),
      db.from('menu_items').select('id').then(r => ({ menu_items: r.data?.length || 0 })),
      db.from('drink_items').select('id').then(r => ({ drinks: r.data?.length || 0 })),
      db.from('entity_photos').select('id').then(r => ({ photos: r.data?.length || 0 })),
      db.from('entity_sections').select('id').then(r => ({ sections: r.data?.length || 0 })),
    ]);

    const data = Object.assign({}, ...counts);

    console.log('📊 ENTITIES BY TYPE:');
    Object.entries(entityTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n📈 TOTAL DATA:');
    console.log(`   Entities: ${data.entity}`);
    console.log(`   Events: ${data.events}`);
    console.log(`   Specials: ${data.specials}`);
    console.log(`   Happy Hours: ${data.happy_hours}`);
    console.log(`   Menu Items: ${data.menu_items}`);
    console.log(`   Drinks: ${data.drinks}`);
    console.log(`   Photos: ${data.photos}`);
    console.log(`   Sections: ${data.sections}`);

    // Check coverage
    const { data: withPhotos } = await db.from('entity').select('id').eq('is_active', true).not('hero_image_url', 'is', null);
    const { data: withEvents } = await db.from('entity').select('id').eq('is_active', true).then(async r => {
      if (!r.data) return { data: [] };
      const ids = r.data.map(e => e.id);
      const ev = await db.from('entity_events').select('entity_id').in('entity_id', ids);
      return ev;
    });

    console.log('\n✓ COVERAGE:');
    console.log(`   Businesses with photos: ${withPhotos?.length || 0} / ${data.entity}`);
    
    // Sample entities
    const { data: sample } = await db.from('entity').select('id, name, entity_type').eq('is_active', true).limit(5);
    console.log('\n📌 SAMPLE ENTITIES:');
    (sample || []).forEach(e => console.log(`   - ${e.name} (${e.entity_type})`));

    console.log('\n' + '='.repeat(80) + '\n');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();

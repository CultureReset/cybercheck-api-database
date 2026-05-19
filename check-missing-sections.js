require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function checkSections() {
  try {
    const db = getGcrDb();

    console.log('📋 CHECKING ENTITY SECTIONS\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Get all entities
    const { data: entities } = await db
      .from('entity')
      .select('id, name');

    console.log(`Total entities: ${entities?.length || 0}\n`);

    // Count entities by section coverage
    let withoutSections = 0;
    let withSections = 0;
    const sectionTypeBreakdown = {};

    for (const entity of entities) {
      const { count } = await db
        .from('entity_sections')
        .select('*', { count: 'exact' })
        .eq('entity_id', entity.id);

      if (!count || count === 0) {
        withoutSections++;
      } else {
        withSections++;

        // Get section types for this entity
        const { data: secs } = await db
          .from('entity_sections')
          .select('section_type')
          .eq('entity_id', entity.id);

        secs?.forEach(s => {
          sectionTypeBreakdown[s.section_type] = (sectionTypeBreakdown[s.section_type] || 0) + 1;
        });
      }
    }

    console.log(`📊 SECTION COVERAGE:\n`);
    console.log(`✅ Entities WITH sections:    ${withSections}`);
    console.log(`❌ Entities WITHOUT sections: ${withoutSections}\n`);

    console.log(`📚 SECTION TYPES BREAKDOWN:\n`);
    Object.entries(sectionTypeBreakdown).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log(`\n═══════════════════════════════════════════════════════\n`);

    // Check what section types SHOULD exist
    console.log(`🔍 EXPECTED SECTION TYPES:\n`);
    const expectedTypes = [
      'menu',
      'happy_hours',
      'drinks',
      'events',
      'specials',
      'gallery',
      'hours',
      'location',
      'reviews',
      'about',
      'grouped_items',
      'rich_text',
      'bullets'
    ];

    expectedTypes.forEach(type => {
      const count = sectionTypeBreakdown[type] || 0;
      const status = count > 0 ? '✅' : '❌';
      console.log(`${status} ${type}: ${count}`);
    });

    console.log(`\n═══════════════════════════════════════════════════════\n`);
    console.log(`⚠️  MISSING SECTIONS:\n`);

    const missing = expectedTypes.filter(t => !sectionTypeBreakdown[t]);
    missing.forEach(type => {
      console.log(`• ${type}`);
    });

    console.log(`\nTotal missing: ${missing.length}/${expectedTypes.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSections();

require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function checkSchema() {
  try {
    const db = getGcrDb();

    console.log('📋 CHECKING DATABASE SCHEMA\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Check menu_sections table
    console.log('📊 menu_sections columns:');
    try {
      const { data, error } = await db
        .from('menu_sections')
        .select()
        .limit(1);

      if (data && data.length > 0) {
        console.log(Object.keys(data[0]).map(k => `  - ${k}`).join('\n'));
      } else {
        console.log('  (no data, checking via schema)');
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }

    // Check menu_items table
    console.log('\n📊 menu_items columns:');
    try {
      const { data } = await db
        .from('menu_items')
        .select()
        .limit(1);

      if (data && data.length > 0) {
        console.log(Object.keys(data[0]).map(k => `  - ${k}`).join('\n'));
      } else {
        console.log('  (no data yet)');
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }

    // Check entity_specials table
    console.log('\n📊 entity_specials columns:');
    try {
      const { data } = await db
        .from('entity_specials')
        .select()
        .limit(1);

      if (data && data.length > 0) {
        console.log(Object.keys(data[0]).map(k => `  - ${k}`).join('\n'));
      } else {
        console.log('  (no data yet)');
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }

    // Check entity_events table
    console.log('\n📊 entity_events columns:');
    try {
      const { data } = await db
        .from('entity_events')
        .select()
        .limit(1);

      if (data && data.length > 0) {
        console.log(Object.keys(data[0]).map(k => `  - ${k}`).join('\n'));
      } else {
        console.log('  (no data yet)');
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();

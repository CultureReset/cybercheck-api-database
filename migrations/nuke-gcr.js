// ============================================================
// NUKE GCR DATABASE — DELETE EVERYTHING
// Caution: This deletes ALL data from GCR Supabase
//
// Usage:
//   node migrations/nuke-gcr.js
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function nuke() {
    console.log('💥 DELETING ALL DATA FROM GCR DATABASE...\n');

    const tables = [
        'section_rich_text',
        'section_bullets',
        'section_groups',
        'section_items',
        'section_cards',
        'section_photos',
        'section_hours',
        'section_location',
        'section_reviews',
        'entity_sections',
        'entity_tags',
        'entity_perfect_for',
        'entity_features',
        'entity'
    ];

    for (const table of tables) {
        try {
            const { data: allRows } = await gcrDb.from(table).select('id');
            if (allRows && allRows.length > 0) {
                await gcrDb.from(table).delete().neq('id', '');
                console.log(`✅ Deleted ${allRows.length} rows from ${table}`);
            } else {
                console.log(`⏭  ${table} is empty`);
            }
        } catch (err) {
            console.log(`⚠️  Error deleting ${table}: ${err.message}`);
        }
    }

    console.log('\n🎉 GCR Database is now completely empty and ready for fresh data!');
}

nuke();

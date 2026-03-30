// ============================================================
// Clear all activities from GCR database before reseeding
//
// Usage:
//   node migrations/reset-gcr-activities.js
//
// Env vars needed:
//   GCR_SUPABASE_URL + GCR_SUPABASE_KEY
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function deleteAllActivities() {
    console.log('🗑️  Clearing GCR activities...\n');

    try {
        // Get all activity entities
        const { data: entities, error: fetchError } = await gcrDb
            .from('entity')
            .select('id')
            .eq('entity_subtype', 'activity');

        if (fetchError) {
            console.error('❌ Failed to fetch entities:', fetchError.message);
            return;
        }

        console.log(`Found ${entities.length} activities to delete\n`);

        // Delete in order (child tables first, then parent)
        for (const entity of entities) {
            const entityId = entity.id;
            console.log(`Deleting entity: ${entityId}`);

            // Get all sections for this entity
            const { data: sections } = await gcrDb
                .from('entity_sections')
                .select('id')
                .eq('entity_id', entityId);

            if (sections) {
                for (const section of sections) {
                    // Delete all section data
                    await gcrDb.from('section_rich_text').delete().eq('section_id', section.id);
                    await gcrDb.from('section_bullets').delete().eq('section_id', section.id);
                    await gcrDb.from('section_groups').delete().eq('section_id', section.id);
                    await gcrDb.from('section_items').delete().eq('section_id', section.id);
                    await gcrDb.from('section_cards').delete().eq('section_id', section.id);
                    await gcrDb.from('section_photos').delete().eq('section_id', section.id);
                    await gcrDb.from('section_hours').delete().eq('section_id', section.id);
                    await gcrDb.from('section_location').delete().eq('section_id', section.id);
                }

                // Delete sections
                await gcrDb.from('entity_sections').delete().eq('entity_id', entityId);
            }

            // Delete tags
            await gcrDb.from('entity_tags').delete().eq('entity_id', entityId);

            // Delete entity
            await gcrDb.from('entity').delete().eq('id', entityId);
            console.log(`   ✅ Deleted\n`);
        }

        console.log('🎉 All activities cleared!');
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

deleteAllActivities();

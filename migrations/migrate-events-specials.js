// ============================================================
// Data Migration: Copy events + specials from old DB to new GCR DB
// Run: node migrations/migrate-events-specials.js
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const oldDb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

const newDb = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_SERVICE_KEY || process.env.GCR_SUPABASE_KEY
);

async function migrate() {
    console.log('Starting migration...\n');

    // Build slug → entity_id map from new DB
    const { data: entities, error: entErr } = await newDb
        .from('entity')
        .select('id, slug, name')
        .eq('is_active', true)
        .range(0, 999);

    if (entErr) { console.error('Failed to load entities:', entErr.message); process.exit(1); }

    const slugMap = {};
    const nameMap = {};
    (entities || []).forEach(e => {
        slugMap[e.slug] = e.id;
        nameMap[(e.name || '').toLowerCase()] = e.id;
    });

    console.log(`Loaded ${entities.length} entities from new DB\n`);

    // ── MIGRATE EVENTS ──
    const { data: oldEvents, error: evErr } = await oldDb
        .from('events')
        .select('*, businesses(name, subdomain)')
        .eq('active', true);

    if (evErr) { console.error('Failed to load old events:', evErr.message); }

    let evMigrated = 0, evSkipped = 0;
    const evRows = [];

    for (const e of (oldEvents || [])) {
        const slug = e.businesses?.subdomain || e.site_id;
        const bizName = (e.businesses?.name || '').toLowerCase();
        const entityId = slugMap[slug] || nameMap[bizName];

        if (!entityId) {
            console.log(`  SKIP event "${e.name}" — no matching entity for slug "${slug}"`);
            evSkipped++;
            continue;
        }

        evRows.push({
            entity_id:    entityId,
            event_name:   e.name || 'Event',
            event_type:   e.event_type || null,
            description:  e.description || null,
            artist_name:  e.artist_name || null,
            music_style:  e.music_style || null,
            venue_location: e.venue_location || e.location || null,
            day_of_week:  e.day_of_week || null,
            event_date:   e.event_date || null,
            start_time:   e.event_time || e.start_time || null,
            end_time:     e.end_time || null,
            recurring:    e.recurring || false,
            cover_charge: e.cover_charge || null,
            is_active:    true,
        });
        evMigrated++;
    }

    if (evRows.length) {
        const { error: insErr } = await newDb.from('entity_events').insert(evRows);
        if (insErr) console.error('Error inserting events:', insErr.message);
        else console.log(`✓ Migrated ${evMigrated} events`);
    }
    if (evSkipped) console.log(`  Skipped ${evSkipped} events (no matching entity)`);

    // ── MIGRATE SPECIALS ──
    const { data: oldSpecials, error: spErr } = await oldDb
        .from('specials')
        .select('*, businesses(name, subdomain)')
        .eq('active', true);

    if (spErr) { console.error('Failed to load old specials:', spErr.message); }

    let spMigrated = 0, spSkipped = 0;
    const spRows = [];

    for (const s of (oldSpecials || [])) {
        const slug = s.businesses?.subdomain || s.site_id;
        const bizName = (s.businesses?.name || '').toLowerCase();
        const entityId = slugMap[slug] || nameMap[bizName];

        if (!entityId) {
            console.log(`  SKIP special "${s.name}" — no matching entity for slug "${slug}"`);
            spSkipped++;
            continue;
        }

        spRows.push({
            entity_id:    entityId,
            special_name: s.name || 'Special',
            description:  s.description || null,
            special_type: s.special_type || null,
            days:         s.days || null,
            start_time:   s.start_time || null,
            end_time:     s.end_time || null,
            discount_text: s.discount_text || s.discount || null,
            is_active:    true,
        });
        spMigrated++;
    }

    if (spRows.length) {
        const { error: insErr } = await newDb.from('entity_specials').insert(spRows);
        if (insErr) console.error('Error inserting specials:', insErr.message);
        else console.log(`✓ Migrated ${spMigrated} specials`);
    }
    if (spSkipped) console.log(`  Skipped ${spSkipped} specials (no matching entity)`);

    console.log('\nMigration complete.');
}

migrate().catch(console.error);

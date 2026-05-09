require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);
const DRY_RUN = !process.argv.includes('--apply');

const slugify = s => (s || '').toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Venues to create as new entities. venue_match is a list of venue_location patterns
// (substring, case-insensitive) that should be linked to this entity.
const VENUES_TO_CREATE = [
    { name: "Pappa Rocco's",                    city: 'Gulf Shores',  entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['pappa rocco'] },
    { name: 'Orange Beach Presbyterian Church', city: 'Orange Beach', entity_type: 'business',   entity_subtype: 'event_venue', venue_match: ['orange beach presbyterian'] },
    { name: 'American Legion Post 99',          city: 'Foley',        entity_type: 'business',   entity_subtype: 'event_venue', venue_match: ['american legion post 99', 'american legion post. 99'] },
    { name: 'Tacky Jacks Orange Beach',         city: 'Orange Beach', entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['tacky jacks, orange beach'] },
    { name: 'Tacky Jacks Gulf Shores',          city: 'Gulf Shores',  entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['tacky jacks, gulf shores'] },
    { name: 'Tacky Jacks Fort Morgan',          city: 'Fort Morgan',  entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['tacky jacks, fort morgan'] },
    { name: 'American Legion Post 199',         city: 'Fairhope',     entity_type: 'business',   entity_subtype: 'event_venue', venue_match: ['american legion post 199', 'american legion post. 199'] },
    { name: 'Dragon Fly Pool Bar',              city: 'Gulf Shores',  entity_type: 'restaurant', entity_subtype: 'bar',         venue_match: ['dragon fly pool bar'] },
    { name: 'American Legion Post 44',          city: 'Gulf Shores',  entity_type: 'business',   entity_subtype: 'event_venue', venue_match: ['american legion post 44'] },
    { name: 'Brandon Styles Theatre',           city: 'Foley',        entity_type: 'business',   entity_subtype: 'entertainment', venue_match: ['brandon styles theatre', 'brandon styles theater'] },
    { name: 'CoastAl Restaurant',               city: 'Orange Beach', entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['coastal restaurant, orange beach'] },
    { name: 'The Sloop',                        city: 'Gulf Shores',  entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['the sloop, gulf shores'] },
    { name: 'Holy Spirit Episcopal Church',     city: 'Fort Morgan',  entity_type: 'business',   entity_subtype: 'event_venue', venue_match: ['holy spirit episcopal church'] },
    { name: 'South Baldwin Community Theater',  city: 'Gulf Shores',  entity_type: 'business',   entity_subtype: 'entertainment', venue_match: ['south baldwin community theater'] },
    { name: "Luna's",                           city: 'Orange Beach', entity_type: 'restaurant', entity_subtype: 'restaurant',  venue_match: ['luna'] },
    { name: 'Woodside Restaurant at Gulf State Park', city: 'Gulf Shores', entity_type: 'restaurant', entity_subtype: 'restaurant', venue_match: ['woodside restaurant at gulf state park'] },
];

// Orphan events whose venue matches an existing entity (different name spelling).
// Each: { entity_name_existing, venue_match }
const RELINK_TO_EXISTING = [
    { entity_name: 'GTs on the Bay', venue_match: ["gt's on the bay", 'gts on the bay'] },
];

const norm = s => (s || '').toLowerCase().replace(/[''`]/g, "'").trim();

async function run() {
    console.log(`\n=== GCR Events Cleanup — ${DRY_RUN ? 'DRY RUN' : 'APPLY MODE'} ===\n`);

    // Load all entities (paginated, in case >1000)
    const allEntities = [];
    {
        let from = 0, page = 1000;
        while (true) {
            const { data, error } = await supabase.from('entity').select('id, slug, name, city').range(from, from + page - 1);
            if (error) throw error;
            if (!data || !data.length) break;
            allEntities.push(...data);
            if (data.length < page) break;
            from += page;
        }
    }
    console.log(`Loaded ${allEntities.length} entities`);

    // Load all events
    const allEvents = [];
    {
        let from = 0, page = 1000;
        while (true) {
            const { data, error } = await supabase.from('entity_events').select('*').range(from, from + page - 1);
            if (error) throw error;
            if (!data || !data.length) break;
            allEvents.push(...data);
            if (data.length < page) break;
            from += page;
        }
    }
    console.log(`Loaded ${allEvents.length} events\n`);

    const orphans = allEvents.filter(e => !e.entity_id);

    // ------------- SECTION 1: relink orphans to existing entities -------------
    console.log('--- 1. RELINK orphans to EXISTING entities ---');
    const relinkOps = []; // {event_id, entity_id, entity_name, venue_text}
    for (const r of RELINK_TO_EXISTING) {
        const ent = allEntities.find(e => norm(e.name) === norm(r.entity_name));
        if (!ent) { console.log(`  SKIP (not found): ${r.entity_name}`); continue; }
        const matched = orphans.filter(ev => r.venue_match.some(p => norm(ev.venue_location).includes(norm(p))));
        for (const ev of matched) relinkOps.push({ event_id: ev.id, event_name: ev.event_name, entity_id: ent.id, entity_name: ent.name, venue_text: ev.venue_location });
    }
    console.log(`  ${relinkOps.length} events to relink to existing entities`);
    relinkOps.slice(0, 10).forEach(o => console.log(`    "${o.event_name}" @ "${o.venue_text}" → ${o.entity_name}`));
    if (relinkOps.length > 10) console.log(`    ... and ${relinkOps.length - 10} more`);
    console.log();

    // ------------- SECTION 2: create new entities + link orphans -------------
    console.log('--- 2. CREATE new entities + link orphans ---');
    const createOps = []; // {entity_def, slug, matched_events}
    const linkExistingOps = []; // events to link to entity that already exists
    for (const v of VENUES_TO_CREATE) {
        const matched = orphans.filter(ev => v.venue_match.some(p => norm(ev.venue_location).includes(norm(p))));
        // First check if an entity with the same name+city already exists (avoid duplicate creation)
        const exists = allEntities.find(e => norm(e.name) === norm(v.name) && norm(e.city) === norm(v.city));
        if (exists) {
            console.log(`  EXISTS: ${v.name} (${v.city}) → entity ${exists.id.slice(0,8)} — will link ${matched.length} orphans`);
            for (const ev of matched) linkExistingOps.push({ event_id: ev.id, event_name: ev.event_name, entity_id: exists.id, entity_name: exists.name, venue_text: ev.venue_location });
            continue;
        }
        let slug = slugify(`${v.name}-${v.city}`);
        if (allEntities.some(e => e.slug === slug)) slug = slug + '-' + Math.random().toString(36).slice(2, 6);
        createOps.push({ def: v, slug, matched });
    }
    if (linkExistingOps.length) console.log(`  + ${linkExistingOps.length} orphans linked to already-existing entities`);
    let totalLinkedFromCreate = 0;
    for (const c of createOps) {
        console.log(`  CREATE entity: "${c.def.name}" (${c.def.city}) [${c.def.entity_type}/${c.def.entity_subtype}] slug=${c.slug}`);
        console.log(`         + link ${c.matched.length} events`);
        totalLinkedFromCreate += c.matched.length;
    }
    console.log(`  Total: ${createOps.length} new entities, ${totalLinkedFromCreate} events linked\n`);

    // ------------- SECTION 3: collapse weekly recurring groups -------------
    console.log('--- 3. COLLAPSE weekly recurring groups (3+ same name/venue/DOW) ---');
    const groups = {};
    for (const ev of allEvents) {
        const name = norm(ev.event_name);
        const venue = norm(ev.venue_location || ev.entity_id || '');
        const dow = norm(ev.day_of_week);
        if (!name || !venue || !dow) continue;
        const k = `${name}|${venue}|${dow}`;
        (groups[k] = groups[k] || []).push(ev);
    }
    const collapseGroups = Object.entries(groups).filter(([k, v]) => v.length >= 3);
    const collapseOps = [];
    for (const [key, evs] of collapseGroups) {
        // Skip if already partially recurring — be conservative
        if (evs.some(e => e.recurring)) {
            console.log(`  SKIP (some already recurring): ${key} (${evs.length} rows)`);
            continue;
        }
        // Pick the row with the EARLIEST event_date as the "keeper"
        const sorted = [...evs].sort((a, b) => (a.event_date || '9999').localeCompare(b.event_date || '9999'));
        const keeper = sorted[0];
        const rest = sorted.slice(1);
        collapseOps.push({ key, keeper, rest });
    }
    let totalDeleted = 0;
    collapseOps.forEach(c => {
        console.log(`  COLLAPSE: "${c.keeper.event_name}" @ "${c.keeper.venue_location}" every ${c.keeper.day_of_week}`);
        console.log(`    KEEP id=${c.keeper.id} (set recurring=true, day_of_week='${c.keeper.day_of_week}', event_date=null, recurring_start_date='${c.keeper.event_date}')`);
        console.log(`    DELETE ${c.rest.length} other rows: ${c.rest.map(r => `${r.event_date}:${r.id.slice(0,8)}`).join(', ')}`);
        totalDeleted += c.rest.length;
    });
    console.log(`  Total: ${collapseOps.length} groups, ${totalDeleted} rows deleted\n`);

    // ------------- SUMMARY -------------
    const allRelinks = [...relinkOps, ...linkExistingOps];
    console.log('=== SUMMARY ===');
    console.log(`  Link orphans to existing entities:  ${allRelinks.length} events`);
    console.log(`  New entities to create:             ${createOps.length}`);
    console.log(`  Events linked to new entities:      ${totalLinkedFromCreate}`);
    console.log(`  Recurring groups to collapse:       ${collapseOps.length}`);
    console.log(`  Redundant rows to delete:           ${totalDeleted}`);
    console.log(`  Total events touched:               ${allRelinks.length + totalLinkedFromCreate + collapseOps.length + totalDeleted}`);
    console.log();

    if (DRY_RUN) {
        console.log('Dry run complete. Re-run with --apply to execute.\n');
        return;
    }

    // ====================== APPLY ======================
    console.log('=== APPLYING CHANGES ===\n');

    // 1. Relink to existing (both name-spelling variants AND already-existing target entities)
    for (const op of allRelinks) {
        const { error } = await supabase.from('entity_events').update({ entity_id: op.entity_id }).eq('id', op.event_id);
        if (error) console.error(`  ERR relink ${op.event_id}: ${error.message}`);
    }
    console.log(`Relinked ${allRelinks.length} events to existing entities`);

    // 2. Create new entities + link
    for (const c of createOps) {
        const insertRow = {
            slug: c.slug,
            name: c.def.name,
            city: c.def.city,
            entity_type: c.def.entity_type,
            entity_subtype: c.def.entity_subtype,
            is_active: true,
        };
        const { data: created, error } = await supabase.from('entity').insert(insertRow).select().single();
        if (error || !created) { console.error(`  ERR create ${c.def.name}: ${error?.message}`); continue; }
        console.log(`  Created entity ${created.id.slice(0,8)} ${c.def.name}`);
        // Link events
        const ids = c.matched.map(ev => ev.id);
        if (ids.length) {
            const { error: linkErr } = await supabase.from('entity_events').update({ entity_id: created.id }).in('id', ids);
            if (linkErr) console.error(`  ERR link events: ${linkErr.message}`);
            else console.log(`    linked ${ids.length} events`);
        }
    }

    // 3. Collapse recurring
    for (const c of collapseOps) {
        const { error: updErr } = await supabase.from('entity_events').update({
            recurring: true,
            day_of_week: c.keeper.day_of_week,
            event_date: null,
            recurring_start_date: c.keeper.event_date,
        }).eq('id', c.keeper.id);
        if (updErr) { console.error(`  ERR keeper ${c.keeper.id}: ${updErr.message}`); continue; }
        const restIds = c.rest.map(r => r.id);
        const { error: delErr } = await supabase.from('entity_events').delete().in('id', restIds);
        if (delErr) console.error(`  ERR delete rest: ${delErr.message}`);
        else console.log(`  Collapsed "${c.keeper.event_name}" — kept ${c.keeper.id.slice(0,8)}, deleted ${restIds.length}`);
    }

    console.log('\nApply complete.');
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });

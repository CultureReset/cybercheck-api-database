// ============================================================
// GCR Business Seeder
// Reads the 4 example JSON files and inserts all data into
// the new GCR Supabase project using proper UUID relationships
//
// Usage:
//   node migrations/seed-gcr-businesses.js
//
// Requires env vars:
//   GCR_SUPABASE_URL=https://adpnhipmdefutkzzltbs.supabase.co
//   GCR_SUPABASE_KEY=<service role key or anon key>
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Try to load from .env or process.env
require('dotenv').config();

const GCR_URL = process.env.GCR_SUPABASE_URL || 'https://adpnhipmdefutkzzltbs.supabase.co';
const GCR_KEY = process.env.GCR_SUPABASE_KEY;

if (!GCR_KEY) {
    console.error('❌ GCR_SUPABASE_KEY not set. Add it to your .env file or set it as an env var.');
    process.exit(1);
}

const supabase = createClient(GCR_URL, GCR_KEY);

// Path to JSON files
const DATA_DIR = path.join(__dirname, '../../build-main/structured data ');

const FILES = [
    'dockside_real_data_fixed.json',
    'sunny_lady_real_data_complete.json',
    'teeoff_real_data.json',
    'cobalt_real_data_fixed.json',
];

async function seedBusiness(data) {
    // Normalize key names (cobalt uses "features", "perfect_for", "sections")
    const entityFeatures  = data.entity_features  || data.features    || [];
    const entityPerfectFor = data.entity_perfect_for || data.perfect_for || [];
    const entitySections  = data.entity_sections  || data.sections    || [];

    // Maps from JSON string ID → real database UUID
    const idMap = {};

    // ── 1. Insert entity ──────────────────────────────────────
    const entityPayload = { ...data.entity };
    const jsonEntityId = entityPayload.id;
    delete entityPayload.id; // let DB generate UUID

    console.log(`\n📋 Inserting entity: ${entityPayload.name}`);
    const { data: insertedEntity, error: entityErr } = await supabase
        .from('entity')
        .insert(entityPayload)
        .select('id')
        .single();

    if (entityErr) {
        // If already exists (re-run), fetch it
        if (entityErr.code === '23505') {
            console.log(`   ⚠️  Entity already exists — fetching existing ID`);
            const { data: existing } = await supabase
                .from('entity')
                .select('id')
                .eq('slug', entityPayload.slug)
                .single();
            idMap[jsonEntityId] = existing.id;
        } else {
            throw new Error(`entity insert failed: ${entityErr.message}`);
        }
    } else {
        idMap[jsonEntityId] = insertedEntity.id;
    }

    const realEntityId = idMap[jsonEntityId];
    console.log(`   ✅ entity id: ${realEntityId}`);

    // ── 2. Insert entity_features ─────────────────────────────
    if (entityFeatures.length) {
        const rows = entityFeatures.map(f => ({ entity_id: realEntityId, label: f.label, sort_order: f.sort_order }));
        const { error } = await supabase.from('entity_features').insert(rows);
        if (error && error.code !== '23505') throw new Error(`entity_features: ${error.message}`);
        console.log(`   ✅ ${rows.length} features`);
    }

    // ── 3. Insert entity_perfect_for ──────────────────────────
    if (entityPerfectFor.length) {
        const rows = entityPerfectFor.map(p => ({ entity_id: realEntityId, label: p.label, sort_order: p.sort_order }));
        const { error } = await supabase.from('entity_perfect_for').insert(rows);
        if (error && error.code !== '23505') throw new Error(`entity_perfect_for: ${error.message}`);
        console.log(`   ✅ ${rows.length} perfect_for`);
    }

    // ── 3b. Seed entity_tags from features + perfect_for ──────
    const tagRows = [
        ...entityFeatures.map((f, i)   => ({ entity_id: realEntityId, tag: f.label.toLowerCase().trim(), tag_category: 'feature',    sort_order: i })),
        ...entityPerfectFor.map((p, i) => ({ entity_id: realEntityId, tag: p.label.toLowerCase().trim(), tag_category: 'perfect_for', sort_order: i })),
    ].filter((t, i, arr) => arr.findIndex(x => x.tag === t.tag) === i);
    if (tagRows.length) {
        const { error } = await supabase.from('entity_tags').insert(tagRows);
        if (error && error.code !== '23505') throw new Error(`entity_tags: ${error.message}`);
        console.log(`   ✅ ${tagRows.length} tags`);
    }

    // ── 4. Insert entity_sections ─────────────────────────────
    for (const sec of entitySections) {
        const jsonSectionId = sec.id;
        const payload = {
            entity_id: realEntityId,
            section_key: sec.section_key,
            section_label: sec.section_label,
            section_type: sec.section_type,
            sort_order: sec.sort_order,
        };

        const { data: insertedSection, error: secErr } = await supabase
            .from('entity_sections')
            .insert(payload)
            .select('id')
            .single();

        if (secErr) {
            if (secErr.code === '23505') {
                const { data: existing } = await supabase
                    .from('entity_sections')
                    .select('id')
                    .eq('entity_id', realEntityId)
                    .eq('section_key', sec.section_key)
                    .single();
                idMap[jsonSectionId] = existing.id;
            } else {
                throw new Error(`entity_sections (${sec.section_key}): ${secErr.message}`);
            }
        } else {
            idMap[jsonSectionId] = insertedSection.id;
        }
    }
    console.log(`   ✅ ${entitySections.length} sections`);

    // ── 5. Insert section_rich_text ───────────────────────────
    const richTextRows = Array.isArray(data.section_rich_text)
        ? data.section_rich_text
        : (data.section_rich_text ? [data.section_rich_text] : []);

    for (const rt of richTextRows) {
        const sectionId = idMap[rt.section_id];
        if (!sectionId) continue;
        const { error } = await supabase.from('section_rich_text').insert({ section_id: sectionId, body_text: rt.body_text });
        if (error && error.code !== '23505') throw new Error(`section_rich_text: ${error.message}`);
    }
    if (richTextRows.length) console.log(`   ✅ ${richTextRows.length} rich_text rows`);

    // ── 6. Insert section_bullets ─────────────────────────────
    const bullets = data.section_bullets || [];
    if (bullets.length) {
        const rows = bullets.map(b => ({
            section_id: idMap[b.section_id],
            bullet_text: b.bullet_text,
            sort_order: b.sort_order,
        })).filter(r => r.section_id);

        const { error } = await supabase.from('section_bullets').insert(rows);
        if (error && error.code !== '23505') throw new Error(`section_bullets: ${error.message}`);
        console.log(`   ✅ ${rows.length} bullets`);
    }

    // ── 7. Insert section_groups ──────────────────────────────
    const groups = data.section_groups || [];
    for (const grp of groups) {
        const jsonGroupId = grp.id;
        const sectionId = idMap[grp.section_id];
        if (!sectionId) continue;

        const payload = {
            section_id: sectionId,
            title: grp.title,
            subtitle: grp.subtitle || null,
            note_text: grp.note_text || null,
            sort_order: grp.sort_order,
        };

        const { data: insertedGroup, error: grpErr } = await supabase
            .from('section_groups')
            .insert(payload)
            .select('id')
            .single();

        if (grpErr) throw new Error(`section_groups: ${grpErr.message}`);
        idMap[jsonGroupId] = insertedGroup.id;
    }
    if (groups.length) console.log(`   ✅ ${groups.length} groups`);

    // ── 8. Insert section_items ───────────────────────────────
    const items = data.section_items || [];
    if (items.length) {
        // Insert in batches of 50
        const rows = items.map(item => ({
            section_id: idMap[item.section_id],
            group_id: item.group_id ? idMap[item.group_id] : null,
            item_name: item.item_name,
            item_description: item.item_description || null,
            price_label: item.price_label || null,
            price_text: item.price_text || null,
            price_numeric: item.price_numeric || null,
            price_min: item.price_min || null,
            price_max: item.price_max || null,
            unit_label: item.unit_label || null,
            item_type: item.item_type || null,
            metadata_json: item.metadata_json || {},
            sort_order: item.sort_order || 0,
        })).filter(r => r.section_id);

        // Batch insert
        for (let i = 0; i < rows.length; i += 50) {
            const batch = rows.slice(i, i + 50);
            const { error } = await supabase.from('section_items').insert(batch);
            if (error) throw new Error(`section_items batch ${i}: ${error.message}`);
        }
        console.log(`   ✅ ${rows.length} items`);
    }

    // ── 9. Insert section_cards ───────────────────────────────
    const cards = data.section_cards || [];
    if (cards.length) {
        const rows = cards.map(c => ({
            section_id: idMap[c.section_id],
            title: c.title,
            subtitle: c.subtitle || null,
            description: c.description || null,
            badge_text: c.badge_text || null,
            price_text: c.price_text || null,
            image_url: c.image_url || null,
            link_url: c.link_url || null,
            sort_order: c.sort_order || 0,
        })).filter(r => r.section_id);

        const { error } = await supabase.from('section_cards').insert(rows);
        if (error) throw new Error(`section_cards: ${error.message}`);
        console.log(`   ✅ ${rows.length} cards`);
    }

    // ── 10. Insert section_photos ─────────────────────────────
    const photos = data.section_photos || [];
    if (photos.length) {
        const rows = photos.map(p => ({
            section_id: idMap[p.section_id],
            image_url: p.image_url,
            caption: p.caption || null,
            alt_text: p.alt_text || null,
            sort_order: p.sort_order || 0,
        })).filter(r => r.section_id);

        const { error } = await supabase.from('section_photos').insert(rows);
        if (error) throw new Error(`section_photos: ${error.message}`);
        console.log(`   ✅ ${rows.length} photos`);
    }

    // ── 11. Insert section_reviews ────────────────────────────
    const reviews = Array.isArray(data.section_reviews) ? data.section_reviews : [];
    if (reviews.length) {
        const rows = reviews.map(r => ({
            section_id: idMap[r.section_id],
            author_name: r.author_name,
            rating: r.rating,
            review_text: r.review_text,
            review_date: r.review_date || null,
            source: r.source || null,
            sort_order: r.sort_order || 0,
        })).filter(r => r.section_id);

        const { error } = await supabase.from('section_reviews').insert(rows);
        if (error) throw new Error(`section_reviews: ${error.message}`);
        console.log(`   ✅ ${rows.length} reviews`);
    }

    // ── 12. Insert section_hours ──────────────────────────────
    const hours = data.section_hours || [];
    if (hours.length) {
        const rows = hours.map(h => ({
            section_id: idMap[h.section_id],
            day_of_week: h.day_of_week,
            open_time: h.open_time || null,
            close_time: h.close_time || null,
            is_closed: h.is_closed || false,
            note_text: h.note_text || null,
            sort_order: h.sort_order || 0,
        })).filter(r => r.section_id);

        const { error } = await supabase.from('section_hours').insert(rows);
        if (error) throw new Error(`section_hours: ${error.message}`);
        console.log(`   ✅ ${rows.length} hours rows`);
    }

    // ── 13. Insert section_location ───────────────────────────
    const locationRows = Array.isArray(data.section_location)
        ? data.section_location
        : (data.section_location ? [data.section_location] : []);

    for (const loc of locationRows) {
        const sectionId = idMap[loc.section_id];
        if (!sectionId) continue;
        const payload = {
            section_id: sectionId,
            address_line_1: loc.address_line_1 || null,
            address_line_2: loc.address_line_2 || null,
            city: loc.city || null,
            state: loc.state || null,
            zip: loc.zip || null,
            latitude: loc.latitude || null,
            longitude: loc.longitude || null,
            directions_url: loc.directions_url || null,
            phone: loc.phone || null,
            website_url: loc.website_url || null,
            note_text: loc.note_text || null,
        };
        const { error } = await supabase.from('section_location').insert(payload);
        if (error && error.code !== '23505') throw new Error(`section_location: ${error.message}`);
    }
    if (locationRows.length) console.log(`   ✅ location`);

    console.log(`✅ Done: ${data.entity.name}`);
}

async function main() {
    console.log('🚀 GCR Business Seeder');
    console.log(`📡 Connecting to: ${GCR_URL}`);

    let seeded = 0;

    for (const file of FILES) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found: ${filePath} — skipping`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        try {
            await seedBusiness(data);
            seeded++;
        } catch (err) {
            console.error(`❌ Error seeding ${file}: ${err.message}`);
        }
    }

    console.log(`\n🎉 Seeded ${seeded}/${FILES.length} businesses`);
}

main();

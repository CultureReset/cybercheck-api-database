// ============================================================
// Migrate "things-to-do" / activities businesses from old
// CyberCheck database into the new GCR entity schema
//
// Usage:
//   node migrations/migrate-activities-to-gcr.js
//
// Env vars needed:
//   SUPABASE_URL + SUPABASE_SERVICE_KEY  (old CyberCheck DB)
//   GCR_SUPABASE_URL + GCR_SUPABASE_KEY  (new GCR DB)
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const oldDb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

// Slugs already seeded — skip these
const ALREADY_SEEDED = new Set([
    'orange-beach-dockside-parasail',
    'sunny-lady-dolphin-cruises',
    'tee-off-at-the-wharf-powered-by-topgolf-swing-suites',
    'cobalt-the-restaurant',
]);

function slugify(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function migrateActivity(biz, content, menuItems, mediaItems, events, specials) {
    const slug = biz.subdomain || slugify(biz.name);
    if (ALREADY_SEEDED.has(slug)) { console.log(`   ⏭  Skipping (already seeded): ${biz.name}`); return; }

    console.log(`\n📋 Migrating: ${biz.name}`);

    // ── 1. Create entity ──────────────────────────────────────
    const { data: existing } = await gcrDb.from('entity').select('id').eq('slug', slug).single();
    let entityId;

    if (existing) {
        entityId = existing.id;
        console.log(`   ⚠️  Already exists — updating`);
        await gcrDb.from('entity').update({
            name: biz.name, subtitle: biz.tagline, icon: biz.emoji,
            phone: content?.phone || biz.phone, rating: biz.rating,
            review_count: biz.review_count, city: content?.city,
            state: content?.state, hero_image_url: biz.cover_url,
            website_url: content?.website_url || content?.website,
            directions_url: content?.social?.google_maps, updated_at: new Date().toISOString()
        }).eq('id', entityId);
    } else {
        const { data: created, error } = await gcrDb.from('entity').insert({
            slug, name: biz.name, subtitle: biz.tagline,
            entity_type: 'business', entity_subtype: biz.subcategory || biz.type || 'activity',
            icon: biz.emoji, phone: content?.phone || biz.phone,
            rating: biz.rating, review_count: biz.review_count || 0,
            address_line_1: content?.address, city: content?.city,
            state: content?.state, zip: content?.zip,
            hero_image_url: biz.cover_url,
            website_url: content?.website_url || content?.website,
            directions_url: content?.social?.google_maps,
            call_url: content?.phone ? `tel:${(content.phone||'').replace(/\D/g,'')}` : null,
            is_active: biz.gcr_listed !== false,
        }).select('id').single();
        if (error) { console.log(`   ❌ Entity insert failed: ${error.message}`); return; }
        entityId = created.id;
        console.log(`   ✅ Entity created: ${entityId}`);
    }

    // Helper: create section, return id
    async function createSection(key, label, type, order) {
        const { data, error } = await gcrDb.from('entity_sections').upsert(
            { entity_id: entityId, section_key: key, section_label: label, section_type: type, sort_order: order },
            { onConflict: 'entity_id,section_key' }
        ).select('id').single();
        if (error) { console.log(`   ⚠️  Section ${key}: ${error.message}`); return null; }
        return data.id;
    }

    let order = 1;

    // ── 2. About (rich_text) ──────────────────────────────────
    const aboutText = content?.about_text || content?.description;
    if (aboutText) {
        const sid = await createSection('about', 'About', 'rich_text', order++);
        if (sid) await gcrDb.from('section_rich_text').upsert({ section_id: sid, body_text: aboutText }, { onConflict: 'section_id' });
    }

    // ── 3. Highlights (bullets) ───────────────────────────────
    const highlights = Array.isArray(content?.highlights) ? content.highlights :
        (typeof content?.highlights === 'string' ? content.highlights.split('\n').filter(Boolean) : []);
    if (highlights.length) {
        const sid = await createSection('highlights', 'Highlights', 'bullets', order++);
        if (sid) {
            await gcrDb.from('section_bullets').delete().eq('section_id', sid);
            await gcrDb.from('section_bullets').insert(highlights.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 4. Schedules / tickets ────────────────────────────────
    const schedules = content?.schedules || [];
    const ticketItems = menuItems.filter(i => i.item_type === 'ticket');
    if (schedules.length || ticketItems.length) {
        const sid = await createSection('schedules', 'Times & Tickets', 'grouped_items', order++);
        if (sid) {
            if (schedules.length) {
                for (let i = 0; i < schedules.length; i++) {
                    const s = schedules[i];
                    const { data: grp } = await gcrDb.from('section_groups').insert({ section_id: sid, title: s.time || s.name, subtitle: s.name, sort_order: i }).select('id').single();
                    if (grp && s.tickets) {
                        for (let j = 0; j < s.tickets.length; j++) {
                            const t = s.tickets[j];
                            await gcrDb.from('section_items').insert({ section_id: sid, group_id: grp.id, item_name: t.name, price_text: `$${t.price}`, price_numeric: parseFloat(t.price) || null, item_type: 'ticket', sort_order: j });
                        }
                    }
                }
            } else if (ticketItems.length) {
                const { data: grp } = await gcrDb.from('section_groups').insert({ section_id: sid, title: 'Tickets', sort_order: 0 }).select('id').single();
                if (grp) {
                    for (let i = 0; i < ticketItems.length; i++) {
                        const t = ticketItems[i];
                        await gcrDb.from('section_items').insert({ section_id: sid, group_id: grp.id, item_name: t.name, item_description: t.description, price_text: t.price ? `$${t.price}` : null, price_numeric: parseFloat(t.price) || null, item_type: 'ticket', sort_order: i });
                    }
                }
            }
        }
    }

    // ── 5. Food menu ──────────────────────────────────────────
    const foodItems = menuItems.filter(i => i.item_type !== 'drink' && i.item_type !== 'ticket');
    if (foodItems.length) {
        const byCategory = {};
        foodItems.forEach(item => {
            const cat = item.category || 'Menu';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(item);
        });
        for (const [cat, items] of Object.entries(byCategory)) {
            const key = slugify(cat);
            const sid = await createSection(key, cat, 'grouped_items', order++);
            if (sid) {
                const { data: grp } = await gcrDb.from('section_groups').insert({ section_id: sid, title: cat, sort_order: 0 }).select('id').single();
                if (grp) {
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        await gcrDb.from('section_items').insert({ section_id: sid, group_id: grp.id, item_name: item.name, item_description: item.description, price_text: item.price ? `$${item.price}` : null, price_numeric: parseFloat(item.price) || null, item_type: item.item_type || 'menu_item', sort_order: i });
                    }
                }
            }
        }
    }

    // ── 6. Guest Info / Restrictions (bullets) ────────────────
    const restrictions = Array.isArray(content?.restrictions) ? content.restrictions :
        (typeof content?.restrictions === 'string' ? content.restrictions.split('\n').filter(Boolean) : []);
    if (restrictions.length) {
        const sid = await createSection('restrictions', 'Guest Info', 'bullets', order++);
        if (sid) {
            await gcrDb.from('section_bullets').delete().eq('section_id', sid);
            await gcrDb.from('section_bullets').insert(restrictions.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 7. What to Bring (bullets) ────────────────────────────
    const whatToBring = Array.isArray(content?.what_to_bring) ? content.what_to_bring : [];
    if (whatToBring.length) {
        const sid = await createSection('what_to_bring', 'What to Bring', 'bullets', order++);
        if (sid) {
            await gcrDb.from('section_bullets').delete().eq('section_id', sid);
            await gcrDb.from('section_bullets').insert(whatToBring.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 8. Events (cards) ─────────────────────────────────────
    if (events.length) {
        const sid = await createSection('events', 'Events', 'cards', order++);
        if (sid) {
            for (let i = 0; i < events.length; i++) {
                const e = events[i];
                await gcrDb.from('section_cards').insert({ section_id: sid, title: e.title || e.name, description: e.description, badge_text: e.event_date, price_text: e.price || null, image_url: e.image_url || null, sort_order: i });
            }
        }
    }

    // ── 9. Gallery (photos) ───────────────────────────────────
    const galleryMedia = mediaItems.filter(m => m.section === 'gallery' || !m.section);
    if (galleryMedia.length) {
        const sid = await createSection('gallery', 'Photos', 'gallery', order++);
        if (sid) {
            for (let i = 0; i < galleryMedia.length; i++) {
                const m = galleryMedia[i];
                await gcrDb.from('section_photos').insert({ section_id: sid, image_url: m.url, caption: m.caption || null, alt_text: m.caption || null, sort_order: i });
            }
        }
    }

    // ── 10. Hours ─────────────────────────────────────────────
    const hours = content?.hours;
    if (hours && typeof hours === 'object') {
        const dayMap = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
        const sid = await createSection('hours', 'Hours', 'hours', order++);
        if (sid) {
            await gcrDb.from('section_hours').delete().eq('section_id', sid);
            const rows = [];
            let i = 0;
            for (const [key, val] of Object.entries(hours)) {
                const day = dayMap[key] || key;
                const closed = !val || val.toLowerCase() === 'closed';
                rows.push({ section_id: sid, day_of_week: day, is_closed: closed, note_text: closed ? null : val, sort_order: i++ });
            }
            if (rows.length) await gcrDb.from('section_hours').insert(rows);
        }
    }

    // ── 11. Location ──────────────────────────────────────────
    const sid = await createSection('location', 'Location', 'location', 99);
    if (sid) {
        await gcrDb.from('section_location').upsert({
            section_id: sid,
            address_line_1: content?.address, city: content?.city,
            state: content?.state, zip: content?.zip,
            phone: content?.phone, website_url: content?.website_url || content?.website,
            directions_url: content?.social?.google_maps,
        }, { onConflict: 'section_id' });
    }

    // ── 12. Features & Perfect For ────────────────────────────
    if (biz.tags?.length) {
        const tagRows = biz.tags.map((t, i) => ({ entity_id: entityId, tag: t.toLowerCase().trim(), tag_category: 'search', sort_order: i }));
        await gcrDb.from('entity_tags').upsert(tagRows, { onConflict: 'entity_id,tag', ignoreDuplicates: true });
    }

    console.log(`   ✅ Done: ${biz.name}`);
}

async function main() {
    console.log('🚀 Migrating activities from old DB → new GCR DB\n');

    // Fetch all things-to-do businesses from old DB
    const { data: businesses, error } = await oldDb
        .from('businesses')
        .select('*')
        .eq('type', 'things-to-do')
        .eq('gcr_listed', true);

    if (error) { console.error('Failed to fetch businesses:', error.message); return; }
    console.log(`Found ${businesses.length} businesses to migrate\n`);

    let success = 0, failed = 0;

    for (const biz of businesses) {
        try {
            const [contentRes, menuRes, mediaRes, eventsRes, specialsRes] = await Promise.all([
                oldDb.from('site_content').select('*').eq('site_id', biz.site_id).single(),
                oldDb.from('menu_items').select('*').eq('site_id', biz.site_id).order('sort_order'),
                oldDb.from('business_media').select('*').eq('site_id', biz.site_id).order('sort_order'),
                oldDb.from('events').select('*').eq('site_id', biz.site_id).order('event_date'),
                oldDb.from('specials').select('*').eq('site_id', biz.site_id),
            ]);

            await migrateActivity(
                biz,
                contentRes.data || {},
                menuRes.data || [],
                mediaRes.data || [],
                eventsRes.data || [],
                specialsRes.data || [],
            );
            success++;
        } catch(err) {
            console.error(`❌ Failed: ${biz.name} — ${err.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Migration complete: ${success} succeeded, ${failed} failed`);
}

main();

// ============================================================
// Seed all activities from /Users/owner/build-main/activities/
// Each folder has a data.json with the activity data
//
// Usage:
//   GCR_SUPABASE_KEY=xxx node migrations/seed-activities.js
// ============================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL || 'https://adpnhipmdefutkzzltbs.supabase.co',
    process.env.GCR_SUPABASE_KEY
);

const ACTIVITIES_DIR = '/Users/owner/build-main/activities';

const ALREADY_SEEDED = new Set([
    'orange-beach-dockside-parasail',
    'sunny-lady-dolphin-cruises',
]);

function slugify(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function seedActivity(data) {
    let slug = slugify(data.title);
    if (ALREADY_SEEDED.has(slug)) {
        console.log(`   ⏭  Skipping (already seeded): ${data.title}`);
        return;
    }

    // Check if slug exists, make it unique
    let uniqueSlug = slug;
    let counter = 1;
    while (true) {
        const { count } = await supabase
            .from('entity')
            .select('id', { count: 'exact', head: true })
            .eq('slug', uniqueSlug);
        if (count === 0) break;
        uniqueSlug = slug + '-' + counter++;
    }
    slug = uniqueSlug;

    console.log(`\n📋 Seeding: ${data.title}${slug !== slugify(data.title) ? ' (as: ' + slug + ')' : ''}`);

    // ── 1. Entity ─────────────────────────────────────────────
    const subtype = slugify(data.category || 'activity');
    const address = data.meeting_point || '';
    const addrParts = address.split(',');

    const entityPayload = {
        slug,
        name: data.title,
        subtitle: data.category,
        entity_type: 'business',
        entity_subtype: subtype,
        phone: data.phone || null,
        rating: data.rating || null,
        review_count: data.review_count || 0,
        address_line_1: addrParts[0]?.trim() || null,
        city: addrParts[1]?.trim() || 'Orange Beach',
        state: 'Alabama',
        zip: addrParts[2]?.match(/\d{5}/)?.[0] || '36561',
        hero_image_url: data.images?.[0] || null,
        website_url: data.url || null,
        is_active: true,
    };

    // Upsert entity (overwrite if exists)
    const { data: entity, error: entErr } = await supabase
        .from('entity')
        .upsert(entityPayload, { onConflict: 'slug' })
        .select('id')
        .single();

    if (entErr) { console.log(`   ❌ Entity failed: ${entErr.message}`); return; }
    const entityId = entity.id;
    console.log(`   ✅ Entity: ${entityId}`);

    // Helper
    async function createSection(key, label, type, order) {
        const { data: sec, error } = await supabase
            .from('entity_sections')
            .upsert({ entity_id: entityId, section_key: key, section_label: label, section_type: type, sort_order: order }, { onConflict: 'entity_id,section_key' })
            .select('id').single();
        if (error) { console.log(`   ⚠️  Section ${key}: ${error.message}`); return null; }
        return sec.id;
    }

    let order = 1;

    // ── 2. About ──────────────────────────────────────────────
    if (data.description) {
        const sid = await createSection('about', 'About', 'rich_text', order++);
        if (sid) await supabase.from('section_rich_text').upsert({ section_id: sid, body_text: data.description }, { onConflict: 'section_id' });
    }

    // ── 3. Highlights ─────────────────────────────────────────
    if (data.highlights?.length) {
        const sid = await createSection('highlights', 'Highlights', 'bullets', order++);
        if (sid) {
            await supabase.from('section_bullets').delete().eq('section_id', sid);
            await supabase.from('section_bullets').insert(data.highlights.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 4. Tickets / Schedules ────────────────────────────────
    const ticketPrices = data.ticket_prices || {};
    const schedules    = data.schedules || [];

    if (schedules.length) {
        const sid = await createSection('schedules', 'Times & Tickets', 'grouped_items', order++);
        if (sid) {
            for (let i = 0; i < schedules.length; i++) {
                const s = schedules[i];
                const { data: grp } = await supabase.from('section_groups').insert({ section_id: sid, title: s.time || s.name, subtitle: s.name, sort_order: i }).select('id').single();
                if (grp && s.tickets) {
                    const tickets = Array.isArray(s.tickets) ? s.tickets : Object.entries(s.tickets).map(([name, price]) => ({ name, price }));
                    for (let j = 0; j < tickets.length; j++) {
                        const t = tickets[j];
                        await supabase.from('section_items').insert({ section_id: sid, group_id: grp.id, item_name: t.name, price_text: `$${t.price}`, price_numeric: parseFloat(t.price) || null, item_type: 'ticket', sort_order: j });
                    }
                }
            }
        }
    } else if (Object.keys(ticketPrices).length) {
        // No time slots — just flat ticket prices
        const sid = await createSection('schedules', 'Tickets & Pricing', 'grouped_items', order++);
        if (sid) {
            const { data: grp } = await supabase.from('section_groups').insert({ section_id: sid, title: data.duration || 'Tickets', sort_order: 0 }).select('id').single();
            if (grp) {
                const entries = Object.entries(ticketPrices);
                for (let j = 0; j < entries.length; j++) {
                    const [name, price] = entries[j];
                    await supabase.from('section_items').insert({ section_id: sid, group_id: grp.id, item_name: name, price_text: `$${price}`, price_numeric: parseFloat(price) || null, item_type: 'ticket', sort_order: j });
                }
            }
        }
    }

    // ── 5. What's Included (bullets) ─────────────────────────
    if (data.included?.length) {
        const sid = await createSection('included', "What's Included", 'bullets', order++);
        if (sid) {
            await supabase.from('section_bullets').delete().eq('section_id', sid);
            await supabase.from('section_bullets').insert(data.included.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 6. What to Bring (bullets) ────────────────────────────
    if (data.what_to_bring?.length) {
        const sid = await createSection('what_to_bring', 'What to Bring', 'bullets', order++);
        if (sid) {
            await supabase.from('section_bullets').delete().eq('section_id', sid);
            await supabase.from('section_bullets').insert(data.what_to_bring.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 7. Guest Info / Restrictions (bullets) ────────────────
    if (data.restrictions?.length) {
        const sid = await createSection('restrictions', 'Guest Info', 'bullets', order++);
        if (sid) {
            await supabase.from('section_bullets').delete().eq('section_id', sid);
            await supabase.from('section_bullets').insert(data.restrictions.map((b, i) => ({ section_id: sid, bullet_text: b, sort_order: i + 1 })));
        }
    }

    // ── 8. Gallery ────────────────────────────────────────────
    const images = data.images || [];
    if (images.length) {
        const sid = await createSection('gallery', 'Photos', 'gallery', order++);
        if (sid) {
            await supabase.from('section_photos').delete().eq('section_id', sid);
            await supabase.from('section_photos').insert(images.map((url, i) => ({ section_id: sid, image_url: url, sort_order: i + 1 })));
        }
    }

    // ── 9. Reviews ────────────────────────────────────────────
    if (data.reviews?.length) {
        const sid = await createSection('reviews', 'Reviews', 'reviews', order++);
        if (sid) {
            await supabase.from('section_reviews').delete().eq('section_id', sid);
            await supabase.from('section_reviews').insert(data.reviews.map((r, i) => ({
                section_id: sid,
                author_name: r.author || r.name || 'Guest',
                rating: r.rating || 5,
                review_text: r.text || r.review || r.comment,
                source: 'tripshock',
                sort_order: i + 1
            })));
        }
    }

    // ── 10. Location ──────────────────────────────────────────
    const locSid = await createSection('location', 'Location', 'location', 99);
    if (locSid) {
        await supabase.from('section_location').upsert({
            section_id: locSid,
            address_line_1: addrParts[0]?.trim() || null,
            city: addrParts[1]?.trim() || 'Orange Beach',
            state: 'Alabama',
            zip: addrParts[2]?.match(/\d{5}/)?.[0] || '36561',
            phone: data.phone || null,
            website_url: data.url || null,
            directions_url: data.meeting_point ? `https://maps.google.com/?q=${encodeURIComponent(data.meeting_point)}` : null,
        }, { onConflict: 'section_id' });
    }

    // ── 11. Tags from category + highlights ───────────────────
    const tags = [
        data.category && { tag: data.category.toLowerCase(), tag_category: 'activity' },
        data.duration && { tag: data.duration.toLowerCase(), tag_category: 'feature' },
        ...(data.highlights || []).slice(0, 5).map(h => ({ tag: h.toLowerCase().slice(0, 50), tag_category: 'feature' }))
    ].filter(Boolean).filter((t, i, arr) => arr.findIndex(x => x.tag === t.tag) === i);

    if (tags.length) {
        await supabase.from('entity_tags').upsert(
            tags.map((t, i) => ({ entity_id: entityId, ...t, sort_order: i })),
            { onConflict: 'entity_id,tag', ignoreDuplicates: true }
        );
    }

    console.log(`   ✅ Done: ${data.title}`);
}

async function main() {
    console.log('🚀 Seeding activities from build-main/activities\n');

    const folders = fs.readdirSync(ACTIVITIES_DIR);
    let success = 0, skipped = 0, failed = 0;

    for (const folder of folders) {
        const dataFile = path.join(ACTIVITIES_DIR, folder, 'data.json');
        if (!fs.existsSync(dataFile)) continue;

        try {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            const slug = slugify(data.title);
            if (ALREADY_SEEDED.has(slug)) { skipped++; continue; }
            await seedActivity(data);
            success++;
        } catch(err) {
            console.error(`❌ Failed: ${folder} — ${err.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Done: ${success} seeded, ${skipped} skipped, ${failed} failed`);
}

main();

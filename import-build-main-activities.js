require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const ACTIVITIES_DIR = '/Users/owner/build-main/activities';
const DRY_RUN = process.argv.includes('--apply') ? false : true;
const LIMIT = (() => {
    const arg = process.argv.find(a => a.startsWith('--limit='));
    return arg ? parseInt(arg.split('=')[1]) : null;
})();

function slugify(s) {
    return String(s).toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeName(s) {
    return String(s || '').toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function pickPhone(phones) {
    if (!phones || !phones.length) return null;
    const p = phones[0];
    return typeof p === 'string' ? p : (p.number || p.phone || null);
}

function pickWebsite(d) {
    if (d.external_websites && d.external_websites.length) return d.external_websites[0];
    return d.url || null;
}

function buildAddress(meetingPoint) {
    if (!meetingPoint) return { address: null, city: null, state: null };
    const parts = meetingPoint.split(',').map(s => s.trim());
    let address = parts[0] || null;
    let city = null, state = null;
    if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const m = last.match(/([A-Za-z\s]+?)\s+([A-Z]{2})\b/);
        if (m) {
            city = m[1].trim();
            state = m[2];
        } else {
            city = last;
        }
    }
    return { address, city, state };
}

function findExistingMatch(d, existingEntities) {
    const slug = slugify(d.title);
    // 1. Exact slug match
    let match = existingEntities.find(e => e.slug === slug);
    if (match) return match;
    // 2. Normalized name match (handles "Orange Beach: Tritoon Rental" vs "Orange Beach Tritoon Boat Rental")
    const norm = normalizeName(d.title);
    match = existingEntities.find(e => normalizeName(e.name) === norm);
    if (match) return match;
    // 3. Loose containment (one contains the other, when long enough)
    if (norm.length >= 15) {
        match = existingEntities.find(e => {
            const en = normalizeName(e.name);
            return en.length >= 15 && (en.includes(norm) || norm.includes(en));
        });
        if (match) return match;
    }
    return null;
}

async function fetchAllEntities() {
    const all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from('entity')
            .select('id, name, slug, entity_subtype, is_active')
            .range(from, from + 999);
        if (error || !data || !data.length) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
    }
    return all;
}

async function processOne(folder, existingEntities, dryRun) {
    const cleanedPath = path.join(ACTIVITIES_DIR, folder, 'data-cleaned.json');
    const rawPath = path.join(ACTIVITIES_DIR, folder, 'data.json');
    const dataPath = fs.existsSync(cleanedPath) ? cleanedPath :
                     fs.existsSync(rawPath) ? rawPath : null;
    if (!dataPath) return { folder, status: 'skip', reason: 'no data.json or data-cleaned.json' };

    const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!d.title) return { folder, status: 'skip', reason: 'no title' };

    const existing = findExistingMatch(d, existingEntities);
    const tickets = d.ticket_prices || {};
    const tierCount = Object.keys(tickets).length;

    if (dryRun) {
        return {
            folder,
            status: existing ? 'will-add-tiers-only' : 'will-create-new',
            slug: existing ? existing.slug : slugify(d.title),
            name: d.title,
            matchedExisting: existing ? existing.name : null,
            tierCount,
            highlights: (d.highlights || []).length,
            reviews: (d.reviews || []).length
        };
    }

    let entityId;
    let action;

    if (existing) {
        // Don't create duplicate. Just attach tiers + enrich missing fields.
        entityId = existing.id;
        action = 'tiers-added';

        // Enrich missing fields only (don't overwrite existing data)
        const { data: full } = await supabase.from('entity').select('*').eq('id', entityId).single();
        const enrich = {};
        if (!full.description && d.description) enrich.description = d.description;
        if (!full.duration_text && d.duration) enrich.duration_text = d.duration;
        if (!full.meeting_point && d.meeting_point) enrich.meeting_point = d.meeting_point;
        if (!full.hero_image_url && (d.main_image || (d.images && d.images[0]))) {
            enrich.hero_image_url = d.main_image || d.images[0];
        }
        if (!full.price_from && d.price_from) enrich.price_from = parseFloat(d.price_from);
        if (Object.keys(enrich).length) {
            enrich.updated_at = new Date().toISOString();
            await supabase.from('entity').update(enrich).eq('id', entityId);
        }
    } else {
        // Create new entity
        const slug = slugify(d.title);
        const { address, city, state } = buildAddress(d.meeting_point);
        const phone = pickPhone(d.phones);
        const website = pickWebsite(d);
        const insertRow = {
            slug,
            name: d.title,
            subtitle: d.category || null,
            entity_type: 'business',
            entity_subtype: 'jet-ski-rentals-tours',
            icon: '🎯',
            phone: phone ? phone.replace(/\D/g, '') : null,
            rating: d.rating ? parseFloat(d.rating) : null,
            review_count: d.review_count ? parseInt(d.review_count) : 0,
            address_line_1: address,
            city: city,
            state: state || 'Alabama',
            hero_image_url: d.main_image || (d.images && d.images[0]) || null,
            website_url: website,
            description: d.description || null,
            duration_text: d.duration || null,
            meeting_point: d.meeting_point || null,
            price_from: d.price_from ? parseFloat(d.price_from) : null,
            price_unit: 'per person',
            is_active: true,
            featured: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('entity').insert(insertRow).select('id').single();
        if (error) return { folder, status: 'error', reason: 'entity insert: ' + error.message };
        entityId = data.id;
        action = 'created';
    }

    // Wipe existing menu_items for this entity (clean slate for tiers)
    await supabase.from('menu_items').delete().eq('entity_id', entityId);

    // Insert ticket tiers as menu_items
    const itemRows = [];
    let order = 0;
    for (const [tierName, price] of Object.entries(tickets)) {
        itemRows.push({
            entity_id: entityId,
            item_name: tierName,
            description: d.duration ? `Duration: ${d.duration}` : null,
            price: typeof price === 'number' ? price : parseFloat(price) || null,
            price_text: typeof price === 'number' ? `$${price}` : String(price),
            sort_order: order++,
            is_available: true
        });
    }

    if (itemRows.length > 0) {
        const { error } = await supabase.from('menu_items').insert(itemRows);
        if (error) return { folder, status: 'partial', entityId, action, reason: 'items insert: ' + error.message };
    }

    return {
        folder,
        status: action,
        entityId,
        tiersAdded: itemRows.length,
        matchedExisting: existing ? existing.name : null
    };
}

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING IMPORT ===\n');

    const existingEntities = await fetchAllEntities();
    console.log(`Loaded ${existingEntities.length} existing entities for duplicate-checking\n`);

    let folders = fs.readdirSync(ACTIVITIES_DIR).filter(f =>
        fs.statSync(path.join(ACTIVITIES_DIR, f)).isDirectory()
    );
    console.log(`Found ${folders.length} activity folders`);
    if (LIMIT) {
        folders = folders.slice(0, LIMIT);
        console.log(`⚠️ LIMIT=${LIMIT} — only processing first ${LIMIT}`);
    }
    console.log('');

    const results = [];
    for (const folder of folders) {
        try {
            const r = await processOne(folder, existingEntities, DRY_RUN);
            results.push(r);

            let line;
            if (r.status === 'will-create-new') {
                line = `🆕 NEW: "${r.name}" (${r.tierCount} pricing tiers)`;
            } else if (r.status === 'will-add-tiers-only') {
                line = `🔗 EXISTS: matches "${r.matchedExisting}" — would add ${r.tierCount} pricing tiers`;
            } else if (r.status === 'created') {
                line = `✅ CREATED (${r.tiersAdded} tiers)`;
            } else if (r.status === 'tiers-added') {
                line = `🔄 ENRICHED EXISTING "${r.matchedExisting}" + ${r.tiersAdded} tiers`;
            } else if (r.status === 'skip') {
                line = `⏭ SKIP: ${r.reason}`;
            } else if (r.status === 'error') {
                line = `❌ ERROR: ${r.reason}`;
            } else {
                line = `⚠️ ${r.status}: ${r.reason || ''}`;
            }
            console.log(`${folder}\n    ${line}`);
        } catch (e) {
            console.log(`${folder}\n    ❌ EXCEPTION: ${e.message}`);
            results.push({ folder, status: 'error', reason: e.message });
        }
    }

    console.log('\n══════════════════════════════════════════════════════════════════════');
    if (DRY_RUN) {
        const willNew = results.filter(r => r.status === 'will-create-new').length;
        const willExist = results.filter(r => r.status === 'will-add-tiers-only').length;
        const skip = results.filter(r => r.status === 'skip').length;
        console.log(`DRY RUN preview:`);
        console.log(`  🆕 New entities to create: ${willNew}`);
        console.log(`  🔗 Match existing (add tiers only): ${willExist}`);
        console.log(`  ⏭ Skipped: ${skip}`);
        console.log(`\nRun with --apply to commit.`);
    } else {
        const created = results.filter(r => r.status === 'created').length;
        const enriched = results.filter(r => r.status === 'tiers-added').length;
        const skip = results.filter(r => r.status === 'skip').length;
        const err = results.filter(r => r.status === 'error').length;
        console.log(`Created: ${created} | Enriched existing: ${enriched} | Skipped: ${skip} | Errored: ${err}`);
    }
    console.log('══════════════════════════════════════════════════════════════════════');
}

run();

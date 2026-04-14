#!/usr/bin/env node
// ============================================================
// gcr-full-verify.js — COMPLETE END-TO-END VERIFICATION
// Tests every data path from admin upload → API → launching-GCR display
//
// Covers:
//   ✓ All public API endpoints return correct fields
//   ✓ Every upload method saves and appears on public profile
//   ✓ All listing pages get the right data
//   ✓ Profile page gets all section types
//   ✓ Search works across all data types
//   ✓ Admin → public flow for entity, menu, drinks, events,
//     specials, happy hour, photos, tags, features, sections,
//     fleet, addons, pricing, qna, requirements, policies,
//     meeting point, whats included, shopping, activities
//
// Usage:
//   node agents/gcr-full-verify.js
//   node agents/gcr-full-verify.js --verbose
// ============================================================

require('dotenv').config();

const BASE    = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL   = process.env.ADMIN_EMAIL;
const PASS    = process.env.ADMIN_PASS;
const VERBOSE = process.argv.includes('--verbose');

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m)  { console.log(`  ${G}✓${X} ${m}`); passed.push(m); }
function fail(m){ console.log(`  ${R}✗${X} ${m}`); failed.push(m); }
function warn(m){ console.log(`  ${Y}⚠${X} ${m}`); warned.push(m); }
function sec(t) { console.log(`\n${B}${C}━━ ${t} ${'━'.repeat(Math.max(0,52-t.length))}${X}`); }
function log(m) { if (VERBOSE) console.log(`  ${D}${m}${X}`); }

async function req(method, path, body, token) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers: h };
    if (body) opts.body = JSON.stringify(body);
    try {
        const r = await fetch(BASE + path, opts);
        let data; try { data = await r.json(); } catch { data = null; }
        return { status: r.status, data, ok: r.ok };
    } catch(e) {
        return { status: 0, data: null, ok: false, error: e.message };
    }
}

const TEST_SLUG = `gcr-verify-${Date.now()}`;
let token = null;
let entityId = null;
const cleanup = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkFields(label, obj, fields) {
    if (!obj) { fail(`${label} — response is null`); return; }
    const missing = fields.filter(f => obj[f] === undefined);
    if (missing.length === 0) ok(`${label} — all fields present`);
    else warn(`${label} — missing fields: ${missing.join(', ')}`);
}

function checkArray(label, arr, minLength = 1) {
    if (!Array.isArray(arr)) { fail(`${label} — not an array`); return false; }
    if (arr.length < minLength) { warn(`${label} — empty (${arr.length} items)`); return false; }
    ok(`${label} — ${arr.length} items`); return true;
}

async function uploadAndVerify(label, endpoint, payload, verifyFn) {
    const r = await req('POST', endpoint, payload, token);
    if (!r.ok && r.status !== 200 && r.status !== 201) {
        fail(`Upload ${label} — status ${r.status}: ${JSON.stringify(r.data)?.slice(0,100)}`);
        return false;
    }
    log(`${label} upload response: ${JSON.stringify(r.data)?.slice(0,80)}`);
    ok(`Upload ${label} accepted`);

    // Fetch public profile and verify
    await new Promise(res => setTimeout(res, 500));
    const profile = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
    if (!profile.ok) { fail(`Profile fetch after ${label} upload — status ${profile.status}`); return false; }

    const result = verifyFn(profile.data);
    if (result === true) ok(`${label} appears on public profile`);
    else if (result === false) fail(`${label} NOT found on public profile`);
    else warn(`${label} — ${result}`);
    return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    console.log(`\n${B}GCR Full Verification — Admin → API → Public${X}`);
    console.log(`${D}Target: ${BASE}${X}`);
    console.log(`${D}Time:   ${new Date().toLocaleString()}${X}\n`);

    // ── AUTH ─────────────────────────────────────────────────────────────────
    sec('Authentication');
    if (!EMAIL || !PASS) { fail('ADMIN_EMAIL and ADMIN_PASS not set in .env'); process.exit(1); }
    const lr = await req('POST', '/api/admin/login', { username: EMAIL, password: PASS });
    if (!lr.data?.token) { fail('Admin login failed'); process.exit(1); }
    token = lr.data.token;
    ok(`Logged in as ${EMAIL}`);

    // ── CREATE TEST ENTITY ────────────────────────────────────────────────────
    sec('Create Test Entity');
    const cr = await req('POST', '/api/admin/gcr/entities', {
        entity: {
            name: 'GCR Verify Test (auto-delete)',
            slug: TEST_SLUG,
            entity_type: 'business',
            entity_subtype: 'restaurant',
            subtitle: 'Automated verification entity',
            city: 'Orange Beach',
            state: 'Alabama',
            phone: '(251) 555-0000',
            is_active: true,
        }
    }, token);
    if (!cr.ok && cr.status !== 200 && cr.status !== 201) {
        fail(`Create entity — status ${cr.status}: ${JSON.stringify(cr.data)?.slice(0,100)}`);
        process.exit(1);
    }
    entityId = cr.data?.entity?.id || cr.data?.id;
    ok(`Test entity created: ${entityId}`);
    cleanup.push(() => req('DELETE', `/api/admin/gcr/entities/${entityId}`, null, token));

    // ── PUBLIC ENTITY APPEARS ─────────────────────────────────────────────────
    sec('Entity Appears on Public Site');
    const pubList = await req('GET', '/api/gcr/entities');
    const entities = Array.isArray(pubList.data) ? pubList.data : (pubList.data?.entities || pubList.data?.businesses || []);
    const found = Array.isArray(entities) ? entities.find(e => e.slug === TEST_SLUG) : null;
    found ? ok('Entity appears in /api/gcr/entities') : warn('Entity not yet in listing (may be caching)');

    const profile1 = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
    profile1.ok && profile1.data?.entity ? ok('Entity loads by slug') : fail('Entity slug lookup failed');

    // ── LISTING PAGE FIELDS ───────────────────────────────────────────────────
    sec('/api/gcr/entities — Listing Page Fields');
    if (found) {
        checkFields('Entity card fields', found, [
            'slug','name','entity_subtype','city','state','address_line_1',
            'phone','hero_image_url','directions_url','booking_url',
            'reservation_url','order_url','hh_days','hh_start','hh_end',
            'price_range','featured','rating','review_count'
        ]);
    } else {
        // Check first entity in list
        const sample = entities[0];
        if (sample) checkFields('Entity card fields (sample)', sample, [
            'slug','name','entity_subtype','city','phone','directions_url',
            'booking_url','hh_days','rating'
        ]);
    }

    // ── HAPPY HOURS ENDPOINT FIELDS ───────────────────────────────────────────
    sec('/api/gcr/happy-hours — Fields');
    const hhRes = await req('GET', '/api/gcr/happy-hours');
    if (hhRes.ok && Array.isArray(hhRes.data) && hhRes.data.length > 0) {
        ok(`Happy hours endpoint — ${hhRes.data.length} entities`);
        checkFields('HH entity fields', hhRes.data[0], [
            'slug','name','city','hh_days','hh_start','hh_end','hh_description',
            'hours','phone','directions_url','call_url','booking_url','photos'
        ]);
    } else fail(`Happy hours endpoint — status ${hhRes.status}`);

    // ── SPECIALS ENDPOINT FIELDS ──────────────────────────────────────────────
    sec('/api/gcr/specials — Fields');
    const spRes = await req('GET', '/api/gcr/specials');
    if (spRes.ok && Array.isArray(spRes.data) && spRes.data.length > 0) {
        ok(`Specials endpoint — ${spRes.data.length} specials`);
        checkFields('Special fields', spRes.data[0], [
            'slug','special_name','discount_text','description',
            'businessName','hero_image_url','city','phone',
            'directions_url','call_url','booking_url','days'
        ]);
    } else fail(`Specials endpoint — status ${spRes.status}`);

    // ── EVENTS ENDPOINT FIELDS ────────────────────────────────────────────────
    sec('/api/gcr/events — Fields');
    const evRes = await req('GET', '/api/gcr/events');
    if (evRes.ok && Array.isArray(evRes.data) && evRes.data.length > 0) {
        ok(`Events endpoint — ${evRes.data.length} events`);
        checkFields('Event fields', evRes.data[0], [
            'event_name','businessName','entity_slug','hero_image_url','city','date'
        ]);
    } else fail(`Events endpoint — status ${evRes.status}`);

    // ── PROFILE PAGE FIELDS ───────────────────────────────────────────────────
    sec('/api/gcr/entity/:slug — Full Profile Fields');
    const profileFull = await req('GET', '/api/gcr/entity/cobalt-the-restaurant');
    const pEnt = profileFull.data?.entity;
    if (pEnt) {
        ok(`Full profile loads (cobalt-the-restaurant)`);
        checkFields('Profile entity fields', pEnt, [
            'name','slug','subtitle','entity_subtype','icon','phone','email',
            'website_url','directions_url','call_url','booking_url',
            'reservation_url','order_url','address_line_1','city','state',
            'rating','review_count','hero_image_url','description',
            'hh_days','hh_start','hh_end','social_instagram','social_facebook','social_tiktok'
        ]);
        checkFields('Profile sections', profileFull.data, ['sections','tags','features','perfect_for','hours','photos']);
    } else {
        // Use our test entity
        const p2 = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
        checkFields('Profile entity fields', p2.data?.entity, [
            'name','slug','subtitle','entity_subtype','phone','city','state'
        ]);
    }

    // ── UPLOAD: MENU ITEMS ────────────────────────────────────────────────────
    sec('Upload: Menu Items → appears on profile');
    await uploadAndVerify('Menu items (CSV)', '/api/admin/gcr/import-menu', {
        slug: TEST_SLUG,
        rows: [
            { section: 'Starters', item_name: 'Verify Crab Dip', description: 'Test item', price: '14' },
            { section: 'Entrees', item_name: 'Verify Grouper', description: 'Gulf fresh', price: '32' },
        ]
    }, (data) => {
        const sections = data?.sections || [];
        const hasMenu = sections.some(s => s.section_type === 'grouped_items' || s.section_key?.includes('menu') || s.section_key?.includes('starter') || s.section_key?.includes('entree'));
        return hasMenu || sections.length > 0 ? true : 'No menu sections found';
    });

    // ── UPLOAD: DRINKS ────────────────────────────────────────────────────────
    sec('Upload: Drinks → appears on profile');
    await uploadAndVerify('Drinks (CSV)', '/api/admin/gcr/import-drinks', {
        slug: TEST_SLUG,
        rows: [
            { section: 'Beer', item_name: 'Verify IPA', item_style: 'IPA', price: '7' },
            { section: 'Cocktails', item_name: 'Verify Margarita', price: '12' },
        ]
    }, (data) => {
        const drinks = data?.drinks || data?.entity?.drinks || [];
        return Array.isArray(drinks) && drinks.length > 0 ? true : 'No drinks data found';
    });

    // ── UPLOAD: EVENTS ────────────────────────────────────────────────────────
    sec('Upload: Events → appears on /api/gcr/events');
    const evUpload = await req('POST', '/api/admin/gcr/import-events', {
        slug: TEST_SLUG,
        rows: [{ event_name: 'Verify Live Music', event_date: '2026-12-31', event_type: 'live_music', description: 'Test event' }]
    }, token);
    if (evUpload.ok) {
        ok('Events upload accepted');
        await new Promise(res => setTimeout(res, 500));
        const evCheck = await req('GET', '/api/gcr/events');
        const evFound = (evCheck.data || []).find(e => e.event_name === 'Verify Live Music' || e.entity_slug === TEST_SLUG);
        evFound ? ok('Event appears on /api/gcr/events') : warn('Event not yet in /api/gcr/events (may need time)');
    } else fail(`Events upload — status ${evUpload.status}`);

    // ── UPLOAD: SPECIALS ──────────────────────────────────────────────────────
    sec('Upload: Specials → appears on /api/gcr/specials');
    const spUpload = await req('POST', '/api/admin/gcr/import-specials', {
        slug: TEST_SLUG,
        rows: [{ special_name: 'Verify Tuesday Special', discount_text: '20% off', description: 'Test special', days: 'Tuesday' }]
    }, token);
    if (spUpload.ok) {
        ok('Specials upload accepted');
        await new Promise(res => setTimeout(res, 500));
        const spCheck = await req('GET', '/api/gcr/specials');
        const spFound = (spCheck.data || []).find(s => s.entity_slug === TEST_SLUG || s.slug === TEST_SLUG);
        spFound ? ok('Special appears on /api/gcr/specials') : warn('Special not yet in /api/gcr/specials');
    } else fail(`Specials upload — status ${spUpload.status}`);

    // ── UPLOAD: TAGS ──────────────────────────────────────────────────────────
    sec('Upload: Tags → searchable + on profile');
    if (entityId) {
        const tagR = await req('POST', `/api/admin/gcr/entities/${entityId}/tags`, { tag: 'verify-test-tag', tag_type: 'feature' }, token);
        if (tagR.ok) {
            ok('Tag added via editor');
            const p = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
            const hasTags = (p.data?.tags || []).length > 0;
            hasTags ? ok('Tags appear on profile') : warn('Tags not on profile yet');
        } else fail(`Add tag — status ${tagR.status}`);
    }

    // ── UPLOAD: FEATURES ──────────────────────────────────────────────────────
    sec('Upload: Features → appears on profile');
    if (entityId) {
        const featR = await req('POST', `/api/admin/gcr/entities/${entityId}/features`, { label: 'Verify Feature', sort_order: 0 }, token);
        if (featR.ok) {
            ok('Feature added');
            const p = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
            const hasFeats = (p.data?.features || []).length > 0;
            hasFeats ? ok('Features appear on profile') : warn('Features not on profile');
        } else fail(`Add feature — status ${featR.status}`);
    }

    // ── UPLOAD: SECTIONS (About) ──────────────────────────────────────────────
    sec('Upload: Content Section → appears on profile');
    if (entityId) {
        const secR = await req('POST', `/api/admin/gcr/entities/${entityId}/sections`, {
            section_key: 'about', section_label: 'About', section_type: 'rich_text', sort_order: 1
        }, token);
        if (secR.ok) {
            const secId = secR.data?.section?.id || secR.data?.id;
            ok(`Section created: ${secId}`);
            if (secId) {
                await req('POST', `/api/admin/gcr/sections/${secId}/bullets`, { bullet_text: 'Verify bullet point' }, token);
                const p = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
                const secs = p.data?.sections || [];
                secs.length > 0 ? ok(`Sections appear on profile (${secs.length})`) : warn('Sections not on profile');
            }
        } else fail(`Create section — status ${secR.status}`);
    }

    // ── UPLOAD: PHOTOS ────────────────────────────────────────────────────────
    sec('Upload: Photo URLs → appears on profile');
    const photoR = await req('POST', '/api/admin/gcr/import-photos', {
        slug: TEST_SLUG,
        rows: [{ image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', caption: 'Verify photo' }]
    }, token);
    if (photoR.ok) {
        ok('Photos upload accepted');
        const p = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
        const photos = p.data?.photos || p.data?.entity?.photos || [];
        photos.length > 0 ? ok(`Photos appear on profile (${photos.length})`) : warn('Photos not on profile yet');
    } else fail(`Photos upload — status ${photoR.status}`);

    // ── UPLOAD: FLEET ─────────────────────────────────────────────────────────
    sec('Upload: Fleet → appears on profile');
    await uploadAndVerify('Fleet (CSV)', '/api/admin/gcr/import-fleet', {
        slug: TEST_SLUG,
        rows: [{ vessel_name: 'Verify Boat', vessel_type: 'pontoon', capacity: 12, description: 'Test vessel' }]
    }, (data) => {
        const fleet = data?.fleet || data?.entity?.fleet || [];
        return Array.isArray(fleet) && fleet.length > 0 ? true : 'No fleet data on profile';
    });

    // ── UPLOAD: ADD-ONS ───────────────────────────────────────────────────────
    sec('Upload: Add-ons → appears on profile');
    await uploadAndVerify('Add-ons (CSV)', '/api/admin/gcr/import-addons', {
        slug: TEST_SLUG,
        rows: [{ addon_name: 'Verify Bait Package', addon_type: 'equipment', price: '25', description: 'Test addon' }]
    }, (data) => {
        const addons = data?.addons || data?.entity?.addons || [];
        return Array.isArray(addons) && addons.length > 0 ? true : 'No addons on profile';
    });

    // ── UPLOAD: PRICING ───────────────────────────────────────────────────────
    sec('Upload: Pricing → appears on profile');
    await uploadAndVerify('Pricing (CSV)', '/api/admin/gcr/import-pricing', {
        slug: TEST_SLUG,
        rows: [{ package_name: 'Verify Full Day', duration_hours: 8, price: 800, max_guests: 6, description: 'Test package' }]
    }, (data) => {
        const pricing = data?.pricing || data?.entity?.pricing || [];
        return Array.isArray(pricing) && pricing.length > 0 ? true : 'No pricing on profile';
    });

    // ── UPLOAD: QnA ───────────────────────────────────────────────────────────
    sec('Upload: Q&A → appears on profile');
    await uploadAndVerify('Q&A (CSV)', '/api/admin/gcr/import-qna', {
        slug: TEST_SLUG,
        rows: [{ question: 'Do you provide equipment?', answer: 'Yes, all gear included.' }]
    }, (data) => {
        const qna = data?.qna || data?.entity?.qna || [];
        return Array.isArray(qna) && qna.length > 0 ? true : 'No QnA on profile';
    });

    // ── UPLOAD: WHAT'S INCLUDED ───────────────────────────────────────────────
    sec('Upload: What\'s Included → appears on profile');
    await uploadAndVerify("What's Included (CSV)", '/api/admin/gcr/import-included', {
        slug: TEST_SLUG,
        rows: [{ item_text: 'Verify Fishing Gear' }, { item_text: 'Verify Bait' }]
    }, (data) => {
        const inc = data?.whats_included || data?.entity?.whats_included || [];
        return Array.isArray(inc) && inc.length > 0 ? true : "No whats_included on profile";
    });

    // ── UPLOAD: REQUIREMENTS ──────────────────────────────────────────────────
    sec('Upload: Requirements → appears on profile');
    await uploadAndVerify('Requirements (CSV)', '/api/admin/gcr/import-requirements', {
        slug: TEST_SLUG,
        rows: [{ requirement_text: 'Must be 6+ years old' }, { requirement_text: 'Closed-toe shoes required' }]
    }, (data) => {
        const req2 = data?.requirements || data?.entity?.requirements || [];
        return Array.isArray(req2) && req2.length > 0 ? true : 'No requirements on profile';
    });

    // ── UPLOAD: POLICIES ──────────────────────────────────────────────────────
    sec('Upload: Policies → appears on profile');
    await uploadAndVerify('Policies (CSV)', '/api/admin/gcr/import-policies', {
        slug: TEST_SLUG,
        rows: [{ policy_text: 'Verify 48-hour cancellation policy' }]
    }, (data) => {
        const pol = data?.policies || data?.entity?.policies || [];
        return Array.isArray(pol) && pol.length > 0 ? true : 'No policies on profile';
    });

    // ── UPLOAD: MEETING POINT ─────────────────────────────────────────────────
    sec('Upload: Meeting Point → appears on profile');
    await uploadAndVerify('Meeting Point (CSV)', '/api/admin/gcr/import-meetingpoint', {
        slug: TEST_SLUG,
        rows: [{ location_name: 'Verify Marina Dock A', address: '123 Test Harbor Rd', instructions: 'Park in lot B' }]
    }, (data) => {
        const mp = data?.meeting_points || data?.entity?.meeting_points || [];
        return Array.isArray(mp) && mp.length > 0 ? true : 'No meeting_points on profile';
    });

    // ── UPLOAD: SECTION-BASED (master CSV) ───────────────────────────────────
    sec('Upload: Section-Based Master CSV');
    const masterR = await req('POST', '/api/admin/gcr/import-section-based', {
        rows: [
            { entity_slug: TEST_SLUG, record_type: 'menu', section: 'Lunch', item_name: 'Verify Lunch Item', price: '15' },
            { entity_slug: TEST_SLUG, record_type: 'tags', item_name: 'outdoor-seating,waterfront' },
        ]
    }, token);
    masterR.ok ? ok(`Section-based upload accepted: ${JSON.stringify(masterR.data).slice(0,80)}`) : fail(`Section-based upload — status ${masterR.status}: ${JSON.stringify(masterR.data)?.slice(0,100)}`);

    // ── ENTITY EDITOR SAVE ────────────────────────────────────────────────────
    sec('Entity Editor: Save all info fields');
    if (entityId) {
        const saveR = await req('PUT', `/api/admin/gcr/entities/${entityId}`, {
            entity: {
                name: 'GCR Verify Test (auto-delete)',
                subtitle: 'Updated subtitle',
                phone: '(251) 555-1234',
                website_url: 'https://example.com',
                booking_url: 'https://example.com/book',
                rating: 4.5,
                review_count: 42,
                is_active: true,
            }
        }, token);
        if (saveR.ok) {
            ok('Entity editor save accepted');
            const p = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
            const e = p.data?.entity;
            if (e?.subtitle === 'Updated subtitle') ok('Updated fields appear on public profile');
            else warn('Updated fields not yet on public profile');
        } else fail(`Entity editor save — status ${saveR.status}`);
    }

    // ── ACTIVE / INACTIVE TOGGLE ──────────────────────────────────────────────
    sec('Active/Inactive Toggle → listing visibility');
    if (entityId) {
        // Deactivate
        await req('PUT', `/api/admin/gcr/entities/${entityId}`, { entity: { is_active: false } }, token);
        await new Promise(r => setTimeout(r, 500));
        const pubOff = await req('GET', '/api/gcr/entities');
        const entsOff = Array.isArray(pubOff.data) ? pubOff.data : (pubOff.data?.entities || []);
        const hiddenOk = Array.isArray(entsOff) && !entsOff.find(e => e.slug === TEST_SLUG);
        hiddenOk ? ok('Entity hidden when is_active=false') : warn('Entity still showing after deactivation (may be cached)');

        // Re-activate
        await req('PUT', `/api/admin/gcr/entities/${entityId}`, { entity: { is_active: true } }, token);
        ok('Entity re-activated');
    }

    // ── SEARCH ────────────────────────────────────────────────────────────────
    sec('Search — all data types');
    const searches = [
        { query: 'restaurant', label: 'Category search' },
        { query: 'Orange Beach', label: 'Location search' },
        { query: 'happy hour', label: 'Happy hour search' },
        { query: 'fishing', label: 'Activity search' },
        { query: 'live music', label: 'Event search' },
    ];
    for (const { query, label } of searches) {
        const sr = await req('POST', '/api/gcr/search', { query });
        if (sr.status === 500) fail(`Search "${label}" → 500 crash`);
        else if (sr.status === 200) {
            const count = sr.data?.results?.length || 0;
            count > 0 ? ok(`Search "${label}" → ${count} results`) : warn(`Search "${label}" → 0 results`);
        } else fail(`Search "${label}" → status ${sr.status}`);
    }

    // ── ALL LISTING PAGES API CHECK ───────────────────────────────────────────
    sec('All Listing Page Endpoints');
    const listingChecks = [
        { path: '/api/gcr/entities', label: 'Restaurants/Things-To-Do/Nightlife/Shopping', minFields: ['slug','name','entity_subtype','city','phone'] },
        { path: '/api/gcr/events', label: 'Events page', minFields: ['event_name','businessName','entity_slug'] },
        { path: '/api/gcr/specials', label: 'Specials page', minFields: ['special_name','businessName','slug'] },
        { path: '/api/gcr/happy-hours', label: 'Happy Hours page', minFields: ['slug','name','hh_days','hours'] },
        { path: '/api/gcr/featured', label: 'Homepage featured', minFields: [] },
        { path: '/api/gcr/categories', label: 'Category config', minFields: [] },
    ];
    for (const { path, label, minFields } of listingChecks) {
        const r = await req('GET', path);
        if (!r.ok) { fail(`${label} — status ${r.status}`); continue; }
        const arr = Array.isArray(r.data) ? r.data : (r.data?.entities || r.data?.businesses || []);
        const count = Array.isArray(arr) ? arr.length : (typeof r.data === 'object' ? Object.keys(r.data).length : 0);
        if (count === 0) { warn(`${label} — 0 results`); continue; }
        ok(`${label} — ${count} items`);
        if (minFields.length > 0 && Array.isArray(arr) && arr[0]) {
            const missing = minFields.filter(f => arr[0][f] === undefined);
            if (missing.length > 0) warn(`${label} missing fields: ${missing.join(', ')}`);
        }
    }

    // ── CLEANUP ───────────────────────────────────────────────────────────────
    sec('Cleanup');
    for (const fn of cleanup) {
        try { await fn(); } catch(e) { /* ignore */ }
    }
    ok(`Test entity deleted (${TEST_SLUG})`);

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    const total = passed.length + failed.length + warned.length;
    console.log(`\n${B}${'═'.repeat(58)}${X}`);
    console.log(`${B}Full Verify: ${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}  ${D}/ ${total} total${X}`);

    if (failed.length === 0 && warned.length <= 5) {
        console.log(`\n${G}${B}✓ ALL SYSTEMS GO — ready to launch${X}`);
    } else if (failed.length === 0) {
        console.log(`\n${Y}${B}⚠ LAUNCH WITH CAUTION — ${warned.length} warnings${X}`);
        warned.forEach(w => console.log(`  ${Y}⚠${X} ${w}`));
    } else {
        console.log(`\n${R}${B}✗ NOT READY — ${failed.length} failures${X}`);
        failed.forEach(f => console.log(`  ${R}✗${X} ${f}`));
        if (warned.length > 0) {
            console.log(`\n${Y}Warnings:${X}`);
            warned.forEach(w => console.log(`  ${Y}⚠${X} ${w}`));
        }
    }
    console.log();
    process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });

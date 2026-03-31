const express = require('express');
const supabase = require('../db');

const router = express.Router();

// ============================================
// GET /api/gcr/businesses — DEPRECATED: redirects to /entities
// Old DB no longer used for GCR public pages
// ============================================
router.get('/businesses', async (req, res) => {
    // Redirect to entities endpoint — old DB disabled
    return res.redirect('/api/gcr/entities?' + new URLSearchParams(req.query).toString());
    /* DISABLED — old DB code below */
    let query = supabase
        .from('businesses')
        .select(`site_id, name, type, subdomain, domain, logo_url, cover_url, status,
            emoji, tagline, featured, tags, price_range, rating, review_count,
            happy_hour, kids_friendly, pet_friendly, live_music, outdoor, reservations,
            alcohol, booking_required, delivery, takeout, sort_order, gcr_listed, gcr_verified,
            subcategory, waterfront, beachfront,
            site_content(address, city, state, zip, lat, lng, hours, theme_color, seo_description, about_text, contact_phone, website_url, social_links)`)
        .eq('status', 'active')
        .eq('gcr_listed', true)
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (req.query.type || req.query.category) query = query.eq('type', req.query.type || req.query.category);
    if (req.query.subcategory)                query = query.eq('subcategory', req.query.subcategory);
    if (req.query.search)                     query = query.ilike('name', `%${req.query.search}%`);
    if (req.query.featured === 'true')        query = query.eq('featured', true);
    if (req.query.pet_friendly === 'true')    query = query.eq('pet_friendly', true);
    if (req.query.kids_friendly === 'true')   query = query.eq('kids_friendly', true);
    if (req.query.live_music === 'true')      query = query.eq('live_music', true);
    if (req.query.waterfront === 'true')      query = query.eq('waterfront', true);

    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const offset = parseInt(req.query.offset) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const businesses = (data || []).map(b => {
        const content = b.site_content || {};
        delete b.site_content;
        return {
            ...b,
            category:    b.type,        // alias for GCR compatibility
            subcategory: b.subcategory || null,
            id:          b.site_id,
            slug:        b.subdomain || b.site_id,
            address: content.address || '',
            city: content.city || '',
            state: content.state || '',
            zip: content.zip || '',
            lat: content.lat || null,
            lng: content.lng || null,
            hours: content.hours || {},
            phone: content.contact_phone || '',
            website: content.website_url || '',
            description: content.about_text || content.seo_description || '',
            social: content.social_links || {},
            priceRange: b.price_range || '',
            reviewCount: b.review_count || 0,
            happyHour: b.happy_hour === true || b.happy_hour === 'true',
            kidsFriendly: b.kids_friendly || false,
            petFriendly: b.pet_friendly || false,
            liveMusic: b.live_music || false,
        };
    });

    res.json({ businesses, total: businesses.length, limit, offset });
});

// ============================================
// GET /api/gcr/events — old DB events matched to GCR entities by slug
// ============================================
router.get('/events', async (req, res) => {
    let query = supabase
        .from('events')
        .select('*, businesses(name, emoji, type, subdomain)')
        .eq('active', true)
        .order('event_date', { ascending: true });

    if (req.query.site_id) query = query.eq('site_id', req.query.site_id);
    if (req.query.upcoming === 'true') { const today = new Date().toISOString().split('T')[0]; query = query.or(`event_date.gte.${today},recurring.eq.true`); }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Build slug→entity lookup from GCR DB for hero images
    const { data: entities } = await gcrDb.from('entity').select('slug, name, icon, hero_image_url, entity_subtype, city').eq('is_active', true).range(0, 999);
    const entBySlug = {};
    (entities || []).forEach(e => { entBySlug[e.slug] = e; });

    const events = (data || []).map(e => {
        const slug = e.businesses?.subdomain || e.site_id;
        const ent = entBySlug[slug] || {};
        return {
            ...e,
            date: e.event_date,
            time: e.event_time,
            businessName: ent.name || e.businesses?.name || '',
            businessEmoji: ent.icon || e.businesses?.emoji || '🏪',
            category: ent.entity_subtype || e.businesses?.type || '',
            slug: slug,
            hero_image_url: ent.hero_image_url || null,
        };
    });

    res.json(events);
});

// ============================================
// GET /api/gcr/happy-hours — combines site_content HH + specials named "Happy Hour"
// ============================================
router.get('/happy-hours', async (req, res) => {
    // Get GCR entity data for images (used for both sources)
    const { data: entities } = await gcrDb.from('entity').select('slug, name, hero_image_url, icon, rating, city, phone, directions_url, address_line_1').eq('is_active', true).range(0, 999);
    const entBySlug = {};
    const entByName = {};
    (entities || []).forEach(e => {
        entBySlug[e.slug] = e;
        entByName[(e.name || '').toLowerCase()] = e;
    });

    // Source 1: businesses with site_content.happy_hour
    const { data: hhBiz } = await supabase
        .from('businesses')
        .select(`site_id, name, emoji, type, subdomain, rating, tags,
            site_content(happy_hour, address, city, state, contact_phone, hours, google_maps),
            business_media(url, section, sort_order)`)
        .eq('status', 'active')
        .eq('gcr_listed', true)
        .not('site_content.happy_hour', 'is', null);

    // Source 2: specials named "happy hour"
    const { data: hhSpecials } = await supabase
        .from('specials')
        .select('*, businesses(name, emoji, type, subdomain)')
        .eq('active', true)
        .ilike('name', '%happy hour%');

    const results = [];
    const seen = new Set();

    // Process source 1
    (hhBiz || []).filter(b => b.site_content?.happy_hour).forEach(b => {
        const slug = b.subdomain || b.site_id;
        const c = b.site_content || {};
        const media = (b.business_media || []).sort((a,bb) => a.sort_order - bb.sort_order);
        const cover = media.find(m => m.section === 'cover')?.url || media[0]?.url || null;
        const ent = entBySlug[slug] || entByName[(b.name || '').toLowerCase()] || {};
        seen.add(slug);
        results.push({
            slug:      ent.slug || slug,
            name:      b.name,
            emoji:     ent.icon || b.emoji || '🏪',
            type:      b.type || '',
            rating:    ent.rating || b.rating || null,
            tags:      b.tags || [],
            address:   ent.address_line_1 || c.address || '',
            city:      ent.city || c.city || '',
            phone:     ent.phone || c.contact_phone || '',
            google_maps: ent.directions_url || c.google_maps || '',
            cover:     ent.hero_image_url || cover,
            happyHour: c.happy_hour,
        });
    });

    // Process source 2 — group specials by business
    const hhByBiz = {};
    (hhSpecials || []).forEach(s => {
        const slug = s.businesses?.subdomain || s.site_id;
        if (seen.has(slug)) return; // already from source 1
        if (!hhByBiz[slug]) hhByBiz[slug] = { biz: s.businesses || {}, specials: [], site_id: s.site_id };
        hhByBiz[slug].specials.push(s);
    });

    Object.entries(hhByBiz).forEach(([slug, data]) => {
        const biz = data.biz;
        const ent = entBySlug[slug] || entBySlug[biz.subdomain] || entByName[(biz.name || '').toLowerCase()] || {};
        // Build happyHour object from specials
        const items = data.specials.map(s => ({
            name: s.name,
            description: s.description || '',
            days: s.days || '',
            discount: s.discount_text || s.discount || '',
        }));
        seen.add(slug);
        results.push({
            slug:      ent.slug || biz.subdomain || slug,
            name:      ent.name || biz.name || '',
            emoji:     ent.icon || biz.emoji || '🏪',
            type:      biz.type || '',
            rating:    ent.rating || null,
            tags:      [],
            address:   ent.address_line_1 || '',
            city:      ent.city || '',
            phone:     ent.phone || '',
            google_maps: ent.directions_url || '',
            cover:     ent.hero_image_url || null,
            happyHour: items.length === 1 ? (items[0].description || items[0].days || 'Happy Hour available') : items,
        });
    });

    res.json(results);
});

// ============================================
// GET /api/gcr/specials — old DB specials matched to GCR entities
// Excludes happy hours (those go to /happy-hours)
// ============================================
router.get('/specials', async (req, res) => {
    let query = supabase
        .from('specials')
        .select('*, businesses(name, emoji, type, subdomain)')
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (req.query.site_id) query = query.eq('site_id', req.query.site_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Get GCR entity data for images/icons
    const { data: entities } = await gcrDb.from('entity').select('slug, name, hero_image_url, icon, entity_subtype, city, phone, directions_url, address_line_1').eq('is_active', true).range(0, 999);
    const entBySlug = {};
    const entByName = {};
    (entities || []).forEach(e => {
        entBySlug[e.slug] = e;
        entByName[(e.name || '').toLowerCase()] = e;
    });

    const specials = (data || [])
        // Exclude happy hours at the API level — they belong on /happy-hours
        .filter(s => !(s.name || '').toLowerCase().includes('happy hour'))
        .map(s => {
            const slug = s.businesses?.subdomain || s.site_id;
            const bizName = s.businesses?.name || '';
            // Try slug match, then name match
            const ent = entBySlug[slug] || entBySlug[s.businesses?.subdomain] || entByName[bizName.toLowerCase()] || {};
            return {
                ...s,
                businessName: ent.name || bizName,
                businessEmoji: ent.icon || s.businesses?.emoji || '🏪',
                category: ent.entity_subtype || s.businesses?.type || '',
                slug: ent.slug || slug,
                hero_image_url: ent.hero_image_url || null,
                city: ent.city || '',
                phone: ent.phone || '',
                directions_url: ent.directions_url || '',
                address: ent.address_line_1 || '',
            };
        });

    res.json(specials);
});

// ============================================
// POST /api/gcr/search — AI-powered semantic search
// ============================================
router.post('/search', async (req, res) => {
    const { query: searchQuery, lat, lng, radius_miles, type, open_now } = req.body;

    if (!searchQuery) {
        return res.status(400).json({ error: 'Search query required' });
    }

    // For now: text-based search (pgvector semantic search added later)
    let dbQuery = supabase
        .from('businesses')
        .select(`
            site_id, name, type, subdomain, domain, logo_url, cover_url,
            site_content(address, city, state, zip, lat, lng, hours, theme_color, seo_description, contact_phone)
        `)
        .eq('status', 'active')
        .eq('gcr_listed', true)
        .ilike('name', `%${searchQuery}%`);

    if (type) dbQuery = dbQuery.eq('type', type);

    const { data: byName } = await dbQuery;

    // Also search by description
    const { data: byDesc } = await supabase
        .from('site_content')
        .select('site_id, seo_description')
        .ilike('seo_description', `%${searchQuery}%`);

    const descSiteIds = (byDesc || []).map(d => d.site_id);

    let additionalResults = [];
    if (descSiteIds.length > 0) {
        const { data: byDescBiz } = await supabase
            .from('businesses')
            .select(`
                site_id, name, type, subdomain, domain, logo_url, cover_url,
                site_content(address, city, state, zip, lat, lng, hours, theme_color, seo_description, contact_phone)
            `)
            .eq('status', 'active')
            .eq('gcr_listed', true)
            .in('site_id', descSiteIds);

        additionalResults = byDescBiz || [];
    }

    // Also search services
    const { data: serviceMatches } = await supabase
        .from('services')
        .select('site_id, name')
        .ilike('name', `%${searchQuery}%`);

    const serviceSiteIds = [...new Set((serviceMatches || []).map(s => s.site_id))];

    if (serviceSiteIds.length > 0) {
        const { data: byService } = await supabase
            .from('businesses')
            .select(`
                site_id, name, type, subdomain, domain, logo_url, cover_url,
                site_content(address, city, state, zip, lat, lng, hours, theme_color, seo_description, contact_phone)
            `)
            .eq('status', 'active')
            .eq('gcr_listed', true)
            .in('site_id', serviceSiteIds);

        additionalResults = [...additionalResults, ...(byService || [])];
    }

    // Merge and deduplicate
    const allResults = [...(byName || []), ...additionalResults];
    const seen = new Set();
    const unique = allResults.filter(b => {
        if (seen.has(b.site_id)) return false;
        seen.add(b.site_id);
        return true;
    });

    // Flatten site_content
    const businesses = unique.map(b => {
        const content = b.site_content || {};
        delete b.site_content;
        return { ...b, ...content };
    });

    // TODO: Replace with pgvector semantic search
    // TODO: Add AI summary of results
    res.json({
        query: searchQuery,
        results: businesses,
        total: businesses.length,
        ai_summary: `Found ${businesses.length} businesses matching "${searchQuery}".`
    });
});

// ============================================
// GET /api/gcr/businesses/:slug — Full business profile by slug
// Returns: business + site_content + fleet + pricing + addons + services + reviews + specials + events
// Used by: gcr/business.html?id=:slug
// ============================================
router.get('/businesses/:slug', async (req, res) => {
    const slug = req.params.slug;

    // Look up by subdomain (slug)
    const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select(`site_id, name, type, subdomain, domain, logo_url, cover_url, status,
            emoji, tagline, featured, tags, price_range, rating, review_count,
            happy_hour, kids_friendly, pet_friendly, live_music, outdoor, reservations,
            alcohol, booking_required, delivery, takeout, waterfront, beachfront,
            subcategory, sort_order, gcr_listed, gcr_verified, instagram, facebook, tiktok`)
        .eq('subdomain', slug)
        .eq('status', 'active')
        .single();

    if (bizErr || !business) {
        return res.status(404).json({ error: 'Business not found' });
    }

    const siteId = business.site_id;

    const [content, services, fleet, pricing, addons, groupRates, reviews, specials, events, menuItems, mediaItems] = await Promise.all([
        supabase.from('site_content').select('*').eq('site_id', siteId).single(),
        supabase.from('services').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('fleet_types').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('rental_pricing').select('*, rental_time_slots(name)').eq('site_id', siteId).eq('active', true),
        supabase.from('rental_addons').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('rental_group_rates').select('*').eq('site_id', siteId).eq('active', true),
        supabase.from('reviews').select('*').eq('site_id', siteId).eq('active', true).order('created_at', { ascending: false }),
        supabase.from('specials').select('*').eq('site_id', siteId).eq('active', true).order('created_at'),
        supabase.from('events').select('*').eq('site_id', siteId).eq('active', true).order('event_date', { ascending: true }),
        supabase.from('menu_items').select('name, description, price, category, item_type, tags').eq('site_id', siteId).eq('available', true).order('sort_order'),
        supabase.from('business_media').select('url, caption, section, sort_order').eq('site_id', siteId).order('sort_order'),
    ]);

    const c = content.data || {};

    // Group menu_items by category → array of {category, meal, items[]}
    const menuMap = {};
    const barMap = {};
    const MEAL_NAMES = ['brunch','lunch','dinner','kids','gluten-free','gluten free'];
    (menuItems.data || []).forEach(item => {
        const isDrink = item.item_type === 'drink';
        const displayCat = item.category || 'Menu';
        const catKey = displayCat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
        const formatted = { name: item.name, desc: item.description || '', price: item.price ? `$${parseFloat(item.price).toFixed(2).replace('.00','')}` : '', tags: item.tags || [] };
        if (isDrink) {
            if (!barMap[catKey]) barMap[catKey] = { category: displayCat, items: [] };
            barMap[catKey].items.push(formatted);
        } else {
            const meal = MEAL_NAMES.includes(displayCat.toLowerCase()) ? displayCat.toLowerCase().replace(/\s+/g,'-') : 'other';
            if (!menuMap[catKey]) menuMap[catKey] = { category: displayCat, meal, items: [] };
            menuMap[catKey].items.push(formatted);
        }
    });
    const menu = Object.values(menuMap);
    const barMenuFromTable = Object.values(barMap);

    // Build full address string
    const addressParts = [c.address, c.city, c.state].filter(Boolean);
    const fullAddress = addressParts.length > 1
        ? `${c.address || ''}, ${c.city || ''}, ${c.state || ''} ${c.zip || ''}`.trim().replace(/,\s*$/, '')
        : c.address || '';

    res.json({
        ...business,
        id:          siteId,
        slug:        business.subdomain,
        // flattened site_content
        address:     fullAddress,
        city:        c.city    || '',
        state:       c.state   || '',
        zip:         c.zip     || '',
        lat:         c.lat     || null,
        lng:         c.lng     || null,
        phone:       c.contact_phone || '',
        email:       c.contact_email || '',
        website:     c.website_url   || '',
        description: c.about_text    || c.seo_description || '',
        hours:       c.hours         || {},
        hours_note:  c.hours_note    || '',
        social: {
            ...(c.social_links || {}),
            instagram: business.instagram || c.social_links?.instagram || '',
            facebook:  business.facebook  || c.social_links?.facebook  || '',
            tiktok:    business.tiktok    || c.social_links?.tiktok    || '',
            google_maps: c.google_maps   || '',
        },
        hero_text:   c.hero_text     || '',
        hero_subtext:c.hero_subtext  || '',
        gallery:     (mediaItems.data || []).length
            ? (mediaItems.data || []).map(m => ({ url: m.url, caption: m.caption || '', section: m.section || 'gallery' }))
            : (c.gallery || []),
        qna:         c.qna           || [],
        features:    c.features      || [],
        // related data
        services:    services.data    || [],
        whats_included: c.whats_included || [],
        fleet:       fleet.data       || [],
        pricing:     (pricing.data || []).map(p => ({ ...p, slot_label: p.slot_label || (p.rental_time_slots && p.rental_time_slots.name) || null })),
        addons:      addons.data      || [],
        group_rates: groupRates.data  || [],
        reviews:     (reviews.data || []).map(r => ({
            author: r.customer_name || r.author || 'Guest',
            rating: r.rating || 5,
            text:   r.text || r.body || '',
            date:   r.created_at ? new Date(r.created_at).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : '',
        })),
        specials:    specials.data    || [],
        events:      events.data      || [],
        menu:        menu.length ? menu : null,
        barMenu:     barMenuFromTable.length ? barMenuFromTable : (c.bar_menu || null),
        schedules:   c.schedules      || [],
        highlights:  c.highlights     || [],
        restrictions:c.restrictions   || [],
        whatToBring: c.what_to_bring  || [],
        happyHour:   c.happy_hour     || null,
        perfectFor:  c.perfect_for    || [],
        packages:    c.packages       || [],
        games:       c.games          || [],
        bookABay:    c.book_a_bay     || null,
        league:      c.league         || null,
        faq:         c.faq            || [],
        custom_sections: c.custom_sections || [],
    });
});

// ============================================
// GET /api/gcr/business/:id — Single business detail (by UUID — legacy)
// ============================================
router.get('/business/:id', async (req, res) => {
    const { data: business } = await supabase
        .from('businesses')
        .select('site_id, name, type, subdomain, domain, logo_url, cover_url')
        .eq('site_id', req.params.id)
        .eq('status', 'active')
        .single();

    if (!business) {
        return res.status(404).json({ error: 'Business not found' });
    }

    // Get all public data in parallel
    const [content, services, reviews, faqs, staff, specials, fleet] = await Promise.all([
        supabase.from('site_content').select('*').eq('site_id', req.params.id).single(),
        supabase.from('services').select('id, name, description, price, duration_minutes, image_url, category').eq('site_id', req.params.id).eq('available', true).order('sort_order'),
        supabase.from('reviews').select('id, customer_name, rating, text, created_at').eq('site_id', req.params.id).eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('faqs').select('id, question, answer').eq('site_id', req.params.id).order('sort_order'),
        supabase.from('staff').select('name, role').eq('site_id', req.params.id).eq('active', true),
        supabase.from('specials').select('name, description, discount_text').eq('site_id', req.params.id).eq('active', true),
        supabase.from('fleet_types').select('id, name, description, specs, image_url').eq('site_id', req.params.id).eq('available', true).order('sort_order')
    ]);

    const reviewsList = reviews.data || [];
    const avgRating = reviewsList.length > 0
        ? reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length
        : 0;

    res.json({
        ...business,
        ...(content.data || {}),
        services: services.data || [],
        reviews: reviewsList,
        avg_rating: Math.round(avgRating * 10) / 10,
        review_count: reviewsList.length,
        faqs: faqs.data || [],
        staff: staff.data || [],
        specials: specials.data || [],
        fleet: fleet.data || []
    });
});

// ============================================
// GET /api/gcr/business/:id/availability — Live availability
// ============================================
router.get('/business/:id/availability', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: 'date query parameter required' });
    }

    const siteId = req.params.id;

    // Get fleet inventory
    const { data: fleetItems } = await supabase
        .from('fleet_items')
        .select('fleet_type_id')
        .eq('site_id', siteId)
        .eq('condition', 'good');

    const { data: fleetTypes } = await supabase
        .from('fleet_types')
        .select('id, name')
        .eq('site_id', siteId)
        .eq('available', true);

    const { data: timeSlots } = await supabase
        .from('rental_time_slots')
        .select('id, name, start_time, end_time')
        .eq('site_id', siteId)
        .eq('active', true);

    const { data: bookings } = await supabase
        .from('bookings')
        .select('fleet_type_id, time_slot_id, qty')
        .eq('site_id', siteId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed', 'checked_in']);

    const { data: pricing } = await supabase
        .from('rental_pricing')
        .select('fleet_type_id, time_slot_id, price')
        .eq('site_id', siteId);

    // Calculate
    const inventory = {};
    (fleetItems || []).forEach(i => {
        inventory[i.fleet_type_id] = (inventory[i.fleet_type_id] || 0) + 1;
    });

    const booked = {};
    (bookings || []).forEach(b => {
        const key = `${b.fleet_type_id}_${b.time_slot_id}`;
        booked[key] = (booked[key] || 0) + (b.qty || 1);
    });

    const priceMap = {};
    (pricing || []).forEach(p => {
        priceMap[`${p.fleet_type_id}_${p.time_slot_id}`] = p.price;
    });

    const availability = [];
    (fleetTypes || []).forEach(ft => {
        (timeSlots || []).forEach(ts => {
            const key = `${ft.id}_${ts.id}`;
            const total = inventory[ft.id] || 0;
            const used = booked[key] || 0;

            availability.push({
                fleet_type: ft.name,
                fleet_type_id: ft.id,
                time_slot: ts.name,
                time_slot_id: ts.id,
                available: Math.max(0, total - used),
                price: priceMap[key] || 0
            });
        });
    });

    // Also check services availability
    const { data: services } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, capacity')
        .eq('site_id', siteId)
        .eq('available', true);

    res.json({
        date,
        rentals: availability,
        services: services || [],
        has_availability: availability.some(a => a.available > 0) || (services || []).length > 0
    });
});

// ============================================
// POST /api/gcr/business/:id/book — Book from GCR
// ============================================
router.post('/business/:id/book', async (req, res) => {
    const siteId = req.params.id;
    const booking = {
        site_id: siteId,
        fleet_type_id: req.body.fleet_type_id,
        service_id: req.body.service_id,
        time_slot_id: req.body.time_slot_id,
        booking_date: req.body.booking_date,
        booking_time: req.body.booking_time,
        qty: req.body.qty || 1,
        party_size: req.body.party_size || 1,
        addons: req.body.addons || [],
        subtotal: req.body.subtotal,
        tax: req.body.tax || 0,
        total: req.body.total,
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
        customer_email: req.body.customer_email,
        notes: req.body.notes ? `[Booked via GCR] ${req.body.notes}` : '[Booked via GCR]',
        status: 'pending',
        payment_status: 'unpaid'
    };

    const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // TODO: Emit event: booking.created (from GCR)
    res.status(201).json(data);
});

// ============================================
// GET /api/gcr/categories — All business categories
// ============================================
router.get('/categories', async (req, res) => {
    const { data } = await supabase
        .from('businesses')
        .select('type')
        .eq('status', 'active')
        .eq('gcr_listed', true);

    const counts = {};
    (data || []).forEach(b => {
        counts[b.type] = (counts[b.type] || 0) + 1;
    });

    const categories = Object.entries(counts).map(([type, count]) => ({
        type,
        count,
        label: type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ')
    }));

    categories.sort((a, b) => b.count - a.count);

    res.json(categories);
});

// ============================================
// GET /api/gcr/featured — Featured businesses
// ============================================
router.get('/featured', async (req, res) => {
    // For now: return all active businesses with pro/enterprise plans
    const { data } = await supabase
        .from('businesses')
        .select('site_id, name, type, subdomain, domain, logo_url, cover_url, site_content(city, state, seo_description, theme_color)')
        .eq('status', 'active')
        .in('plan', ['pro', 'enterprise'])
        .limit(10);

    const businesses = (data || []).map(b => {
        const content = b.site_content || {};
        delete b.site_content;
        return { ...b, ...content };
    });

    res.json(businesses);
});

// ============================================
// GET /api/gcr/trending — Trending searches
// ============================================
router.get('/trending', async (req, res) => {
    // TODO: Track and return actual trending searches
    res.json([
        'boat rentals',
        'restaurants near me',
        'hair salon',
        'fishing charter',
        'bakery',
        'dog grooming'
    ]);
});

// ============================================
// GET /api/gcr/nearby — Businesses near coordinates
// ============================================
router.get('/nearby', async (req, res) => {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: 'lat and lng query parameters required' });
    }

    const radiusMiles = parseFloat(radius) || 25;

    // Simple distance calculation (not using PostGIS for now)
    // 1 degree latitude ≈ 69 miles
    const latRange = radiusMiles / 69;
    const lngRange = radiusMiles / (69 * Math.cos(parseFloat(lat) * Math.PI / 180));

    const { data } = await supabase
        .from('site_content')
        .select('site_id, lat, lng, city, state, address')
        .gte('lat', parseFloat(lat) - latRange)
        .lte('lat', parseFloat(lat) + latRange)
        .gte('lng', parseFloat(lng) - lngRange)
        .lte('lng', parseFloat(lng) + lngRange);

    if (!data || data.length === 0) {
        return res.json([]);
    }

    const siteIds = data.map(d => d.site_id);

    const { data: businesses } = await supabase
        .from('businesses')
        .select('site_id, name, type, subdomain, domain, logo_url, cover_url')
        .eq('status', 'active')
        .in('site_id', siteIds);

    // Merge with location data
    const locMap = {};
    data.forEach(d => { locMap[d.site_id] = d; });

    const results = (businesses || []).map(b => ({
        ...b,
        ...(locMap[b.site_id] || {}),
        distance_miles: Math.round(
            Math.sqrt(
                Math.pow((locMap[b.site_id]?.lat - parseFloat(lat)) * 69, 2) +
                Math.pow((locMap[b.site_id]?.lng - parseFloat(lng)) * 69 * Math.cos(parseFloat(lat) * Math.PI / 180), 2)
            ) * 10
        ) / 10
    }));

    results.sort((a, b) => a.distance_miles - b.distance_miles);

    res.json(results);
});

// ============================================
// POST /api/gcr/tourist/register — GCR Loyalty Signup → SMS
// ============================================
router.post('/tourist/register', async (req, res) => {
    const { name, phone, interests, visitor_type, checkin, checkout, sms_consent } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'name and phone required' });
    }

    // Insert tourist session
    const { data: session, error: sessionError } = await supabase
        .from('tourist_sessions')
        .insert({
            name,
            phone,
            interests: interests || [],
            visitor_type: visitor_type || 'tourist',
            checkin: checkin || null,
            checkout: checkout || null
        })
        .select()
        .single();

    if (sessionError) {
        console.error('Tourist session error:', sessionError);
        return res.status(500).json({ error: sessionError.message });
    }

    const chatUrl = `https://cybercheck-login.vercel.app/chat/${session.session_id}`;

    // Send SMS via Twilio (if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
        try {
            const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await twilio.messages.create({
                to: phone,
                from: process.env.TWILIO_PHONE_NUMBER,
                body: `Hey ${name}! Your Gulf Coast trip guide is ready 🌊 Ask me about restaurants, boat rentals, and activities → ${chatUrl}`
            });
        } catch (smsErr) {
            console.error('SMS send error:', smsErr.message);
            // Don't fail the request if SMS fails
        }
    }

    res.json({
        success: true,
        session_id: session.session_id,
        chat_url: chatUrl
    });
});

// ============================================
// POST /api/gcr/chat — GCR AI voice/text search
// ============================================
router.post('/chat', async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    if (!process.env.OPENAI_API_KEY) {
        return res.json({ reply: "AI is being set up — check back soon!" });
    }

    const { data: businesses } = await supabase
        .from('businesses')
        .select(`name, type, subdomain, tagline, area, tags, happy_hour, kids_friendly, pet_friendly, live_music, outdoor, alcohol, price_range, rating, site_content(contact_phone, address, city, hours, website_url)`)
        .eq('gcr_listed', true).eq('status', 'active').order('name');

    const bizContext = (businesses || []).map(b => {
        const c = b.site_content || {};
        const flags = [
            b.happy_hour    === true && 'happy hour',
            b.live_music    === true && 'live music',
            b.kids_friendly === true && 'kid-friendly',
            b.pet_friendly  === true && 'pet-friendly',
            b.outdoor       === true && 'outdoor seating',
            b.alcohol       === true && 'full bar',
        ].filter(Boolean).join(', ');
        return `• ${b.name} [${b.type}] ${b.area || ''} — ${b.tagline || ''} | ${flags} | ${b.price_range || ''}`;
    }).join('\n');

    const systemPrompt = `You are the Gulf Coast Concierge — a friendly, enthusiastic local who's lived on the Alabama Gulf Coast your whole life. You talk like a real person, not a search engine. Think of yourself as the tourist's best friend who knows every spot.

Your personality:
- Warm, casual, fun — like texting a friend who lives there
- Use short sentences. Be direct. Drop in local flavor ("that place is LEGENDARY", "trust me on this one", "locals don't even tell tourists about this spot")
- Never sound robotic or list-like

CONVERSATION STYLE:
- ALWAYS ask a follow-up question at the end of your response to keep the conversation going
- Examples: "How many people in your group?", "Are you more of a fried seafood or raw oyster person?", "What time were y'all thinking?", "Got kids with you?", "What's the vibe — chill dinner or something lively?"
- If they say something vague like "where should I eat" — ask 2 quick questions before recommending: "What kind of food are y'all feeling? And is this a date night, family thing, or group situation?"
- If they've already told you details (kids, budget, etc.) in the conversation history, REMEMBER them and don't re-ask

RECOMMENDATIONS:
- Give 1-2 specific spots, not a list of 5
- Say WHY it's the right pick for them specifically
- DO NOT include phone numbers or suggest they call — they're talking to you!
- Add a local tip: "Get there before 6 or you'll wait 45 min", "Sit on the patio if you can", "Ask for the off-menu shrimp basket"

Here are the businesses you know about:
${bizContext}

HARD RULES:
- Only recommend places from the list above — never make up a business
- Keep each response under 80 words (short texts, not essays)
- If you don't have a match, say so honestly and suggest what's close`;

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: message }],
                max_tokens: 250, temperature: 0.85
            })
        });
        const data = await openaiRes.json();
        if (!openaiRes.ok) throw new Error(data.error?.message || 'OpenAI error');
        res.json({ reply: data.choices?.[0]?.message?.content || "Try rephrasing!" });
    } catch (err) {
        console.error('GCR chat error:', err.message);
        res.json({ reply: "Something went wrong — try again!" });
    }
});

// ============================================
// POST /api/gcr/search-structured — Public structured search
// ============================================
router.post('/search-structured', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        // Extract search parameters from query using simple keyword matching
        const keywords = query.toLowerCase().split(/\s+/);
        const hasLiveMusic = keywords.some(k => ['live', 'music', 'entertainment'].includes(k));
        const hasGlutenFree = keywords.some(k => ['gluten', 'free', 'gf'].includes(k));
        const hasKidsFriendly = keywords.some(k => ['kids', 'family', 'children'].includes(k));
        const hasVegan = keywords.some(k => ['vegan', 'vegetarian'].includes(k));
        const hasSeafood = keywords.some(k => ['seafood', 'fish', 'shrimp', 'crab'].includes(k));
        const hasHappyHour = keywords.some(k => ['happy', 'hour', 'deals'].includes(k));

        // Build query for menu items or businesses
        let query_obj = supabase.from('menu_items').select('*').eq('available', true);

        if (hasGlutenFree) query_obj = query_obj.filter('allergens', 'not.cs', '["gluten"]');
        if (hasVegan) query_obj = query_obj.filter('tags', 'cs', '["vegan"]');
        if (hasSeafood) {
            keywords.forEach(k => {
                if (['seafood', 'fish', 'shrimp', 'crab'].includes(k)) {
                    query_obj = query_obj.or(`name.ilike.%${k}%,description.ilike.%${k}%`);
                }
            });
        }

        const { data: results, error } = await query_obj.limit(10);
        if (error) throw error;

        const formatted = (results || []).map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            tags: item.tags || [],
            allergens: item.allergens || []
        }));

        res.json({
            query,
            filters: { hasLiveMusic, hasGlutenFree, hasKidsFriendly, hasVegan, hasSeafood, hasHappyHour },
            results: formatted,
            count: formatted.length
        });
    } catch (err) {
        console.error('GCR search error:', err.message);
        res.json({ query, results: [], error: err.message });
    }
});

// ============================================
// RAG helpers — shared by /ask and /reindex
// ============================================
async function getAISettings() {
    const { data } = await supabase.from('ai_settings').select('*').eq('id', 1).single();
    return data || {};
}

async function embedText(text, settings) {
    const apiKey = settings.embed_api_key || process.env.OPENAI_API_KEY || process.env.EMBED_API_KEY;
    const model  = settings.embed_model || 'text-embedding-3-small';
    if (!apiKey) throw new Error('No embedding API key configured');

    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`Embed API ${res.status}: ${e}`); }
    const data = await res.json();
    return data.data[0].embedding;
}

async function chatCompletion(systemPrompt, userMessage, settings) {
    const provider = settings.chat_provider || 'anthropic';
    const model    = settings.chat_model    || 'claude-sonnet-4-6';
    const apiKey   = settings.chat_api_key  || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

    if (provider === 'anthropic') {
        if (!apiKey) throw new Error('No Anthropic API key configured');
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });
        if (!res.ok) { const e = await res.text(); throw new Error(`Anthropic API ${res.status}: ${e}`); }
        const data = await res.json();
        return data.content?.[0]?.text || '';
    }

    if (provider === 'openai') {
        const openaiKey = settings.chat_api_key || process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('No OpenAI API key configured');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
                max_tokens: 1024,
            }),
        });
        if (!res.ok) { const e = await res.text(); throw new Error(`OpenAI API ${res.status}: ${e}`); }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    if (provider === 'grok') {
        const grokKey = settings.chat_api_key || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
        if (!grokKey) throw new Error('No Grok API key configured');
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${grokKey}` },
            body: JSON.stringify({
                model: model || 'grok-3-mini',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
                max_tokens: 1024,
            }),
        });
        if (!res.ok) { const e = await res.text(); throw new Error(`Grok API ${res.status}: ${e}`); }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    if (provider === 'groq') {
        const groqKey = settings.chat_api_key || process.env.GROQ_API_KEY;
        if (!groqKey) throw new Error('No Groq API key configured');
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({
                model: model || 'llama-3.3-70b-versatile',
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
                max_tokens: 1024,
            }),
        });
        if (!res.ok) { const e = await res.text(); throw new Error(`Groq API ${res.status}: ${e}`); }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    throw new Error(`Unknown chat provider: ${provider}`);
}

// ============================================
// POST /api/gcr/ask — RAG question answering
// Body: { question, slug?, limit? }
// ============================================
router.post('/ask', async (req, res) => {
    const { question, slug: filterSlug, limit = 8 } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    try {
        const settings = await getAISettings();

        if (settings.rag_enabled === false) {
            return res.status(503).json({ error: 'RAG is disabled' });
        }

        // Embed the question
        const queryVector = await embedText(question, settings);

        // Vector similarity search
        const { data: chunks, error: vecErr } = await supabase.rpc('match_business_chunks', {
            query_embedding: JSON.stringify(queryVector),
            match_count: limit,
            filter_slug: filterSlug || null,
        });

        if (vecErr) {
            console.error('Vector search error:', vecErr.message);
            return res.status(500).json({ error: 'Search failed: ' + vecErr.message });
        }

        if (!chunks || chunks.length === 0) {
            return res.json({
                answer: "I don't have specific information about that in my database yet. Try browsing the Gulf Coast Radar listings!",
                sources: [],
            });
        }

        // Build context from top chunks
        const context = chunks.map(c => c.content).join('\n\n---\n\n');

        const systemPrompt = settings.system_prompt ||
            'You are a friendly local guide for Gulf Coast Radar, the ultimate tourism directory for Orange Beach and Gulf Shores, Alabama. Answer questions using only the business information provided. Be specific, helpful, and enthusiastic.';

        const userMessage = `Here is information about local businesses:\n\n${context}\n\n---\n\nQuestion: ${question}\n\nAnswer based only on the information provided above. If the answer isn't in the provided information, say so.`;

        const answer = await chatCompletion(systemPrompt, userMessage, settings);

        // Deduplicate sources
        const seen = new Set();
        const sources = chunks
            .filter(c => { if (seen.has(c.slug)) return false; seen.add(c.slug); return true; })
            .map(c => ({ name: c.business_name, slug: c.slug, relevance: Math.round(c.similarity * 100) / 100 }));

        res.json({ answer, sources });

    } catch (err) {
        console.error('GCR /ask error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// POST /api/gcr/reindex/:slug — Re-embed a single business (admin use)
// ============================================
router.post('/reindex/:slug', async (req, res) => {
    // Light auth check: require an admin token or a shared reindex secret
    const authHeader = req.headers.authorization || '';
    const secret = process.env.REINDEX_SECRET || process.env.JWT_SECRET;
    if (!authHeader.includes(secret) && req.body.secret !== secret) {
        // Also accept a valid JWT admin token
        try {
            const jwt = require('jsonwebtoken');
            const token = authHeader.replace('Bearer ', '');
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            if (payload.role !== 'admin') throw new Error('Not admin');
        } catch {
            return res.status(403).json({ error: 'Unauthorized' });
        }
    }

    const slug = req.params.slug;

    // Fetch the business
    const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select('site_id, name, type, subdomain, tagline, tags, price_range, happy_hour, live_music, waterfront, kids_friendly, pet_friendly')
        .eq('subdomain', slug)
        .eq('status', 'active')
        .single();

    if (bizErr || !business) return res.status(404).json({ error: 'Business not found' });

    const siteId = business.site_id;
    const name   = business.name;

    const settings = await getAISettings();
    const apiKey = settings.embed_api_key || process.env.OPENAI_API_KEY || process.env.EMBED_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Embedding API key not configured' });

    // Fetch all data
    const [content, fleet, pricing, groupRates, reviews, specials, events, menuItems] = await Promise.all([
        supabase.from('site_content').select('*').eq('site_id', siteId).single(),
        supabase.from('fleet_types').select('*').eq('site_id', siteId).eq('active', true),
        supabase.from('rental_pricing').select('*, rental_time_slots(name)').eq('site_id', siteId).eq('active', true),
        supabase.from('rental_group_rates').select('*').eq('site_id', siteId).eq('active', true),
        supabase.from('reviews').select('*').eq('site_id', siteId).eq('active', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('specials').select('*').eq('site_id', siteId).eq('active', true),
        supabase.from('events').select('*').eq('site_id', siteId).eq('active', true).order('event_date', { ascending: true }).limit(20),
        supabase.from('menu_items').select('name, description, price, category, tags').eq('site_id', siteId).eq('available', true).order('sort_order'),
    ]);

    const c = content.data || {};

    // Build text chunks (inline — same logic as build-rag-index.js)
    function fmtMenu(items) {
        if (!items || !items.length) return null;
        const bycat = {};
        items.forEach(i => { const k = i.category || 'Menu'; if (!bycat[k]) bycat[k] = []; bycat[k].push(i); });
        return [`MENU for ${name}:`, ...Object.entries(bycat).flatMap(([cat, its]) => [cat+':', ...its.map(i => `  - ${i.name}${i.price ? ' $'+i.price : ''}${i.description ? ' — '+i.description : ''}`)])].join('\n');
    }
    function fmtHappyHour(hh) {
        if (!hh) return null;
        if (typeof hh === 'string') return `HAPPY HOUR at ${name}: ${hh}`;
        const lines = [`HAPPY HOUR at ${name}:`, hh.schedule ? `Schedule: ${hh.schedule}` : ''];
        if (Array.isArray(hh.deals)) hh.deals.forEach(d => lines.push(`  - ${d.name}: ${d.price || ''}`));
        return lines.filter(Boolean).join('\n');
    }

    const pricingData = (pricing.data || []).map(p => ({ ...p, slot_label: p.slot_label || (p.rental_time_slots && p.rental_time_slots.name) || null }));
    const priceBySlot = {};
    pricingData.forEach(p => { const s = p.slot_label || 'General'; if (!priceBySlot[s]) priceBySlot[s] = []; priceBySlot[s].push(`${p.name || 'Ticket'}: $${p.price}`); });
    const pricingText = Object.keys(priceBySlot).length
        ? [`PRICING/TICKETS at ${name}:`, ...Object.entries(priceBySlot).flatMap(([s, ts]) => [s+':', ...ts.map(t => '  - '+t)])].join('\n')
        : null;

    const features = (c.features || []).map(f => typeof f === 'string' ? f : [f.label, f.value].filter(Boolean).join(': ')).join(', ');
    const profileText = [`BUSINESS: ${name}`, `Type: ${business.type}`, c.about_text ? `Description: ${c.about_text}` : '', features ? `Features: ${features}` : '', business.tagline ? `Tagline: ${business.tagline}` : ''].filter(Boolean).join('\n');

    const hoursEntries = c.hours && typeof c.hours === 'object' ? Object.entries(c.hours) : [];
    const hoursText = hoursEntries.length ? [`HOURS for ${name}:`, ...hoursEntries.map(([d,v]) => `  ${d}: ${typeof v === 'object' ? (v.open||'')+'–'+(v.close||'') : v}`)].join('\n') : null;

    const highlightItems = [...(c.highlights || []), ...(c.whats_included || [])];
    const highlightsText = highlightItems.length ? [`HIGHLIGHTS at ${name}:`, ...highlightItems.map(h => `  - ${h}`)].join('\n') : null;

    const reviewsList = (reviews.data || []).slice(0, 5);
    const reviewsText = reviewsList.length ? [`REVIEWS for ${name}:`, ...reviewsList.map(r => `  ${'★'.repeat(r.rating||5)} ${r.customer_name||'Guest'}: "${r.text||''}"`)].join('\n') : null;

    const specialsList = specials.data || [];
    const specialsText = specialsList.length ? [`SPECIALS at ${name}:`, ...specialsList.map(s => `  - ${s.name}: ${s.description||''}`)].join('\n') : null;

    const eventsList = events.data || [];
    const eventsText = eventsList.length ? [`EVENTS at ${name}:`, ...eventsList.map(e => `  - ${e.title||e.name} on ${e.event_date||''}: ${e.description||''}`)].join('\n') : null;

    const fleetList = fleet.data || [];
    const fleetText = fleetList.length ? [`FLEET at ${name}:`, ...fleetList.map(f => `  - ${f.name}${f.capacity?' cap:'+f.capacity:''}${f.price_per_hour?' $'+f.price_per_hour+'/hr':''}: ${f.description||''}`)].join('\n') : null;

    const chunks = [
        { type: 'profile',    text: profileText },
        { type: 'hours',      text: hoursText },
        { type: 'menu',       text: fmtMenu(menuItems.data) },
        { type: 'happy_hour', text: fmtHappyHour(c.happy_hour) },
        { type: 'specials',   text: specialsText },
        { type: 'events',     text: eventsText },
        { type: 'fleet',      text: fleetText },
        { type: 'pricing',    text: pricingText },
        { type: 'highlights', text: highlightsText },
        { type: 'reviews',    text: reviewsText },
    ].filter(ch => ch.text && ch.text.trim().length > 20);

    // Delete old embeddings
    await supabase.from('business_embeddings').delete().eq('site_id', siteId);

    let indexed = 0;
    for (const chunk of chunks) {
        try {
            const vector = await embedText(chunk.text, settings);
            await supabase.from('business_embeddings').insert({
                site_id: siteId, slug: business.subdomain, business_name: name,
                chunk_type: chunk.type, content: chunk.text,
                embedding: JSON.stringify(vector), updated_at: new Date().toISOString(),
            });
            indexed++;
        } catch (e) {
            console.error(`Embed failed for ${chunk.type}:`, e.message);
        }
    }

    res.json({ success: true, slug, chunks_indexed: indexed, chunks_total: chunks.length });
});

// ============================================================
// GCR ENTITY API — New normalized schema (separate Supabase DB)
// ============================================================

const getGcrDb = require('../gcr-db');
let gcrDb; try { gcrDb = getGcrDb(); } catch(e) { console.warn('GCR DB not initialized:', e.message); }

// Helper: fetch all content for a section based on its type
async function fetchSectionContent(section) {
    const sid = section.id;
    const type = section.section_type;

    if (type === 'rich_text') {
        const { data } = await gcrDb.from('section_rich_text').select('body_text').eq('section_id', sid).single();
        return { ...section, content: data };
    }

    if (type === 'bullets') {
        const { data } = await gcrDb.from('section_bullets').select('id, bullet_text, sort_order').eq('section_id', sid).order('sort_order');
        return { ...section, bullets: data || [] };
    }

    if (type === 'grouped_items') {
        const { data: groups } = await gcrDb.from('section_groups').select('id, title, subtitle, note_text, sort_order').eq('section_id', sid).order('sort_order');
        const { data: items } = await gcrDb.from('section_items').select('id, group_id, item_name, item_description, price_label, price_text, price_numeric, price_min, price_max, unit_label, item_type, sort_order').eq('section_id', sid).order('sort_order');

        const groupsWithItems = (groups || []).map(g => ({
            ...g,
            items: (items || []).filter(i => i.group_id === g.id),
        }));
        // Items with no group
        const ungrouped = (items || []).filter(i => !i.group_id);
        return { ...section, groups: groupsWithItems, ungrouped_items: ungrouped };
    }

    if (type === 'cards') {
        const { data } = await gcrDb.from('section_cards').select('id, title, subtitle, description, badge_text, price_text, image_url, link_url, sort_order').eq('section_id', sid).order('sort_order');
        return { ...section, cards: data || [] };
    }

    if (type === 'gallery') {
        const { data } = await gcrDb.from('section_photos').select('id, image_url, caption, alt_text, sort_order').eq('section_id', sid).order('sort_order');
        return { ...section, photos: data || [] };
    }

    if (type === 'reviews') {
        const { data } = await gcrDb.from('section_reviews').select('id, author_name, rating, review_text, review_date, source, sort_order').eq('section_id', sid).order('sort_order');
        return { ...section, reviews: data || [] };
    }

    if (type === 'hours') {
        const { data } = await gcrDb.from('section_hours').select('id, day_of_week, open_time, close_time, is_closed, note_text, sort_order').eq('section_id', sid).order('sort_order');
        return { ...section, hours: data || [] };
    }

    if (type === 'location') {
        const { data } = await gcrDb.from('section_location').select('*').eq('section_id', sid).single();
        return { ...section, location: data };
    }

    return section;
}

// ============================================
// GET /api/gcr/entities — List all GCR entities
// ============================================
router.get('/entities', async (req, res) => {
    let query = gcrDb
        .from('entity')
        .select('id, slug, name, subtitle, entity_type, entity_subtype, icon, phone, rating, review_count, city, state, zip, address_line_1, hero_image_url, website_url, directions_url, call_url, is_active')
        .eq('is_active', true)
        .order('name')
        .range(0, 999);

    if (req.query.subtype) query = query.eq('entity_subtype', req.query.subtype);
    if (req.query.city)    query = query.ilike('city', `%${req.query.city}%`);
    if (req.query.search)  query = query.ilike('name', `%${req.query.search}%`);

    // Tag-based filtering — if ?tag=happy_hour, return only entities with that tag
    if (req.query.tag) {
        const { data: tagMatches } = await gcrDb
            .from('entity_tags')
            .select('entity_id')
            .ilike('tag', `%${req.query.tag}%`);
        const ids = (tagMatches || []).map(t => t.entity_id);
        if (ids.length) query = query.in('id', ids);
        else return res.json({ entities: [] });
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const entities = data || [];
    const entityIds = entities.map(e => e.id);

    // Batch-fetch tags for all entities
    let tagMap = {};
    if (entityIds.length) {
        const { data: tagRows } = await gcrDb
            .from('entity_tags')
            .select('entity_id, tag, tag_category')
            .in('entity_id', entityIds);
        (tagRows || []).forEach(r => {
            if (!tagMap[r.entity_id]) tagMap[r.entity_id] = [];
            tagMap[r.entity_id].push({ tag: r.tag, tag_category: r.tag_category });
        });
    }

    // Batch-fetch hours for all entities
    let hoursMap = {};
    if (entityIds.length) {
        const { data: hoursSections } = await gcrDb
            .from('entity_sections')
            .select('id, entity_id')
            .eq('section_type', 'hours')
            .in('entity_id', entityIds);
        const sectionIds = (hoursSections || []).map(s => s.id);
        const sectionEntityMap = {};
        (hoursSections || []).forEach(s => { sectionEntityMap[s.id] = s.entity_id; });
        if (sectionIds.length) {
            const { data: hoursRows } = await gcrDb
                .from('section_hours')
                .select('section_id, day_of_week, open_time, close_time, is_closed, note_text')
                .in('section_id', sectionIds);
            (hoursRows || []).forEach(r => {
                const eid = sectionEntityMap[r.section_id];
                if (!eid) return;
                if (!hoursMap[eid]) hoursMap[eid] = [];
                hoursMap[eid].push(r);
            });
        }
    }

    // Map entity fields to match old business format so pages don't break
    const mapped = entities.map(e => ({
        ...e,
        // Old field aliases
        site_id:      e.id,
        subdomain:    e.slug,
        type:         e.entity_subtype,
        category:     e.entity_subtype,
        emoji:        e.icon,
        cover_url:    e.hero_image_url,
        logo_url:     e.hero_image_url,
        tagline:      e.subtitle,
        status:       e.is_active ? 'active' : 'hidden',
        gcr_listed:   e.is_active,
        featured:     false,
        address:      e.address_line_1 || '',
        priceRange:   e.price_range || '',
        reviewCount:  e.review_count || 0,
        // New fields
        tags:         tagMap[e.id] || [],
        hours:        hoursMap[e.id] || [],
    }));

    res.json({ entities: mapped, businesses: mapped, total: mapped.length });
});

// ============================================
// GET /api/gcr/entity/:slug — Full entity profile
// Returns entity + features + perfect_for + tags + all sections with content
// ============================================
router.get('/entity/:slug', async (req, res) => {
    const { slug } = req.params;

    // Try exact match first
    let { data: entity, error: entErr } = await gcrDb
        .from('entity')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    // If not found, try partial match (slug starts with)
    if (!entity && entErr) {
        const { data: entities } = await gcrDb
            .from('entity')
            .select('*')
            .ilike('slug', slug + '%')
            .eq('is_active', true)
            .limit(1);
        if (entities?.length) entity = entities[0];
    }

    if (!entity) return res.status(404).json({ error: 'Entity not found' });

    // Fetch features, perfect_for, tags, sections in parallel
    const [featuresRes, perfectForRes, tagsRes, sectionsRes] = await Promise.all([
        gcrDb.from('entity_features').select('id, label, sort_order').eq('entity_id', entity.id).order('sort_order'),
        gcrDb.from('entity_perfect_for').select('id, label, sort_order').eq('entity_id', entity.id).order('sort_order'),
        gcrDb.from('entity_tags').select('id, tag, tag_category, sort_order').eq('entity_id', entity.id).order('sort_order'),
        gcrDb.from('entity_sections').select('id, section_key, section_label, section_type, sort_order').eq('entity_id', entity.id).order('sort_order'),
    ]);

    // Fetch content for each section
    const sections = sectionsRes.data || [];
    const sectionsWithContent = await Promise.all(sections.map(sec => fetchSectionContent(sec)));

    res.json({
        entity,
        features:    featuresRes.data   || [],
        perfect_for: perfectForRes.data || [],
        tags:        tagsRes.data       || [],
        sections:    sectionsWithContent,
    });
});

module.exports = router;

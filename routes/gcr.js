const express = require('express');
const supabase = require('../db');
const getGcrDb = require('../gcr-db');

const router = express.Router();

const gcrDb = getGcrDb();

// Cache all GET responses on Vercel's CDN for 24 hours
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  }
  next();
});

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
    let query = gcrDb
        .from('entity_events')
        .select('*, entity(slug, name, icon, hero_image_url, entity_subtype, city)')
        .eq('is_active', true)
        .order('event_date', { ascending: true });

    if (req.query.slug) query = query.eq('entity.slug', req.query.slug);
    if (req.query.upcoming === 'true') {
        const today = new Date().toISOString().split('T')[0];
        query = query.or(`event_date.gte.${today},recurring.eq.true`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Fetch photos for all entities in events
    let photosMap = {};
    const entityIds = (data || []).filter(e => e.entity_id).map(e => e.entity_id);
    if (entityIds.length) {
        const { data: photosData } = await gcrDb
            .from('entity_photos')
            .select('entity_id, image_url, caption, sort_order')
            .in('entity_id', entityIds)
            .order('sort_order');
        (photosData || []).forEach(p => {
            if (!photosMap[p.entity_id]) photosMap[p.entity_id] = [];
            photosMap[p.entity_id].push({ image_url: p.image_url, caption: p.caption });
        });
    }

    const events = (data || []).map(e => ({
        ...e,
        date: e.event_date,
        businessName:       e.entity?.name || '',
        businessEmoji:      e.entity?.icon || '🏪',
        category:           e.entity?.entity_subtype || '',
        slug:               e.entity?.slug || '',
        hero_image_url:     e.entity?.hero_image_url || null,
        photos:             photosMap[e.entity_id] || [],
        city:               e.entity?.city || '',
        // Explicit entity_ prefixed fields for events page
        // For standalone events (entity_id=null), fall back to venue_location parts
        entity_name:        e.entity?.name || (e.venue_location ? e.venue_location.split(',')[0]?.trim() : '') || '',
        entity_city:        e.entity?.city || (e.venue_location ? e.venue_location.split(',').slice(1).join(',').trim() : '') || '',
        entity_slug:        e.entity?.slug || '',
        entity_hero_image_url: e.entity?.hero_image_url || null,
    }));

    res.json(events);
});

// ============================================
// GET /api/gcr/happy-hours — entities with HH data from any source
// ============================================
router.get('/happy-hours', async (req, res) => {
    // Get entity IDs from actual HH data only — NOT tags (tags are unreliable)
    const [secRes, specialRes, hhDaysRes] = await Promise.all([
        gcrDb.from('happy_hour_sections').select('entity_id'),
        gcrDb.from('entity_specials').select('entity_id').eq('special_type', 'happy_hour').eq('is_active', true),
        gcrDb.from('entity').select('id').not('hh_days', 'is', null).eq('is_active', true),
    ]);

    // Only entities with real HH data
    const hhEntityIds = new Set();
    (secRes.data || []).forEach(r => hhEntityIds.add(r.entity_id));
    (specialRes.data || []).forEach(r => hhEntityIds.add(r.entity_id));
    (hhDaysRes.data || []).forEach(r => hhEntityIds.add(r.id));

    if (!hhEntityIds.size) return res.json([]);

    const { data, error } = await gcrDb
        .from('entity')
        .select('id, slug, name, icon, hero_image_url, entity_subtype, city, phone, directions_url, call_url, address_line_1, rating, hh_days, hh_start, hh_end, hh_description, description, price_range, booking_url, reservation_url, social_instagram, social_facebook')
        .eq('is_active', true)
        .in('id', [...hhEntityIds])
        .range(0, 999);

    if (error) return res.status(500).json({ error: error.message });

    const entityIds = (data || []).map(e => e.id);
    let hhSectionsMap = {};
    let photosMap = {};

    if (entityIds.length) {
        const [hhSecRes, photosRes, hoursRes] = await Promise.all([
            gcrDb.from('happy_hour_sections').select('id, entity_id, section_name, sort_order').in('entity_id', entityIds).order('sort_order'),
            gcrDb.from('entity_photos').select('entity_id, image_url, caption, sort_order').in('entity_id', entityIds).order('sort_order'),
            gcrDb.from('entity_hours').select('entity_id, day_of_week, open_time, close_time, is_closed').in('entity_id', entityIds).order('id'),
        ]);

        const hhSections = hhSecRes.data || [];
        const sectionIds = (hhSections || []).map(s => s.id);
        let itemsMap = {};

        if (sectionIds.length) {
            const { data: hhItems } = await gcrDb
                .from('happy_hour_items')
                .select('*')
                .in('hh_section_id', sectionIds)
                .order('sort_order');
            (hhItems || []).forEach(item => {
                if (!itemsMap[item.hh_section_id]) itemsMap[item.hh_section_id] = [];
                itemsMap[item.hh_section_id].push(item);
            });
        }

        (hhSections || []).forEach(sec => {
            if (!hhSectionsMap[sec.entity_id]) hhSectionsMap[sec.entity_id] = [];
            hhSectionsMap[sec.entity_id].push({ ...sec, items: itemsMap[sec.id] || [] });
        });

        (photosRes.data || []).forEach(p => {
            if (!photosMap[p.entity_id]) photosMap[p.entity_id] = [];
            photosMap[p.entity_id].push({ image_url: p.image_url, caption: p.caption });
        });

        let hoursMap = {};
        (hoursRes.data || []).forEach(h => {
            if (!hoursMap[h.entity_id]) hoursMap[h.entity_id] = [];
            hoursMap[h.entity_id].push(h);
        });
        Object.assign(photosMap, { _hours: hoursMap });
    }

    const hoursMap = photosMap._hours || {};

    const results = (data || []).map(e => ({
        slug:        e.slug,
        name:        e.name,
        emoji:       e.icon || '🏪',
        type:        e.entity_subtype || '',
        entity_subtype: e.entity_subtype || '',
        rating:      e.rating || null,
        address:     e.address_line_1 || '',
        address_line_1: e.address_line_1 || '',
        city:        e.city || '',
        phone:       e.phone || '',
        call_url:    e.call_url || null,
        google_maps: e.directions_url || '',
        directions_url: e.directions_url || null,
        booking_url: e.booking_url || null,
        reservation_url: e.reservation_url || null,
        cover:       e.hero_image_url || null,
        hero_image_url: e.hero_image_url || null,
        photos:      photosMap[e.id] || [],
        hours:       hoursMap[e.id] || [],
        hh_days:     e.hh_days,
        hh_start:    e.hh_start,
        hh_end:      e.hh_end,
        hh_description: e.hh_description,
        happyHour:   `${e.hh_days} ${e.hh_start}–${e.hh_end}`,
        hh_sections: hhSectionsMap[e.id] || [],
    }));

    res.json(results);
});

// ============================================
// GET /api/gcr/specials — new GCR DB entity_specials
// ============================================
router.get('/specials', async (req, res) => {
    let query = gcrDb
        .from('entity_specials')
        .select('*, entity(slug, name, icon, hero_image_url, entity_subtype, city, phone, directions_url, call_url, address_line_1, booking_url, reservation_url)')
        .eq('is_active', true)
        .order('id', { ascending: false });

    if (req.query.slug) query = query.eq('entity.slug', req.query.slug);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const specials = (data || []).map(s => ({
        ...s,
        // Field aliases for backwards compatibility
        name:           s.special_name,
        active:         s.is_active,
        type:           s.special_type,
        discount:       s.discount_text,
        businessName:   s.entity?.name || '',
        businessEmoji:  s.entity?.icon || '🏪',
        category:       s.entity?.entity_subtype || '',
        slug:           s.entity?.slug || '',
        subdomain:      s.entity?.slug || '',
        hero_image_url: s.entity?.hero_image_url || null,
        city:           s.entity?.city || '',
        phone:          s.entity?.phone || '',
        directions_url: s.entity?.directions_url || '',
        address:        s.entity?.address_line_1 || '',
        // Explicit entity_ prefixed fields (same convention as /events)
        entity_name:        s.entity?.name || '',
        entity_city:        s.entity?.city || '',
        entity_slug:        s.entity?.slug || '',
        entity_hero_image_url: s.entity?.hero_image_url || null,
        call_url:           s.entity?.call_url || null,
        booking_url:        s.entity?.booking_url || null,
        reservation_url:    s.entity?.reservation_url || null,
        days:               s.days_of_week || s.days || null,
    }));

    res.json(specials);
});

// ============================================
// POST /api/gcr/search — AI-powered semantic search
// ============================================
router.post('/search', async (req, res) => {
    const { query: searchQuery, type, city } = req.body;
    if (!searchQuery || !searchQuery.trim()) return res.status(400).json({ error: 'Search query required' });

    const q = searchQuery.toLowerCase().trim();
    // Split multi-word queries into keywords so "Gulf Shores seafood" finds entities with any of those words
    const keywords = q.split(/\s+/).filter(k => k.length >= 2);
    const matchedEntityIds = new Set();

    // Build OR filter covering all keywords across given fields
    function kf(...fields) {
        return keywords.flatMap(k => fields.map(f => `${f}.ilike.%${k}%`)).join(',');
    }

    // Search across all new GCR DB tables in parallel
    const [
        byEntity, byTags, byMenuItems, byDrinkItems,
        byHHItems, bySpecials, byEvents, byActivities
    ] = await Promise.all([
        // Entity fields: name, subtitle, description, city, entity_subtype
        gcrDb.from('entity').select('id').eq('is_active', true)
            .or(kf('name','subtitle','description','city','entity_subtype')),
        // Tags
        gcrDb.from('entity_tags').select('entity_id')
            .or(kf('tag')),
        // Menu items: name + description
        gcrDb.from('menu_items').select('entity_id').or(kf('item_name','description')),
        // Drink items: name + description + brewery + item_style
        gcrDb.from('drink_items').select('entity_id').or(kf('item_name','description','brewery','item_style')),
        // Happy hour items
        gcrDb.from('happy_hour_items').select('entity_id').or(kf('item_name','description')),
        // Specials
        gcrDb.from('entity_specials').select('entity_id').eq('is_active', true).or(kf('special_name','description','discount_text')),
        // Events
        gcrDb.from('entity_events').select('entity_id').eq('is_active', true).or(kf('event_name','description','artist_name','music_style','event_type')),
        // Activities (Things To Do)
        gcrDb.from('activities').select('entity_id').or(kf('activity_name','description','activity_type')),
    ]);

    // Collect all matching entity IDs — filter out undefined/null to prevent UUID parse errors
    [byEntity, byTags, byMenuItems, byDrinkItems, byHHItems, bySpecials, byEvents, byActivities]
        .forEach(res => (res.data || []).forEach(r => {
            const id = r.entity_id || r.id;
            if (id) matchedEntityIds.add(id);
        }));

    if (!matchedEntityIds.size) return res.json({ query: searchQuery, results: [], total: 0 });

    // Fetch full entity data for all matches
    let entityQuery = gcrDb.from('entity')
        .select('id, slug, name, subtitle, entity_subtype, icon, phone, rating, review_count, city, state, address_line_1, hero_image_url, website_url, directions_url, call_url, price_range, featured, booking_url, reservation_url, order_url, hh_days, hh_start, hh_end')
        .eq('is_active', true)
        .in('id', [...matchedEntityIds]);

    // Also fetch photos for all matching entities
    const photosQuery = gcrDb.from('entity_photos')
        .select('entity_id, image_url, caption, sort_order')
        .in('entity_id', [...matchedEntityIds])
        .order('sort_order');

    if (type) entityQuery = entityQuery.eq('entity_subtype', type);
    if (city) entityQuery = entityQuery.ilike('city', `%${city}%`);

    const [entRes, photosRes] = await Promise.all([
        entityQuery,
        photosQuery
    ]);

    const { data: entities, error } = entRes;
    const { data: photosData } = photosRes;

    if (error) return res.status(500).json({ error: error.message });

    // Map photos by entity ID
    let photosMap = {};
    (photosData || []).forEach(p => {
        if (!photosMap[p.entity_id]) photosMap[p.entity_id] = [];
        photosMap[p.entity_id].push({ image_url: p.image_url, caption: p.caption });
    });

    // For each matching entity, find what specifically matched (menu items, specials, etc.)
    const entityIdList = (entities || []).map(e => e.id);
    let menuMatchMap = {}, drinkMatchMap = {}, hhMatchMap = {}, specialMatchMap = {}, eventMatchMap = {};

    if (entityIdList.length) {
        const [menuMatches, drinkMatches, hhMatches, specialMatches, eventMatches] = await Promise.all([
            gcrDb.from('menu_items').select('entity_id, item_name, description, price, price_text')
                .or(`item_name.ilike.%${q}%,description.ilike.%${q}%`).in('entity_id', entityIdList),
            gcrDb.from('drink_items').select('entity_id, item_name, description, price, price_text, item_style, brewery')
                .or(`item_name.ilike.%${q}%,description.ilike.%${q}%,item_style.ilike.%${q}%`).in('entity_id', entityIdList),
            gcrDb.from('happy_hour_items').select('entity_id, item_name, description, hh_price, price_text')
                .or(`item_name.ilike.%${q}%,description.ilike.%${q}%`).in('entity_id', entityIdList),
            gcrDb.from('entity_specials').select('entity_id, special_name, description, discount_text').eq('is_active', true)
                .or(`special_name.ilike.%${q}%,description.ilike.%${q}%,discount_text.ilike.%${q}%`).in('entity_id', entityIdList),
            gcrDb.from('entity_events').select('entity_id, event_name, event_date, day_of_week').eq('is_active', true)
                .or(`event_name.ilike.%${q}%,description.ilike.%${q}%`).in('entity_id', entityIdList),
        ]);
        (menuMatches.data || []).forEach(m => { if (!menuMatchMap[m.entity_id]) menuMatchMap[m.entity_id] = []; menuMatchMap[m.entity_id].push({ ...m, _type: 'menu' }); });
        (drinkMatches.data || []).forEach(m => { if (!drinkMatchMap[m.entity_id]) drinkMatchMap[m.entity_id] = []; drinkMatchMap[m.entity_id].push({ ...m, _type: 'drink' }); });
        (hhMatches.data || []).forEach(m => { if (!hhMatchMap[m.entity_id]) hhMatchMap[m.entity_id] = []; hhMatchMap[m.entity_id].push({ ...m, _type: 'happy_hour' }); });
        (specialMatches.data || []).forEach(s => { if (!specialMatchMap[s.entity_id]) specialMatchMap[s.entity_id] = []; specialMatchMap[s.entity_id].push(s); });
        (eventMatches.data || []).forEach(e => { if (!eventMatchMap[e.entity_id]) eventMatchMap[e.entity_id] = []; eventMatchMap[e.entity_id].push(e); });
    }

    // Score items by match quality (exact > starts_with > contains)
    const scoreItem = (name, desc, q) => {
        const n = (name || '').toLowerCase();
        const d = (desc || '').toLowerCase();
        if (n === q) return 100;
        if (n.startsWith(q)) return 80;
        if (n.includes(q)) return 60;
        if (d.startsWith(q)) return 40;
        if (d.includes(q)) return 20;
        return 0;
    };

    // Sort items within each entity by match quality
    const sortItems = (items, q) => [...items].sort((a, b) =>
        scoreItem(b.item_name || b.special_name, b.description, q) - scoreItem(a.item_name || a.special_name, a.description, q)
    );

    // Build results — sort by entity relevance score, then rating
    const results = (entities || []).map(e => {
        const menuItems = sortItems([...(menuMatchMap[e.id] || []), ...(drinkMatchMap[e.id] || []), ...(hhMatchMap[e.id] || [])], q);
        const nameScore = scoreItem(e.name, e.subtitle, q);
        const itemScore = menuItems.length > 0 ? scoreItem(menuItems[0].item_name, menuItems[0].description, q) : 0;
        const relevance = Math.max(nameScore, itemScore) + (e.rating || 0);
        return {
            ...e,
            site_id: e.id, subdomain: e.slug, emoji: e.icon,
            type: e.entity_subtype, category: e.entity_subtype,
            cover_url: e.hero_image_url, tagline: e.subtitle,
            photos: photosMap[e.id] || [],
            matched_menu_items: menuItems,
            matched_specials:   sortItems(specialMatchMap[e.id] || [], q),
            matched_events:     eventMatchMap[e.id] || [],
            _relevance: relevance,
        };
    }).sort((a, b) => b._relevance - a._relevance);

    // Build structured response grouped by type — for voice search and AI concierge
    const structured = {
        businesses: results.map(e => ({
            id: e.id, slug: e.slug, name: e.name, subtitle: e.subtitle,
            entity_subtype: e.entity_subtype, icon: e.icon, city: e.city,
            hero_image_url: e.hero_image_url, price_range: e.price_range,
            rating: e.rating, hh_days: e.hh_days, hh_start: e.hh_start, hh_end: e.hh_end,
            phone: e.phone, address_line_1: e.address_line_1,
        })),
        menu_items: results.flatMap(e =>
            (menuMatchMap[e.id] || []).map(i => ({
                item_name: i.item_name, description: i.description,
                price: i.price, price_text: i.price_text,
                business: e.name, slug: e.slug, city: e.city,
            }))
        ),
        drink_items: results.flatMap(e =>
            (drinkMatchMap[e.id] || []).map(i => ({
                item_name: i.item_name, description: i.description,
                price: i.price, price_text: i.price_text,
                item_style: i.item_style, brewery: i.brewery,
                business: e.name, slug: e.slug, city: e.city,
            }))
        ),
        happy_hour_items: results.flatMap(e =>
            (hhMatchMap[e.id] || []).map(i => ({
                item_name: i.item_name, description: i.description,
                price: i.hh_price, price_text: i.price_text,
                hh_days: e.hh_days, hh_start: e.hh_start, hh_end: e.hh_end,
                business: e.name, slug: e.slug, city: e.city,
            }))
        ),
        specials: results.flatMap(e =>
            (specialMatchMap[e.id] || []).map(s => ({
                special_name: s.special_name, description: s.description,
                discount_text: s.discount_text,
                business: e.name, slug: e.slug, city: e.city,
            }))
        ),
        events: results.flatMap(e =>
            (eventMatchMap[e.id] || []).map(ev => ({
                event_name: ev.event_name, event_date: ev.event_date,
                day_of_week: ev.day_of_week,
                business: e.name, slug: e.slug, city: e.city,
            }))
        ),
    };

    res.json({
        query: searchQuery,
        results,           // full entity results with matched items nested (backwards compat)
        structured,        // flat lists grouped by type — for voice/AI use
        total: results.length,
        counts: {
            businesses:      structured.businesses.length,
            menu_items:      structured.menu_items.length,
            drink_items:     structured.drink_items.length,
            happy_hour_items: structured.happy_hour_items.length,
            specials:        structured.specials.length,
            events:          structured.events.length,
        }
    });
});

// ============================================
// GET /api/gcr/businesses/:slug — Full business profile by slug
// Returns: business + site_content + fleet + pricing + addons + services + reviews + specials + events
// Used by: gcr/business.html?id=:slug
// ============================================
router.get('/businesses/:slug', async (req, res) => {
    // Redirect to GCR entity endpoint — old DB no longer used
    return res.redirect(301, `/api/gcr/entity/${encodeURIComponent(req.params.slug)}`);

    // eslint-disable-next-line no-unreachable
    const slug = req.params.slug;
    const { data: business, error: bizErr } = await supabase
        .from('businesses')
        .select(`site_id, name, type, subdomain`)
        .eq('subdomain', slug)
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

        // Search GCR DB menu_items + entity_tags
        let menuQuery = gcrDb.from('menu_items').select('id, item_name, description, price, allergens, entity_id').eq('is_available', true);

        if (hasSeafood) {
            const term = keywords.find(k => ['seafood','fish','shrimp','crab','oyster','lobster'].includes(k)) || 'seafood';
            menuQuery = menuQuery.or(`item_name.ilike.%${term}%,description.ilike.%${term}%`);
        } else {
            const searchTerm = keywords.filter(k => k.length > 2).join(' ');
            if (searchTerm) menuQuery = menuQuery.or(`item_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }

        const { data: results, error } = await menuQuery.limit(10);
        if (error) throw error;

        // Fetch entity names for matched items
        const entityIds = [...new Set((results||[]).map(r => r.entity_id).filter(Boolean))];
        let entityMap = {};
        if (entityIds.length) {
            const { data: ents } = await gcrDb.from('entity').select('id, name, slug, city').in('id', entityIds);
            (ents||[]).forEach(e => { entityMap[e.id] = e; });
        }

        const formatted = (results || []).map(item => ({
            id: item.id,
            name: item.item_name,
            description: item.description,
            price: item.price,
            allergens: item.allergens || [],
            business: entityMap[item.entity_id]?.name || '',
            slug: entityMap[item.entity_id]?.slug || '',
            city: entityMap[item.entity_id]?.city || '',
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
    // Try GCR DB first, fallback to main DB
    const { data: gcrSettings } = await gcrDb.from('ai_settings').select('*').eq('id', 1).single();
    if (gcrSettings) return gcrSettings;
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
        .select('id, slug, name, subtitle, entity_type, entity_subtype, icon, phone, rating, review_count, city, state, zip, address_line_1, hero_image_url, website_url, directions_url, call_url, is_active, description, price_range, featured, booking_url, reservation_url, order_url, hh_days, hh_start, hh_end, hh_description, social_instagram, social_facebook, social_tiktok, email')
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

    // Batch-fetch tags — chunk to avoid Supabase URL length limits (max ~100 IDs)
    let tagMap = {};
    if (entityIds.length) {
        const CHUNK = 100;
        for (let i = 0; i < entityIds.length; i += CHUNK) {
            const chunk = entityIds.slice(i, i + CHUNK);
            const { data: tagRows } = await gcrDb
                .from('entity_tags')
                .select('entity_id, tag, tag_category')
                .in('entity_id', chunk);
            (tagRows || []).forEach(r => {
                if (!tagMap[r.entity_id]) tagMap[r.entity_id] = [];
                tagMap[r.entity_id].push({ tag: r.tag, tag_category: r.tag_category });
            });
        }
    }

    // Batch-fetch features (Happy Hour, Kids Friendly, etc.) and merge into tags
    if (entityIds.length) {
        const CHUNK = 100;
        for (let i = 0; i < entityIds.length; i += CHUNK) {
            const chunk = entityIds.slice(i, i + CHUNK);
            const { data: featureRows } = await gcrDb
                .from('entity_features')
                .select('entity_id, label')
                .in('entity_id', chunk);
            (featureRows || []).forEach(r => {
                if (!tagMap[r.entity_id]) tagMap[r.entity_id] = [];
                tagMap[r.entity_id].push({ tag: r.label.toLowerCase().replace(/ /g, '_'), tag_category: 'feature' });
            });
        }
    }

    // Batch-fetch photos
    let photosMap = {};
    if (entityIds.length) {
        const CHUNK = 100;
        for (let i = 0; i < entityIds.length; i += CHUNK) {
            const chunk = entityIds.slice(i, i + CHUNK);
            const { data: photoRows } = await gcrDb
                .from('entity_photos')
                .select('entity_id, image_url, caption, sort_order')
                .in('entity_id', chunk)
                .order('sort_order');
            (photoRows || []).forEach(r => {
                if (!photosMap[r.entity_id]) photosMap[r.entity_id] = [];
                photosMap[r.entity_id].push({ image_url: r.image_url, caption: r.caption });
            });
        }
    }

    // Batch-fetch hours from entity_hours (same table as profile pages)
    let hoursMap = {};
    if (entityIds.length) {
        const CHUNK = 100;
        for (let i = 0; i < entityIds.length; i += CHUNK) {
            const chunk = entityIds.slice(i, i + CHUNK);
            const { data: hoursRows } = await gcrDb
                .from('entity_hours')
                .select('entity_id, day_of_week, open_time, close_time, is_closed')
                .in('entity_id', chunk)
                .order('day_of_week');
            (hoursRows || []).forEach(r => {
                if (!hoursMap[r.entity_id]) hoursMap[r.entity_id] = [];
                hoursMap[r.entity_id].push(r);
            });
        }
    }

    // Batch-fetch section rich_text as fallback description for entities missing entity.description
    // entity_sections has no content column — content is in section_rich_text joined via section id
    let sectionDescMap = {};
    if (entityIds.length) {
        const CHUNK = 100;
        for (let i = 0; i < entityIds.length; i += CHUNK) {
            const chunk = entityIds.slice(i, i + CHUNK);
            // Get the rich_text section ids for these entities
            const { data: secRows } = await gcrDb
                .from('entity_sections')
                .select('id, entity_id')
                .eq('section_type', 'rich_text')
                .in('entity_id', chunk)
                .order('sort_order');
            if (secRows && secRows.length) {
                const secIds = secRows.map(s => s.id);
                const { data: richRows } = await gcrDb
                    .from('section_rich_text')
                    .select('section_id, body_text')
                    .in('section_id', secIds);
                (richRows || []).forEach(r => {
                    const sec = secRows.find(s => s.id === r.section_id);
                    if (sec && r.body_text && !sectionDescMap[sec.entity_id]) {
                        sectionDescMap[sec.entity_id] = r.body_text;
                    }
                });
            }
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
        featured:        e.featured || false,
        address:         e.address_line_1 || '',
        priceRange:      e.price_range || '',
        reviewCount:     e.review_count || 0,
        description:     e.description || sectionDescMap[e.id] || '',
        booking_url:     e.booking_url || null,
        reservation_url: e.reservation_url || null,
        order_url:       e.order_url || null,
        hh_days:         e.hh_days || null,
        hh_start:        e.hh_start || null,
        hh_end:          e.hh_end || null,
        hh_description:  e.hh_description || null,
        social_instagram: e.social_instagram || null,
        social_facebook:  e.social_facebook || null,
        social_tiktok:    e.social_tiktok || null,
        email:           e.email || null,
        // New fields
        tags:            tagMap[e.id] || [],
        hours:           hoursMap[e.id] || [],
        photos:          photosMap[e.id] || [],
    }));

    res.json({ entities: mapped, businesses: mapped, total: mapped.length });
});

// ============================================
// GET /api/gcr/entity/:slug — Full entity profile
// Returns entity + features + perfect_for + tags + all sections with content
// ============================================
router.get('/entity/:slug', async (req, res) => {
    // Shorter cache on individual profiles so business updates show within 5 min
    res.set('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

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

    const eid = entity.id;

    // Fetch everything in parallel — old sections system + all new dedicated tables
    const [
        featuresRes, perfectForRes, tagsRes, sectionsRes,
        hoursRes, bulletsRes, photosRes,
        menuSectionsRes, drinkSectionsRes, hhSectionsRes,
        eventsRes, specialsRes,
        activitiesRes, pricingRes, slotsRes, fleetRes, addonsRes,
        includedRes, requirementsRes, policiesRes, meetingRes, qnaRes,
        productSectionsRes,
    ] = await Promise.all([
        gcrDb.from('entity_features').select('id, label, sort_order').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('entity_perfect_for').select('id, label, sort_order').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('entity_tags').select('id, tag, tag_category, sort_order').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('entity_sections').select('id, section_key, section_label, section_type, sort_order').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('entity_hours').select('*').eq('entity_id', eid).order('day_of_week'),
        gcrDb.from('entity_about_bullets').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('entity_photos').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('menu_sections').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('drink_sections').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('happy_hour_sections').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('entity_events').select('*').eq('entity_id', eid).eq('is_active', true).order('event_date'),
        gcrDb.from('entity_specials').select('*').eq('entity_id', eid).eq('is_active', true),
        gcrDb.from('activities').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('pricing_items').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('booking_slots').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('fleet_items').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('addons').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('whats_included').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('requirements').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('policies').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('meeting_points').select('*').eq('entity_id', eid),
        gcrDb.from('entity_qna').select('*').eq('entity_id', eid).order('sort_order'),
        gcrDb.from('product_sections').select('*').eq('entity_id', eid).order('sort_order'),
    ]);

    // Fetch menu sub-sections and items
    const menuSections = menuSectionsRes.data || [];
    const menuSectionIds = menuSections.map(s => s.id);
    let menuSubSections = [], menuItems = [];
    if (menuSectionIds.length) {
        const [subRes, itemRes] = await Promise.all([
            gcrDb.from('menu_sub_sections').select('*').in('menu_section_id', menuSectionIds).order('sort_order'),
            gcrDb.from('menu_items').select('*').eq('entity_id', eid).order('sort_order'),
        ]);
        menuSubSections = subRes.data || [];
        menuItems = itemRes.data || [];
    }

    // Fetch drink items
    const drinkSections = drinkSectionsRes.data || [];
    const drinkSectionIds = drinkSections.map(s => s.id);
    let drinkItems = [];
    if (drinkSectionIds.length) {
        const { data } = await gcrDb.from('drink_items').select('*').eq('entity_id', eid).order('sort_order');
        drinkItems = data || [];
    }

    // Fetch HH items
    const hhSections = hhSectionsRes.data || [];
    const hhSectionIds = hhSections.map(s => s.id);
    let hhItems = [];
    if (hhSectionIds.length) {
        const { data } = await gcrDb.from('happy_hour_items').select('*').eq('entity_id', eid).order('sort_order');
        hhItems = data || [];
    }

    // Fetch product sub-sections and items
    const productSections = productSectionsRes.data || [];
    const productSectionIds = productSections.map(s => s.id);
    let productSubSections = [], productItems = [];
    if (productSectionIds.length) {
        const [subRes, itemRes] = await Promise.all([
            gcrDb.from('product_sub_sections').select('*').in('product_section_id', productSectionIds).order('sort_order'),
            gcrDb.from('product_items').select('*').eq('entity_id', eid).order('sort_order'),
        ]);
        productSubSections = subRes.data || [];
        productItems = itemRes.data || [];
    }

    // Fetch old sections content (keep for backwards compat)
    const sections = sectionsRes.data || [];
    const sectionsWithContent = await Promise.all(sections.map(sec => fetchSectionContent(sec)));

    res.json({
        entity,
        features:      featuresRes.data   || [],
        perfect_for:   perfectForRes.data || [],
        tags:          tagsRes.data       || [],
        sections:      sectionsWithContent,
        // New dedicated tables
        hours:         hoursRes.data      || [],
        about_bullets: bulletsRes.data    || [],
        photos:        photosRes.data     || [],
        menu: {
            sections:     menuSections,
            sub_sections: menuSubSections,
            items:        menuItems,
        },
        drinks: {
            sections: drinkSections,
            items:    drinkItems,
        },
        happy_hour: {
            sections: hhSections,
            items:    hhItems,
        },
        events:       eventsRes.data      || [],
        specials:     specialsRes.data    || [],
        activities:   activitiesRes.data  || [],
        pricing:      pricingRes.data     || [],
        booking_slots: slotsRes.data      || [],
        fleet:        fleetRes.data       || [],
        addons:       addonsRes.data      || [],
        whats_included: includedRes.data  || [],
        requirements: requirementsRes.data || [],
        policies:     policiesRes.data    || [],
        meeting_points: meetingRes.data   || [],
        qna:          qnaRes.data         || [],
        shopping: {
            sections:     productSections,
            sub_sections: productSubSections,
            items:        productItems,
        },
    });
});

// ============================================
// GET /api/gcr/category-page-config/:categoryId
// Public: returns hero image, title, description for a category page
// Called by gcr-config.js on every category listing page
// ============================================
router.get('/category-page-config/:categoryId', async (req, res) => {
    if (!gcrDb) return res.status(503).json({ error: 'GCR DB not available' });
    const { categoryId } = req.params;
    const { data, error } = await gcrDb
        .from('gcr_category_page_config')
        .select('category_id, page_title, page_description, hero_image_url')
        .eq('category_id', categoryId)
        .single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json(data || { category_id: categoryId });
});

module.exports = router;

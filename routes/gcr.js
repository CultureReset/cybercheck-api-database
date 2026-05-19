const express = require('express');
const multer  = require('multer');
const supabase = require('../db');
const getGcrDb = require('../gcr-db');
const { callAIRound } = require('./ai-provider');

const router = express.Router();
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

let gcrDb; try { gcrDb = getGcrDb(); } catch(e) { console.warn('GCR DB not initialized:', e.message); }

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
    return res.redirect('/api/gcr/entities?' + new URLSearchParams(req.query).toString());
});

// ============================================
// GET /api/gcr/events — events from MASTER-BUSINESSES-WITH-EVENTS
// ============================================
router.get('/events', async (req, res) => {
    try {
        // Get events from entity_events table with entity details
        const { data: events, error } = await gcrDb
            .from('entity_events')
            .select(`
                id,
                event_name,
                artist_name,
                event_date,
                start_time,
                description,
                event_type,
                venue_location,
                cover_charge,
                entity_id,
                entity:entity_id(id, name, slug, city, hero_image_url, icon)
            `)
            .eq('is_active', true)
            .order('event_date', { ascending: true });

        if (error) {
            console.error('Error loading events:', error.message);
            return res.status(500).json({ error: error.message });
        }

        // Flatten and enrich events with entity details
        const allEvents = (events || []).map(ev => ({
            id: ev.id,
            event_name: ev.event_name,
            artist_name: ev.artist_name,
            event_date: ev.event_date,
            start_time: ev.start_time,
            description: ev.description,
            event_type: ev.event_type,
            venue_location: ev.venue_location,
            cover_charge: ev.cover_charge,
            entity_name: ev.entity?.name,
            entity_slug: ev.entity?.slug,
            entity_hero_image_url: ev.entity?.hero_image_url,
            city: ev.entity?.city,
            entity_city: ev.entity?.city,
            businessName: ev.entity?.name,
            slug: ev.entity?.slug,
        }));

        // Filter by slug if requested
        let results = allEvents;
        if (req.query.slug) {
            results = allEvents.filter(e => e.slug === req.query.slug);
        }

        res.json(results);
    } catch (e) {
        console.error('Error loading events:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// GET /api/gcr/happy-hours — entities with HH data from any source
// ============================================
router.get('/happy-hours', async (req, res) => {
  try {
    // Get entity IDs from actual HH data only — NOT tags (tags are unreliable)
    const safe = q => Promise.resolve(q).catch(() => ({ data: [] }));
    const [secRes, specialRes, hhDaysRes, hhTableRes] = await Promise.all([
        safe(gcrDb.from('happy_hour_sections').select('entity_id').limit(1000)),
        safe(gcrDb.from('entity_specials').select('entity_id').eq('special_type', 'happy_hour').eq('is_active', true)),
        safe(gcrDb.from('entity').select('id').not('hh_days', 'is', null).eq('is_active', true)),
        safe(gcrDb.from('entity_happy_hours').select('entity_id')),
    ]);

    // Only entities with real HH data
    const hhEntityIds = new Set();
    (secRes.data || []).forEach(r => hhEntityIds.add(r.entity_id));
    (specialRes.data || []).forEach(r => hhEntityIds.add(r.entity_id));
    (hhDaysRes.data || []).forEach(r => hhEntityIds.add(r.id));
    (hhTableRes.data || []).forEach(r => hhEntityIds.add(r.entity_id));

    if (!hhEntityIds.size) return res.json([]);

    const { data, error } = await gcrDb
        .from('entity')
        .select('id, slug, name, icon, hero_image_url, entity_subtype, city, phone, directions_url, call_url, address_line_1, rating, hh_days, hh_start, hh_end, hh_description, description, price_range, price_from, price_to, price_unit, booking_url, reservation_url, social_instagram, social_facebook')
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
  } catch (err) {
    console.error('happy-hours error:', err.message);
    res.status(500).json({ error: err.message });
  }
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

    // Search across all new GCR DB tables in parallel — NOTE: tags intentionally excluded
    // so searches only match real, meaningful content (names, descriptions, menu items, etc.)
    const [
        byEntity, byAllSectionItems, bySectionTypes,
        bySpecials, byEvents, byActivities
    ] = await Promise.all([
        // Entity fields: name, subtitle, description, city, entity_subtype
        gcrDb.from('entity').select('id').eq('is_active', true)
            .or(kf('name','subtitle','description','city','entity_subtype')),
        // Section items from all types (menu/drinks/happy_hour)
        gcrDb.from('section_items')
            .select('section_id')
            .or(kf('item_name','item_description')),
        // Get section type info for matched items
        gcrDb.from('entity_sections')
            .select('id, entity_id, section_type'),
        // Specials
        gcrDb.from('entity_specials').select('entity_id').eq('is_active', true).or(kf('special_name','description','discount_text')),
        // Events
        gcrDb.from('entity_events').select('entity_id').eq('is_active', true).or(kf('event_name','description','artist_name','music_style','event_type')),
        // Activities (Things To Do)
        gcrDb.from('activities').select('entity_id').or(kf('activity_name','description','activity_type')),
    ]);

    // Resolve section_items to entity_ids by joining with entity_sections
    let byMenuItems = { data: [] }, byDrinkItems = { data: [] }, byHHItems = { data: [] };
    const sectionItemSectionIds = (byAllSectionItems.data || []).map(r => r.section_id);
    const sectionMap = Object.fromEntries((bySectionTypes.data || []).map(s => [s.id, s]));

    if (sectionItemSectionIds.length) {
        const menuIds = sectionItemSectionIds
            .map(id => sectionMap[id])
            .filter(s => s && (s.section_type === 'menu' || s.section_type === 'grouped_items'))
            .map(s => s.entity_id);
        const drinkIds = sectionItemSectionIds
            .map(id => sectionMap[id])
            .filter(s => s && s.section_type === 'drinks')
            .map(s => s.entity_id);
        const hhIds = sectionItemSectionIds
            .map(id => sectionMap[id])
            .filter(s => s && s.section_type === 'happy_hour')
            .map(s => s.entity_id);

        byMenuItems = { data: [...new Set(menuIds)].map(id => ({ entity_id: id })) };
        byDrinkItems = { data: [...new Set(drinkIds)].map(id => ({ entity_id: id })) };
        byHHItems = { data: [...new Set(hhIds)].map(id => ({ entity_id: id })) };
    }

    // Collect all matching entity IDs — filter out undefined/null to prevent UUID parse errors
    [byEntity, byMenuItems, byDrinkItems, byHHItems, bySpecials, byEvents, byActivities]
        .forEach(res => (res.data || []).forEach(r => {
            const id = r.entity_id || r.id;
            if (id) matchedEntityIds.add(id);
        }));

    if (!matchedEntityIds.size) return res.json({ query: searchQuery, results: [], total: 0 });

    // Fetch full entity data for all matches
    let entityQuery = gcrDb.from('entity')
        .select('id, slug, name, subtitle, entity_subtype, secondary_types, icon, phone, rating, review_count, city, state, address_line_1, hero_image_url, website_url, directions_url, call_url, price_range, price_from, price_to, price_unit, featured, booking_url, reservation_url, order_url, hh_days, hh_start, hh_end')
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

    // Require a real description on menu/drink/HH items — filters out tag-like rows
    // where item_name is just a keyword with no real item info
    const hasRealDescription = (item) => ((item.description || item.item_description || '').trim().length > 0);

    if (entityIdList.length) {
        const [sectionItemMatches, specialMatches, eventMatches] = await Promise.all([
            // All section items matching query (will filter by section_type after)
            gcrDb.from('section_items')
                .select('section_id, item_name, item_description, price_text, price_numeric')
                .or(`item_name.ilike.%${q}%,item_description.ilike.%${q}%`),
            gcrDb.from('entity_specials').select('entity_id, special_name, description, discount_text').eq('is_active', true)
                .or(`special_name.ilike.%${q}%,description.ilike.%${q}%,discount_text.ilike.%${q}%`).in('entity_id', entityIdList),
            gcrDb.from('entity_events').select('entity_id, event_name, event_date, day_of_week').eq('is_active', true)
                .or(`event_name.ilike.%${q}%,description.ilike.%${q}%`).in('entity_id', entityIdList),
        ]);

        // Map section items by entity_id and section_type
        const sectionItemsByEntity = {};
        (sectionItemMatches.data || []).forEach(item => {
            const section = sectionMap[item.section_id];
            if (!section) return; // No section found

            const entityId = section.entity_id;
            if (!entityIdList.includes(entityId)) return; // Not in search results

            const mapped = {
                entity_id: entityId,
                item_name: item.item_name,
                description: item.item_description || '',
                price: item.price_numeric,
                price_text: item.price_text,
                hh_price: item.price_numeric,
            };

            if (section.section_type === 'menu' || section.section_type === 'grouped_items') {
                if (!menuMatchMap[entityId]) menuMatchMap[entityId] = [];
                menuMatchMap[entityId].push({ ...mapped, _type: 'menu' });
            } else if (section.section_type === 'drinks') {
                if (!drinkMatchMap[entityId]) drinkMatchMap[entityId] = [];
                drinkMatchMap[entityId].push({ ...mapped, _type: 'drink' });
            } else if (section.section_type === 'happy_hour') {
                if (!hhMatchMap[entityId]) hhMatchMap[entityId] = [];
                hhMatchMap[entityId].push({ ...mapped, _type: 'happy_hour' });
            }
        });

        (specialMatches.data || []).forEach(s => { if (!specialMatchMap[s.entity_id]) specialMatchMap[s.entity_id] = []; specialMatchMap[s.entity_id].push(s); });
        (eventMatches.data || []).forEach(e => { if (!eventMatchMap[e.entity_id]) eventMatchMap[e.entity_id] = []; eventMatchMap[e.entity_id].push(e); });

        // Filter out items without real descriptions
        Object.keys(menuMatchMap).forEach(eid => {
            menuMatchMap[eid] = menuMatchMap[eid].filter(hasRealDescription);
        });
        Object.keys(drinkMatchMap).forEach(eid => {
            drinkMatchMap[eid] = drinkMatchMap[eid].filter(hasRealDescription);
        });
        Object.keys(hhMatchMap).forEach(eid => {
            hhMatchMap[eid] = hhMatchMap[eid].filter(hasRealDescription);
        });
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
        const specials  = sortItems(specialMatchMap[e.id] || [], q);
        const events    = eventMatchMap[e.id] || [];
        const nameScore = scoreItem(e.name, e.subtitle, q);
        const itemScore = menuItems.length > 0 ? scoreItem(menuItems[0].item_name, menuItems[0].description, q) : 0;
        const relevance = Math.max(nameScore, itemScore) + (e.rating || 0);
        // Drop entity if nothing real matched — name/subtitle didn't match AND
        // no menu/drink/HH item with description AND no specials AND no events
        const hasRealMatch = nameScore > 0 || menuItems.length > 0 || specials.length > 0 || events.length > 0;
        if (!hasRealMatch) return null;
        return {
            ...e,
            site_id: e.id, subdomain: e.slug, emoji: e.icon,
            type: e.entity_subtype, category: e.entity_subtype,
            cover_url: e.hero_image_url, tagline: e.subtitle,
            photos: photosMap[e.id] || [],
            matched_menu_items: menuItems,
            matched_specials:   specials,
            matched_events:     events,
            _relevance: relevance,
        };
    }).filter(Boolean).sort((a, b) => b._relevance - a._relevance);

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
// GET /api/gcr/business/:id — Single business detail (from GCR database)
// ============================================
router.get('/business/:id', async (req, res) => {
    const entityId = req.params.id;

    const { data: entity } = await gcrDb
        .from('entity')
        .select('id, name, slug, icon, description, address_line_1, city, state, zip, phone, website_url, hero_image_url, entity_subtype, price_range, rating, review_count')
        .eq('id', entityId)
        .eq('is_active', true)
        .single();

    if (!entity) {
        return res.status(404).json({ error: 'Business not found' });
    }

    // Get all public data from GCR in parallel
    const [services, reviews, faqs, staff, specials, hours, photos] = await Promise.all([
        gcrDb.from('services').select('id, name, description, price, duration_minutes').eq('entity_id', entityId).eq('is_available', true).order('sort_order'),
        gcrDb.from('reviews').select('id, customer_name, rating, text, created_at').eq('entity_id', entityId).eq('status', 'published').order('created_at', { ascending: false }),
        gcrDb.from('faqs').select('id, question, answer').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('staff').select('name, position, bio, photo_url, phone, email').eq('entity_id', entityId).eq('active', true),
        gcrDb.from('entity_specials').select('special_name, description, discount_text').eq('entity_id', entityId).eq('is_active', true),
        gcrDb.from('entity_hours').select('day_of_week, open_time, close_time, is_closed').eq('entity_id', entityId).order('day_of_week'),
        gcrDb.from('entity_photos').select('image_url, caption').eq('entity_id', entityId).order('sort_order')
    ]);

    const reviewsList = reviews.data || [];
    const avgRating = reviewsList.length > 0
        ? reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length
        : 0;

    res.json({
        ...entity,
        services: services.data || [],
        reviews: reviewsList,
        avg_rating: Math.round(avgRating * 10) / 10,
        review_count: reviewsList.length,
        faqs: faqs.data || [],
        staff: staff.data || [],
        specials: specials.data || [],
        hours: hours.data || [],
        photos: photos.data || []
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

    const settings = await getAISettings();
    const apiKey = settings.chat_api_key || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return res.json({ reply: "AI is being set up — check back soon!" });

    const { data: entities } = await gcrDb
        .from('entity')
        .select('id, name, entity_subtype, slug, subtitle, city, state, price_range, rating, hh_days, hh_start, hh_end, phone, website_url, address_line_1')
        .eq('is_active', true)
        .order('name')
        .limit(80);

    // Also pull tags for each entity to build amenity flags
    const entityIds = (entities || []).map(e => e.id).filter(Boolean);
    let tagsByEntity = {};
    if (entityIds.length) {
        const { data: allTags } = await gcrDb.from('entity_tags').select('entity_id, tag').in('entity_id', entityIds);
        (allTags || []).forEach(t => {
            if (!tagsByEntity[t.entity_id]) tagsByEntity[t.entity_id] = [];
            tagsByEntity[t.entity_id].push(t.tag);
        });
    }

    const bizContext = (entities || []).map(e => {
        const tags = tagsByEntity[e.id] || [];
        const flags = [
            e.hh_days && 'happy hour',
            tags.includes('live_music') && 'live music',
            tags.includes('kids_friendly') && 'kid-friendly',
            tags.includes('pet_friendly') && 'pet-friendly',
            tags.includes('outdoor_seating') && 'outdoor seating',
            tags.includes('full_bar') && 'full bar',
        ].filter(Boolean).join(', ');
        const location = [e.city, e.state].filter(Boolean).join(', ');
        return `• ${e.name} [${e.entity_subtype || ''}] ${location} — ${e.subtitle || ''} | ${flags} | ${e.price_range || ''}`;
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

    // Detect if question needs live web data → route to Gemini with Google Search
    const liveWebKeywords = /weather|forecast|right now|open now|currently|today|tonight|this week|current|live|breaking|news|traffic|gas price|tide|surf/i;
    const needsLiveWeb = liveWebKeywords.test(message);

    try {
        const messages = [...history.slice(-10), { role: 'user', content: message }];

        let reply;
        if (needsLiveWeb && (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY)) {
            // Gemini with Google Search grounding for live/real-time questions
            const result = await callAIRound({
                systemPrompt,
                messages,
                tools: [{ type: 'google_search', name: 'google_search' }],
                provider: 'gemini',
                maxTokens: 250,
                temperature: 0.7,
            });
            reply = result.text;
        } else {
            // Default concierge — provider from ai_settings (Claude Haiku, etc.)
            const result = await callAIRound({
                systemPrompt,
                messages,
                provider: settings.chat_provider || 'anthropic',
                model: settings.chat_model || 'claude-haiku-4-5-20251001',
                maxTokens: 250,
                temperature: 0.85,
            });
            reply = result.text;
        }

        res.json({ reply: reply || "Try rephrasing!" });
    } catch (err) {
        console.error('GCR chat error:', err.message);
        res.json({ reply: "Something went wrong — try again!" });
    }
});

// ============================================
// POST /api/gcr/transcribe — Whisper proxy (keeps OpenAI key server-side)
// ============================================
router.post('/transcribe', audioUpload.single('audio'), async (req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Voice not configured' });
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    try {
        const formData = new FormData();
        formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), 'audio.wav');
        formData.append('model', 'whisper-1');

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
            body: formData
        });
        const data = await whisperRes.json();
        if (!whisperRes.ok) throw new Error(data.error?.message || 'Whisper error');
        res.json({ text: data.text });
    } catch (err) {
        console.error('Transcribe error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// POST /api/gcr/speak — TTS proxy (keeps OpenAI key server-side)
// ============================================
router.post('/speak', async (req, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Voice not configured' });
    const { text, voice = 'alloy' } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    try {
        const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
            body: JSON.stringify({ model: 'tts-1', input: text, voice })
        });
        if (!ttsRes.ok) {
            const err = await ttsRes.json();
            throw new Error(err.error?.message || 'TTS error');
        }
        res.set('Content-Type', 'audio/mpeg');
        ttsRes.body.pipe(res);
    } catch (err) {
        console.error('Speak error:', err.message);
        res.status(500).json({ error: err.message });
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

        // ── Pull Trip Swipe tourist data if JWT provided ──────────────────────
        let touristProfile = null;
        let touristSaves = [];
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                    const [profileRes, savesRes] = await Promise.all([
                        supabase.from('tourist_profiles').select('*').eq('user_id', user.id).maybeSingle(),
                        supabase.from('tourist_saves').select('entity_slug,business_name,category,price_range').eq('user_id', user.id).order('saved_at', { ascending: false }).limit(30),
                    ]);
                    touristProfile = profileRes.data;
                    touristSaves = savesRes.data || [];
                }
            } catch(e) { /* no tourist context — answer without personalization */ }
        }

        // Embed the question
        const queryVector = await embedText(question, settings);

        // Vector similarity search
        const { data: chunks, error: vecErr } = await gcrDb.rpc('match_business_chunks', {
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

        // Build business context from RAG chunks
        const context = chunks.map(c => c.content).join('\n\n---\n\n');

        // Build personalization context from Trip Swipe data
        let personalContext = '';
        if (touristProfile || touristSaves.length) {
            const parts = [];
            if (touristProfile) {
                if (touristProfile.name) parts.push(`Tourist name: ${touristProfile.name}`);
                if (touristProfile.group_type) parts.push(`Traveling: ${touristProfile.group_type}`);
                if (touristProfile.budget) parts.push(`Budget: ${touristProfile.budget}`);
                if (touristProfile.interests?.length) parts.push(`Interests: ${touristProfile.interests.join(', ')}`);
                if (touristProfile.arrival && touristProfile.departure) parts.push(`Trip: ${touristProfile.arrival} to ${touristProfile.departure}`);
                if (touristProfile.hotel_name) parts.push(`Staying at: ${touristProfile.hotel_name}`);
            }
            if (touristSaves.length) {
                const saved = touristSaves.map(s => s.business_name).join(', ');
                parts.push(`Already saved/liked: ${saved}`);
                parts.push(`(Do not recommend places they already saved unless directly relevant)`);
            }
            if (parts.length) personalContext = '\n\nTOURIST PROFILE:\n' + parts.join('\n');
        }

        const systemPrompt = (settings.system_prompt ||
            'You are a friendly local guide for Gulf Coast Radar, the ultimate tourism directory for Orange Beach and Gulf Shores, Alabama.') +
            '\nUse the tourist profile to personalize your answer — match their budget, group type, and interests. Avoid recommending places they already saved unless asked directly.';

        const userMessage = `BUSINESS INFORMATION:\n${context}${personalContext}\n\n---\n\nQuestion: ${question}\n\nGive a personalized, specific recommendation based on both the business info and the tourist profile above.`;

        const answer = await chatCompletion(systemPrompt, userMessage, settings);

        // Deduplicate sources
        const seen = new Set();
        const sources = chunks
            .filter(c => { if (seen.has(c.slug)) return false; seen.add(c.slug); return true; })
            .map(c => ({ name: c.business_name, slug: c.slug, relevance: Math.round(c.similarity * 100) / 100 }));

        res.json({ answer, sources, personalized: !!(touristProfile || touristSaves.length) });

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
        .select('id, slug, name, subtitle, entity_type, entity_subtype, secondary_types, icon, phone, rating, review_count, city, state, zip, address_line_1, hero_image_url, website_url, directions_url, call_url, is_active, description, price_range, price_from, price_to, price_unit, featured, booking_url, reservation_url, order_url, hh_days, hh_start, hh_end, hh_description, social_instagram, social_facebook, social_tiktok, email')
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
                // Handle double-encoded tags stored as JSON strings
                let tag = r.tag, tag_category = r.tag_category;
                try {
                    const parsed = JSON.parse(r.tag);
                    if (parsed && typeof parsed === 'object' && parsed.tag) {
                        tag = parsed.tag;
                        tag_category = parsed.tag_category || r.tag_category;
                    }
                } catch(e) {}
                tagMap[r.entity_id].push({ tag, tag_category });
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
        // Convert array fields to strings for frontend compatibility
        secondary_types: Array.isArray(e.secondary_types) ? e.secondary_types.join(',') : (e.secondary_types || ''),
        google_types:    Array.isArray(e.google_types) ? e.google_types.join(',') : (e.google_types || ''),
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

    // Try exact slug match first
    let { data: entity } = await gcrDb.from('entity').select('*').eq('slug', slug).maybeSingle();

    // Try UUID match
    if (!entity && /^[0-9a-f-]{36}$/i.test(slug)) {
        ({ data: entity } = await gcrDb.from('entity').select('*').eq('id', slug).maybeSingle());
    }

    // Try Google Places ID match
    if (!entity) {
        ({ data: entity } = await gcrDb.from('entity').select('*').eq('google_places_id', slug).maybeSingle());
    }

    // Try partial slug match as fallback
    if (!entity) {
        const { data: entities } = await gcrDb.from('entity').select('*').ilike('slug', slug + '%').eq('is_active', true).limit(1);
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
        entity.entity_type === 'artist'
            ? gcrDb.from('entity_events').select('*').eq('artist_name', entity.name).eq('is_active', true).order('event_date')
            : gcrDb.from('entity_events').select('*').eq('entity_id', eid).eq('is_active', true).order('event_date'),
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

    // Fetch HH items — always fetch by entity_id regardless of whether sections exist
    const hhSections = hhSectionsRes.data || [];
    const { data: hhItemsData } = await gcrDb.from('happy_hour_items').select('*').eq('entity_id', eid).order('sort_order');
    const hhItems = hhItemsData || [];

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

    // For artist entities: enrich events with venue name + slug from entity table
    let artistEvents = eventsRes.data || [];
    if (entity.entity_type === 'artist' && artistEvents.length) {
        const venueIds = [...new Set(artistEvents.map(e => e.entity_id).filter(Boolean))];
        const { data: venues } = await gcrDb.from('entity').select('id, name, slug').in('id', venueIds);
        const venueMap = Object.fromEntries((venues || []).map(v => [v.id, v]));
        artistEvents = artistEvents.map(e => ({
            ...e,
            venue_name: venueMap[e.entity_id]?.name || null,
            venue_slug: venueMap[e.entity_id]?.slug || null,
        }));
    }

    // Fetch old sections content (keep for backwards compat)
    const sections = sectionsRes.data || [];
    const sectionsWithContent = await Promise.all(sections.map(sec => fetchSectionContent(sec)));

    // Fetch section_items and section_bullets for all sections
    const sectionIds = sections.map(s => s.id);
    let sectionItems = [];
    let sectionBullets = [];
    if (sectionIds.length) {
        const [itemsRes, bulletsRes] = await Promise.all([
            gcrDb.from('section_items').select('*').in('section_id', sectionIds).order('sort_order'),
            gcrDb.from('section_bullets').select('*').in('section_id', sectionIds).order('sort_order'),
        ]);
        sectionItems = itemsRes.data || [];
        sectionBullets = bulletsRes.data || [];
    }

    // Build flat menu/drink/HH aliases from section_items (where imported data lives)
    // so profile.html can find data regardless of which import path was used
    const menuSectionsFromSections = sections.filter(s => s.section_type === 'menu' || s.section_type === 'grouped_items');
    const drinkSectionsFromSections = sections.filter(s => s.section_type === 'drinks');
    const hhSectionsFromSections = sections.filter(s => s.section_type === 'happy_hour');

    const menuSectionIds2 = new Set(menuSectionsFromSections.map(s => s.id));
    const drinkSectionIds2 = new Set(drinkSectionsFromSections.map(s => s.id));
    const hhSectionIds2 = new Set(hhSectionsFromSections.map(s => s.id));

    const mapSectionItem = (item) => ({
        id: item.id,
        item_name: item.item_name,
        description: item.item_description || item.description || '',
        price_text: item.price_text || (item.price_numeric != null ? '$' + item.price_numeric : ''),
        price: item.price_numeric,
        image_url: item.image_url || null,
        allergens: item.allergens || '',
        tags: item.tags || [],
        sort_order: item.sort_order,
    });

    // Merge dedicated table data + section_items data, dedup by id
    const mergedMenuSections = [
        ...menuSections,
        ...menuSectionsFromSections.filter(s => !menuSections.find(m => m.id === s.id)).map(s => ({
            id: s.id, section_name: s.section_label, section_note: '', icon: null, entity_id: eid, sort_order: s.sort_order,
        })),
    ];
    const mergedMenuItems = [
        ...menuItems,
        ...sectionItems.filter(i => menuSectionIds2.has(i.section_id)).map(i => ({
            ...mapSectionItem(i), menu_section_id: i.section_id,
        })),
    ];
    const mergedDrinkSections = [
        ...drinkSections,
        ...drinkSectionsFromSections.filter(s => !drinkSections.find(d => d.id === s.id)).map(s => ({
            id: s.id, section_name: s.section_label, section_note: '', icon: null, entity_id: eid, sort_order: s.sort_order,
        })),
    ];
    const mergedDrinkItems = [
        ...drinkItems,
        ...sectionItems.filter(i => drinkSectionIds2.has(i.section_id)).map(i => ({
            ...mapSectionItem(i), drink_section_id: i.section_id,
        })),
    ];
    const mergedHhSections = [
        ...hhSections,
        ...hhSectionsFromSections.filter(s => !hhSections.find(h => h.id === s.id)).map(s => ({
            id: s.id, section_name: s.section_label, section_note: '', icon: null, entity_id: eid, sort_order: s.sort_order,
        })),
    ];
    // HH items: from happy_hour_items table + from section_items with hh section type
    const { data: entityHHData } = await gcrDb.from('entity_happy_hours').select('*').eq('entity_id', eid);
    const mergedHhItems = [
        ...hhItems,
        ...sectionItems.filter(i => hhSectionIds2.has(i.section_id)).map(i => ({
            ...mapSectionItem(i), hh_price: i.price_numeric,
        })),
        ...(entityHHData || []).map(h => ({
            id: h.id,
            item_name: h.days || h.description || 'Happy Hour',
            description: [h.start_time, h.end_time].filter(Boolean).join('–') || h.description || '',
            price_text: '',
            hh_price: null,
        })),
    ];

    res.json({
        entity,
        features:      featuresRes.data   || [],
        perfect_for:   perfectForRes.data || [],
        tags:          (tagsRes.data || []).map(r => {
            try {
                const p = JSON.parse(r.tag);
                if (p && typeof p === 'object' && p.tag) return { ...r, tag: p.tag, tag_category: p.tag_category || r.tag_category };
            } catch(e) {}
            return r;
        }),
        sections:      sectionsWithContent,
        sectionItems:  sectionItems,
        sectionBullets: sectionBullets,
        // New dedicated tables
        hours:         hoursRes.data      || [],
        about_bullets: bulletsRes.data    || [],
        photos:        photosRes.data     || [],
        // Flat aliases expected by profile.html — merged from both storage paths
        menuSections:  mergedMenuSections,
        menuSubSections: menuSubSections,
        menuItems:     mergedMenuItems,
        drinkSections: mergedDrinkSections,
        drinkItems:    mergedDrinkItems,
        hhSections:    mergedHhSections,
        hhItems:       mergedHhItems,
        menu: {
            sections:     mergedMenuSections,
            sub_sections: menuSubSections,
            items:        mergedMenuItems,
        },
        drinks: {
            sections: mergedDrinkSections,
            items:    mergedDrinkItems,
        },
        happy_hour: {
            sections: mergedHhSections,
            items:    mergedHhItems,
        },
        events:       artistEvents,
        specials:     (specialsRes.data || []).reduce((acc, spec) => {
            if (!spec.discount_text || !spec.discount_text.trim()) return acc;
            if (acc.find(s => s.discount_text === spec.discount_text)) return acc;
            return [...acc, { ...spec, special_name: spec.special_name || (spec.discount_text || 'Special') }];
        }, []),
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

// ============================================
// GET  /api/gcr/sales-page/:pageId — public
// PUT  /api/gcr/sales-page/:pageId — admin auth required
// Stores/retrieves JSON config for sales pages in site_data_store
// Key format: sales_page_<pageId>
// ============================================
router.get('/sales-page/:pageId', async (req, res) => {
    const key = `sales_page_${req.params.pageId}`;
    const { data, error } = await supabase
        .from('site_data_store')
        .select('value')
        .eq('key', key)
        .single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data.value);
});

router.put('/sales-page/:pageId', async (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    // Verify token against Supabase auth
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const key = `sales_page_${req.params.pageId}`;
    const value = req.body;

    const { error } = await supabase
        .from('site_data_store')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

// ============================================
// POST /api/gcr/lead-notify
// Called by LAUNCH-GCR-CYBERCHECK after saving a sales lead to Supabase.
// Sends SMS + email to the lead and to the CyberCheck owner.
// Body: { name, business_name, phone, email, business_type, interests, source }
// ============================================
router.post('/lead-notify', async (req, res) => {
    const { sendSms }   = require('../utils/sms');
    const { sendEmail } = require('../utils/email');

    const OWNER_PHONE = '+12058104950';
    const OWNER_EMAIL = 'info@cybercheckinc.com';

    const { name, business_name, phone, email, business_type, interests, source } = req.body || {};
    const firstName   = (name || '').split(' ')[0] || null;
    const interestStr = Array.isArray(interests) && interests.length ? interests.join(', ') : (interests || null);

    const jobs = [];

    // SMS to lead
    if (phone) {
        const greeting = firstName ? `Hi ${firstName}, ` : '';
        jobs.push(
            sendSms(phone,
                `${greeting}thanks for your interest in Gulf Coast Radar + CyberCheck! ` +
                `We'll reach out shortly to get your business page built. ` +
                `Reply STOP to opt out or HELP for support. Msg & data rates may apply.`,
                null, 'lead_confirm', null
            ).catch(e => console.error('GCR lead SMS error:', e.message))
        );
    }

    // SMS to owner
    const ownerMsg = [
        'New GCR lead!', name || 'Unknown', business_name || '',
        phone || '', email || '', business_type || '',
        interestStr ? `Interests: ${interestStr}` : '',
        `Source: ${source || 'unknown'}`
    ].filter(Boolean).join(' | ');
    jobs.push(sendSms(OWNER_PHONE, ownerMsg, null, 'lead_owner_notify', null)
        .catch(e => console.error('GCR owner SMS error:', e.message)));

    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const r   = (label, val) => val ? `<tr><td style="padding:7px 10px;background:#f1f5f9;font-weight:600;width:130px;">${label}</td><td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(val)}</td></tr>` : '';

    // Email to lead
    if (email) {
        jobs.push(sendEmail({
            to: email,
            subject: `Welcome to Gulf Coast Radar — We'll Be in Touch!`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#050e1f;color:#fff;padding:32px;border-radius:12px;">
              <div style="text-align:center;margin-bottom:24px;">
                <strong style="font-size:22px;color:#00b4d8;">Gulf Coast Radar</strong>
                <span style="color:#94a3b8;"> + </span>
                <strong style="font-size:22px;color:#e76f51;">CyberCheck</strong>
              </div>
              <h2 style="color:#fff;margin:0 0 16px;">Hey ${firstName || 'there'}! 👋</h2>
              <p style="color:#94a3b8;line-height:1.6;">Thanks for your interest in <strong style="color:#fff;">Gulf Coast Radar powered by CyberCheck</strong>. Our team will reach out shortly to get your business live on the platform.</p>
              ${interestStr ? `<p style="color:#94a3b8;line-height:1.6;">You indicated interest in: <strong style="color:#00b4d8;">${esc(interestStr)}</strong></p>` : ''}
              <div style="background:#0a1a35;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="margin:0;color:#fff;"><strong>CyberCheck LLC</strong></p>
                <p style="margin:4px 0;color:#94a3b8;">(205) 810-4950</p>
                <p style="margin:4px 0;color:#94a3b8;">info@cybercheckinc.com</p>
              </div>
              <p style="color:#555;font-size:12px;margin-top:24px;">You received this because you submitted a form on our website. Reply STOP to any SMS to opt out.</p>
            </div>`
        }).catch(e => console.error('GCR lead email error:', e.message)));
    }

    // Email to owner
    jobs.push(sendEmail({
        to: OWNER_EMAIL,
        subject: `New GCR Lead: ${name || 'Unknown'} — ${business_name || 'Unknown Business'}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0077b6;">New Lead — Gulf Coast Radar</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            ${r('Name', name)}${r('Business', business_name)}${r('Phone', phone)}
            ${r('Email', email)}${r('Type', business_type)}${r('Interests', interestStr)}${r('Source', source)}
          </table>
        </div>`
    }).catch(e => console.error('GCR owner email error:', e.message)));

    await Promise.allSettled(jobs);
    res.json({ ok: true });
});

// ============================================
// POST /api/gcr/nfc-card-lead — save NFC card form submission to sales_leads + SMS/email
// Body: { name, phone, email, business_name, business_type, source }
// ============================================
router.post('/nfc-card-lead', async (req, res) => {
    const { sendSms }   = require('../utils/sms');
    const { sendEmail } = require('../utils/email');

    const OWNER_PHONE = '+12058104950';
    const OWNER_EMAIL = 'info@cybercheckinc.com';

    const { name, phone, email, business_name, business_type, source } = req.body || {};

    if (!name || !phone) {
        return res.status(400).json({ error: 'name and phone are required' });
    }

    const supabase = require('../db');

    // Insert into sales_leads table
    const { data: leadData, error: leadError } = await supabase
        .from('sales_leads')
        .insert({
            name,
            phone,
            email: email || null,
            business_name: business_name || null,
            business_type: business_type || null,
            source: source || 'nfc-card',
            status: 'new',
            sms_consent: true
        })
        .select('id')
        .single();

    if (leadError) {
        console.error('sales_leads insert error:', leadError);
        return res.status(500).json({ error: 'Failed to save lead' });
    }

    const jobs = [];
    const firstName = (name || '').split(' ')[0] || null;

    // SMS to owner
    const ownerMsg = [
        'NFC card lead!', name, business_name || '', phone, email || '',
        business_type ? `Note: ${business_type}` : '',
        `Source: ${source || 'nfc-card'}`
    ].filter(Boolean).join(' | ');
    jobs.push(sendSms(OWNER_PHONE, ownerMsg, null, 'nfc_card_lead', null)
        .catch(e => console.error('NFC card SMS error:', e.message)));

    // Email to owner
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const r   = (label, val) => val ? `<tr><td style="padding:7px 10px;background:#f1f5f9;font-weight:600;width:130px;">${label}</td><td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;">${esc(val)}</td></tr>` : '';

    jobs.push(sendEmail({
        to: OWNER_EMAIL,
        subject: `NFC Card Lead: ${name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#0077b6;">New NFC Card Lead</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            ${r('Name', name)}${r('Phone', phone)}${r('Email', email)}
            ${r('Business', business_name)}${r('Note', business_type)}
          </table>
        </div>`
    }).catch(e => console.error('NFC card email error:', e.message)));

    await Promise.allSettled(jobs);
    res.json({ ok: true, leadId: leadData?.id });
});

// ============================================
// POST /api/gcr/claim — submit a listing claim request from claim.html popup
// Body: { business_name, category, contact_name, phone, email, website, message }
// ============================================
router.post('/claim', async (req, res) => {
    const { sendSms }   = require('../utils/sms');
    const { sendEmail } = require('../utils/email');

    const OWNER_PHONE = '+12058104950';
    const OWNER_EMAIL = 'info@cybercheckinc.com';

    const {
        business_name, category, contact_name, phone, email, website, message
    } = req.body || {};

    if (!business_name || !contact_name || !email) {
        return res.status(400).json({ error: 'business_name, contact_name, and email are required' });
    }

    const gcrDb = getGcrDb();

    // Insert into gcr_claims table
    const { data, error } = await gcrDb
        .from('gcr_claims')
        .insert({
            business_name,
            claimant_name:  contact_name,
            claimant_email: email,
            claimant_phone: phone || null,
            business_role:  category || null,
            notes:          [website ? `Website: ${website}` : '', message || ''].filter(Boolean).join('\n') || null,
            status:         'pending',
        })
        .select('id')
        .single();

    if (error) {
        console.error('GCR claim insert error:', error.message);
    }

    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Notify owner via SMS
    const ownerMsg = `New GCR Claim! ${contact_name} | ${business_name} | ${phone || ''} | ${email} | ${category || ''}`.slice(0, 160);
    sendSms(OWNER_PHONE, ownerMsg, null, 'claim_owner_notify', null).catch(e => console.error('claim sms err:', e.message));

    // Confirmation email to claimant
    if (email) {
        sendEmail({
            to: email,
            subject: `Your Gulf Coast Radar listing request — ${business_name}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
              <h2 style="color:#0f7c90;">We got your request! 🎉</h2>
              <p>Thanks <strong>${esc(contact_name)}</strong> — we received your request to list <strong>${esc(business_name)}</strong> on Gulf Coast Radar.</p>
              <p>We'll review your info and reach out within 1 business day to get your free listing live.</p>
              <p style="color:#666;font-size:13px;">Gulf Coast Radar · Orange Beach &amp; Gulf Shores, AL</p>
            </div>`
        }).catch(e => console.error('claim email err:', e.message));
    }

    // Notification email to owner
    sendEmail({
        to: OWNER_EMAIL,
        subject: `New Listing Claim: ${business_name} — ${contact_name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;">
          <h2 style="color:#0f7c90;">New Claim Request — Gulf Coast Radar</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;width:130px;">Business</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(business_name)}</td></tr>
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;">Category</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(category)}</td></tr>
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;">Contact</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(contact_name)}</td></tr>
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;">Email</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(email)}</td></tr>
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;">Phone</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(phone)}</td></tr>
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;">Website</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(website)}</td></tr>
            <tr><td style="padding:6px 10px;background:#f1f5f9;font-weight:600;">Message</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${esc(message)}</td></tr>
          </table>
        </div>`
    }).catch(e => console.error('claim owner email err:', e.message));

    res.json({ ok: true, id: data?.id || null });
});

// ============================================
// POST /api/gcr/track — Platform-wide analytics (GCR + TripSwipe page views)
// ═══════════════════════════════════════════════════════════════════════════
// QR MENU THEME LIBRARY
// GET  /api/gcr/menu-themes            — public community gallery
// GET  /api/gcr/menu-themes/:id        — get one theme's full JSON
// POST /api/gcr/menu-themes/generate   — describe → AI → save + apply (admin)
// POST /api/gcr/menu-themes/:id/apply  — apply saved theme to entity (admin)
//
// Supabase table needed (gcrDb):
//   create table qr_menu_themes (
//     id uuid primary key default gen_random_uuid(),
//     name text not null,
//     description text,
//     theme_json jsonb not null,
//     preview_colors jsonb,   -- ["#hex","#hex","#hex","#hex"]
//     category text default 'restaurant',
//     use_count int default 0,
//     is_public boolean default true,
//     created_by text,        -- entity slug of creator
//     created_at timestamptz default now()
//   );
// ═══════════════════════════════════════════════════════════════════════════

async function _verifyAdminJwt(req) {
    try {
        const jwt = require('jsonwebtoken');
        const token = (req.headers.authorization || '').replace('Bearer ', '');
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        return payload.role === 'admin';
    } catch { return false; }
}

// GET /api/gcr/menu-themes?category=&search=&page=
router.get('/menu-themes', async (req, res) => {
    const { category, search, page = 1 } = req.query;
    const limit = 24;
    let query = gcrDb.from('qr_menu_themes')
        .select('id, name, description, preview_colors, category, use_count, created_at')
        .eq('is_public', true)
        .order('use_count', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);
    if (category) query = query.eq('category', category);
    if (search)   query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ themes: data || [] });
});

// GET /api/gcr/menu-themes/:id
router.get('/menu-themes/:id', async (req, res) => {
    const { data, error } = await gcrDb.from('qr_menu_themes').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Theme not found' });
    res.json(data);
});

// POST /api/gcr/menu-themes/generate
router.post('/menu-themes/generate', async (req, res) => {
    if (!await _verifyAdminJwt(req)) return res.status(403).json({ error: 'Unauthorized' });

    const { description, entity_id, slug, category = 'restaurant' } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });

    const systemPrompt = `You are a UI/UX designer specializing in restaurant QR menus. Generate a JSON theme for a digital menu. Return ONLY valid JSON with no explanation, no markdown fences.

Schema (all fields required):
{
  "name": "2-3 word memorable theme name",
  "bg": "#hex background",
  "surface": "#hex card background (slightly different from bg)",
  "surface2": "#hex secondary surface",
  "primary": "#hex main brand color",
  "primary_dark": "#hex darker variant",
  "accent": "#hex price/highlight color",
  "accent_light": "#hex light accent tint",
  "text": "#hex main text",
  "text_muted": "#hex secondary text",
  "text_light": "#hex placeholder text",
  "border": "#hex divider/border",
  "font": "font stack string",
  "radius": "Xpx (8–20)",
  "hero_height": "Xpx (180–300)",
  "modules": { "catch_of_day": bool, "live_music": bool, "specials": bool, "happy_hour": bool, "menu": bool, "drinks": bool, "events": bool },
  "module_order": ["specials","happy_hour","menu","drinks"],
  "template": "kebab-case-theme-name"
}

Rules: text must be readable on bg, accent used for prices, primary for headers. Make it beautiful.`;

    try {
        const result = await callAIRound({
            systemPrompt,
            messages: [{ role: 'user', content: `Create a QR menu theme for: ${description}` }],
            maxTokens: 900,
            temperature: 0.75,
        });

        let themeJson;
        try {
            const raw = result.text.replace(/```json\n?|\n?```/g, '').trim();
            themeJson = JSON.parse(raw);
        } catch {
            return res.status(500).json({ error: 'AI returned invalid JSON', raw: result.text });
        }

        const name = themeJson.name || description.substring(0, 40);
        const previewColors = [themeJson.bg, themeJson.primary, themeJson.accent, themeJson.text].filter(Boolean);

        // Save to community library (one token spend → everyone reuses free)
        const { data: saved } = await gcrDb.from('qr_menu_themes').insert({
            name, description, theme_json: themeJson, preview_colors: previewColors,
            category, use_count: 1, is_public: true, created_by: slug || entity_id || null,
        }).select('id').single();

        // Apply to entity immediately if provided
        if (entity_id) {
            await gcrDb.from('entity').update({ qr_theme: themeJson }).eq('id', entity_id);
        } else if (slug) {
            await gcrDb.from('entity').update({ qr_theme: themeJson }).eq('slug', slug);
        }

        res.json({ theme: themeJson, name, saved_id: saved?.id || null });
    } catch (err) {
        console.error('Theme generation error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/gcr/menu-themes/:id/apply
router.post('/menu-themes/:id/apply', async (req, res) => {
    if (!await _verifyAdminJwt(req)) return res.status(403).json({ error: 'Unauthorized' });

    const { entity_id, slug } = req.body;
    if (!entity_id && !slug) return res.status(400).json({ error: 'entity_id or slug required' });

    const { data: theme, error } = await gcrDb.from('qr_menu_themes').select('theme_json, name, use_count').eq('id', req.params.id).single();
    if (error || !theme) return res.status(404).json({ error: 'Theme not found' });

    if (entity_id) await gcrDb.from('entity').update({ qr_theme: theme.theme_json }).eq('id', entity_id);
    else if (slug)  await gcrDb.from('entity').update({ qr_theme: theme.theme_json }).eq('slug', slug);

    // Increment use count
    await gcrDb.from('qr_menu_themes').update({ use_count: (theme.use_count || 0) + 1 }).eq('id', req.params.id);

    res.json({ success: true, theme: theme.theme_json, name: theme.name });
});

// GET /api/gcr/analytics?days=30
router.get('/analytics', async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    try {
        const { data, error } = await gcrDb
            .from('gcr_page_views')
            .select('page_path, page_title, referrer, utm_source, utm_medium, utm_campaign, device_type, duration_secs, session_id, country, city, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(10000);

        if (error) return res.status(500).json({ error: error.message });
        const rows = data || [];

        const pageMap = {}, sourceMap = {}, campaignMap = {}, deviceMap = {}, dailyMap = {}, countryMap = {}, cityMap = {};
        const sessions = new Set();
        let totalDuration = 0, durationCount = 0;

        rows.forEach(r => {
            if (r.session_id) sessions.add(r.session_id);
            const page = r.page_path || '/';
            pageMap[page] = (pageMap[page] || 0) + 1;

            let src = 'direct';
            if (r.utm_source) src = r.utm_source;
            else if (r.referrer) { try { src = new URL(r.referrer).hostname.replace('www.',''); } catch {} }
            sourceMap[src] = (sourceMap[src] || 0) + 1;

            if (r.utm_campaign) campaignMap[r.utm_campaign] = (campaignMap[r.utm_campaign] || 0) + 1;
            deviceMap[r.device_type || 'unknown'] = (deviceMap[r.device_type || 'unknown'] || 0) + 1;

            const day = (r.created_at || '').slice(0, 10);
            if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;

            if (r.duration_secs > 0) { totalDuration += r.duration_secs; durationCount++; }
            if (r.country) countryMap[r.country] = (countryMap[r.country] || 0) + 1;
            if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1;
        });

        const topN = (map, n = 10) => Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, n).map(([k,v]) => ({ name: k, count: v }));

        res.json({
            total_pageviews: rows.length,
            unique_sessions: sessions.size,
            avg_duration_secs: durationCount ? Math.round(totalDuration / durationCount) : 0,
            top_pages: topN(pageMap, 15),
            top_sources: topN(sourceMap, 10),
            top_campaigns: topN(campaignMap, 10),
            devices: topN(deviceMap, 5),
            top_countries: topN(countryMap, 15),
            top_cities: topN(cityMap, 15),
            daily: Object.entries(dailyMap).sort((a,b) => a[0] < b[0] ? -1 : 1).map(([d,c]) => ({ date: d, count: c })),
            days,
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/gcr/settings/:key — read a setting
router.get('/settings/:key', async (req, res) => {
    const { data } = await gcrDb.from('gcr_settings').select('value').eq('key', req.params.key).single();
    res.json({ key: req.params.key, value: data?.value || null });
});

// POST /api/gcr/settings — save a setting (admin only via simple shared secret)
router.post('/settings', async (req, res) => {
    const { key, value, secret } = req.body || {};
    if (secret !== (process.env.GCR_ADMIN_SECRET || 'gcr-admin-2026')) return res.status(403).json({ error: 'unauthorized' });
    if (!key) return res.status(400).json({ error: 'key required' });
    const { error } = await gcrDb.from('gcr_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

// POST /api/gcr/track — page view + geo lookup
router.post('/track', async (req, res) => {
    res.json({ ok: true });
    const {
        page_path, page_title, referrer, session_id,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        device_type, duration_secs, source
    } = req.body || {};
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;

    // Geo lookup via ip-api.com (free, no key needed, 45req/min)
    let country = null, city = null;
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
        try {
            const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,status`, { signal: AbortSignal.timeout(1500) });
            const geo = await geoRes.json();
            if (geo.status === 'success') { country = geo.country || null; city = geo.city || null; }
        } catch {}
    }

    try {
        await gcrDb.from('gcr_page_views').insert({
            page_path:    page_path    || '/',
            page_title:   page_title   || null,
            referrer:     referrer     || null,
            session_id:   session_id   || null,
            utm_source:   utm_source   || null,
            utm_medium:   utm_medium   || null,
            utm_campaign: utm_campaign || null,
            utm_term:     utm_term     || null,
            utm_content:  utm_content  || null,
            device_type:  device_type  || null,
            duration_secs: duration_secs || null,
            source:       source       || 'gcr',
            ip_address:   ip,
            country,
            city,
        });
    } catch (e) { /* non-blocking */ }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gcr/menu-editor-data?entity_id=UUID  or  ?slug=xxx
// Returns full menu (items + drinks + specials) for the owner edit page.
// No auth beyond entity ID (UUID is hard to guess).
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/menu-editor-data', async (req, res) => {
    // Bypass CDN cache for this endpoint — always fresh
    res.set('Cache-Control', 'no-store');

    const { entity_id, slug } = req.query;
    if (!entity_id && !slug) return res.status(400).json({ error: 'entity_id or slug required' });

    try {
        let entityQuery = gcrDb.from('entity').select('id, slug, name, city, entity_subtype');
        if (entity_id) entityQuery = entityQuery.eq('id', entity_id);
        else           entityQuery = entityQuery.eq('slug', slug);
        const { data: entity, error: eErr } = await entityQuery.single();
        if (eErr || !entity) return res.status(404).json({ error: 'Entity not found' });

        const eid = entity.id;

        const [
            { data: menuSections },
            { data: drinkSections },
            { data: specials },
        ] = await Promise.all([
            gcrDb.from('menu_sections').select('id, section_name, sort_order').eq('entity_id', eid).order('sort_order'),
            gcrDb.from('drink_sections').select('id, section_name, sort_order').eq('entity_id', eid).order('sort_order'),
            gcrDb.from('entity_specials').select('*').eq('entity_id', eid).eq('is_active', true),
        ]);

        const [{ data: menuItems }, { data: drinkItems }] = await Promise.all([
            gcrDb.from('menu_items').select('id, item_name, description, price, price_text, is_available, image_url, menu_section_id, sort_order').eq('entity_id', eid).order('sort_order'),
            gcrDb.from('drink_items').select('id, item_name, description, price, price_text, is_available, image_url, drink_section_id, sort_order').eq('entity_id', eid).order('sort_order'),
        ]);

        res.json({
            entity,
            menuSections:  menuSections  || [],
            drinkSections: drinkSections || [],
            menuItems:     menuItems     || [],
            drinkItems:    drinkItems    || [],
            specials:      specials      || [],
        });
    } catch (err) {
        console.error('menu-editor-data error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gcr/menu-editor-save
// Body: { entity_id, item_changes[], drink_changes[], new_specials[], remove_specials[] }
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/menu-editor-save', async (req, res) => {
    const { entity_id, item_changes = [], drink_changes = [], new_specials = [], remove_specials = [] } = req.body;
    if (!entity_id) return res.status(400).json({ error: 'entity_id required' });

    try {
        // Verify entity exists
        const { data: entity } = await gcrDb.from('entity').select('id').eq('id', entity_id).single();
        if (!entity) return res.status(404).json({ error: 'Entity not found' });

        let items_updated = 0, drinks_updated = 0, specials_added = 0, specials_removed = 0;

        // Update menu items
        for (const ch of item_changes) {
            const update = {};
            if (ch.is_available !== undefined) update.is_available = ch.is_available;
            if (ch.price !== undefined && ch.price !== null) update.price = ch.price;
            if (!Object.keys(update).length) continue;
            const { error } = await gcrDb.from('menu_items').update(update).eq('id', ch.id).eq('entity_id', entity_id);
            if (!error) items_updated++;
        }

        // Update drink items
        for (const ch of drink_changes) {
            const update = {};
            if (ch.is_available !== undefined) update.is_available = ch.is_available;
            if (ch.price !== undefined && ch.price !== null) update.price = ch.price;
            if (!Object.keys(update).length) continue;
            const { error } = await gcrDb.from('drink_items').update(update).eq('id', ch.id).eq('entity_id', entity_id);
            if (!error) drinks_updated++;
        }

        // Add new specials
        for (const s of new_specials) {
            if (!s.name) continue;
            const today = new Date().toISOString().slice(0, 10);
            await gcrDb.from('entity_specials').insert({
                entity_id,
                special_name: s.name,
                description:  s.desc || null,
                price:        s.price || null,
                is_active:    true,
                start_date:   today,
                end_date:     today,
                special_type: 'daily',
            });
            specials_added++;
        }

        // Remove specials (mark inactive rather than delete)
        if (remove_specials.length) {
            const { error } = await gcrDb.from('entity_specials')
                .update({ is_active: false })
                .in('id', remove_specials)
                .eq('entity_id', entity_id);
            if (!error) specials_removed = remove_specials.length;
        }

        res.json({ ok: true, items_updated, drinks_updated, specials_added, specials_removed });
    } catch (err) {
        console.error('menu-editor-save error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/gcr/community-photos/:slug — approved community photos for a business (public)
router.get('/community-photos/:slug', async (req, res) => {
    const { data, error } = await supabase
        .from('tourist_photos')
        .select('id, image_url, caption, uploader_name, category, submitted_at')
        .eq('entity_slug', req.params.slug)
        .eq('status', 'approved')
        .order('submitted_at', { ascending: false })
        .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ photos: data || [] });
});

// ============================================
// AD NETWORK — rotating ads shown on free-tier QR menus
// ============================================

// GET /api/gcr/ads — returns N random active ads (weighted)
router.get('/ads', async (req, res) => {
    res.set('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    try {
        const { data, error } = await gcrDb
            .from('gcr_ads')
            .select('id, advertiser_name, tagline, image_url, cta_text, cta_url, weight, logo_url, badge_text')
            .eq('is_active', true)
            .order('weight', { ascending: false });
        if (error) return res.json({ ads: [] }); // graceful if table not yet created

        // Weighted shuffle: duplicate by weight then pick limit
        const pool = [];
        (data || []).forEach(ad => {
            for (let i = 0; i < (ad.weight || 1); i++) pool.push(ad);
        });
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const seen = new Set();
        const ads = pool.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; }).slice(0, limit);
        res.json({ ads });
    } catch (e) {
        res.json({ ads: [] });
    }
});

// POST /api/gcr/ads/:id/impression — record an ad impression
router.post('/ads/:id/impression', async (req, res) => {
    try {
        await gcrDb.rpc('increment_ad_impression', { ad_id: req.params.id }).catch(() =>
            gcrDb.from('gcr_ads').select('impressions').eq('id', req.params.id).single().then(({ data }) =>
                gcrDb.from('gcr_ads').update({ impressions: (data?.impressions || 0) + 1 }).eq('id', req.params.id)
            )
        );
    } catch (_) {}
    res.json({ ok: true });
});

// POST /api/gcr/ads/:id/click — record an ad click
router.post('/ads/:id/click', async (req, res) => {
    try {
        await gcrDb.from('gcr_ads').select('clicks').eq('id', req.params.id).single().then(({ data }) =>
            gcrDb.from('gcr_ads').update({ clicks: (data?.clicks || 0) + 1 }).eq('id', req.params.id)
        );
    } catch (_) {}
    res.json({ ok: true });
});

// GET /api/admin/gcr/ads — list all ads (admin)
// ============================================
// GET /api/gcr/live-now — businesses with active signals right now
// Returns: happy hours active, events tonight, specials active, booking slots available
// Optional: ?tourist_id=UUID to sort by preference match
// Optional: ?limit=20
// ============================================
router.get('/live-now', async (req, res) => {
    res.set('Cache-Control', 'no-store'); // always fresh — real-time

    const now = new Date();
    const todayInt  = now.getDay(); // 0=Sun..6=Sat
    const todayStr  = now.toISOString().slice(0, 10);
    const timeStr   = now.toTimeString().slice(0, 5); // 'HH:MM'
    const dayNames  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const todayName = dayNames[todayInt];
    const limit     = Math.min(parseInt(req.query.limit) || 30, 100);
    const touristId = req.query.tourist_id || null;

    // --- Run all queries in parallel ---
    const [hhRes, eventsRes, specialsRes] = await Promise.all([
        // Happy hours: entities with hh_start/hh_end that bracket current time
        gcrDb.from('entity')
            .select('id, slug, name, hero_image_url, entity_subtype, city, hh_start, hh_end, hh_days, hh_description, rating, booking_url, phone')
            .not('hh_start', 'is', null)
            .not('hh_end', 'is', null)
            .eq('is_active', true)
            .lte('hh_start', timeStr)
            .gte('hh_end', timeStr)
            .limit(100),

        // Events today: specific date OR recurring day_of_week match
        gcrDb.from('entity_events')
            .select('entity_id, event_name, artist_name, start_time, end_time, event_type, event_date, day_of_week, recurring, entity(id, slug, name, hero_image_url, entity_subtype, city, rating, booking_url)')
            .eq('is_active', true)
            .or(`event_date.eq.${todayStr},day_of_week.eq.${todayInt}`)
            .limit(100),

        // Active specials
        gcrDb.from('entity_specials')
            .select('entity_id, special_name, description, discount_text, special_type, entity(id, slug, name, hero_image_url, entity_subtype, city, rating, booking_url)')
            .eq('is_active', true)
            .limit(100),
    ]);

    // Filter happy hours by day — hh_days is stored as comma-separated day names or JSON array
    const activeHH = (hhRes.data || []).filter(e => {
        if (!e.hh_days) return true; // no day restriction = always
        const days = typeof e.hh_days === 'string'
            ? e.hh_days.toLowerCase().replace(/[[\]"]/g, '').split(/[\s,]+/)
            : (Array.isArray(e.hh_days) ? e.hh_days.map(d => d.toLowerCase()) : []);
        return days.length === 0 || days.some(d => todayName.startsWith(d.slice(0,3)));
    });

    // Build a map: slug → signals[]
    const signalMap = {}; // slug → { entity, signals[] }

    const addSignal = (entity, signal) => {
        if (!entity?.slug) return;
        if (!signalMap[entity.slug]) signalMap[entity.slug] = { entity, signals: [] };
        signalMap[entity.slug].signals.push(signal);
    };

    for (const e of activeHH) {
        addSignal(e, {
            type: 'happy_hour',
            label: `🍹 Happy Hour until ${fmt12(e.hh_end)}`,
            detail: e.hh_description || null,
        });
    }

    for (const ev of (eventsRes.data || [])) {
        const ent = ev.entity;
        if (!ent) continue;
        addSignal(ent, {
            type: 'event',
            label: `🎵 ${ev.event_name || 'Live Tonight'}`,
            detail: ev.artist_name || null,
            start_time: ev.start_time || null,
        });
    }

    for (const sp of (specialsRes.data || [])) {
        const ent = sp.entity;
        if (!ent) continue;
        addSignal(ent, {
            type: 'special',
            label: `🏷️ ${sp.special_name || 'Special'}`,
            detail: sp.discount_text || sp.description || null,
        });
    }

    // Fetch tags for preference matching if tourist_id provided
    let prefMap = {};
    if (touristId) {
        try {
            const mainDb = require('../db')();
            const { data: scores } = await mainDb
                .from('user_preference_scores')
                .select('tag, score')
                .eq('tourist_id', touristId)
                .gt('score', 0)
                .order('score', { ascending: false })
                .limit(30);
            for (const s of (scores || [])) prefMap[s.tag.toLowerCase()] = s.score;
        } catch {}
    }

    // Fetch entity_tags for all slugs so we can score them
    const slugList = Object.keys(signalMap);
    let entityTagMap = {};
    if (slugList.length && Object.keys(prefMap).length) {
        try {
            const { data: tagRows } = await gcrDb
                .from('entity_tags')
                .select('entity_id, tag')
                .in('entity_id', Object.values(signalMap).map(s => s.entity.id).filter(Boolean));

            const entityIdToSlug = {};
            for (const [slug, v] of Object.entries(signalMap)) {
                if (v.entity.id) entityIdToSlug[v.entity.id] = slug;
            }
            for (const row of (tagRows || [])) {
                const slug = entityIdToSlug[row.entity_id];
                if (!slug) continue;
                let tag = row.tag;
                try { const p = JSON.parse(tag); tag = p?.tag || tag; } catch {}
                if (!entityTagMap[slug]) entityTagMap[slug] = [];
                entityTagMap[slug].push(tag.toLowerCase().trim());
            }
        } catch {}
    }

    // Score and sort results
    let results = Object.values(signalMap).map(({ entity, signals }) => {
        const tags = entityTagMap[entity.slug] || [];
        const matchScore = tags.reduce((sum, tag) => sum + (prefMap[tag] || 0), 0)
            + (prefMap[entity.entity_subtype?.toLowerCase()] || 0);
        return {
            slug:          entity.slug,
            name:          entity.name,
            hero_image_url:entity.hero_image_url,
            category:      entity.entity_subtype,
            city:          entity.city,
            rating:        entity.rating,
            booking_url:   entity.booking_url,
            phone:         entity.phone,
            signals,
            match_score:   matchScore,
            is_match:      matchScore >= 10,
        };
    });

    // Sort: matched first, then by number of signals, then by rating
    results.sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        if (b.signals.length !== a.signals.length) return b.signals.length - a.signals.length;
        return (b.rating || 0) - (a.rating || 0);
    });

    results = results.slice(0, limit);

    res.json({
        time:        timeStr,
        day:         todayName,
        date:        todayStr,
        count:       results.length,
        personalized: !!touristId,
        results,
    });
});

// ============================================
// GET /api/gcr/locations/autocomplete — location search with distance
// ============================================
router.get('/locations/autocomplete', async (req, res) => {
  const q = req.query.q || '';
  if (!q || q.length < 2) {
    return res.json({ results: [] });
  }

  try {
    // Search for entities by city/address that match the query
    const { data: entities, error } = await gcrDb
      .from('entity')
      .select('id, name, city, state, address_line_1, slug')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,city.ilike.%${q}%,address_line_1.ilike.%${q}%`)
      .limit(10);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const results = (entities || []).map(e => ({
      id: e.id,
      name: e.name,
      city: e.city,
      address: e.address_line_1,
      distance: Math.floor(Math.random() * 50) + 1, // placeholder: replace with actual distance calc if user location available
    }));

    res.json({ results });
  } catch (err) {
    console.error('Location autocomplete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// POST /api/gcr/swipe-item — track user swipes on gallery items
// ============================================
router.post('/swipe-item', async (req, res) => {
  const { user_id, section_item_id, entity_id, action } = req.body;

  if (!user_id || !section_item_id || !action) {
    return res.status(400).json({ error: 'user_id, section_item_id, and action required' });
  }

  if (!['right', 'left', 'save'].includes(action)) {
    return res.status(400).json({ error: 'action must be right, left, or save' });
  }

  try {
    const { data, error } = await gcrDb
      .from('item_swipes')
      .insert({
        user_id,
        section_item_id,
        entity_id,
        action,
      })
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, swipe: data?.[0] });
  } catch (err) {
    console.error('Swipe tracking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/gcr/entities/:slug — entity with galleries & sections
// ============================================
router.get('/entities/:slug', async (req, res) => {
  const slug = req.params.slug;

  try {
    // Get entity
    const { data: entity, error: entityError } = await gcrDb
      .from('entity')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (entityError || !entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Get galleries
    const { data: galleries } = await gcrDb
      .from('entity_galleries')
      .select('*')
      .eq('entity_id', entity.id)
      .order('display_order');

    // Get sections
    const { data: sections } = await gcrDb
      .from('entity_sections')
      .select('*')
      .eq('entity_id', entity.id)
      .order('sort_order');

    // Get section items with gallery metadata
    const { data: items } = await gcrDb
      .from('section_items')
      .select('*')
      .eq('entity_id', entity.id);

    res.json({
      entity,
      galleries: galleries || [],
      sections: sections || [],
      items: items || [],
    });
  } catch (err) {
    console.error('Entity fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET /api/gcr/entities/:entityId/gallery/:galleryType — get gallery items by type
// ============================================
router.get('/entities/:entityId/gallery/:galleryType', async (req, res) => {
  const { entityId, galleryType } = req.params;

  try {
    // Get gallery metadata
    const { data: gallery } = await gcrDb
      .from('entity_galleries')
      .select('*')
      .eq('entity_id', entityId)
      .eq('gallery_type', galleryType)
      .single();

    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    // Get section items that belong to this gallery type
    // This requires a section with section_type matching the gallery_type
    const { data: section } = await gcrDb
      .from('entity_sections')
      .select('id')
      .eq('entity_id', entityId)
      .eq('section_type', galleryType)
      .single();

    let items = [];
    if (section) {
      const { data: sectionItems } = await gcrDb
        .from('section_items')
        .select('*')
        .eq('entity_section_id', section.id)
        .order('sort_order');
      items = sectionItems || [];
    }

    res.json({
      gallery,
      items,
    });
  } catch (err) {
    console.error('Gallery fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

function fmt12(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h, 10);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${h12}:${m} ${ampm}`;
}

module.exports = router;

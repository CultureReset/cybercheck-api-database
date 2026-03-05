const express = require('express');
const supabase = require('../db');

const router = express.Router();

// ============================================
// GET /api/gcr/businesses — Browse all businesses
// ============================================
router.get('/businesses', async (req, res) => {
    let query = supabase
        .from('businesses')
        .select('site_id, name, type, subdomain, domain, logo_url, cover_url, status, site_content(address, city, state, zip, lat, lng, hours, theme_color, seo_description)')
        .eq('status', 'active')
        .order('name', { ascending: true });

    if (req.query.type) query = query.eq('type', req.query.type);
    if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);
    if (req.query.city) query = query.eq('site_content.city', req.query.city);

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Flatten site_content into business object
    const businesses = (data || []).map(b => {
        const content = b.site_content || {};
        delete b.site_content;
        return { ...b, ...content };
    });

    res.json({ businesses, total: count, limit, offset });
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
// GET /api/gcr/business/:id — Single business detail
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
        .eq('status', 'active');

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

module.exports = router;

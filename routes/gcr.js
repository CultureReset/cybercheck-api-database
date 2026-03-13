const express = require('express');
const supabase = require('../db');

const router = express.Router();

// ============================================
// GET /api/gcr/businesses — Browse all businesses
// ============================================
router.get('/businesses', async (req, res) => {
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
            happyHour: b.happy_hour || null,
            kidsFriendly: b.kids_friendly || false,
            petFriendly: b.pet_friendly || false,
            liveMusic: b.live_music || false,
        };
    });

    res.json({ businesses, total: businesses.length, limit, offset });
});

// ============================================
// GET /api/gcr/events — public events feed
// ============================================
router.get('/events', async (req, res) => {
    let query = supabase
        .from('events')
        .select('*, businesses(name, emoji, type, subdomain)')
        .eq('active', true)
        .order('event_date', { ascending: true });

    if (req.query.site_id) query = query.eq('site_id', req.query.site_id);
    if (req.query.upcoming === 'true') query = query.gte('event_date', new Date().toISOString().split('T')[0]);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const events = (data || []).map(e => ({
        ...e,
        date: e.event_date,
        time: e.event_time,
        businessName: e.businesses?.name || '',
        businessEmoji: e.businesses?.emoji || '🏪',
        category: e.businesses?.type || '',
        slug: e.businesses?.subdomain || e.site_id,
    }));

    res.json(events);
});

// ============================================
// GET /api/gcr/specials — public specials feed
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

    const specials = (data || []).map(s => ({
        ...s,
        businessName: s.businesses?.name || '',
        businessEmoji: s.businesses?.emoji || '🏪',
        category: s.businesses?.type || '',
        slug: s.businesses?.subdomain || s.site_id,
    }));

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
            subcategory, sort_order, gcr_listed, gcr_verified`)
        .eq('subdomain', slug)
        .eq('status', 'active')
        .single();

    if (bizErr || !business) {
        return res.status(404).json({ error: 'Business not found' });
    }

    const siteId = business.site_id;

    const [content, services, fleet, pricing, addons, groupRates, reviews, specials, events] = await Promise.all([
        supabase.from('site_content').select('*').eq('site_id', siteId).single(),
        supabase.from('services').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('fleet_types').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('rental_pricing').select('*, rental_time_slots(name)').eq('site_id', siteId).eq('active', true),
        supabase.from('rental_addons').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('rental_group_rates').select('*').eq('site_id', siteId).eq('active', true),
        supabase.from('reviews').select('*').eq('site_id', siteId).eq('active', true).order('created_at', { ascending: false }),
        supabase.from('specials').select('*').eq('site_id', siteId).eq('active', true).order('sort_order'),
        supabase.from('events').select('*').eq('site_id', siteId).eq('active', true).order('event_date', { ascending: true }),
    ]);

    const c = content.data || {};

    res.json({
        ...business,
        id:          siteId,
        slug:        business.subdomain,
        // flattened site_content
        address:     c.address || '',
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
        social:      c.social_links  || {},
        hero_text:   c.hero_text     || '',
        hero_subtext:c.hero_subtext  || '',
        // related data
        services:    services.data    || [],
        whats_included: (c.whats_included) || [],
        fleet:       fleet.data       || [],
        pricing:     (pricing.data || []).map(p => ({ ...p, slot_label: p.slot_label || (p.rental_time_slots && p.rental_time_slots.name) || null })),
        addons:      addons.data      || [],
        group_rates: groupRates.data  || [],
        reviews:     reviews.data     || [],
        specials:    specials.data    || [],
        events:      events.data      || [],
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
        return `• ${b.name} [${b.type}] ${b.area || ''} — ${b.tagline || ''} | ${flags} | ${b.price_range || ''} | phone: ${c.contact_phone || 'n/a'}`;
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
- Include the phone number so they can call
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

module.exports = router;

/**
 * Tourist endpoints — for trip-swipe users (signed in via Supabase auth).
 *
 *  Tourist-facing (requires Supabase JWT from the tourist):
 *    GET    /api/tourist/me          — profile + saves + itinerary (bundle)
 *    GET    /api/tourist/saves       — list saved places
 *    POST   /api/tourist/saves       — upsert a save { entity_slug, business_name, ... }
 *    DELETE /api/tourist/saves/:slug — remove a save
 *    GET    /api/tourist/profile
 *    PUT    /api/tourist/profile     — upsert profile { name, destination, ... }
 *    GET    /api/tourist/itinerary   — latest itinerary
 *    PUT    /api/tourist/itinerary   — upsert { destination, days }
 *
 *  Admin-facing (requires admin JWT):
 *    GET    /api/admin/tourists                — list all tourists (summary)
 *    GET    /api/admin/tourists/:user_id       — detail (profile + saves + itinerary)
 *    DELETE /api/admin/tourists/:user_id/saves/:save_id
 *    DELETE /api/admin/tourists/:user_id       — delete a tourist (auth user + cascades)
 */

const express = require('express');
const mainDb = require('../db');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();

// ── Tourist middleware: verify Supabase JWT, attach tourist user id ─────────
async function touristAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.split(' ')[1];
    try {
        const { data, error } = await mainDb.auth.getUser(token);
        if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });
        req.touristId = data.user.id;
        req.touristEmail = data.user.email;
        return next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// TOURIST — own data
// ═══════════════════════════════════════════════════════════════════════════

router.get('/me', touristAuth, async (req, res) => {
    const [{ data: profile }, { data: saves }, { data: itin }] = await Promise.all([
        mainDb.from('tourist_profiles').select('*').eq('user_id', req.touristId).maybeSingle(),
        mainDb.from('tourist_saves').select('*').eq('user_id', req.touristId).order('saved_at', { ascending: false }),
        mainDb.from('tourist_itineraries').select('*').eq('user_id', req.touristId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    res.json({
        user: { id: req.touristId, email: req.touristEmail },
        profile: profile || null,
        saves: saves || [],
        itinerary: itin || null,
    });
});

router.get('/saves', touristAuth, async (req, res) => {
    const { data, error } = await mainDb.from('tourist_saves')
        .select('*').eq('user_id', req.touristId).order('saved_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ saves: data || [] });
});

router.post('/saves', touristAuth, async (req, res) => {
    const { entity_slug, entity_id, business_name, hero_image_url, subtitle, category, rating, price_range } = req.body || {};
    if (!entity_slug) return res.status(400).json({ error: 'entity_slug required' });
    const row = {
        user_id: req.touristId,
        entity_slug,
        entity_id: entity_id && /^[0-9a-f-]{36}$/i.test(String(entity_id)) ? entity_id : null,
        business_name: business_name || null,
        hero_image_url: hero_image_url || null,
        subtitle: subtitle || null,
        category: category || null,
        rating: rating ?? null,
        price_range: price_range || null,
    };
    const { data, error } = await mainDb.from('tourist_saves')
        .upsert(row, { onConflict: 'user_id,entity_slug' })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ save: data });
});

router.delete('/saves/:slug', touristAuth, async (req, res) => {
    const { error } = await mainDb.from('tourist_saves')
        .delete().eq('user_id', req.touristId).eq('entity_slug', req.params.slug);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.get('/profile', touristAuth, async (req, res) => {
    const { data } = await mainDb.from('tourist_profiles').select('*').eq('user_id', req.touristId).maybeSingle();
    res.json({ profile: data || null });
});

router.put('/profile', touristAuth, async (req, res) => {
    const b = req.body || {};
    const row = {
        user_id: req.touristId,
        name: b.name || null,
        destination: b.destination || null,
        arrival: b.arrival || null,
        departure: b.departure || null,
        trip_days: b.trip_days || null,
        group_type: b.group_type || null,
        budget: b.budget || null,
        interests: b.interests || [],
        stay_status: b.stay_status || null,
        hotel_name: b.hotel_name || null,
        setup_complete: !!b.setup_complete,
    };
    const { data, error } = await mainDb.from('tourist_profiles')
        .upsert(row, { onConflict: 'user_id' })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ profile: data });
});

router.get('/itinerary', touristAuth, async (req, res) => {
    const { data } = await mainDb.from('tourist_itineraries')
        .select('*').eq('user_id', req.touristId)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    res.json({ itinerary: data || null });
});

router.put('/itinerary', touristAuth, async (req, res) => {
    const { destination, days, model_used } = req.body || {};
    // Upsert by finding the most recent one; otherwise insert
    const { data: existing } = await mainDb.from('tourist_itineraries')
        .select('id').eq('user_id', req.touristId)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
        const { data, error } = await mainDb.from('tourist_itineraries')
            .update({ destination: destination || null, days: days || [], model_used: model_used || null })
            .eq('id', existing.id).eq('user_id', req.touristId)
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ itinerary: data });
    }
    const { data, error } = await mainDb.from('tourist_itineraries')
        .insert({ user_id: req.touristId, destination: destination || null, days: days || [], model_used: model_used || null })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ itinerary: data });
});

module.exports = router;
module.exports.touristAuth = touristAuth;

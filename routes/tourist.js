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

// ═══════════════════════════════════════════════════════════════════════════
// Email itinerary via Brevo (info@cybercheckinc.com)
// ═══════════════════════════════════════════════════════════════════════════

const { sendEmail } = require('../utils/email');

router.post('/itinerary/email', touristAuth, async (req, res) => {
    const [{ data: itin }, { data: profile }] = await Promise.all([
        mainDb.from('tourist_itineraries').select('*').eq('user_id', req.touristId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        mainDb.from('tourist_profiles').select('name,destination,arrival,departure').eq('user_id', req.touristId).maybeSingle(),
    ]);
    if (!itin || !itin.days?.length) return res.status(400).json({ error: 'No itinerary to email' });

    const destination = itin.destination || profile?.destination || 'Gulf Coast';
    const name = profile?.name || 'Traveler';
    const dateRange = profile?.arrival
        ? `${new Date(profile.arrival).toLocaleDateString('en-US',{month:'short',day:'numeric'})}${profile?.departure ? ' – ' + new Date(profile.departure).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}`
        : '';

    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const daysHtml = (itin.days || []).map(d => `
      <div style="margin:24px 0;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
        <div style="font-size:14px;font-weight:700;color:#0ea5e9;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">${esc(d.date || ('Day ' + d.day))}</div>
        ${(d.slots || []).map(s => `
          <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #e5e7eb;">
            <div style="min-width:80px;font-size:13px;font-weight:700;color:#374151;">${esc(s.time || '')}</div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:600;color:#111827;">${esc(s.business?.name || s.entity_slug || '')}</div>
              ${s.business?.subtitle ? `<div style="font-size:12px;color:#6b7280;">${esc(s.business.subtitle)}</div>` : ''}
              ${s.why || s.note ? `<div style="font-size:13px;color:#0ea5e9;margin-top:4px;">${esc(s.why || s.note)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:640px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#0ea5e9,#7c6af7);padding:36px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;">🌊 Your ${esc(destination)} Trip</h1>
        ${dateRange ? `<p style="margin:8px 0 0;color:#e0f2fe;font-size:15px;">${esc(dateRange)}</p>` : ''}
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi ${esc(name)},</p>
        <p style="margin:0 0 20px;color:#374151;font-size:15px;">Here's your Gulf Coast Radar itinerary, built from the places you saved:</p>
        ${daysHtml}
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">Open the app anytime to edit, re-build, or add more spots. Your trip is saved across devices.</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Sent automatically from Gulf Coast Radar.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

    const send = await sendEmail({
        to: req.touristEmail,
        subject: `🌊 Your ${destination} trip itinerary`,
        html,
    });
    if (!send.success) return res.status(500).json({ error: 'Failed to send email' });
    res.json({ success: true, sent_to: req.touristEmail });
});

// ═══════════════════════════════════════════════════════════════════════════
// AI — build itinerary from saved places + profile
// ═══════════════════════════════════════════════════════════════════════════

const { callAIRound } = require('./ai-provider');

router.post('/build-itinerary', touristAuth, async (req, res) => {
    const [{ data: profile }, { data: saves }] = await Promise.all([
        mainDb.from('tourist_profiles').select('*').eq('user_id', req.touristId).maybeSingle(),
        mainDb.from('tourist_saves').select('*').eq('user_id', req.touristId).order('saved_at', { ascending: false }),
    ]);
    if (!saves || saves.length < 2) return res.status(400).json({ error: 'Save at least 2 places first' });

    // Fetch richer detail (hours, tags) for each save from GCR entity endpoint
    const { createClient } = require('@supabase/supabase-js');
    const gcr = createClient(process.env.GCR_SUPABASE_URL || process.env.SUPABASE_URL, process.env.GCR_SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY);
    const slugs = saves.map(s => s.entity_slug).filter(Boolean).slice(0, 20);
    const { data: entities } = slugs.length
        ? await gcr.from('entity').select('id,name,slug,subtitle,entity_type,entity_subtype,tags,hh_days,hh_start,hh_end,address_line_1,city,state,latitude,longitude,price_range').in('slug', slugs)
        : { data: [] };

    const days = profile?.trip_days || 3;
    const destination = profile?.destination || 'Gulf Coast';
    const interests = Array.isArray(profile?.interests) ? profile.interests : [];
    const groupType = profile?.group_type || 'adults';
    const arrival = profile?.arrival || null;

    const placeList = (entities || []).map((e, i) => {
        const hh = e.hh_start && e.hh_end ? ` · happy hour ${e.hh_start}-${e.hh_end}` : '';
        const loc = [e.city, e.state].filter(Boolean).join(', ');
        const tagList = Array.isArray(e.tags) ? e.tags.slice(0, 4).map(t => typeof t === 'string' ? t : t.label || t.name).filter(Boolean).join(', ') : '';
        return `${i + 1}. ${e.name} (slug:${e.slug}) — ${e.entity_subtype || e.entity_type || 'place'}${e.subtitle ? ' · ' + e.subtitle : ''} · ${loc}${hh}${tagList ? ' · tags: ' + tagList : ''}`;
    }).join('\n');

    const systemPrompt = `You are a local trip planner for the Gulf Coast. Build a realistic, day-by-day itinerary from the user's saved places. Rules:
- Group activities by geographic proximity to minimize driving.
- Respect business category: breakfast spots morning, nightlife at night, activities/tours mid-day.
- Space out eating — not two restaurants in a row. Mix food, activity, beach/outdoor, nightlife.
- Exactly ${days} day(s). If fewer saves than slots, it's fine — leave slots empty.
- Each slot: {"time":"9:00 AM","entity_slug":"name-slug","why":"one short sentence"}.
- Return ONLY valid JSON matching this exact shape, no prose:
{"days":[{"date":"Day 1","slots":[{"time":"9:00 AM","entity_slug":"...","why":"..."}]}]}
- Use slugs from the provided list only. Don't invent businesses.`;

    const userPrompt = `Destination: ${destination}
Days: ${days}${arrival ? ' starting ' + arrival : ''}
Group: ${groupType}
Interests: ${interests.join(', ') || 'none specified'}

Saved places (${entities?.length || 0}):
${placeList || '(no enriched data)'}

Return the JSON itinerary now.`;

    try {
        const ai = await callAIRound({
            messages: [{ role: 'user', content: userPrompt }],
            systemPrompt,
            temperature: 0.4,
            maxTokens: 1800,
        });
        const text = ai?.text || ai?.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return res.status(500).json({ error: 'AI returned no itinerary', raw: text.slice(0, 500) });
        let parsed;
        try { parsed = JSON.parse(match[0]); } catch(e) { return res.status(500).json({ error: 'AI returned invalid JSON', raw: match[0].slice(0, 500) }); }

        // Hydrate slots with business data for frontend
        const bySlug = {};
        (entities || []).forEach(e => { bySlug[e.slug] = e; });
        const slugToSave = {};
        (saves || []).forEach(s => { slugToSave[s.entity_slug] = s; });

        (parsed.days || []).forEach((d, idx) => {
            d.day = idx + 1;
            if (!d.date) d.date = 'Day ' + (idx + 1);
            (d.slots || []).forEach(slot => {
                const ent = bySlug[slot.entity_slug];
                const save = slugToSave[slot.entity_slug];
                slot.business = ent ? {
                    id: ent.id, slug: ent.slug, name: ent.name,
                    subtitle: ent.subtitle, hero_image_url: save?.hero_image_url || null,
                    rating: save?.rating, price_range: ent.price_range,
                } : save ? {
                    id: save.entity_id, slug: save.entity_slug, name: save.business_name,
                    subtitle: save.subtitle, hero_image_url: save.hero_image_url,
                    rating: save.rating, price_range: save.price_range,
                } : { slug: slot.entity_slug, name: slot.entity_slug };
                slot.note = slot.why || slot.note || '';
            });
        });

        // Persist
        const payload = { destination, days: parsed.days || [], model_used: ai?.model || 'ai' };
        const { data: existing } = await mainDb.from('tourist_itineraries')
            .select('id').eq('user_id', req.touristId)
            .order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (existing) {
            await mainDb.from('tourist_itineraries').update(payload).eq('id', existing.id).eq('user_id', req.touristId);
        } else {
            await mainDb.from('tourist_itineraries').insert({ user_id: req.touristId, ...payload });
        }

        res.json({ itinerary: { destination, days: parsed.days || [], model_used: payload.model_used } });
    } catch (err) {
        console.error('build-itinerary error:', err);
        res.status(500).json({ error: 'AI request failed: ' + err.message });
    }
});

module.exports = router;
module.exports.touristAuth = touristAuth;

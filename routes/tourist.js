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

// DELETE /api/tourist/seen — clear all seen slugs (reset swipe deck)
router.delete('/seen', touristAuth, async (req, res) => {
    const { data: profile } = await mainDb.from('tourist_profiles')
        .select('answers').eq('user_id', req.touristId).maybeSingle();
    const answers = { ...(profile?.answers || {}) }
    delete answers.seen_slugs
    await mainDb.from('tourist_profiles')
        .upsert({ user_id: req.touristId, answers }, { onConflict: 'user_id' });
    res.json({ ok: true });
});

// POST /api/tourist/seen — record swiped (seen) slugs so they don't reappear
router.post('/seen', touristAuth, async (req, res) => {
    const { slugs } = req.body || {};
    if (!Array.isArray(slugs) || slugs.length === 0) return res.status(400).json({ error: 'slugs required' });
    const { data: profile } = await mainDb.from('tourist_profiles')
        .select('answers').eq('user_id', req.touristId).maybeSingle();
    const existing = profile?.answers?.seen_slugs || [];
    const merged = [...new Set([...existing, ...slugs])];
    await mainDb.from('tourist_profiles')
        .upsert(
            { user_id: req.touristId, answers: { ...(profile?.answers || {}), seen_slugs: merged } },
            { onConflict: 'user_id' }
        );
    res.json({ ok: true, count: merged.length });
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
    // Fetch existing answers so we never wipe seen_slugs or other stored data
    const { data: existing } = await mainDb.from('tourist_profiles')
        .select('answers').eq('user_id', req.touristId).maybeSingle();
    const existingAnswers = (existing?.answers && typeof existing.answers === 'object') ? existing.answers : {};
    const incomingAnswers = (typeof b.answers === 'object' && b.answers) ? b.answers : {};
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
        answers: { ...existingAnswers, ...incomingAnswers },
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
        ? await gcr.from('entity').select('id,name,slug,subtitle,entity_type,entity_subtype,tags,hh_days,hh_start,hh_end,address_line_1,city,state,latitude,longitude,price_range,hero_image_url,booking_url,website_url,phone').in('slug', slugs)
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
                const address = ent
                    ? [ent.address_line_1, ent.city, ent.state].filter(Boolean).join(', ')
                    : null;
                slot.business = ent ? {
                    id: ent.id, slug: ent.slug, name: ent.name,
                    subtitle: ent.subtitle,
                    hero_image_url: ent.hero_image_url || save?.hero_image_url || null,
                    rating: save?.rating || null,
                    price_range: ent.price_range || null,
                    booking_url: ent.booking_url || ent.website_url || null,
                    address,
                } : save ? {
                    id: save.entity_id, slug: save.entity_slug, name: save.business_name,
                    subtitle: save.subtitle, hero_image_url: save.hero_image_url,
                    rating: save.rating, price_range: save.price_range,
                    booking_url: null, address: null,
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

// ═══════════════════════════════════════════════════════════════════════════
// TOURIST AI CONCIERGE — chat with memory, fed live GCR data + tourist saves
// Dual-auth: real tourist token, OR admin token with ?as_tourist=USER_ID
// (admin testing surface lives in cybercheck-platform admin)
// ═══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

async function touristOrAdminAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
    const token = header.split(' ')[1];

    // 1) Try admin JWT first (admin can impersonate any tourist via ?as_tourist=USER_ID)
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'admin') {
            const asTourist = req.query.as_tourist || req.body?.as_tourist;
            if (!asTourist) return res.status(400).json({ error: 'Admin must pass as_tourist=USER_ID' });
            req.touristId = asTourist;
            req.touristEmail = `admin-test:${asTourist}`;
            req.isAdminImpersonating = true;
            return next();
        }
    } catch (e) { /* not an admin JWT — try tourist */ }

    // 2) Try tourist Supabase JWT
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

router.post('/ai-chat', touristOrAdminAuth, async (req, res) => {
    const { message = '', history = [], image, url, conversation_id: clientConvId } = req.body || {};
    if (!message && !image) return res.status(400).json({ error: 'Message required' });

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.json({ reply: "AI concierge is being set up — check back soon!" });
    }

    const touristId = req.touristId;

    // Optional URL fetch
    let urlContent = '';
    if (url) {
        try {
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
            const html = await r.text();
            urlContent = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim().slice(0, 6000);
        } catch (e) { urlContent = `(Could not fetch ${url}: ${e.message})`; }
    }

    // Pull tourist context: profile, saves, memories
    const [profileRes, savesRes, memoriesRes] = await Promise.all([
        mainDb.from('tourist_profiles').select('name, destination, arrival, departure, trip_days, group_type, budget, interests, stay_status, hotel_name').eq('user_id', touristId).maybeSingle(),
        mainDb.from('tourist_saves').select('business_name, entity_slug, category, subtitle, rating, price_range').eq('user_id', touristId).order('saved_at', { ascending: false }).limit(50),
        mainDb.from('tourist_memories').select('category, key, value, tags').eq('user_id', touristId).order('updated_at', { ascending: false })
    ]);
    const profile   = profileRes.data || {};
    const saves     = savesRes.data || [];
    const memories  = memoriesRes.data || [];

    // Pull live GCR data — top entities so the AI can recommend real places
    const gcrDb = require('../gcr-db')();
    const { data: gcrEntities } = await gcrDb
        .from('entity')
        .select('name, slug, type, subtypes, city, neighborhood, rating, price_range, tags, is_active')
        .eq('is_active', true)
        .order('rating', { ascending: false, nullsFirst: false })
        .limit(120);

    const gcrContext = (gcrEntities || []).map(e => {
        const where = [e.neighborhood, e.city].filter(Boolean).join(', ');
        const tags  = (e.tags || []).slice(0, 4).join(', ');
        return `• ${e.name} [${e.type}${e.subtypes?.length ? '/' + e.subtypes[0] : ''}] ${where} ${e.rating ? `· ⭐${e.rating}` : ''} ${e.price_range || ''}${tags ? ' · ' + tags : ''} (slug: ${e.slug})`;
    }).join('\n');

    // Group memories
    let memoryBlock = '';
    if (memories.length) {
        const byCat = {};
        memories.forEach(m => { (byCat[m.category] = byCat[m.category] || []).push(m); });
        const labels = { preference:'PREFERENCES', fact:'KNOWN FACTS', goal:'GOALS', decision:'PAST DECISIONS', recurring:'RECURRING TOPICS', note:'NOTES' };
        memoryBlock = '\n\nWHAT YOU REMEMBER ABOUT THIS TRAVELER (from past chats):\n';
        Object.keys(labels).forEach(cat => {
            if (!byCat[cat]) return;
            memoryBlock += `\n${labels[cat]}:\n`;
            byCat[cat].forEach(m => { memoryBlock += `  • [${m.key}] ${m.value}${m.tags?.length ? ` (${m.tags.join(', ')})` : ''}\n`; });
        });
    }

    // Build profile block
    let profileBlock = '';
    if (profile.name) profileBlock += `Name: ${profile.name}\n`;
    if (profile.destination) profileBlock += `Destination: ${profile.destination}\n`;
    if (profile.arrival && profile.departure) profileBlock += `Trip dates: ${profile.arrival} → ${profile.departure}${profile.trip_days ? ` (${profile.trip_days} days)` : ''}\n`;
    if (profile.group_type) profileBlock += `Group: ${profile.group_type}\n`;
    if (profile.budget) profileBlock += `Budget: ${profile.budget}\n`;
    if (profile.hotel_name) profileBlock += `Staying at: ${profile.hotel_name}\n`;
    if (profile.interests?.length) profileBlock += `Interests: ${profile.interests.join(', ')}\n`;

    let savesBlock = '';
    if (saves.length) {
        savesBlock = '\nPLACES THEY ALREADY SAVED:\n';
        saves.slice(0, 25).forEach(s => {
            savesBlock += `• ${s.business_name} [${s.category || s.subtitle || ''}]${s.rating ? ` ⭐${s.rating}` : ''}\n`;
        });
    }

    const systemPrompt = `You are the GulfCoast Concierge — a warm, enthusiastic local who's lived on the Alabama Gulf Coast forever and knows every spot. You're chatting with ${profile.name || 'a traveler'} as their personal trip planner.

YOU ARE TALKING TO:
${profileBlock || '(unknown traveler)'}
${savesBlock}${memoryBlock}

LIVE GULF COAST DATA (only recommend places from this list — never invent):
${gcrContext}
${urlContent ? `\nWEBPAGE CONTENT (URL they shared):\n${urlContent}\n` : ''}
HOW TO CHAT:
- Warm, casual, fun — like texting a friend who's a local. Short sentences.
- Drop in local flavor: "trust me on this one", "locals don't even tell tourists about this spot"
- Ask follow-ups to keep it going: "How many in your group?", "Date night or family?", "Crab or oysters mood?"
- Recommend 1-2 specific spots — not a list of 5. Use the slug from the data so the app can link to it.
- Add a local tip: "Get there before 6 or you'll wait 45 min", "Sit on the patio if you can"
- Reference their saved places naturally if relevant ("since you already saved Harbor Docks…")

MEMORY (you remember across chats):
- When they share durable info (dietary restrictions, group composition, allergies, must-do/avoid lists, return-trip patterns), call save_memory
- Categories: preference / fact / goal / decision / recurring / note
- Keep memories concise and tagged. Don't save trivia.
- If memory is outdated, update_memory or delete_memory

HARD RULES:
- Only recommend places from the LIVE GULF COAST DATA above
- Keep replies under 100 words unless they ask for a full plan
- No phone numbers — they're chatting with you, not calling the place`;

    // ── Tools ──
    const tools = [
        {
            name: 'save_memory',
            description: 'Remember a durable fact, preference, or pattern about this traveler. Auto-upserts on (category, key).',
            input_schema: {
                type: 'object',
                properties: {
                    category:   { type: 'string', enum: ['preference','fact','goal','decision','recurring','note'] },
                    key:        { type: 'string', description: 'Short slug like "dietary" or "favorite_neighborhood"' },
                    value:      { type: 'string' },
                    tags:       { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'string', enum: ['high','medium','low'] }
                },
                required: ['category','key','value']
            }
        },
        {
            name: 'update_memory',
            description: 'Update an existing memory (when info has changed)',
            input_schema: {
                type: 'object',
                properties: {
                    category:  { type: 'string', enum: ['preference','fact','goal','decision','recurring','note'] },
                    key:       { type: 'string' },
                    new_value: { type: 'string' }
                },
                required: ['category','key','new_value']
            }
        },
        {
            name: 'delete_memory',
            description: 'Forget a memory',
            input_schema: {
                type: 'object',
                properties: {
                    category: { type: 'string', enum: ['preference','fact','goal','decision','recurring','note'] },
                    key:      { type: 'string' }
                },
                required: ['category','key']
            }
        }
    ];

    async function executeTool(name, input) {
        if (name === 'save_memory') {
            const row = { user_id: touristId, category: input.category, key: input.key, value: input.value, tags: input.tags || [], confidence: input.confidence || 'medium', source_message: (message || '').slice(0, 500), updated_at: new Date().toISOString() };
            const { error } = await mainDb.from('tourist_memories').upsert(row, { onConflict: 'user_id,category,key' });
            if (error) return { error: error.message };
            return { success: true, saved_key: input.key, category: input.category };
        }
        if (name === 'update_memory') {
            const { error } = await mainDb.from('tourist_memories').update({ value: input.new_value, updated_at: new Date().toISOString() }).eq('user_id', touristId).eq('category', input.category).eq('key', input.key);
            if (error) return { error: error.message };
            return { success: true, updated_key: input.key };
        }
        if (name === 'delete_memory') {
            const { error } = await mainDb.from('tourist_memories').delete().eq('user_id', touristId).eq('category', input.category).eq('key', input.key);
            if (error) return { error: error.message };
            return { success: true, deleted_key: input.key };
        }
        return { error: 'Unknown tool' };
    }

    try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const userContent = [];
        if (image && image.base64) {
            userContent.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType || 'image/jpeg', data: image.base64 } });
        }
        userContent.push({ type: 'text', text: message || 'What do you see in this image?' });

        const messages = [
            ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: userContent.length > 1 ? userContent : (message || 'What do you see in this image?') }
        ];

        const toolResults = [];
        let finalReply = '';
        let loopMessages = [...messages];

        for (let i = 0; i < 4; i++) {
            const response = await client.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: systemPrompt,
                tools,
                messages: loopMessages
            });

            if (response.stop_reason === 'end_turn') {
                finalReply = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
                break;
            }

            if (response.stop_reason === 'tool_use') {
                loopMessages.push({ role: 'assistant', content: response.content });
                const toolResultMsgs = [];
                for (const block of response.content) {
                    if (block.type !== 'tool_use') continue;
                    const result = await executeTool(block.name, block.input);
                    if (result.saved_key)   toolResults.push({ tool: block.name, saved_key: result.saved_key, category: result.category });
                    if (result.updated_key) toolResults.push({ tool: block.name, updated_key: result.updated_key });
                    if (result.deleted_key) toolResults.push({ tool: block.name, deleted_key: result.deleted_key });
                    toolResultMsgs.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
                }
                loopMessages.push({ role: 'user', content: toolResultMsgs });
                continue;
            }

            finalReply = response.content.filter(b => b.type === 'text').map(b => b.text).join('') || 'Try rephrasing!';
            break;
        }

        // Persist conversation + messages
        let conversationId = clientConvId || null;
        try {
            if (!conversationId) {
                const title = (message || 'Image conversation').slice(0, 60).replace(/\s+/g, ' ').trim();
                const { data: conv } = await mainDb.from('tourist_ai_conversations').insert({ user_id: touristId, title }).select('id').single();
                conversationId = conv?.id || null;
            } else {
                await mainDb.from('tourist_ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', touristId);
            }
            if (conversationId) {
                await mainDb.from('tourist_ai_messages').insert([
                    { conversation_id: conversationId, role: 'user',      content: message || '(image only)', has_image: !!image, url: url || null, tool_results: null },
                    { conversation_id: conversationId, role: 'assistant', content: finalReply || 'Done!',     has_image: false,    url: null,        tool_results: toolResults.length ? toolResults : null }
                ]);
            }
        } catch (persistErr) {
            console.warn('Tourist AI chat persist failed (non-fatal):', persistErr.message);
        }

        res.json({ reply: finalReply || 'Try rephrasing!', tool_results: toolResults, conversation_id: conversationId });
    } catch (err) {
        console.error('Tourist AI chat error:', err.message);
        res.json({ reply: 'Something went wrong — try again!' });
    }
});

// List recent conversations for sidebar
router.get('/ai-chat/conversations', touristOrAdminAuth, async (req, res) => {
    const { data, error } = await mainDb
        .from('tourist_ai_conversations')
        .select('id, title, created_at, updated_at')
        .eq('user_id', req.touristId)
        .order('updated_at', { ascending: false })
        .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ conversations: data || [] });
});

// Load one conversation's messages
router.get('/ai-chat/conversations/:id', touristOrAdminAuth, async (req, res) => {
    const { data: conv } = await mainDb
        .from('tourist_ai_conversations')
        .select('id, title, created_at')
        .eq('id', req.params.id).eq('user_id', req.touristId).single();
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const { data: msgs } = await mainDb
        .from('tourist_ai_messages')
        .select('id, role, content, has_image, url, tool_results, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at');
    res.json({ conversation: conv, messages: msgs || [] });
});

router.delete('/ai-chat/conversations/:id', touristOrAdminAuth, async (req, res) => {
    const { error } = await mainDb.from('tourist_ai_conversations').delete().eq('id', req.params.id).eq('user_id', req.touristId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// List all memories (for the owner / admin to review what AI has remembered)
router.get('/ai-chat/memories', touristOrAdminAuth, async (req, res) => {
    const { data, error } = await mainDb
        .from('tourist_memories')
        .select('id, category, key, value, tags, confidence, created_at, updated_at')
        .eq('user_id', req.touristId)
        .order('category')
        .order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ memories: data || [] });
});

router.delete('/ai-chat/memories/:id', touristOrAdminAuth, async (req, res) => {
    const { error } = await mainDb.from('tourist_memories').delete().eq('id', req.params.id).eq('user_id', req.touristId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Community Photos ────────────────────────────────────────────────────────

// POST /api/tourist/photos — submit a photo (auth or anon via review link)
router.post('/photos', async (req, res) => {
    const { entity_slug, image_url, caption, uploader_name, category } = req.body;
    if (!entity_slug || !image_url) return res.status(400).json({ error: 'entity_slug and image_url required' });
    // Attempt to read user_id from token if present (not required)
    let userId = null;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        try {
            const token = header.slice(7);
            const { data: { user } } = await mainDb.auth.getUser(token);
            userId = user?.id || null;
        } catch (_) {}
    }
    const { data, error } = await mainDb.from('tourist_photos').insert({
        user_id: userId,
        entity_slug,
        image_url,
        caption: caption || null,
        uploader_name: uploader_name || null,
        category: category || 'general',
        status: 'pending',
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, photo: data });
});

// GET /api/tourist/photos — get photos submitted by the logged-in user
router.get('/photos', touristAuth, async (req, res) => {
    const { data, error } = await mainDb.from('tourist_photos')
        .select('id, entity_slug, image_url, caption, category, status, submitted_at, reviewed_at')
        .eq('user_id', req.touristId)
        .order('submitted_at', { ascending: false })
        .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ photos: data || [] });
});

module.exports = router;
module.exports.touristAuth = touristAuth;

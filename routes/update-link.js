/**
 * Daily Update Link — Full Mobile Editor
 *
 * Business owner gets a secure URL via SMS.
 * Opens on their phone — full editor with tabs:
 *   Specials | Menu | Drinks | Happy Hour | Events
 * Can add, edit, delete items and upload photos from their camera.
 * All saves hit instantly — no page reload.
 *
 * Admin routes (auth required):
 *   POST /api/update/generate
 *   POST /api/update/send-sms
 *   GET  /api/update/status/:entity_id
 *
 * Public routes (token = the secret, no login needed):
 *   GET  /update/:token              — redirect to cybercheck-links/menu-editor.html?token=
 *   GET  /update/:token/data         — load all entity data as JSON
 *   POST /update/:token/upload       — image upload → Supabase Storage
 *   POST /update/:token/specials     — add/update special
 *   DELETE /update/:token/specials/:id
 *   POST /update/:token/menu-items   — add/update menu item
 *   DELETE /update/:token/menu-items/:id
 *   POST /update/:token/menu-sections — add section
 *   POST /update/:token/drink-items  — add/update drink item
 *   DELETE /update/:token/drink-items/:id
 *   PUT  /update/:token/happy-hour   — update HH schedule
 *   POST /update/:token/hh-items     — add/update HH item
 *   DELETE /update/:token/hh-items/:id
 *   POST /update/:token/events       — add/update event
 *   DELETE /update/:token/events/:id
 */

const express  = require('express');
const crypto   = require('crypto');
const multer   = require('multer');
const getGcrDb = require('../gcr-db');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function db() { return getGcrDb(); }
const supabase = db(); // update_links lives in GCR

function twilio() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const tok = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !tok) return null;
    return require('twilio')(sid, tok);
}
function fromNumber() { return process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER; }
function makeToken()  { return crypto.randomBytes(24).toString('hex'); }
function linkUrl(tok) {
    const base = (process.env.LINKS_BASE_URL || 'https://cybercheck-links.vercel.app').replace(/\/$/, '');
    return `${base}/menu-editor.html?token=${tok}`;
}

// ── Token validation middleware (for all public /:token/* routes) ─────────────
async function validateToken(req, res, next) {
    const token = req.params.token;
    const { data: link } = await supabase.from('update_links').select('*').eq('token', token).maybeSingle();
    if (!link) return res.status(404).json({ error: 'Link not found' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });
    req.link = link;
    req.entityId = link.entity_id;
    next();
}

// ═══════════════════════════════════════════════════════════════
// ADMIN — Generate / send links
// ═══════════════════════════════════════════════════════════════

router.post('/generate', adminRequired, async (req, res) => {
    const { entity_id, link_type = 'full', send_phone } = req.body;
    if (!entity_id) return res.status(400).json({ error: 'entity_id required' });
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase.from('update_links').select('*')
        .eq('entity_id', entity_id).eq('link_type', link_type).eq('link_date', today).maybeSingle();

    if (existing) return res.json({ token: existing.token, url: linkUrl(existing.token), existing: true });

    const token = makeToken();
    const { data, error } = await supabase.from('update_links').insert({
        entity_id, link_type, link_date: today, token,
        send_phone: send_phone || null,
        expires_at: new Date(Date.now() + 30 * 3600 * 1000).toISOString(),
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ token, url: linkUrl(token), existing: false });
});

router.post('/send-sms', adminRequired, async (req, res) => {
    const { entity_id, phone, link_type = 'full' } = req.body;
    if (!entity_id || !phone) return res.status(400).json({ error: 'entity_id and phone required' });

    const today = new Date().toISOString().split('T')[0];
    let { data: link } = await supabase.from('update_links').select('*')
        .eq('entity_id', entity_id).eq('link_type', link_type).eq('link_date', today).maybeSingle();

    if (!link) {
        const token = makeToken();
        const ins = await supabase.from('update_links').insert({
            entity_id, link_type, link_date: today, token, send_phone: phone,
            expires_at: new Date(Date.now() + 30 * 3600 * 1000).toISOString(),
        }).select().single();
        link = ins.data;
    }

    const url = linkUrl(link.token);
    const { data: entity } = await db().from('entity').select('name').eq('id', entity_id).single();
    const name = entity?.name || 'your business';

    const tc = twilio();
    if (!tc) return res.json({ success: false, error: 'Twilio not configured', url, token: link.token });

    await tc.messages.create({
        body: `Hi! Here's your daily update link for ${name}:\n\n${url}\n\nUpdate your menu, specials, photos and more. Expires tonight.`,
        from: fromNumber(), to: phone,
    });

    res.json({ success: true, url, token: link.token, sent_to: phone });
});

router.get('/status/:entity_id', adminRequired, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase.from('update_links').select('*')
        .eq('entity_id', req.params.entity_id).eq('link_date', today);
    res.json({ links: data || [], today });
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC — Mobile editor
// ═══════════════════════════════════════════════════════════════

// GET /update/:token — redirect to correct cybercheck-links page by link_type
router.get('/:token', async (req, res) => {
    const { data: link } = await supabase.from('update_links').select('link_type').eq('token', req.params.token).maybeSingle();
    if (!link) return res.status(404).json({ error: 'Link not found' });
    const base = (process.env.LINKS_BASE_URL || 'https://cybercheck-links.vercel.app').replace(/\/$/, '');
    const pageMap = { catch_of_day: 'daily-items.html', menu_setup: 'menu-setup.html' };
    const page = pageMap[link.link_type] || 'menu-editor.html';
    res.redirect(302, `${base}/${page}?token=${req.params.token}`);
});

// GET /update/:token/data — load all sections + items
router.get('/:token/data', validateToken, async (req, res) => {
    const eid = req.entityId;
    const g = db();
    const [entity, specials, menuSections, menuItems, drinkSections, drinkItems, hhSections, hhItems, events, photos] = await Promise.all([
        g.from('entity').select('name,icon,description,hh_days,hh_start,hh_end,hh_description,hero_image_url,slug').eq('id', eid).single(),
        g.from('entity_specials').select('*').eq('entity_id', eid).order('created_at'),
        g.from('menu_sections').select('*').eq('entity_id', eid).order('sort_order'),
        g.from('menu_items').select('*').eq('entity_id', eid).order('sort_order'),
        g.from('drink_sections').select('*').eq('entity_id', eid).order('created_at'),
        g.from('drink_items').select('*').eq('entity_id', eid).order('created_at'),
        g.from('happy_hour_sections').select('*').eq('entity_id', eid).order('created_at'),
        g.from('happy_hour_items').select('*').eq('entity_id', eid).order('created_at'),
        g.from('entity_events').select('*').eq('entity_id', eid).eq('is_active', true).order('event_date'),
        g.from('entity_photos').select('*').eq('entity_id', eid).order('sort_order').limit(20),
    ]);
    res.json({
        entity: entity.data,
        specials: specials.data || [],
        menu_sections: menuSections.data || [],
        menu_items: menuItems.data || [],
        drink_sections: drinkSections.data || [],
        drink_items: drinkItems.data || [],
        hh_sections: hhSections.data || [],
        hh_items: hhItems.data || [],
        events: events.data || [],
        photos: photos.data || [],
    });
});

// POST /update/:token/upload — image upload from phone camera/gallery
// ?save_photo=1 also inserts a row into entity_photos
router.post('/:token/upload', validateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file' });
    const ext  = req.file.originalname.split('.').pop() || 'jpg';
    const name = `update-links/${req.entityId}/${Date.now()}.${ext}`;
    const g    = db();
    const { error } = await g.storage.from('entity-media').upload(name, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) return res.status(500).json({ error: error.message });
    const { data: { publicUrl } } = g.storage.from('entity-media').getPublicUrl(name);

    // If this is a standalone business photo (not an item image), persist it to entity_photos
    if (req.query.save_photo === '1') {
        const caption = req.body.caption || null;
        const { data: photo } = await g.from('entity_photos').insert({ entity_id: req.entityId, image_url: publicUrl, caption }).select().single();
        return res.json({ url: publicUrl, photo });
    }

    res.json({ url: publicUrl });
});

// DELETE /update/:token/photos/:id
router.delete('/:token/photos/:id', validateToken, async (req, res) => {
    const { error } = await db().from('entity_photos').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Specials ──────────────────────────────────────────────────
router.post('/:token/specials', validateToken, async (req, res) => {
    const { id, special_name, discount_text, description, days, start_time, end_time, image_url, is_active = true } = req.body;
    if (!special_name) return res.status(400).json({ error: 'special_name required' });
    const g = db();
    let data, error;
    if (id) {
        ({ data, error } = await g.from('entity_specials').update({ special_name, discount_text, description, days, start_time, end_time, image_url, is_active }).eq('id', id).eq('entity_id', req.entityId).select().single());
    } else {
        ({ data, error } = await g.from('entity_specials').insert({ entity_id: req.entityId, special_name, discount_text, description, days, start_time, end_time, image_url, is_active }).select().single());
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/specials/:id', validateToken, async (req, res) => {
    const { error } = await db().from('entity_specials').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Menu sections + items ─────────────────────────────────────
router.post('/:token/menu-sections', validateToken, async (req, res) => {
    const { section_name, available_days, available_start, available_end } = req.body;
    if (!section_name) return res.status(400).json({ error: 'section_name required' });
    const { data, error } = await db().from('menu_sections')
        .insert({ entity_id: req.entityId, section_name, available_days: available_days || null, available_start: available_start || null, available_end: available_end || null })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.put('/:token/menu-sections/:id', validateToken, async (req, res) => {
    const { section_name, available_days, available_start, available_end } = req.body;
    if (!section_name) return res.status(400).json({ error: 'section_name required' });
    const { data, error } = await db().from('menu_sections')
        .update({ section_name, available_days: available_days || null, available_start: available_start || null, available_end: available_end || null })
        .eq('id', req.params.id).eq('entity_id', req.entityId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/menu-sections/:id', validateToken, async (req, res) => {
    const { error } = await db().from('menu_sections').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.post('/:token/menu-items', validateToken, async (req, res) => {
    const { id, item_name, description, price, price_text, menu_section_id, image_url, is_available = true } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const payload = { item_name, description: description || null, price: price !== '' && price != null ? parseFloat(price) : null, price_text: price_text || null, menu_section_id: menu_section_id || null, image_url: image_url || null, is_available };
    const g = db();
    let data, error;
    if (id) {
        ({ data, error } = await g.from('menu_items').update(payload).eq('id', id).eq('entity_id', req.entityId).select().single());
    } else {
        ({ data, error } = await g.from('menu_items').insert({ entity_id: req.entityId, ...payload }).select().single());
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/menu-items/:id', validateToken, async (req, res) => {
    const { error } = await db().from('menu_items').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Drink items ───────────────────────────────────────────────
router.post('/:token/drink-items', validateToken, async (req, res) => {
    const { id, item_name, description, price, price_text, drink_section_id, image_url, is_available = true } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const payload = { item_name, description: description || null, price: price !== '' && price != null ? parseFloat(price) : null, price_text: price_text || null, drink_section_id: drink_section_id || null, image_url: image_url || null, is_available };
    const g = db();
    let data, error;
    if (id) {
        ({ data, error } = await g.from('drink_items').update(payload).eq('id', id).eq('entity_id', req.entityId).select().single());
    } else {
        ({ data, error } = await g.from('drink_items').insert({ entity_id: req.entityId, ...payload }).select().single());
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/drink-items/:id', validateToken, async (req, res) => {
    const { error } = await db().from('drink_items').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Happy Hour ────────────────────────────────────────────────
router.put('/:token/happy-hour', validateToken, async (req, res) => {
    const { hh_days, hh_start, hh_end, hh_description } = req.body;
    const { error } = await db().from('entity').update({ hh_days, hh_start, hh_end, hh_description }).eq('id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.post('/:token/hh-items', validateToken, async (req, res) => {
    const { id, item_name, description, regular_price, hh_price, price_text, image_url } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const payload = { item_name, description: description || null, regular_price: regular_price ? parseFloat(regular_price) : null, hh_price: hh_price ? parseFloat(hh_price) : null, price_text: price_text || null, image_url: image_url || null };
    const g = db();
    let data, error;
    if (id) {
        ({ data, error } = await g.from('happy_hour_items').update(payload).eq('id', id).eq('entity_id', req.entityId).select().single());
    } else {
        ({ data, error } = await g.from('happy_hour_items').insert({ entity_id: req.entityId, ...payload }).select().single());
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/hh-items/:id', validateToken, async (req, res) => {
    const { error } = await db().from('happy_hour_items').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Events ────────────────────────────────────────────────────
router.post('/:token/events', validateToken, async (req, res) => {
    const { id, event_name, description, event_date, start_time, end_time, image_url, cover_charge, is_active = true } = req.body;
    if (!event_name) return res.status(400).json({ error: 'event_name required' });
    const payload = { event_name, description: description || null, event_date: event_date || null, start_time: start_time || null, end_time: end_time || null, image_url: image_url || null, cover_charge: cover_charge || null, is_active };
    const g = db();
    let data, error;
    if (id) {
        ({ data, error } = await g.from('entity_events').update(payload).eq('id', id).eq('entity_id', req.entityId).select().single());
    } else {
        ({ data, error } = await g.from('entity_events').insert({ entity_id: req.entityId, ...payload }).select().single());
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/events/:id', validateToken, async (req, res) => {
    const { error } = await db().from('entity_events').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Catch of the Day ──────────────────────────────────────
// Finds or creates the "Catch of the Day" menu section, then upserts the item.
const CATCH_SECTION_NAME = 'Catch of the Day';

router.get('/:token/catch', validateToken, async (req, res) => {
    const eid = req.entityId;
    const g = db();
    const [sectionRes, itemsRes] = await Promise.all([
        g.from('menu_sections').select('*').eq('entity_id', eid).eq('section_name', CATCH_SECTION_NAME).maybeSingle(),
        g.from('menu_sections').select('id').eq('entity_id', eid).eq('section_name', CATCH_SECTION_NAME).maybeSingle(),
    ]);
    let section = sectionRes.data;
    if (!section) {
        const ins = await g.from('menu_sections').insert({ entity_id: eid, section_name: CATCH_SECTION_NAME }).select().single();
        section = ins.data;
    }
    const items = section
        ? (await g.from('menu_items').select('*').eq('entity_id', eid).eq('menu_section_id', section.id).order('created_at')).data || []
        : [];
    res.json({ section, items });
});

router.post('/:token/catch', validateToken, async (req, res) => {
    const { id, item_name, description, price, is_market_price, image_url } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const eid = req.entityId;
    const g = db();

    // Find or create the Catch of the Day section
    let { data: section } = await g.from('menu_sections').select('id').eq('entity_id', eid).eq('section_name', CATCH_SECTION_NAME).maybeSingle();
    if (!section) {
        const ins = await g.from('menu_sections').insert({ entity_id: eid, section_name: CATCH_SECTION_NAME }).select().single();
        section = ins.data;
    }

    const payload = {
        item_name,
        description: description || null,
        price: is_market_price ? null : (price ? parseFloat(price) : null),
        price_text: is_market_price ? 'Market Price' : null,
        image_url: image_url || null,
        menu_section_id: section.id,
        is_available: true,
    };

    let data, error;
    if (id) {
        ({ data, error } = await g.from('menu_items').update(payload).eq('id', id).eq('entity_id', eid).select().single());
    } else {
        ({ data, error } = await g.from('menu_items').insert({ entity_id: eid, ...payload }).select().single());
    }
    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
});

router.delete('/:token/catch/:id', validateToken, async (req, res) => {
    const { error } = await db().from('menu_items').delete().eq('id', req.params.id).eq('entity_id', req.entityId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════
// MENU SETUP — AI-powered onboarding (link_type = 'menu_setup')
// ═══════════════════════════════════════════════════════════════

async function callGrokForMenu(prompt, imageUrl) {
    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey) throw new Error('XAI_API_KEY not configured');

    const userContent = imageUrl
        ? [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ]
        : prompt;

    const model = imageUrl ? 'grok-2-vision-1212' : 'grok-3-mini';

    const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: 'You are a professional menu digitizer. Extract complete menu data and return ONLY valid JSON — no markdown, no explanation, just the JSON object.' },
                { role: 'user', content: userContent },
            ],
            temperature: 0.1,
        }),
    });
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    // Strip any accidental markdown fences
    const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(clean);
}

const MENU_EXTRACT_PROMPT = `Extract ALL menu sections and items from this menu.

Return ONLY this JSON structure:
{
  "sections": [
    {
      "section_name": "Breakfast",
      "available_days": "Monday-Sunday",
      "available_start": "7:00 AM",
      "available_end": "11:00 AM",
      "items": [
        {
          "item_name": "Eggs Benedict",
          "description": "Poached eggs, Canadian bacon, hollandaise sauce",
          "price": 14.99,
          "price_text": null
        }
      ]
    }
  ]
}

Rules:
- If no explicit sections exist, group items logically (Appetizers, Entrees, Desserts, Drinks, etc.)
- For items with no fixed price (market, seasonal), set price to null and price_text to "Market Price"
- Prices must be numbers, not strings
- Keep descriptions concise but informative
- Extract EVERY item visible — do not skip any`;

// POST /update/:token/setup/parse-image — upload menu photo → Grok Vision
router.post('/:token/setup/parse-image', validateToken, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const ext  = req.file.originalname.split('.').pop() || 'jpg';
    const name = `menu-setup/${req.entityId}/${Date.now()}.${ext}`;
    const g = db();
    const { error: upErr } = await g.storage.from('entity-media').upload(name, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (upErr) return res.status(500).json({ error: upErr.message });
    const { data: { publicUrl } } = g.storage.from('entity-media').getPublicUrl(name);

    try {
        const result = await callGrokForMenu(MENU_EXTRACT_PROMPT, publicUrl);
        res.json({ ok: true, result, image_url: publicUrl });
    } catch (e) {
        res.status(500).json({ error: 'AI parse failed: ' + e.message });
    }
});

// POST /update/:token/setup/parse-website — fetch website → extract text → Grok
router.post('/:token/setup/parse-website', validateToken, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    let pageText = '';
    try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)' }, signal: AbortSignal.timeout(10000) });
        const html = await r.text();
        // Strip tags, collapse whitespace — send readable text to Grok
        pageText = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ').trim()
            .substring(0, 12000); // cap at ~3k tokens
    } catch (e) {
        return res.status(400).json({ error: 'Could not fetch website: ' + e.message });
    }

    try {
        const result = await callGrokForMenu(`${MENU_EXTRACT_PROMPT}\n\nWebsite text:\n${pageText}`);
        res.json({ ok: true, result });
    } catch (e) {
        res.status(500).json({ error: 'AI parse failed: ' + e.message });
    }
});

// POST /update/:token/setup/finish — convert this link to a full daily editor
router.post('/:token/setup/finish', validateToken, async (req, res) => {
    const { error } = await supabase.from('update_links')
        .update({ link_type: 'daily', expires_at: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() })
        .eq('token', req.params.token);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

// POST /update/:token/setup/create — bulk-create all sections + items from AI output
router.post('/:token/setup/create', validateToken, async (req, res) => {
    const { sections } = req.body;
    if (!Array.isArray(sections) || !sections.length) return res.status(400).json({ error: 'sections array required' });
    const eid = req.entityId;
    const g = db();
    let created = { sections: 0, items: 0 };

    for (const sec of sections) {
        const { data: secRow, error: secErr } = await g.from('menu_sections').insert({
            entity_id: eid,
            section_name: sec.section_name || 'Menu',
            available_days:  sec.available_days  || null,
            available_start: sec.available_start || null,
            available_end:   sec.available_end   || null,
        }).select().single();
        if (secErr) continue;
        created.sections++;

        const items = (sec.items || []).filter(i => i.item_name);
        if (!items.length) continue;
        const rows = items.map(i => ({
            entity_id: eid,
            menu_section_id: secRow.id,
            item_name:   i.item_name,
            description: i.description || null,
            price:       i.price != null ? parseFloat(i.price) : null,
            price_text:  i.price_text || null,
            is_available: true,
        }));
        const { error: itemErr } = await g.from('menu_items').insert(rows);
        if (!itemErr) created.items += rows.length;
    }

    res.json({ ok: true, created });
});


module.exports = router;

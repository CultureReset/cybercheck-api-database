/**
 * SMS Automation Routes
 *
 * GET    /api/modules/sms-automation/automations          — list all automation rules
 * POST   /api/modules/sms-automation/automations          — create automation rule
 * PUT    /api/modules/sms-automation/automations/:id      — update rule
 * DELETE /api/modules/sms-automation/automations/:id      — delete rule
 * POST   /api/modules/sms-automation/automations/:id/run  — manually trigger
 * GET    /api/modules/sms-automation/logs                 — run history
 * GET    /api/modules/sms-automation/logs/:automation_id  — run history for one rule
 *
 * Daily Update Links:
 * POST   /api/modules/sms-automation/daily-link           — generate or get today's link for entity
 * GET    /api/modules/sms-automation/daily-link/:token    — (public) load link data for form
 * POST   /api/modules/sms-automation/daily-link/:token/submit — (public) submit update
 *
 * SMS Inbox view (wraps existing sms route data):
 * GET    /api/modules/sms-automation/inbox                — all threads across all businesses
 * GET    /api/modules/sms-automation/inbox/:entity_id     — threads for one business
 */

const express  = require('express');
const supabase = require('../../db');
const gcrDb    = require('../../gcr-db')();
const router   = express.Router();

const { adminRequired } = require('../../middleware/auth');

// ── Helper: get Twilio client ─────────────────────────────────
function twilio() {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;
    return require('twilio')(sid, token);
}

function fromNumber() {
    return process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
}

// ── Generate a secure daily token ─────────────────────────────
function generateToken() {
    const { randomBytes } = require('crypto');
    return randomBytes(20).toString('hex');
}

// ═══════════════════════════════════════════════════════════════
// AUTOMATION RULES CRUD
// ═══════════════════════════════════════════════════════════════

// GET /automations — list all automation rules
router.get('/automations', adminRequired, async (req, res) => {
    let q = supabase.from('sms_automations').select('*').order('created_at', { ascending: false });
    if (req.query.entity_id) q = q.eq('entity_id', req.query.entity_id);
    if (req.query.active === 'true') q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ automations: data || [] });
});

// POST /automations — create rule
router.post('/automations', adminRequired, async (req, res) => {
    const {
        entity_id, name, trigger_type, cron_schedule, trigger_event,
        recipient_type, recipient_phone, recipient_config,
        message_template, data_sources, send_at_offset_minutes,
        is_active = true,
    } = req.body;

    if (!name || !trigger_type || !message_template)
        return res.status(400).json({ error: 'name, trigger_type, message_template required' });

    const { data, error } = await supabase.from('sms_automations').insert({
        entity_id: entity_id || null,
        name, trigger_type, cron_schedule: cron_schedule || null,
        trigger_event: trigger_event || null,
        recipient_type: recipient_type || 'phone',
        recipient_phone: recipient_phone || null,
        recipient_config: recipient_config || null,
        message_template,
        data_sources: data_sources || [],
        send_at_offset_minutes: send_at_offset_minutes || 0,
        is_active,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ automation: data });
});

// PUT /automations/:id — update rule
router.put('/automations/:id', adminRequired, async (req, res) => {
    const allowed = ['name','trigger_type','cron_schedule','trigger_event','recipient_type',
        'recipient_phone','recipient_config','message_template','data_sources',
        'send_at_offset_minutes','is_active'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('sms_automations').update(update).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ automation: data });
});

// DELETE /automations/:id
router.delete('/automations/:id', adminRequired, async (req, res) => {
    const { error } = await supabase.from('sms_automations').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// POST /automations/:id/run — manually trigger an automation
router.post('/automations/:id/run', adminRequired, async (req, res) => {
    const { data: automation } = await supabase.from('sms_automations').select('*').eq('id', req.params.id).single();
    if (!automation) return res.status(404).json({ error: 'Automation not found' });
    const result = await runAutomation(automation, req.body.context || {});
    res.json(result);
});

// ── Run an automation ─────────────────────────────────────────
async function runAutomation(automation, context = {}) {
    const tc = twilio();
    if (!tc) return { success: false, error: 'Twilio not configured' };

    try {
        // Build message by resolving template variables
        const message = await resolveTemplate(automation.message_template, automation, context);
        const to = resolveRecipient(automation, context);

        if (!to) return { success: false, error: 'No recipient phone number' };

        const msg = await tc.messages.create({ body: message, from: fromNumber(), to });

        await supabase.from('sms_automation_logs').insert({
            automation_id: automation.id,
            entity_id: automation.entity_id,
            recipient_phone: to,
            message_sent: message,
            status: 'sent',
            twilio_sid: msg.sid,
        });

        await supabase.from('sms_automations').update({ last_run_at: new Date().toISOString() }).eq('id', automation.id);

        return { success: true, message_sent: message, to, twilio_sid: msg.sid };
    } catch (err) {
        await supabase.from('sms_automation_logs').insert({
            automation_id: automation.id,
            entity_id: automation.entity_id,
            message_sent: automation.message_template,
            status: 'failed',
            error_message: err.message,
        });
        return { success: false, error: err.message };
    }
}

// ── Template resolver — replaces {{variable}} placeholders ───
async function resolveTemplate(template, automation, context) {
    let msg = template;

    // Static context variables (passed in at runtime)
    Object.entries(context).forEach(([k, v]) => {
        msg = msg.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });

    // Date/time
    const now = new Date();
    msg = msg.replace(/\{\{date\}\}/g, now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    msg = msg.replace(/\{\{time\}\}/g, now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));

    // GCR entity data
    if (automation.entity_id && msg.includes('{{')) {
        const { data: entity } = await gcrDb.from('entity').select('name,phone,hh_days,hh_start,hh_end').eq('id', automation.entity_id).single();
        if (entity) {
            msg = msg.replace(/\{\{business_name\}\}/g, entity.name || '');
            msg = msg.replace(/\{\{hh_days\}\}/g, entity.hh_days || '');
            msg = msg.replace(/\{\{hh_hours\}\}/g, entity.hh_start && entity.hh_end ? `${entity.hh_start}–${entity.hh_end}` : '');
        }
    }

    // Weather — if template uses {{weather_*}}
    if (msg.includes('{{weather') && automation.entity_id) {
        try {
            const weather = await require('../weather-connector/api').getWeatherForEntity(automation.entity_id);
            msg = msg.replace(/\{\{weather_temp\}\}/g, weather.temp || '');
            msg = msg.replace(/\{\{weather_desc\}\}/g, weather.description || '');
            msg = msg.replace(/\{\{weather_wind\}\}/g, weather.wind || '');
            msg = msg.replace(/\{\{weather_rain\}\}/g, weather.rain_chance ? `${weather.rain_chance}% chance of rain` : 'no rain expected');
            msg = msg.replace(/\{\{tide_next\}\}/g, weather.tide_next || '');
            msg = msg.replace(/\{\{tide_height\}\}/g, weather.tide_height || '');
        } catch (e) { /* weather unavailable, leave placeholders */ }
    }

    // Booking data — if template uses {{bookings_*}}
    if (msg.includes('{{bookings') && automation.entity_id) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: bookings } = await supabase.from('bookings').select('id,booking_date,start_time,party_size,customer_name,service_name').eq('entity_id', automation.entity_id).eq('booking_date', today).eq('status', 'confirmed');
            msg = msg.replace(/\{\{bookings_count\}\}/g, (bookings || []).length);
            msg = msg.replace(/\{\{bookings_summary\}\}/g, (bookings || []).map(b => `${b.start_time} – ${b.service_name || 'Booking'} (${b.party_size} guests)`).join('\n') || 'No bookings today');
            msg = msg.replace(/\{\{first_booking_time\}\}/g, bookings?.[0]?.start_time || 'N/A');
            msg = msg.replace(/\{\{first_booking_guests\}\}/g, bookings?.[0]?.party_size || 'N/A');
            msg = msg.replace(/\{\{first_booking_name\}\}/g, bookings?.[0]?.customer_name || 'N/A');
        } catch (e) { /* bookings unavailable */ }
    }

    return msg;
}

function resolveRecipient(automation, context) {
    if (context.override_phone) return context.override_phone;
    if (automation.recipient_phone) return automation.recipient_phone;
    if (automation.recipient_config?.phone) return automation.recipient_config.phone;
    return null;
}

// ═══════════════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════════════

router.get('/logs', adminRequired, async (req, res) => {
    const days = parseInt(req.query.days || '7');
    const since = new Date(Date.now() - days * 86400000).toISOString();
    let q = supabase.from('sms_automation_logs').select('*, sms_automations(name)').gte('created_at', since).order('created_at', { ascending: false }).limit(200);
    if (req.query.entity_id) q = q.eq('entity_id', req.query.entity_id);
    if (req.query.status) q = q.eq('status', req.query.status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ logs: data || [], days });
});

router.get('/logs/:automation_id', adminRequired, async (req, res) => {
    const { data, error } = await supabase.from('sms_automation_logs').select('*').eq('automation_id', req.params.automation_id).order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ logs: data || [] });
});

// ═══════════════════════════════════════════════════════════════
// DAILY UPDATE LINKS
// Business owner gets an SMS with a secure one-time-per-day URL.
// They tap it, fill in today's specials/prices/catch/menu items,
// hit Submit → data pushes to GCR entity + their website.
// ═══════════════════════════════════════════════════════════════

// POST /daily-link — generate (or return today's existing) link for an entity
router.post('/daily-link', adminRequired, async (req, res) => {
    const { entity_id, link_type = 'specials', fields_config, send_sms = false } = req.body;
    if (!entity_id) return res.status(400).json({ error: 'entity_id required' });

    const today = new Date().toISOString().split('T')[0];

    // Return existing unused link for today if it exists
    const { data: existing } = await supabase.from('sms_update_links').select('*')
        .eq('entity_id', entity_id).eq('link_type', link_type).eq('link_date', today)
        .maybeSingle();

    if (existing && !existing.submitted_at) {
        const url = buildLinkUrl(existing.token);
        if (send_sms && existing.send_phone) {
            const tc = twilio();
            if (tc) await tc.messages.create({ body: `Your daily update link: ${url}`, from: fromNumber(), to: existing.send_phone });
        }
        return res.json({ token: existing.token, url, created: false, link: existing });
    }

    // Generate new link
    const token = generateToken();
    const { data: link, error } = await supabase.from('sms_update_links').insert({
        entity_id, link_type, link_date: today, token,
        fields_config: fields_config || defaultFieldsConfig(link_type),
        expires_at: new Date(new Date(today).getTime() + 30 * 3600000).toISOString(), // expires 30h from midnight
        send_phone: req.body.send_phone || null,
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    const url = buildLinkUrl(token);

    // Optionally SMS the link right now
    if (send_sms && req.body.send_phone) {
        const tc = twilio();
        if (tc) await tc.messages.create({ body: `Hi! Here's your daily update link:\n${url}\n\nExpires tonight at midnight.`, from: fromNumber(), to: req.body.send_phone });
    }

    res.json({ token, url, created: true, link });
});

// GET /daily-link/:token — PUBLIC — load the form (no auth needed, token is the secret)
router.get('/daily-link/:token', async (req, res) => {
    const { data: link } = await supabase.from('sms_update_links').select('*').eq('token', req.params.token).maybeSingle();
    if (!link) return res.status(404).json({ error: 'Link not found or expired' });
    if (link.submitted_at) return res.status(410).json({ error: 'This link has already been used', submitted_at: link.submitted_at });
    if (link.expires_at && new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });

    // Load previous day's values from GCR to pre-fill the form
    const { data: entity } = await gcrDb.from('entity').select('name,description,price_range').eq('id', link.entity_id).single();
    const { data: specials } = await gcrDb.from('entity_specials').select('special_name,discount_text,days,start_time,end_time').eq('entity_id', link.entity_id).eq('is_active', true).limit(10);

    res.json({ link, entity, prefill: { specials: specials || [] }, fields_config: link.fields_config });
});

// POST /daily-link/:token/submit — PUBLIC — submit the update
router.post('/daily-link/:token/submit', async (req, res) => {
    const { data: link } = await supabase.from('sms_update_links').select('*').eq('token', req.params.token).maybeSingle();
    if (!link) return res.status(404).json({ error: 'Link not found' });
    if (link.submitted_at) return res.status(410).json({ error: 'Already submitted' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });

    const updates = req.body; // { specials: [...], prices: {...}, description: '...' }
    const results = [];

    // Push updates to GCR based on link_type
    if (link.link_type === 'specials' && updates.specials) {
        // Upsert specials
        for (const s of updates.specials) {
            if (!s.special_name) continue;
            const existing = await gcrDb.from('entity_specials').select('id').eq('entity_id', link.entity_id).eq('special_name', s.special_name).maybeSingle();
            if (existing.data) {
                await gcrDb.from('entity_specials').update({ discount_text: s.discount_text, description: s.description || null, updated_at: new Date().toISOString() }).eq('id', existing.data.id);
            } else {
                await gcrDb.from('entity_specials').insert({ entity_id: link.entity_id, special_name: s.special_name, discount_text: s.discount_text, description: s.description || null, is_active: true });
            }
            results.push(`Updated special: ${s.special_name}`);
        }
    }

    if (link.link_type === 'menu_prices' && updates.items) {
        for (const item of updates.items) {
            if (!item.id) continue;
            await gcrDb.from('menu_items').update({ price: item.price, price_text: item.price_text || null }).eq('id', item.id).eq('entity_id', link.entity_id);
            results.push(`Updated price: ${item.item_name}`);
        }
    }

    if (link.link_type === 'catch_of_day' && updates.catch_items) {
        // Store catch items as specials with special_type = 'catch'
        await gcrDb.from('entity_specials').delete().eq('entity_id', link.entity_id).eq('special_type', 'catch_of_day');
        for (const c of updates.catch_items) {
            if (!c.name) continue;
            await gcrDb.from('entity_specials').insert({ entity_id: link.entity_id, special_name: c.name, discount_text: c.price ? `$${c.price}` : null, special_type: 'catch_of_day', description: c.description || null, is_active: true });
            results.push(`Updated catch: ${c.name}`);
        }
    }

    // Mark link as submitted
    await supabase.from('sms_update_links').update({ submitted_at: new Date().toISOString(), submitted_data: updates }).eq('token', req.params.token);

    res.json({ success: true, results, message: 'Update saved! Your listing is now updated.' });
});

// ═══════════════════════════════════════════════════════════════
// SMS INBOX VIEW (wraps existing messages table)
// ═══════════════════════════════════════════════════════════════

router.get('/inbox', adminRequired, async (req, res) => {
    const { data, error } = await supabase.from('messages').select('site_id,customer_phone,direction,body,created_at').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    // Group by conversation thread
    const threads = {};
    (data || []).forEach(m => {
        const key = `${m.site_id}::${m.customer_phone}`;
        if (!threads[key]) threads[key] = { site_id: m.site_id, phone: m.customer_phone, messages: [], last_at: m.created_at };
        threads[key].messages.push(m);
        if (m.created_at > threads[key].last_at) threads[key].last_at = m.created_at;
    });
    res.json({ threads: Object.values(threads).sort((a, b) => b.last_at.localeCompare(a.last_at)) });
});

// ── Helpers ────────────────────────────────────────────────────
function buildLinkUrl(token) {
    const base = process.env.DASHBOARD_URL || process.env.PUBLIC_URL || 'https://cybercheck-login.vercel.app';
    return `${base}/update/${token}`;
}

function defaultFieldsConfig(linkType) {
    if (linkType === 'catch_of_day') return { fields: ['species', 'price', 'sold_out'] };
    if (linkType === 'menu_prices') return { fields: ['item_name', 'price', 'available'] };
    return { fields: ['special_name', 'discount_text', 'description'] };
}

module.exports = router;

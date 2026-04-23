const express = require('express');
const { authRequired } = require('../middleware/auth');
const supabase = require('../db');
const getGcrDb = require('../gcr-db');
const { resolveEntityId } = require('../lib/entity-resolver');
const menuGcr = require('../lib/menu-gcr');
const { extractJsonFromImage, getVisionProvidersStatus } = require('./ai-provider');
const gcr = () => getGcrDb();

const router = express.Router();

// ── GCR write-through ────────────────────────────────────────────────────────
// When data is saved to the main DB via site_id, also mirror it to the GCR
// entity if one exists with a matching legacy_site_id. Fire-and-forget.
async function syncToGcr(siteId, type, data) {
    const gcrDb = gcr();
    const { data: entity } = await gcrDb.from('entity')
        .select('id').eq('legacy_site_id', siteId).maybeSingle();
    if (!entity) return;
    const eid = entity.id;

    if (type === 'menu_item') {
        const itemType = data.item_type || 'food';
        if (itemType === 'drink') {
            // Drinks go to GCR drink_sections + drink_items
            const secName = data.category || 'Drinks';
            let { data: sec } = await gcrDb.from('drink_sections').select('id').eq('entity_id', eid).eq('section_name', secName).maybeSingle();
            if (!sec) {
                const ins = await gcrDb.from('drink_sections').insert({ entity_id: eid, section_name: secName }).select('id').single();
                sec = ins.data;
            }
            if (sec) await gcrDb.from('drink_items').insert({ entity_id: eid, drink_section_id: sec.id, item_name: data.name, price: data.price || null, description: data.description || null, tags: data.tags || [], modifiers: data.modifiers || [], is_available: true });
        } else if (itemType === 'happy_hour') {
            // Happy hour items go to GCR happy_hour_sections + happy_hour_items
            const secName = data.category || 'Happy Hour';
            let { data: sec } = await gcrDb.from('happy_hour_sections').select('id').eq('entity_id', eid).maybeSingle();
            if (!sec) {
                const ins = await gcrDb.from('happy_hour_sections').insert({ entity_id: eid, section_name: secName }).select('id').single();
                sec = ins.data;
            }
            if (sec) await gcrDb.from('happy_hour_items').insert({ entity_id: eid, item_name: data.name, hh_price: data.price || null, description: data.description || null });
        } else {
            // Food goes to GCR menu_items
            await gcrDb.from('menu_items').insert({ entity_id: eid, item_name: data.name, price: data.price || null, description: data.description || null, is_available: true });
        }
    } else if (type === 'special') {
        await gcrDb.from('entity_specials').insert({
            entity_id: eid,
            special_name: data.special_name || data.name,
            discount_text: data.discount_text || '',
            description: data.description || null,
            days: data.days || null,
            start_time: data.start_time || null,
            end_time: data.end_time || null,
            is_active: true,
        });
    } else if (type === 'event') {
        await gcrDb.from('entity_events').insert({
            entity_id: eid,
            event_name: data.name || data.event_name,
            description: data.description || null,
            event_date: data.event_date || null,
            start_time: data.start_time || null,
            end_time: data.end_time || null,
            is_active: true,
        });
    }
}

// Auth removed from dashboard routes — the admin login page is the access gate.
// To re-enable backend auth later, uncomment the line below and remove the next one.
// router.use(authRequired);
router.use((req, res, next) => next());

async function requireEntity(req, res) {
    const entityId = await resolveEntityId(req);
    if (!entityId) {
        res.status(400).json({ error: 'No GCR entity linked to this user. Add a row in entity_owners (user_id → entity_id) or set entity.legacy_site_id = your site_id.' });
        return null;
    }
    return entityId;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Flatten Supabase join objects into top-level fields on a booking row
function flattenBooking(b) {
    if (!b) return b;
    const out = { ...b };
    if (b.fleet_types) {
        out.fleet_type_name = b.fleet_types.name || null;
        delete out.fleet_types;
    }
    if (b.rental_time_slots) {
        out.time_slot_name = b.rental_time_slots.name || null;
        out.time_slot_start = b.rental_time_slots.start_time || null;
        out.time_slot_end   = b.rental_time_slots.end_time   || null;
        delete out.rental_time_slots;
    }
    return out;
}

// ============================================
// PROFILE
// ============================================

// ============================================
// GET /api/dashboard/overview — Dashboard home stats
// ============================================
router.get('/overview', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const [bookingsRes, todayRes, revenueRes, customersRes] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true })
            .eq('site_id', req.siteId)
            .not('status', 'eq', 'cancelled')
            .not('payment_status', 'eq', 'failed'),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
            .eq('site_id', req.siteId)
            .eq('booking_date', today)
            .not('status', 'eq', 'cancelled')
            .not('payment_status', 'eq', 'failed'),
        supabase.from('bookings').select('total')
            .eq('site_id', req.siteId)
            .eq('payment_status', 'paid')
            .not('status', 'eq', 'refunded'),
        supabase.from('customers').select('id', { count: 'exact', head: true })
            .eq('site_id', req.siteId)
    ]);

    const totalRevenue = (revenueRes.data || []).reduce((sum, b) => sum + (b.total || 0), 0);

    const { data: recent } = await supabase
        .from('bookings')
        .select('id, customer_name, booking_date, total, status, payment_status, created_at')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false })
        .limit(5);

    res.json({
        total_bookings: bookingsRes.count || 0,
        bookings_today: todayRes.count || 0,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_customers: customersRes.count || 0,
        recent_bookings: recent || []
    });
});

// ============================================
// GET /api/dashboard/declined-bookings — failed payment bookings for retargeting
// ============================================
router.get('/declined-bookings', async (req, res) => {
    const { data, error } = await supabase
        .from('bookings')
        .select('id, customer_name, customer_phone, customer_email, booking_date, total, created_at')
        .eq('site_id', req.siteId)
        .eq('payment_status', 'failed')
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ============================================
// Profile — admin role → GCR entity, others → old DB (businesses + site_content)
// Translation: GCR stores profile across entity columns (hero_image_url, subtitle,
// phone, address_line_1, social_*) — we map here so the admin frontend sees the
// same { business, content } shape it always has.
// ============================================

function _gcrEntityToAdminProfile(e) {
    if (!e) return { business: null, content: null };
    return {
        business: {
            site_id: e.legacy_site_id || null,
            name: e.name || '',
            type: e.entity_subtype || e.entity_type || '',
            logo_url: e.hero_image_url || '',
            cover_url: e.hero_image_url || '',
            custom_domain: e.custom_domain || '',
            tagline: e.subtitle || '',
            slug: e.slug,
            entity_id: e.id,
        },
        content: {
            hero_text: e.subtitle || '',
            tagline: e.subtitle || '',
            about_text: e.description || '',
            address: e.address_line_1 || '',
            city: e.city || '',
            state: e.state || '',
            zip: e.zip || '',
            contact_phone: e.phone || '',
            email: e.email || '',
            social_links: {
                facebook: e.social_facebook || '',
                instagram: e.social_instagram || '',
                tiktok: e.social_tiktok || '',
            },
            hh_days: e.hh_days || null,
            hh_start: e.hh_start || null,
            hh_end: e.hh_end || null,
            hh_description: e.hh_description || null,
        },
    };
}

function _adminProfileToGcrEntity(bizUpdates, contentUpdates) {
    const out = {};
    if (bizUpdates) {
        if (bizUpdates.name !== undefined) out.name = bizUpdates.name;
        if (bizUpdates.type !== undefined) out.entity_subtype = bizUpdates.type;
        if (bizUpdates.logo_url !== undefined) out.hero_image_url = bizUpdates.logo_url;
        if (bizUpdates.cover_url !== undefined && out.hero_image_url === undefined) out.hero_image_url = bizUpdates.cover_url;
        if (bizUpdates.tagline !== undefined) out.subtitle = bizUpdates.tagline;
    }
    if (contentUpdates) {
        if (contentUpdates.hero_text !== undefined) out.subtitle = contentUpdates.hero_text;
        if (contentUpdates.tagline !== undefined) out.subtitle = contentUpdates.tagline;
        if (contentUpdates.about_text !== undefined) out.description = contentUpdates.about_text;
        if (contentUpdates.address !== undefined) out.address_line_1 = contentUpdates.address;
        if (contentUpdates.city !== undefined) out.city = contentUpdates.city;
        if (contentUpdates.state !== undefined) out.state = contentUpdates.state;
        if (contentUpdates.zip !== undefined) out.zip = contentUpdates.zip;
        if (contentUpdates.contact_phone !== undefined) out.phone = contentUpdates.contact_phone;
        if (contentUpdates.email !== undefined) out.email = contentUpdates.email;
        if (contentUpdates.social_links && typeof contentUpdates.social_links === 'object') {
            if (contentUpdates.social_links.facebook !== undefined) out.social_facebook = contentUpdates.social_links.facebook;
            if (contentUpdates.social_links.instagram !== undefined) out.social_instagram = contentUpdates.social_links.instagram;
            if (contentUpdates.social_links.tiktok !== undefined) out.social_tiktok = contentUpdates.social_links.tiktok;
        }
        if (contentUpdates.hh_days !== undefined) out.hh_days = contentUpdates.hh_days;
        if (contentUpdates.hh_start !== undefined) out.hh_start = contentUpdates.hh_start;
        if (contentUpdates.hh_end !== undefined) out.hh_end = contentUpdates.hh_end;
        if (contentUpdates.hh_description !== undefined) out.hh_description = contentUpdates.hh_description;
    }
    return out;
}

router.get('/profile', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data } = await gcr().from('entity').select('*').eq('id', e).maybeSingle();
        return res.json(_gcrEntityToAdminProfile(data));
    }
    const { data: business } = await supabase.from('businesses').select('*').eq('site_id', req.siteId).single();
    const { data: content } = await supabase.from('site_content').select('*').eq('site_id', req.siteId).single();
    res.json({ business, content });
});

router.put('/profile', async (req, res) => {
    const { business: bizUpdates, content: contentUpdates } = req.body;
    if (!bizUpdates && !contentUpdates) {
        return res.status(400).json({ error: 'Body must have "business" and/or "content" keys.' });
    }

    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const entityUpdates = _adminProfileToGcrEntity(bizUpdates, contentUpdates);
        if (Object.keys(entityUpdates).length) {
            entityUpdates.updated_at = new Date().toISOString();
            const { error } = await gcr().from('entity').update(entityUpdates).eq('id', e);
            if (error) return res.status(500).json({ error: error.message });
        }
        const { data } = await gcr().from('entity').select('*').eq('id', e).maybeSingle();
        return res.json(_gcrEntityToAdminProfile(data));
    }

    if (bizUpdates) {
        const allowedBizFields = ['name', 'type', 'logo_url', 'cover_url', 'custom_domain'];
        const bizData = {};
        for (const key of allowedBizFields) {
            if (bizUpdates[key] !== undefined) bizData[key] = bizUpdates[key];
        }
        if (Object.keys(bizData).length > 0) {
            bizData.updated_at = new Date().toISOString();
            await supabase.from('businesses').update(bizData).eq('site_id', req.siteId);
        }
    }
    if (contentUpdates) {
        delete contentUpdates.site_id;
        if (contentUpdates.tagline !== undefined && contentUpdates.hero_text === undefined) {
            contentUpdates.hero_text = contentUpdates.tagline;
        }
        delete contentUpdates.tagline;
        contentUpdates.updated_at = new Date().toISOString();
        await supabase.from('site_content').upsert({ site_id: req.siteId, ...contentUpdates }).select();
    }
    const { data: business } = await supabase.from('businesses').select('*').eq('site_id', req.siteId).single();
    const { data: content } = await supabase.from('site_content').select('*').eq('site_id', req.siteId).single();
    res.json({ business, content });
});

// ============================================
// HOURS
// ============================================

// GET /api/dashboard/hours
router.get('/hours', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('hours')
        .eq('site_id', req.siteId)
        .single();

    res.json(data?.hours || {});
});

// PUT /api/dashboard/hours
router.put('/hours', async (req, res) => {
    const { hours } = req.body;

    const { data, error } = await supabase
        .from('site_content')
        .update({ hours, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('hours')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Emit event: business.hours.updated
    res.json(data.hours);
});

// ============================================
// SERVICES
// ============================================

router.get('/services', async (req, res) => {
    const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/services', async (req, res) => {
    const service = { ...req.body, site_id: req.siteId };
    delete service.id;

    const { data, error } = await supabase
        .from('services')
        .insert(service)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Emit event: business.service.created
    res.status(201).json(data);
});

router.put('/services/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Emit event: business.service.updated
    res.json(data);
});

router.delete('/services/:id', async (req, res) => {
    const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Emit event: business.service.deleted
    res.json({ success: true });
});

// ============================================
// GALLERY
// ============================================

// Gallery: admin path stores in entity_photos; Circle Boats stays on `media` table.
// GCR entity_photos columns: image_url, caption, alt_text, sort_order, is_cover
// Admin frontend expects: { id, url, filename, alt_text, file_size, folder }
function _gcrPhotoToAdmin(p) {
    if (!p) return p;
    return {
        id: p.id,
        url: p.image_url,
        filename: p.caption || '',
        alt_text: p.alt_text || p.caption || '',
        file_size: null,
        folder: 'gallery',
        sort_order: p.sort_order || 0,
    };
}

router.get('/gallery', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('entity_photos').select('*').eq('entity_id', e).order('sort_order', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json((data || []).map(_gcrPhotoToAdmin));
    }
    const { data } = await supabase.from('media').select('*').eq('site_id', req.siteId).eq('file_type', 'image').order('uploaded_at', { ascending: false });
    res.json(data || []);
});

router.post('/gallery', async (req, res) => {
    const { url, filename, alt_text, file_size } = req.body;
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('entity_photos').insert({
            entity_id: e, image_url: url, caption: filename || null, alt_text: alt_text || null, sort_order: 0
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(_gcrPhotoToAdmin(data));
    }
    const { data, error } = await supabase.from('media').insert({
        site_id: req.siteId, url, filename, alt_text, file_size, file_type: 'image', folder: 'gallery'
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gallery/:id', async (req, res) => {
    const { alt_text, folder } = req.body;
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const patch = {};
        if (alt_text !== undefined) patch.alt_text = alt_text;
        const { data, error } = await gcr().from('entity_photos').update(patch).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(_gcrPhotoToAdmin(data));
    }
    const { data, error } = await supabase.from('media').update({ alt_text, folder }).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gallery/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('entity_photos').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('media').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// FAQS
// ============================================

router.get('/faqs', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('faq_items').select('*').eq('entity_id', e).order('sort_order', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data } = await supabase.from('faqs').select('*').eq('site_id', req.siteId).order('sort_order', { ascending: true });
    res.json(data || []);
});

router.post('/faqs', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id;
        const { data, error } = await gcr().from('faq_items').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const faq = { ...req.body, site_id: req.siteId };
    delete faq.id;
    const { data, error } = await supabase.from('faqs').insert(faq).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/faqs/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('faq_items').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('faqs')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/faqs/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('faq_items').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('faqs').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// SOCIAL LINKS
// ============================================

router.get('/social', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('social_links')
        .eq('site_id', req.siteId)
        .single();

    res.json(data?.social_links || {});
});

router.put('/social', async (req, res) => {
    const { data, error } = await supabase
        .from('site_content')
        .update({ social_links: req.body, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('social_links')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.social_links);
});

// ============================================
// TEAM / STAFF
// ============================================

router.get('/team', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('staff').select('*').eq('entity_id', e).order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data } = await supabase.from('staff').select('*').eq('site_id', req.siteId).order('created_at', { ascending: true });
    res.json(data || []);
});

router.post('/team', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id;
        const { data, error } = await gcr().from('staff').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const member = { ...req.body, site_id: req.siteId };
    delete member.id;
    const { data, error } = await supabase.from('staff').insert(member).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/team/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('staff').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('staff').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/team/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('staff').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('staff').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// MENU ITEMS (restaurants, bakeries, retail)
// ============================================

// Admin (req.role === 'admin') → GCR DB. Everyone else (e.g. Circle Boats) → old DB.
router.get('/menu-items', async (req, res) => {
    if (req.role === 'admin') {
        const entityId = await requireEntity(req, res);
        if (!entityId) return;
        try { return res.json(await menuGcr.listAllMenuItems(entityId)); }
        catch (err) { return res.status(500).json({ error: err.message }); }
    }
    const { data, error } = await supabase
        .from('menu_items').select('*').eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/menu-items', async (req, res) => {
    if (req.role === 'admin') {
        const entityId = await requireEntity(req, res);
        if (!entityId) return;
        try { return res.status(201).json(await menuGcr.createMenuItem(entityId, req.body)); }
        catch (err) { return res.status(500).json({ error: err.message }); }
    }
    const siteId = req.siteId || req.body.site_id;
    if (!siteId) return res.status(400).json({ error: 'site_id required' });
    const item = { ...req.body, site_id: siteId };
    delete item.id;
    const { data, error } = await supabase.from('menu_items').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Write-through to GCR if a matching entity exists via legacy_site_id
    syncToGcr(siteId, 'menu_item', data).catch(() => {});

    res.status(201).json(data);
});

router.put('/menu-items/:id', async (req, res) => {
    if (req.role === 'admin') {
        const entityId = await requireEntity(req, res);
        if (!entityId) return;
        try { return res.json(await menuGcr.updateMenuItem(entityId, req.params.id, req.body)); }
        catch (err) { return res.status(500).json({ error: err.message }); }
    }
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase
        .from('menu_items').update(updates).eq('id', req.params.id).eq('site_id', req.siteId)
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/menu-items/:id', async (req, res) => {
    if (req.role === 'admin') {
        const entityId = await requireEntity(req, res);
        if (!entityId) return;
        try { await menuGcr.deleteMenuItem(entityId, req.params.id); return res.json({ success: true }); }
        catch (err) { return res.status(500).json({ error: err.message }); }
    }
    const { error } = await supabase
        .from('menu_items').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// MENU CATEGORIES (Breakfast, Lunch, Dinner, etc.)
// ============================================

router.get('/menu-categories', async (req, res) => {
    const { data, error } = await supabase
        .from('menu_categories')
        .select('*, menu_subcategories(id, name, sort_order, active)')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/menu-categories', async (req, res) => {
    const cat = { ...req.body, site_id: req.siteId };
    delete cat.id;
    delete cat.menu_subcategories;

    const { data, error } = await supabase
        .from('menu_categories')
        .insert(cat)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/menu-categories/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;
    delete updates.menu_subcategories;

    const { data, error } = await supabase
        .from('menu_categories')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/menu-categories/:id', async (req, res) => {
    const { error } = await supabase
        .from('menu_categories')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// MENU SUBCATEGORIES (Appetizers, Seafood, etc.)
// ============================================

router.get('/menu-subcategories', async (req, res) => {
    let query = supabase
        .from('menu_subcategories')
        .select('*, menu_categories(name)')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    if (req.query.category_id) query = query.eq('category_id', req.query.category_id);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/menu-subcategories', async (req, res) => {
    const sub = { ...req.body, site_id: req.siteId };
    delete sub.id;

    const { data, error } = await supabase
        .from('menu_subcategories')
        .insert(sub)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/menu-subcategories/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('menu_subcategories')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/menu-subcategories/:id', async (req, res) => {
    const { error } = await supabase
        .from('menu_subcategories')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// EVENTS
// ============================================

router.get('/events', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('entity_events').select('*').eq('entity_id', e).order('event_date', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data, error } = await supabase.from('events').select('*').eq('site_id', req.siteId).order('event_date', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/events', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id;
        const { data, error } = await gcr().from('entity_events').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const event = { ...req.body, site_id: req.siteId };
    delete event.id;
    const { data, error } = await supabase.from('events').insert(event).select().single();
    if (error) return res.status(500).json({ error: error.message });
    syncToGcr(req.siteId || req.body.site_id, 'event', data).catch(() => {});
    res.status(201).json(data);
});

router.put('/events/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('entity_events').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('events').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/events/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('entity_events').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('events').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// CUSTOM DOMAINS (dedicated domains table)
// ============================================

router.get('/domains', async (req, res) => {
    const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/domains', async (req, res) => {
    const crypto = require('crypto');
    const domain = {
        site_id: req.siteId,
        domain: req.body.domain,
        is_primary: req.body.is_primary || false,
        dns_type: req.body.dns_type || 'CNAME',
        dns_target: 'proxy.cybercheck.com',
        dns_verification_token: crypto.randomBytes(16).toString('hex')
    };

    const { data, error } = await supabase
        .from('domains')
        .insert(domain)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/domains/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;
    delete updates.dns_verification_token;

    const { data, error } = await supabase
        .from('domains')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/domains/:id', async (req, res) => {
    const { error } = await supabase
        .from('domains')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// FLEET TYPES (rental businesses)
// ============================================

router.get('/fleet', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('fleet_types').select('*, fleet_items(id, unit_name, serial_number, condition)').eq('entity_id', e).order('sort_order', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data } = await supabase.from('fleet_types').select('*, fleet_items(id, unit_name, serial_number, condition)').eq('site_id', req.siteId).order('sort_order', { ascending: true });
    res.json(data || []);
});

router.post('/fleet', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id; delete body.fleet_items;
        const { data, error } = await gcr().from('fleet_types').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const fleet = { ...req.body, site_id: req.siteId };
    delete fleet.id; delete fleet.fleet_items;
    const { data, error } = await supabase.from('fleet_types').insert(fleet).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/fleet/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        delete updates.id; delete updates.site_id; delete updates.entity_id; delete updates.fleet_items;
        const { data, error } = await gcr().from('fleet_types').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id; delete updates.id; delete updates.fleet_items;
    const { data, error } = await supabase.from('fleet_types').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/fleet/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('fleet_types').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('fleet_types').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// FLEET ITEMS (individual inventory units)
// ============================================

router.get('/fleet-items', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        let q = gcr().from('fleet_items').select('*, fleet_types(name)').eq('entity_id', e);
        if (req.query.fleet_type_id) q = q.eq('fleet_type_id', req.query.fleet_type_id);
        const { data, error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    let query = supabase.from('fleet_items').select('*, fleet_types(name)').eq('site_id', req.siteId);
    if (req.query.fleet_type_id) query = query.eq('fleet_type_id', req.query.fleet_type_id);
    const { data } = await query;
    res.json(data || []);
});

router.post('/fleet-items', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id;
        const { data, error } = await gcr().from('fleet_items').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const item = { ...req.body, site_id: req.siteId };
    delete item.id;
    const { data, error } = await supabase.from('fleet_items').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/fleet-items/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('fleet_items').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('fleet_items').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/fleet-items/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('fleet_items').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('fleet_items').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// RENTAL TIME SLOTS
// ============================================

router.get('/time-slots', async (req, res) => {
    const { data } = await supabase
        .from('rental_time_slots')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

router.post('/time-slots', async (req, res) => {
    const slot = { ...req.body, site_id: req.siteId };
    delete slot.id;

    const { data, error } = await supabase
        .from('rental_time_slots')
        .insert(slot)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/time-slots/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('rental_time_slots')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/time-slots/:id', async (req, res) => {
    const { error } = await supabase
        .from('rental_time_slots')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// RENTAL PRICING
// ============================================

router.get('/pricing', async (req, res) => {
    const { data } = await supabase
        .from('rental_pricing')
        .select('*, fleet_types(name), rental_time_slots(name)')
        .eq('site_id', req.siteId);

    res.json(data || []);
});

router.post('/pricing', async (req, res) => {
    const pricing = { ...req.body, site_id: req.siteId };
    delete pricing.id;

    const { data, error } = await supabase
        .from('rental_pricing')
        .upsert(pricing)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});


// PUT /api/dashboard/pricing/:id — update a pricing entry
router.put('/pricing/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('rental_pricing')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/pricing/:id', async (req, res) => {
    const { error } = await supabase
        .from('rental_pricing')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// PUT /api/dashboard/pricing — bulk update pricing for a fleet type
// Body: { fleet_type_id, prices: [{time_slot_id, price_per_unit, deposit_required, deposit_amount}] }
router.put('/pricing', async (req, res) => {
    const { fleet_type_id, prices } = req.body;
    if (!fleet_type_id || !Array.isArray(prices)) {
        return res.status(400).json({ error: 'fleet_type_id and prices[] required' });
    }

    const results = [];
    for (const p of prices) {
        const row = {
            site_id: req.siteId,
            fleet_type_id,
            time_slot_id: p.time_slot_id || null,
            price_per_unit: p.price_per_unit,
            deposit_required: p.deposit_required || false,
            deposit_amount: p.deposit_amount || 0
        };
        const { data, error } = await supabase
            .from('rental_pricing')
            .upsert(row, { onConflict: 'site_id,fleet_type_id,time_slot_id' })
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        results.push(data);
    }
    res.json(results);
});

// ============================================
// RENTAL ADD-ONS
// ============================================

router.get('/addons', async (req, res) => {
    const { data } = await supabase
        .from('rental_addons')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

router.post('/addons', async (req, res) => {
    const addon = { ...req.body, site_id: req.siteId };
    delete addon.id;

    const { data, error } = await supabase
        .from('rental_addons')
        .insert(addon)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// PUT /api/dashboard/addons/sync — replace all addons for this site in one call
// MUST be before /addons/:id so Express doesn't treat "sync" as an id
router.put('/addons/sync', async (req, res) => {
    const addons = req.body;
    if (!Array.isArray(addons)) return res.status(400).json({ error: 'Expected array' });

    await supabase.from('rental_addons').delete().eq('site_id', req.siteId);

    if (addons.length === 0) return res.json([]);

    const rows = addons.map((a, i) => ({
        site_id: req.siteId,
        name: a.name,
        description: a.description || '',
        price: a.price || 0,
        icon: a.icon || '🎁',
        per_unit: a.unit || '',
        image_url: a.image_url || a.image || null,
        available: true,
        sort_order: i
    }));

    // Bypass Supabase JS client (schema cache bug) — use REST API directly
    const insertRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rental_addons`, {
        method: 'POST',
        headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify(rows)
    });
    if (!insertRes.ok) {
        const err = await insertRes.json().catch(() => ({}));
        return res.status(500).json({ error: err.message || err.error || insertRes.status });
    }
    res.json({ success: true, count: rows.length });
});

router.put('/addons/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('rental_addons')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/addons/:id', async (req, res) => {
    const { error } = await supabase
        .from('rental_addons')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GROUP RATES
// ============================================

router.get('/group-rates', async (req, res) => {
    const { data } = await supabase
        .from('rental_group_rates')
        .select('*, fleet_types(name), rental_time_slots(name)')
        .eq('site_id', req.siteId);

    res.json(data || []);
});

router.post('/group-rates', async (req, res) => {
    const rate = { ...req.body, site_id: req.siteId };
    delete rate.id;

    const { data, error } = await supabase
        .from('rental_group_rates')
        .insert(rate)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.delete('/group-rates/:id', async (req, res) => {
    const { error } = await supabase
        .from('rental_group_rates')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// BOOKINGS
// ============================================

router.get('/bookings', async (req, res) => {
    let query = supabase
        .from('bookings')
        .select('*, fleet_types(name), rental_time_slots(name, start_time, end_time)')
        .eq('site_id', req.siteId)
        .order('booking_date', { ascending: true });

    // Hide payment-failed rows by default — surfaced separately via /declined-bookings.
    // Pass ?include_failed=1 to see everything.
    if (req.query.include_failed !== '1') {
        query = query.not('payment_status', 'eq', 'failed');
    }

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.date) query = query.eq('booking_date', req.query.date);
    if (req.query.from) query = query.gte('booking_date', req.query.from);
    if (req.query.to) query = query.lte('booking_date', req.query.to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json((data || []).map(flattenBooking));
});


// GET /api/dashboard/bookings/:id — single booking by ID
router.get('/bookings/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('bookings')
        .select('*, fleet_types(name), rental_time_slots(name, start_time, end_time)')
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .single();

    if (error) return res.status(404).json({ error: 'Booking not found' });
    res.json(flattenBooking(data));
});

async function sendBookingConfirmations(booking, siteId) {
    try {
        const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');

        const { data: settings } = await supabase
            .from('messaging_settings')
            .select('*')
            .eq('site_id', siteId)
            .maybeSingle();

        const prefs = { ...MESSAGING_DEFAULTS, ...(settings || {}) };
        const templateData = await buildTemplateData(booking, siteId);

        // Customer confirmation SMS
        if (prefs.booking_confirmation_sms && booking.customer_phone) {
            const msg = fillTemplate(prefs.booking_confirmation_template, templateData);
            sendSms(booking.customer_phone, msg, siteId, 'booking_confirmation', booking.id)
                .catch(e => console.warn('Booking confirm SMS failed:', e.message));
        }

        // Owner notification SMS — notification_phone from settings takes priority over owner_phone column
        if (prefs.owner_notification_sms) {
            const ownerPhone = settings?.notification_phone || settings?.owner_phone || null;
            if (ownerPhone) {
                const msg = fillTemplate(prefs.owner_notification_template, templateData);
                sendSms(ownerPhone, msg, siteId, 'booking_owner_notify', booking.id)
                    .catch(e => console.warn('Owner notify SMS failed:', e.message));
            }
        }
    } catch (e) {
        console.warn('sendBookingConfirmations error:', e.message);
    }
}

router.post('/bookings', async (req, res) => {
    const booking = { ...req.body, site_id: req.siteId };
    delete booking.id;

    // Use atomic function for fleet bookings to prevent overbooking
    if (booking.fleet_type_id && booking.time_slot_id && booking.booking_date) {
        const { data: result, error: rpcError } = await supabase.rpc('create_booking_if_available', {
            p_site_id: req.siteId,
            p_fleet_type_id: booking.fleet_type_id,
            p_time_slot_id: booking.time_slot_id,
            p_booking_date: booking.booking_date,
            p_qty: booking.qty || 1,
            p_service_id: booking.service_id || null,
            p_booking_time: booking.booking_time || null,
            p_party_size: booking.party_size || 1,
            p_addons: JSON.stringify(booking.addons || []),
            p_subtotal: booking.subtotal || 0,
            p_tax: booking.tax || 0,
            p_total: booking.total || 0,
            p_customer_id: booking.customer_id || null,
            p_customer_name: booking.customer_name || null,
            p_customer_phone: booking.customer_phone || null,
            p_customer_email: booking.customer_email || null,
            p_notes: booking.notes || null
        });

        if (rpcError) return res.status(500).json({ error: rpcError.message });
        if (!result.success) return res.status(409).json({ error: result.error, available: result.available });

        const { data: fullBooking } = await supabase
            .from('bookings')
            .select()
            .eq('id', result.booking_id)
            .single();

        sendBookingConfirmations(fullBooking, req.siteId); // fire and forget
        return res.status(201).json(fullBooking);
    }

    // Non-fleet booking — direct insert
    const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    sendBookingConfirmations(data, req.siteId); // fire and forget
    res.status(201).json(data);
});

router.put('/bookings/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    // Log status change to activity log
    if (updates.status && req.body.status !== undefined) {
        try {
            const oldStatus = (await supabase.from('bookings').select('status').eq('id', req.params.id).single()).data?.status;
            if (oldStatus && oldStatus !== updates.status) {
                await supabase.from('activity_log').insert({
                    site_id: req.siteId,
                    booking_id: req.params.id,
                    event_type: 'booking.updated',
                    details: { old_status: oldStatus, new_status: updates.status },
                    created_at: new Date().toISOString()
                }).catch(() => {});
            }
        } catch (e) {
            // Silently fail activity logging
        }
    }
    res.json(data);
});

router.delete('/bookings/:id', async (req, res) => {
    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// ORDERS
// ============================================

router.get('/orders', async (req, res) => {
    let query = supabase
        .from('orders')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false });

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.put('/orders/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// CUSTOMERS (CRM)
// ============================================

router.get('/customers', async (req, res) => {
    let query = supabase
        .from('customers')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false });

    if (req.query.search) {
        query = query.or(`name.ilike.%${req.query.search}%,email.ilike.%${req.query.search}%,phone.ilike.%${req.query.search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const customers = data || [];
    if (customers.length === 0) return res.json([]);

    // Fetch signed waivers + customer bookings to match by email or booking_id
    const [{ data: waivers }, { data: custBookings }] = await Promise.all([
        supabase.from('waivers').select('customer_email, signed_at, booking_id').eq('site_id', req.siteId).not('signed_at', 'is', null),
        supabase.from('bookings').select('id, customer_email').eq('site_id', req.siteId),
    ]);

    // Map booking_id -> customer_email from bookings table
    const bookingEmailMap = {};
    (custBookings || []).forEach(b => { if (b.id && b.customer_email) bookingEmailMap[b.id] = b.customer_email.toLowerCase(); });

    // Build set of signed emails (by direct email or via booking)
    const signedEmails = {};
    (waivers || []).forEach(w => {
        const email = (w.customer_email || bookingEmailMap[w.booking_id] || '').toLowerCase();
        if (email) signedEmails[email] = w.signed_at;
    });

    const result = customers.map(c => ({
        ...c,
        waiver_signed: !!(c.email && signedEmails[c.email.toLowerCase()]),
        waiver_signed_at: (c.email && signedEmails[c.email.toLowerCase()]) || null,
    }));

    res.json(result);
});

router.post('/customers', async (req, res) => {
    const customer = { ...req.body, site_id: req.siteId };
    delete customer.id;

    const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/customers/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/customers/:id', async (req, res) => {
    const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// REVIEWS
// ============================================

router.get('/reviews', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        let q = gcr().from('gcr_reviews').select('*').eq('entity_id', e).order('created_at', { ascending: false });
        if (req.query.status) q = q.eq('status', req.query.status);
        const { data, error } = await q;
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    let query = supabase.from('reviews').select('*').eq('site_id', req.siteId).order('created_at', { ascending: false });
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.put('/reviews/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('gcr_reviews').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('reviews').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/reviews/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('gcr_reviews').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GET /api/dashboard/reviews/pending
// Returns bookings that haven't had a review request sent yet
// ============================================
router.get('/reviews/pending', async (req, res) => {
    const { data, error } = await supabase
        .from('bookings')
        .select('id, customer_name, customer_phone, customer_email, booking_date, status, total')
        .eq('site_id', req.siteId)
        .in('status', ['confirmed', 'checked_in', 'completed'])
        .not('id', 'in', supabase.from('reviews').select('booking_id').eq('site_id', req.siteId).not('booking_id', 'is', null));

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ============================================
// POST /api/dashboard/reviews/send-request
// Send a review request SMS/email to a customer after their booking
// ============================================
router.post('/reviews/send-request', async (req, res) => {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id required' });

    const { sendSms } = require('../utils/sms');
    const crypto = require('crypto');

    const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .select('id, customer_name, customer_phone, customer_email')
        .eq('id', booking_id)
        .eq('site_id', req.siteId)
        .single();

    if (bookingErr || !booking) return res.status(404).json({ error: 'Booking not found' });

    // Check if review request already sent
    const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', booking_id)
        .eq('site_id', req.siteId)
        .single();

    if (existing) return res.status(409).json({ error: 'Review request already sent for this booking' });

    const token = crypto.randomBytes(24).toString('hex');

    const { data: biz } = await supabase
        .from('businesses')
        .select('subdomain, name')
        .eq('site_id', req.siteId)
        .single();

    const baseUrl = process.env.PUBLIC_SITE_BASE_URL || ('https://' + (biz?.subdomain || 'site') + '.cybercheck.com');
    const reviewLink = `${baseUrl}/review?token=${token}`;

    await supabase.from('reviews').insert({
        site_id: req.siteId,
        booking_id,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        phone: booking.customer_phone,
        review_token: token,
        token_used: false,
        status: 'pending'
    });

    let sms_sent = false;
    if (booking.customer_phone) {
        const name = booking.customer_name ? `, ${booking.customer_name.split(' ')[0]}` : '';
        await sendSms(
            booking.customer_phone,
            `Hi${name}! Thanks for visiting ${biz?.name || 'us'}. We'd love your feedback: ${reviewLink}`,
            req.siteId,
            'review_request',
            booking_id
        ).catch(e => console.warn('Review SMS failed:', e.message));
        sms_sent = true;
    }

    res.json({ success: true, review_link: reviewLink, sms_sent });
});

// ============================================
// REVIEW QUESTIONS — Custom per-business questions
// ============================================

// GET /api/dashboard/review-questions — Get all custom questions for business
router.get('/review-questions', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('review_questions').select('*').eq('entity_id', e).order('display_order', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data } = await supabase.from('review_questions').select('*').eq('site_id', req.siteId).order('display_order', { ascending: true });
    res.json(data || []);
});

router.post('/review-questions', async (req, res) => {
    const { question_text, question_type, display_order } = req.body;
    if (!question_text || !question_type) return res.status(400).json({ error: 'question_text and question_type required' });
    if (!['stars', 'yesno', 'text', 'rating'].includes(question_type)) return res.status(400).json({ error: 'Invalid question_type' });

    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('review_questions').insert({
            entity_id: e, question_text, question_type,
            display_order: display_order || 0, enabled: true
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const { data, error } = await supabase.from('review_questions').insert({
        site_id: req.siteId, question_text, question_type,
        display_order: display_order || 0, enabled: true
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/review-questions/:id', async (req, res) => {
    const { question_text, question_type, display_order, enabled } = req.body;
    const payload = { question_text, question_type, display_order, enabled, updated_at: new Date().toISOString() };
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('review_questions').update(payload).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const { data, error } = await supabase.from('review_questions').update(payload).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/review-questions/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('review_questions').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('review_questions').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// WAIVERS
// ============================================

router.get('/waivers', async (req, res) => {
    const { data } = await supabase
        .from('waivers')
        .select('*')
        .eq('site_id', req.siteId)
        .order('signed_at', { ascending: false });

    res.json(data || []);
});

// GET /api/dashboard/waivers/template — get the waiver template
router.get('/waivers/template', async (req, res) => {
    const { data } = await supabase
        .from('waivers')
        .select('*')
        .eq('site_id', req.siteId)
        .is('booking_id', null)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) return res.status(404).json({ error: 'No waiver template found' });
    res.json(data);
});

// PUT /api/dashboard/waivers/template — create or replace the waiver template text
router.put('/waivers/template', async (req, res) => {
    const { waiver_text, title } = req.body;
    if (!waiver_text) return res.status(400).json({ error: 'waiver_text required' });

    // Fetch existing template row (booking_id IS NULL = master template)
    const { data: existing } = await supabase
        .from('waivers')
        .select('id')
        .eq('site_id', req.siteId)
        .is('booking_id', null)
        .limit(1)
        .single();

    if (existing) {
        const { data, error } = await supabase
            .from('waivers')
            .update({ waiver_text, customer_name: title || null })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    const { data, error } = await supabase
        .from('waivers')
        .insert({ site_id: req.siteId, waiver_text, customer_name: title || null })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// GET /api/dashboard/waivers/booking/:booking_id — get signed waiver for a booking
router.get('/waivers/booking/:booking_id', async (req, res) => {
    const { data } = await supabase
        .from('waivers')
        .select('*')
        .eq('site_id', req.siteId)
        .eq('booking_id', req.params.booking_id)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) return res.status(404).json({ error: 'No waiver found for this booking' });
    res.json(data);
});

// POST /api/dashboard/waivers/link — generate a signed waiver link for a booking
// GET /api/dashboard/waivers/link — get waiver link for a booking (query: ?booking_id=)
async function generateWaiverLink(siteId, booking_id) {
    const crypto = require('crypto');
    const { sendSms } = require('../utils/sms');
    const token = crypto.randomBytes(24).toString('hex');

    const { data: booking } = await supabase
        .from('bookings')
        .select('id, customer_name, customer_phone')
        .eq('id', booking_id)
        .eq('site_id', siteId)
        .single();

    if (!booking) return { error: 'Booking not found' };

    await supabase.from('waivers').upsert({
        site_id: siteId,
        booking_id,
        customer_name: booking.customer_name || null,
        token,
        signed: false
    }, { onConflict: 'booking_id' }).catch(() => {});

    const { data: biz } = await supabase
        .from('businesses')
        .select('subdomain')
        .eq('site_id', siteId)
        .single();

    const baseUrl = process.env.PUBLIC_SITE_BASE_URL || ('https://' + (biz?.subdomain || 'site') + '.cybercheck.com');
    const link = baseUrl + '/waiver?token=' + token + '&booking=' + booking_id;

    // Send SMS to customer — fire and forget, don't block the response
    if (booking.customer_phone) {
        const name = booking.customer_name ? `, ${booking.customer_name.split(' ')[0]}` : '';
        sendSms(
            booking.customer_phone,
            `Hi${name}! Please sign your waiver before your rental: ${link}`,
            siteId,
            'waiver_link',
            booking_id
        ).catch(e => console.warn('Waiver SMS failed:', e.message));
    }

    return { link, token, booking_id, sms_sent: !!booking.customer_phone };
}

router.get('/waivers/link', async (req, res) => {
    const { booking_id } = req.query;
    if (!booking_id) return res.status(400).json({ error: 'booking_id query parameter required' });
    const result = await generateWaiverLink(req.siteId, booking_id);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
});

router.post('/waivers/link', async (req, res) => {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id required' });
    const result = await generateWaiverLink(req.siteId, booking_id);
    if (result.error) return res.status(404).json({ error: result.error });
    res.json(result);
});


// ============================================
// COUPONS
// ============================================

router.get('/coupons', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('coupons').select('*').eq('entity_id', e).order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data } = await supabase.from('coupons').select('*').eq('site_id', req.siteId).order('created_at', { ascending: false });
    res.json(data || []);
});

router.post('/coupons', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id;
        const { data, error } = await gcr().from('coupons').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const coupon = { ...req.body, site_id: req.siteId };
    delete coupon.id;
    const { data, error } = await supabase.from('coupons').insert(coupon).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/coupons/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('coupons').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('coupons').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/coupons/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('coupons').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('coupons').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// SPECIALS
// ============================================

router.get('/specials', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { data, error } = await gcr().from('entity_specials').select('*').eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data || []);
    }
    const { data } = await supabase.from('specials').select('*').eq('site_id', req.siteId);
    res.json(data || []);
});

router.post('/specials', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const body = { ...req.body, entity_id: e };
        delete body.id; delete body.site_id;
        const { data, error } = await gcr().from('entity_specials').insert(body).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }
    const special = { ...req.body, site_id: req.siteId };
    delete special.id;
    const { data, error } = await supabase.from('specials').insert(special).select().single();
    if (error) return res.status(500).json({ error: error.message });
    syncToGcr(req.siteId || req.body.site_id, 'special', data).catch(() => {});
    res.status(201).json(data);
});

router.put('/specials/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const updates = { ...req.body };
        delete updates.id; delete updates.site_id; delete updates.entity_id;
        const { data, error } = await gcr().from('entity_specials').update(updates).eq('id', req.params.id).eq('entity_id', e).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }
    const updates = { ...req.body };
    delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('specials').update(updates).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/specials/:id', async (req, res) => {
    if (req.role === 'admin') {
        const e = await requireEntity(req, res); if (!e) return;
        const { error } = await gcr().from('entity_specials').delete().eq('id', req.params.id).eq('entity_id', e);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }
    const { error } = await supabase.from('specials').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// GET /api/dashboard/qr-theme
router.get('/qr-theme', authRequired, async (req, res) => {
    const siteId = (req.role === 'admin' && req.query.site_id) ? req.query.site_id : req.siteId;
    const { data, error } = await supabase.from('businesses').select('metadata').eq('site_id', siteId).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    const theme = (data?.metadata?.qr_theme) || {};
    res.json(theme);
});

// PUT /api/dashboard/qr-theme
router.put('/qr-theme', authRequired, async (req, res) => {
    const siteId = (req.role === 'admin' && req.body.site_id) ? req.body.site_id : req.siteId;
    const theme = req.body.theme || {};
    // Get existing metadata first
    const { data: existing } = await supabase.from('businesses').select('metadata').eq('site_id', siteId).maybeSingle();
    const metadata = { ...(existing?.metadata || {}), qr_theme: theme };
    const { error } = await supabase.from('businesses').update({ metadata }).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, theme });
});

// ============================================
// CONNECTIONS (OAuth providers)
// ============================================

router.get('/connections', async (req, res) => {
    const { data } = await supabase
        .from('connections')
        .select('id, provider, account_name, status, connected_at')
        .eq('site_id', req.siteId);

    res.json(data || []);
});

router.delete('/connections/:id', async (req, res) => {
    const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// SITE PAGES
// ============================================

router.get('/pages', async (req, res) => {
    const { data } = await supabase
        .from('site_pages')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

router.post('/pages', async (req, res) => {
    const page = { ...req.body, site_id: req.siteId };
    delete page.id;

    const { data, error } = await supabase
        .from('site_pages')
        .insert(page)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/pages/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('site_pages')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/pages/:id', async (req, res) => {
    const { error } = await supabase
        .from('site_pages')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// THEME
// ============================================

router.get('/theme', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('theme_color, theme_font, custom_css')
        .eq('site_id', req.siteId)
        .single();

    res.json(data || {});
});

router.put('/theme', async (req, res) => {
    const { theme_color, theme_font, custom_css } = req.body;

    const { data, error } = await supabase
        .from('site_content')
        .update({ theme_color, theme_font, custom_css, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('theme_color, theme_font, custom_css')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// SEO
// ============================================

router.get('/seo', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('seo_title, seo_description')
        .eq('site_id', req.siteId)
        .single();

    res.json(data || {});
});

router.put('/seo', async (req, res) => {
    const { seo_title, seo_description } = req.body;

    const { data, error } = await supabase
        .from('site_content')
        .update({ seo_title, seo_description, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('seo_title, seo_description')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// DOMAIN
// ============================================

router.get('/domain', async (req, res) => {
    const { data } = await supabase
        .from('businesses')
        .select('domain, subdomain')
        .eq('site_id', req.siteId)
        .single();

    res.json(data || {});
});

router.put('/domain', async (req, res) => {
    const { domain } = req.body;

    // Check domain not already taken
    if (domain) {
        const { data: existing } = await supabase
            .from('businesses')
            .select('site_id')
            .eq('domain', domain)
            .neq('site_id', req.siteId)
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Domain already in use' });
        }
    }

    const { data, error } = await supabase
        .from('businesses')
        .update({ domain, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('domain, subdomain')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Add domain to Caddy via API
    res.json(data);
});

// ============================================
// BILLING
// ============================================

router.get('/billing', async (req, res) => {
    const { data: business } = await supabase
        .from('businesses')
        .select('plan, status')
        .eq('site_id', req.siteId)
        .single();

    const { data: apps } = await supabase
        .from('site_apps')
        .select('app_id, apps(name, monthly_price)')
        .eq('site_id', req.siteId)
        .eq('enabled', true);

    const appsCost = (apps || []).reduce((sum, a) => sum + (a.apps?.monthly_price || 0), 0);

    res.json({
        plan: business?.plan || 'free',
        status: business?.status,
        installed_apps: apps || [],
        monthly_apps_cost: appsCost
    });
});

// ============================================
// APPS (browse + install)
// ============================================

router.get('/apps', async (req, res) => {
    // Get all available apps
    const { data: allApps } = await supabase
        .from('apps')
        .select('*')
        .eq('status', 'active');

    // Get installed apps
    const { data: installed } = await supabase
        .from('site_apps')
        .select('app_id, enabled')
        .eq('site_id', req.siteId);

    const installedMap = {};
    (installed || []).forEach(a => { installedMap[a.app_id] = a.enabled; });

    const apps = (allApps || []).map(app => ({
        ...app,
        installed: app.app_id in installedMap,
        enabled: installedMap[app.app_id] || false
    }));

    res.json(apps);
});

router.post('/apps/install', async (req, res) => {
    const { app_id } = req.body;

    const { data, error } = await supabase
        .from('site_apps')
        .upsert({ site_id: req.siteId, app_id, enabled: true })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/apps/uninstall', async (req, res) => {
    const { app_id } = req.body;

    const { error } = await supabase
        .from('site_apps')
        .update({ enabled: false })
        .eq('site_id', req.siteId)
        .eq('app_id', app_id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// NOTIFICATIONS
// ============================================

router.get('/notifications', async (req, res) => {
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false })
        .limit(50);

    res.json(data || []);
});

router.put('/notifications/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.put('/notifications/read-all', async (req, res) => {
    await supabase
        .from('notifications')
        .update({ read: true })
        .eq('site_id', req.siteId)
        .eq('read', false);

    res.json({ success: true });
});

// ============================================
// SMS LOG
// ============================================

router.get('/sms-log', async (req, res) => {
    const { data } = await supabase
        .from('sms_log')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false })
        .limit(100);

    res.json(data || []);
});

// ============================================
// AVAILABILITY
// ============================================

router.get('/availability', async (req, res) => {
    const { data } = await supabase
        .from('availability')
        .select('*')
        .eq('site_id', req.siteId);

    res.json(data || []);
});

router.post('/availability', async (req, res) => {
    const avail = { ...req.body, site_id: req.siteId };
    delete avail.id;

    const { data, error } = await supabase
        .from('availability')
        .insert(avail)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/availability/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('availability')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/availability/:id', async (req, res) => {
    const { error } = await supabase
        .from('availability')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// ACTIVITY LOG
// ============================================

router.get('/activity', async (req, res) => {
    const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false })
        .limit(100);

    // If activity_log has entries, return them
    if (data && data.length > 0) return res.json(data);

    // Fallback: synthesize activity from recent bookings + customers
    const [{ data: recentBookings }, { data: recentCustomers }] = await Promise.all([
        supabase.from('bookings').select('id, customer_name, status, created_at, total')
            .eq('site_id', req.siteId).order('created_at', { ascending: false }).limit(30),
        supabase.from('customers').select('id, name, email, created_at')
            .eq('site_id', req.siteId).order('created_at', { ascending: false }).limit(20)
    ]);

    const synthetic = [];
    for (const b of recentBookings || []) {
        synthetic.push({
            id: b.id,
            action: 'booking.created',
            entity_type: 'booking',
            entity_id: b.id,
            details: { customer_name: b.customer_name, status: b.status, total: b.total },
            created_at: b.created_at
        });
    }
    for (const c of recentCustomers || []) {
        synthetic.push({
            id: c.id,
            action: 'customer.created',
            entity_type: 'customer',
            entity_id: c.id,
            details: { name: c.name, email: c.email },
            created_at: c.created_at
        });
    }

    synthetic.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(synthetic.slice(0, 100));
});

// ============================================
// DATA EXPORT
// ============================================

router.post('/export/:type', async (req, res) => {
    const { type } = req.params;
    const validTypes = ['customers', 'bookings', 'reviews', 'services', 'menu-items', 'orders'];

    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid export type' });
    }

    const table = type === 'menu-items' ? 'menu_items' : type;

    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ data: data || [], type, exported_at: new Date().toISOString() });
});

// ============================================
// PUBLISH (trigger site rebuild)
// ============================================

router.post('/publish', async (req, res) => {
    // TODO: Trigger site rebuild worker
    // For now, just mark the site as published
    await supabase
        .from('businesses')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId);

    res.json({
        success: true,
        message: 'Site published',
        published_at: new Date().toISOString()
    });
});

// ============================================
// MESSAGING SETTINGS
// ============================================

const MESSAGING_DEFAULTS = {
    booking_confirmation_sms: true,
    booking_confirmation_template: 'Hi {{customer_name}}, your booking at {{business_name}} on {{date}} ({{time_slot}}) is confirmed! Total: ${{total}}. Questions? Reply to this message.',
    owner_notification_sms: true,
    owner_notification_template: 'New booking: {{customer_name}} on {{date}} ({{time_slot}}), {{boat_count}} {{boat_type}}. Total: ${{total}}. Phone: {{customer_phone}}.',
    cancellation_sms: false,
    cancellation_template: 'Hi {{customer_name}}, your booking at {{business_name}} on {{date}} has been cancelled. Contact us with any questions.',
    loyalty_enabled: false,
    loyalty_points_per_dollar: 1,
    loyalty_points_per_booking: 0,
    loyalty_redemption_threshold: 100,
    loyalty_reward_value: 10,
    notification_email: null,
    notification_email_2: null
};

router.get('/messaging-settings', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('messaging_settings')
        .eq('site_id', req.siteId)
        .single();

    const settings = data?.messaging_settings || {};
    // Return defaults merged with any saved settings so it's never empty
    res.json({ ...MESSAGING_DEFAULTS, ...settings });
});

router.put('/messaging-settings', async (req, res) => {
    const settings = req.body;

    const { data, error } = await supabase
        .from('site_content')
        .update({ messaging_settings: settings, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('messaging_settings')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.messaging_settings);
});

// ============================================
// SMS CAMPAIGNS
// ============================================

router.post('/sms/campaign', async (req, res) => {
    const { audience, message, coupon_code } = req.body;

    if (!message) return res.status(400).json({ error: 'Message required' });

    const { sendSms, fillTemplate } = require('../utils/sms');

    // Get customers with phone numbers, filtered by audience
    let query = supabase
        .from('customers')
        .select('id, name, phone, total_bookings')
        .eq('site_id', req.siteId)
        .not('phone', 'is', null);

    if (audience === 'vip') {
        query = query.gte('total_bookings', 3);
    } else if (audience === 'inactive') {
        query = query.eq('total_bookings', 0);
    }

    const { data: customers } = await query;
    if (!customers || customers.length === 0) {
        return res.status(400).json({ error: 'No customers with phone numbers found' });
    }

    // Check opt-outs
    const phones = customers.map(c => c.phone);
    const { data: optOuts } = await supabase
        .from('sms_opt_outs')
        .select('phone')
        .in('phone', phones);

    const optOutSet = new Set((optOuts || []).map(o => o.phone));

    // Get business name for template
    const { data: biz } = await supabase
        .from('businesses')
        .select('name')
        .eq('site_id', req.siteId)
        .single();
    const businessName = biz?.name || '';

    // Create campaign record
    const { data: campaign } = await supabase
        .from('sms_campaigns')
        .insert({
            site_id: req.siteId,
            audience,
            message,
            coupon_code,
            recipient_count: customers.length,
            status: 'sending'
        })
        .select()
        .single();

    // Send in background (don't block the response)
    let sentCount = 0;
    let failedCount = 0;

    const sendAll = async () => {
        for (const customer of customers) {
            if (optOutSet.has(customer.phone)) { failedCount++; continue; }

            let finalMsg = '[' + businessName + '] ' + fillTemplate(message, { customer_name: customer.name || 'there' });
            if (coupon_code) finalMsg += '\n\nUse code ' + coupon_code + ' at checkout!';
            finalMsg += '\n\nReply STOP to unsubscribe.';

            const result = await sendSms(customer.phone, finalMsg, req.siteId, 'campaign', campaign.id);
            if (result.success) sentCount++; else failedCount++;
        }

        await supabase
            .from('sms_campaigns')
            .update({ sent_count: sentCount, failed_count: failedCount, status: 'completed' })
            .eq('id', campaign.id);
    };

    sendAll().catch(err => console.error('Campaign send error:', err));

    res.json({
        success: true,
        campaign_id: campaign.id,
        recipient_count: customers.length
    });
});

router.get('/sms/campaigns', async (req, res) => {
    const { data } = await supabase
        .from('sms_campaigns')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false })
        .limit(50);

    res.json(data || []);
});



// ============================================
// LOYALTY REWARDS (dashboard management)
// ============================================

// GET /api/dashboard/loyalty/settings
router.get('/loyalty/settings', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('messaging_settings')
        .eq('site_id', req.siteId)
        .single();

    const settings = data?.messaging_settings || {};
    res.json({
        enabled: settings.loyalty_enabled || false,
        points_per_dollar: settings.loyalty_points_per_dollar || 1,
        points_per_booking: settings.loyalty_points_per_booking || 0,
        redemption_threshold: settings.loyalty_redemption_threshold || 100,
        reward_value: settings.loyalty_reward_value || 10
    });
});

// PUT /api/dashboard/loyalty/settings
router.put('/loyalty/settings', async (req, res) => {
    const { data: existing } = await supabase
        .from('site_content')
        .select('messaging_settings')
        .eq('site_id', req.siteId)
        .single();

    const current = existing?.messaging_settings || {};
    const updated = {
        ...current,
        loyalty_enabled: req.body.enabled !== undefined ? req.body.enabled : (current.loyalty_enabled || false),
        loyalty_points_per_dollar: req.body.points_per_dollar || current.loyalty_points_per_dollar || 1,
        loyalty_points_per_booking: req.body.points_per_booking || current.loyalty_points_per_booking || 0,
        loyalty_redemption_threshold: req.body.redemption_threshold || current.loyalty_redemption_threshold || 100,
        loyalty_reward_value: req.body.reward_value || current.loyalty_reward_value || 10
    };

    const { error } = await supabase
        .from('site_content')
        .update({ messaging_settings: updated, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json(updated);
});

// GET /api/dashboard/loyalty/members
router.get('/loyalty/members', async (req, res) => {
    const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, total_bookings, total_spent, tags, created_at')
        .eq('site_id', req.siteId)
        .order('total_spent', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const members = (data || []).map(c => ({
        ...c,
        points: Math.floor(c.total_spent || 0)
    }));

    res.json(members);
});

// GET /api/dashboard/loyalty/summary-preview
router.get('/loyalty/summary-preview', async (req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: customers } = await supabase
        .from('customers')
        .select('id, total_spent, total_bookings')
        .eq('site_id', req.siteId);

    const { data: recentBookings } = await supabase
        .from('bookings')
        .select('id, total, status')
        .eq('site_id', req.siteId)
        .gte('created_at', weekAgo);

    const totalMembers = (customers || []).length;
    const totalPoints = (customers || []).reduce((sum, c) => sum + Math.floor(c.total_spent || 0), 0);
    const weeklyBookings = (recentBookings || []).length;
    const weeklyRevenue = (recentBookings || []).reduce((sum, b) => sum + (b.total || 0), 0);

    res.json({
        total_members: totalMembers,
        total_points_outstanding: totalPoints,
        weekly_bookings: weeklyBookings,
        weekly_revenue: weeklyRevenue,
        generated_at: new Date().toISOString()
    });
});

// POST /api/dashboard/loyalty/earn — add points to a customer after a booking
// Body: { customer_id, booking_id, amount, booking_total }
router.post('/loyalty/earn', async (req, res) => {
    const { customer_id, booking_id, booking_total } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

    // Get loyalty settings
    const { data: content } = await supabase
        .from('site_content')
        .select('messaging_settings')
        .eq('site_id', req.siteId)
        .single();

    const settings = content?.messaging_settings || {};
    if (!settings.loyalty_enabled) {
        return res.status(400).json({ error: 'Loyalty program is not enabled' });
    }

    const ptsPerDollar = settings.loyalty_points_per_dollar || 1;
    const ptsPerBooking = settings.loyalty_points_per_booking || 0;
    const earned = Math.floor((booking_total || 0) * ptsPerDollar) + ptsPerBooking;

    // Log to activity_log so history endpoint can read it
    await supabase.from('activity_log').insert({
        site_id: req.siteId,
        action: 'loyalty.earned',
        entity_type: 'customer',
        entity_id: customer_id,
        details: { points_earned: earned, booking_id: booking_id || null, booking_total }
    }).catch(() => {});

    // Update customer's total_spent so points reflect correctly
    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, total_spent')
        .eq('id', customer_id)
        .eq('site_id', req.siteId)
        .single();

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const newPoints = Math.floor((customer.total_spent || 0) * ptsPerDollar) + ptsPerBooking;

    res.json({
        success: true,
        customer_id,
        points_earned: earned,
        total_points: newPoints
    });
});

// GET /api/dashboard/loyalty/history/:customer_id — points history for a customer
router.get('/loyalty/history/:customer_id', async (req, res) => {
    const [{ data: logs }, { data: customer }] = await Promise.all([
        supabase.from('activity_log')
            .select('*')
            .eq('site_id', req.siteId)
            .eq('entity_id', req.params.customer_id)
            .in('action', ['loyalty.earned', 'loyalty.redeemed'])
            .order('created_at', { ascending: false })
            .limit(100),
        supabase.from('customers')
            .select('id, name, email, total_spent, total_bookings')
            .eq('id', req.params.customer_id)
            .eq('site_id', req.siteId)
            .single()
    ]);

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    // If no activity log entries, synthesize from bookings
    let history = logs || [];
    if (history.length === 0) {
        const { data: bookings } = await supabase
            .from('bookings')
            .select('id, total, booking_date, created_at, status')
            .eq('site_id', req.siteId)
            .eq('customer_id', req.params.customer_id)
            .order('created_at', { ascending: false })
            .limit(50);

        history = (bookings || []).map(b => ({
            action: 'loyalty.earned',
            details: { points_earned: Math.floor(b.total || 0), booking_id: b.id, booking_total: b.total },
            created_at: b.created_at
        }));
    }

    res.json({
        customer_id: req.params.customer_id,
        customer_name: customer.name,
        total_points: Math.floor(customer.total_spent || 0),
        history
    });
});

// ============================================
// STRIPE STATUS (dashboard check)
// ============================================

// GET /api/dashboard/stripe-status
router.get('/stripe-status', async (req, res) => {
    const [{ data: connectData }, { data: keyData }] = await Promise.all([
        supabase.from('connections').select('account_id, account_name, status, connected_at')
            .eq('site_id', req.siteId).eq('provider', 'stripe').single(),
        supabase.from('connections').select('status, connected_at')
            .eq('site_id', req.siteId).eq('provider', 'stripe_key').single()
    ]);

    res.json({
        connected: !!(connectData && connectData.status === 'connected'),
        accountId: connectData?.account_id || null,
        connectedAt: connectData?.connected_at || null,
        manualKey: !!(keyData && keyData.status === 'connected'),
        manualKeyAt: keyData?.connected_at || null,
        platform_key_configured: !!process.env.STRIPE_SECRET_KEY
    });
});

// ============================================
// GET /api/dashboard/calendar?month=YYYY-MM
// ============================================
router.get('/calendar', async (req, res) => {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query parameter required (YYYY-MM)' });

    const start = `${month}-01`;
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0)
        .toISOString().split('T')[0];

    const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, booking_date, status, total, qty, customer_name, fleet_types(name)')
        .eq('site_id', req.siteId)
        .gte('booking_date', start)
        .lte('booking_date', end)
        .not('status', 'eq', 'cancelled')
        .not('status', 'eq', 'refunded')
        .order('booking_date');

    if (error) return res.status(500).json({ error: error.message });

    // Group by date
    const byDate = {};
    (bookings || []).forEach(b => {
        const d = b.booking_date;
        if (!byDate[d]) byDate[d] = { date: d, bookings: [], count: 0, revenue: 0 };
        byDate[d].bookings.push({
            id: b.id,
            customer_name: b.customer_name,
            status: b.status,
            total: b.total,
            qty: b.qty,
            fleet_type_name: b.fleet_types?.name || null
        });
        byDate[d].count++;
        byDate[d].revenue += b.total || 0;
    });

    res.json({ month, days: Object.values(byDate) });
});

// ============================================
// GET /api/dashboard/analytics?range=30
// ============================================
router.get('/analytics', async (req, res) => {
    const days = parseInt(req.query.range) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [bookingsRes, revenueRes, customersRes] = await Promise.all([
        supabase.from('bookings').select('id, booking_date, total, status, fleet_type_id, fleet_types(name)')
            .eq('site_id', req.siteId)
            .gte('booking_date', since)
            .not('status', 'eq', 'cancelled')
            .not('status', 'eq', 'refunded'),
        supabase.from('bookings').select('booking_date, total')
            .eq('site_id', req.siteId)
            .eq('payment_status', 'paid')
            .gte('booking_date', since),
        supabase.from('customers').select('id, created_at')
            .eq('site_id', req.siteId)
            .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    ]);

    const bookings = bookingsRes.data || [];
    const paid = revenueRes.data || [];

    // Revenue by date
    const revenueByDate = {};
    paid.forEach(b => {
        revenueByDate[b.booking_date] = (revenueByDate[b.booking_date] || 0) + (b.total || 0);
    });

    // Bookings by fleet type
    const byFleet = {};
    bookings.forEach(b => {
        const name = b.fleet_types?.name || 'Unknown';
        byFleet[name] = (byFleet[name] || 0) + 1;
    });

    res.json({
        range_days: days,
        since,
        total_bookings: bookings.length,
        total_revenue: paid.reduce((s, b) => s + (b.total || 0), 0),
        new_customers: (customersRes.data || []).length,
        revenue_by_date: Object.entries(revenueByDate).map(([date, revenue]) => ({ date, revenue })),
        bookings_by_fleet: Object.entries(byFleet).map(([name, count]) => ({ name, count }))
    });
});

// ============================================
// GET /api/dashboard/media
// POST /api/dashboard/media
// DELETE /api/dashboard/media/:id
// ============================================
router.get('/media', async (req, res) => {
    const { data, error } = await supabase
        .from('media_library')
        .select('id, url, caption, type, sort_order, created_at')
        .eq('site_id', req.siteId)
        .order('sort_order')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/media', async (req, res) => {
    const { url, caption, type } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    const { data: existing } = await supabase
        .from('media_library')
        .select('sort_order')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

    const sort_order = (existing?.sort_order || 0) + 1;

    const { data, error } = await supabase
        .from('media_library')
        .insert({ site_id: req.siteId, url, caption: caption || '', type: type || 'image', sort_order })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.delete('/media/:id', async (req, res) => {
    const { error } = await supabase
        .from('media_library')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// AVAILABILITY / BLOCK DATES
// ============================================

// GET /api/dashboard/availability/blocks?month=YYYY-MM
router.get('/availability/blocks', async (req, res) => {
    let query = supabase
        .from('availability_blocks')
        .select('*')
        .eq('site_id', req.siteId)
        .order('block_date');

    if (req.query.month) {
        const [year, month] = req.query.month.split('-');
        const start = `${year}-${month}-01`;
        const end = new Date(year, month, 0).toISOString().split('T')[0];
        query = query.gte('block_date', start).lte('block_date', end);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// POST /api/dashboard/availability/block
router.post('/availability/block', async (req, res) => {
    const { block_date, start_time, end_time, fleet_type_id, reason } = req.body;
    if (!block_date) return res.status(400).json({ error: 'block_date required' });

    const { data, error } = await supabase
        .from('availability_blocks')
        .insert({
            site_id: req.siteId,
            block_date,
            start_time: start_time || null,
            end_time: end_time || null,
            fleet_type_id: fleet_type_id || null,
            reason: reason || null
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// DELETE /api/dashboard/availability/block/:id
router.delete('/availability/block/:id', async (req, res) => {
    const { error } = await supabase
        .from('availability_blocks')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// DELETE /api/dashboard/availability/block?date=YYYY-MM-DD (clear all blocks for a date)
router.delete('/availability/blocks', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query parameter required' });

    const { error } = await supabase
        .from('availability_blocks')
        .delete()
        .eq('site_id', req.siteId)
        .eq('block_date', date);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// AI TRAINING — business_details, logistics, atmosphere, qa_pairs
// ============================================

// GET all AI profile data in one call
router.get('/ai-profile', async (req, res) => {
    const [details, logistics, atmosphere] = await Promise.all([
        supabase.from('business_details').select('*').eq('site_id', req.siteId).maybeSingle(),
        supabase.from('business_logistics').select('*').eq('site_id', req.siteId).maybeSingle(),
        supabase.from('business_atmosphere').select('*').eq('site_id', req.siteId).maybeSingle(),
    ]);
    res.json({
        details: details.data || {},
        logistics: logistics.data || {},
        atmosphere: atmosphere.data || {},
    });
});

// PUT (upsert) all AI profile data
router.put('/ai-profile', async (req, res) => {
    const { details, logistics, atmosphere } = req.body;
    const siteId = req.siteId;
    const ops = [];
    if (details !== undefined) ops.push(supabase.from('business_details').upsert({ ...details, site_id: siteId }, { onConflict: 'site_id' }));
    if (logistics !== undefined) ops.push(supabase.from('business_logistics').upsert({ ...logistics, site_id: siteId }, { onConflict: 'site_id' }));
    if (atmosphere !== undefined) ops.push(supabase.from('business_atmosphere').upsert({ ...atmosphere, site_id: siteId }, { onConflict: 'site_id' }));
    const results = await Promise.all(ops);
    const err = results.find(r => r.error);
    if (err) return res.status(500).json({ error: err.error.message });
    res.json({ success: true });
});

// GET all Q&A pairs
router.get('/qa-pairs', async (req, res) => {
    const { data, error } = await supabase
        .from('qa_pairs').select('*').eq('site_id', req.siteId).order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// POST create Q&A pair
router.post('/qa-pairs', async (req, res) => {
    const { question, answer, category } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
    const { data, error } = await supabase
        .from('qa_pairs').insert({ site_id: req.siteId, question, answer, category: category || 'general' }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// PUT update Q&A pair
router.put('/qa-pairs/:id', async (req, res) => {
    const { question, answer, category } = req.body;
    const { data, error } = await supabase
        .from('qa_pairs').update({ question, answer, category }).eq('id', req.params.id).eq('site_id', req.siteId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// DELETE Q&A pair
router.delete('/qa-pairs/:id', async (req, res) => {
    const { error } = await supabase
        .from('qa_pairs').delete().eq('id', req.params.id).eq('site_id', req.siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// POST /api/dashboard/ai-chat — Business owner AI assistant (Claude + tool-use)
// ============================================
router.post('/ai-chat', async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.json({ reply: "AI assistant is being set up — check back soon!" });
    }

    const siteId = req.siteId;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    // Fetch all business data in parallel
    const [
        bizRes, contentRes, bookingsThisWeek, bookingsLastWeek,
        revenueRes, customersRes, fleetRes, timeSlotsRes,
        pricingRes, addonsRes, reviewsRes, upcomingRes, faqsRes
    ] = await Promise.all([
        supabase.from('businesses').select('name, type, subdomain, tagline, plan').eq('site_id', siteId).single(),
        supabase.from('site_content').select('contact_phone, address, city, state, hours, hours_note, about_text, whats_included, steps, features, locations, group_rate').eq('site_id', siteId).maybeSingle(),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('booking_date', weekAgo).not('status', 'eq', 'cancelled').not('status', 'eq', 'refunded'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('booking_date', twoWeeksAgo).lt('booking_date', weekAgo).not('status', 'eq', 'cancelled').not('status', 'eq', 'refunded'),
        supabase.from('bookings').select('total').eq('site_id', siteId).gte('booking_date', weekAgo).not('status', 'eq', 'cancelled')
            .not('status', 'eq', 'refunded'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
        supabase.from('fleet_types').select('name, description, specs, image_url').eq('site_id', siteId).eq('available', true).order('sort_order', { ascending: true }),
        supabase.from('rental_time_slots').select('id, name, start_time, end_time').eq('site_id', siteId).eq('active', true),
        supabase.from('rental_pricing').select('fleet_type_id, time_slot_id, price').eq('site_id', siteId),
        supabase.from('rental_addons').select('name, description, price, per_unit').eq('site_id', siteId).eq('available', true),
        supabase.from('reviews').select('rating, text, customer_name, created_at').eq('site_id', siteId).eq('status', 'published').order('created_at', { ascending: false }).limit(5),
        supabase.from('bookings').select('customer_name, booking_date, total, status').eq('site_id', siteId).gte('booking_date', today).order('booking_date').limit(10),
        supabase.from('faqs').select('question, answer').eq('site_id', siteId).eq('active', true).limit(20)
    ]);

    const biz = bizRes.data || {};
    const content = contentRes.data || {};
    const weekRevenue = (revenueRes.data || []).reduce((s, b) => s + (b.total || 0), 0);
    const avgRating = (reviewsRes.data || []).length > 0
        ? ((reviewsRes.data || []).reduce((s, r) => s + r.rating, 0) / reviewsRes.data.length).toFixed(1)
        : 'No reviews yet';

    // Build price lookup for fleet context
    const priceMap = {};
    (pricingRes.data || []).forEach(p => { priceMap[`${p.fleet_type_id}_${p.time_slot_id}`] = p.price; });
    const timeSlots = timeSlotsRes.data || [];

    // Build human-readable context
    let context = `BUSINESS: ${biz.name || 'Unknown'} (${biz.type || 'business'})`;
    if (content.address) context += `\nAddress: ${content.address}${content.city ? ', ' + content.city : ''}${content.state ? ', ' + content.state : ''}`;
    if (content.contact_phone) context += `\nPhone: ${content.contact_phone}`;
    if (content.about_text) context += `\nAbout: ${content.about_text}`;
    if (content.hours) {
        const h = content.hours;
        const hoursStr = typeof h === 'string' ? h : Object.entries(h).filter(([,v]) => v && !v.closed).map(([d,v]) => `${d}: ${v.open}-${v.close}`).join(', ');
        context += `\nHours: ${hoursStr}`;
    }

    context += `\n\nTHIS WEEK'S STATS:`;
    context += `\n• Bookings this week: ${bookingsThisWeek.count || 0} (last week: ${bookingsLastWeek.count || 0})`;
    context += `\n• Revenue this week: $${Math.round(weekRevenue)}`;
    context += `\n• Total customers: ${customersRes.count || 0}`;
    context += `\n• Average rating: ${avgRating}`;

    if ((fleetRes.data || []).length) {
        context += `\n\nFLEET & PRICING:`;
        fleetRes.data.forEach(f => {
            const specs = f.specs || {};
            let prices = [];
            timeSlots.forEach(ts => {
                const price = priceMap[`${f.id}_${ts.id}`] || specs[ts.name] || null;
                if (price) prices.push(`${ts.name}: $${price}`);
            });
            if (!prices.length && specs.halfDayAM) prices.push(`Half Day AM: $${specs.halfDayAM}`);
            if (!prices.length && specs.halfDayPM) prices.push(`Half Day PM: $${specs.halfDayPM}`);
            if (!prices.length && specs.allDay)    prices.push(`All Day: $${specs.allDay}`);
            context += `\n\u2022 ${f.name}${f.description ? ' \u2014 ' + f.description : ''}`;
            if (prices.length) context += ` | Prices: ${prices.join(', ')}`;
            if (specs.specsText) context += ` | Specs: ${specs.specsText}`;
        });
    }


    if ((addonsRes.data || []).length) {
        context += `\n\nADD-ONS AVAILABLE:`;
        addonsRes.data.forEach(a => { context += `\n\u2022 ${a.name} \u2014 $${a.price}${a.per_unit ? ' per ' + a.per_unit : ''}${a.description ? ': ' + a.description : ''}`; });
    }


    if (Array.isArray(content.whats_included) && content.whats_included.length) {
        context += `\n\nWHAT'S INCLUDED: ${content.whats_included.map(i => i.title || i).join(', ')}`;
    }


    if (Array.isArray(content.locations) && content.locations.length) {
        context += `\n\nLAUNCH LOCATIONS:`;
        content.locations.forEach(l => { context += `\n• ${l.name}: ${l.address || ''}${l.description ? ' — ' + l.description : ''}`; });
    }


    if (content.group_rate && (content.group_rate.title || content.group_rate.price)) {
        context += `\n\nGROUP RATES: ${content.group_rate.title || ''} — ${content.group_rate.description || ''} (from $${content.group_rate.price || 0})`;
    }


    if ((faqsRes.data || []).length) {
        context += `\n\nFAQs:`;
        faqsRes.data.forEach(q => { context += `\n• Q: ${q.question}\n  A: ${q.answer}`; });
    }


    if ((reviewsRes.data || []).length) {
        context += `\n\nRECENT REVIEWS:`;
        reviewsRes.data.forEach(r => { context += `\n• ${r.rating}★ from ${r.customer_name || 'Anonymous'}: "${(r.text || '').slice(0, 100)}"`; });
    }

    if ((upcomingRes.data || []).length) {
        context += `\n\nUPCOMING BOOKINGS:`;
        upcomingRes.data.forEach(b => { context += `\n• ${b.booking_date} — ${b.customer_name || 'Unknown'} ($${b.total || 0}) [${b.status}]`; });
    }

    const systemPrompt = `You are the AI assistant for ${biz.name || 'this business'}. You can both answer questions AND make real changes to the business data.

YOUR BUSINESS DATA:
${context}

WHAT YOU CAN DO:
1. ADD DATA — menu items (food/drink/happy hour), specials, events/live music, happy hour schedule
2. UPDATE ITEMS — change a price, rename an item, update its description or category by name
3. ANSWER QUESTIONS — bookings, revenue, reviews, marketing, strategy
4. BULK IMPORT — when the owner pastes a menu, specials board, or event lineup, parse ALL of it and add everything at once using the appropriate tools

BULK DATA RULES:
- When someone pastes a menu or large block of text with items, parse every single item and call add_menu_items with all of them in one call
- Classify each section as food/drink/happy_hour based on what it is
- If a section name sounds like beverages (Beer, Wine, Cocktails, Drinks, Spirits) → item_type: "drink"
- If it sounds like happy hour deals → item_type: "happy_hour"
- Everything else → item_type: "food"
- If user says "replace" or "clear first", call clear_menu_type before adding

STYLE:
- After using a tool, confirm briefly what you did ("Added 24 items across 6 sections ✓")
- For questions, be direct and use real numbers
- Keep responses short unless they ask for something long like a social post`;

    // ── Tool definitions ──
    const tools = [
        {
            name: 'add_menu_items',
            description: 'Add one or more menu items (food, drinks, or happy hour). Use this for any request to add items to the menu.',
            input_schema: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name:        { type: 'string' },
                                price:       { type: 'number' },
                                category:    { type: 'string', description: 'Section name e.g. "Burgers", "Cocktails"' },
                                item_type:   { type: 'string', enum: ['food','drink','happy_hour'] },
                                description: { type: 'string' },
                                tags:        { type: 'array', items: { type: 'string' } }
                            },
                            required: ['name','price','category','item_type']
                        }
                    }
                },
                required: ['items']
            }
        },
        {
            name: 'clear_menu_type',
            description: 'Delete ALL existing items of a type before adding new ones. Only use when user says "replace", "start over", or "clear".',
            input_schema: {
                type: 'object',
                properties: {
                    item_type: { type: 'string', enum: ['food','drink','happy_hour'] }
                },
                required: ['item_type']
            }
        },
        {
            name: 'add_specials',
            description: 'Add daily or weekly specials (food deals, drink specials, promotions)',
            input_schema: {
                type: 'object',
                properties: {
                    specials: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                special_name:  { type: 'string' },
                                discount_text: { type: 'string', description: 'e.g. "$5", "Half off", "2-for-1"' },
                                description:   { type: 'string' },
                                days:          { type: 'string', description: 'e.g. "Mon-Fri", "Tuesday", "Every Day"' },
                                start_time:    { type: 'string' },
                                end_time:      { type: 'string' }
                            },
                            required: ['special_name']
                        }
                    }
                },
                required: ['specials']
            }
        },
        {
            name: 'add_events',
            description: 'Add events or live music schedule entries',
            input_schema: {
                type: 'object',
                properties: {
                    events: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                event_name:   { type: 'string' },
                                event_date:   { type: 'string', description: 'YYYY-MM-DD, or null for recurring/undated' },
                                start_time:   { type: 'string' },
                                end_time:     { type: 'string' },
                                description:  { type: 'string' },
                                cover_charge: { type: 'string' }
                            },
                            required: ['event_name']
                        }
                    }
                },
                required: ['events']
            }
        },
        {
            name: 'delete_menu_item',
            description: 'Delete a specific menu item by name. Use when owner says "remove X", "delete X", "take off X".',
            input_schema: {
                type: 'object',
                properties: {
                    item_name: { type: 'string', description: 'Name of the item to delete (partial match ok)' }
                },
                required: ['item_name']
            }
        },
        {
            name: 'update_menu_item',
            description: 'Update an existing menu item — change its price, name, description, or category. Use when owner says "change X price to $Y", "rename X to Y", etc.',
            input_schema: {
                type: 'object',
                properties: {
                    search_name:     { type: 'string', description: 'Current name of the item to find (partial match ok)' },
                    new_name:        { type: 'string' },
                    new_price:       { type: 'number' },
                    new_description: { type: 'string' },
                    new_category:    { type: 'string' }
                },
                required: ['search_name']
            }
        },
        {
            name: 'update_hh_schedule',
            description: 'Set the happy hour schedule — which days and what times',
            input_schema: {
                type: 'object',
                properties: {
                    days:  { type: 'string', description: 'e.g. "Mon, Tue, Wed, Thu, Fri"' },
                    start: { type: 'string', description: 'e.g. "4:00 PM"' },
                    end:   { type: 'string', description: 'e.g. "7:00 PM"' }
                },
                required: ['days','start','end']
            }
        }
    ];

    // ── Tool execution ──
    async function executeTool(name, input) {
        if (name === 'add_menu_items') {
            const rows = (input.items || []).map(i => ({
                site_id: siteId, name: i.name, price: i.price || 0,
                category: i.category, item_type: i.item_type || 'food',
                description: i.description || '', tags: i.tags || [], modifiers: []
            }));
            if (!rows.length) return { success: true, count: 0 };
            const { error } = await supabase.from('menu_items').insert(rows);
            if (error) return { error: error.message };
            return { success: true, count: rows.length };
        }
        if (name === 'clear_menu_type') {
            const { error } = await supabase.from('menu_items').delete().eq('site_id', siteId).eq('item_type', input.item_type);
            if (error) return { error: error.message };
            return { success: true, cleared: input.item_type };
        }
        if (name === 'add_specials') {
            const rows = (input.specials || []).map(s => ({ site_id: siteId, ...s }));
            if (!rows.length) return { success: true, count: 0 };
            const { error } = await supabase.from('specials').insert(rows);
            if (error) return { error: error.message };
            return { success: true, count: rows.length };
        }
        if (name === 'add_events') {
            const rows = (input.events || []).map(e => ({ site_id: siteId, ...e }));
            if (!rows.length) return { success: true, count: 0 };
            const { error } = await supabase.from('events').insert(rows);
            if (error) return { error: error.message };
            return { success: true, count: rows.length };
        }
        if (name === 'delete_menu_item') {
            const { data: found, error: findErr } = await supabase
                .from('menu_items').select('id,name').eq('site_id', siteId)
                .ilike('name', `%${input.item_name}%`).limit(1).single();
            if (findErr || !found) return { error: `Item "${input.item_name}" not found` };
            const { error } = await supabase.from('menu_items').delete().eq('id', found.id);
            if (error) return { error: error.message };
            return { success: true, deleted_name: found.name };
        }
        if (name === 'update_menu_item') {
            const { data: found, error: findErr } = await supabase
                .from('menu_items').select('id,name').eq('site_id', siteId)
                .ilike('name', `%${input.search_name}%`).limit(1).single();
            if (findErr || !found) return { error: `Item "${input.search_name}" not found` };
            const updates = {};
            if (input.new_name        !== undefined) updates.name        = input.new_name;
            if (input.new_price       !== undefined) updates.price       = input.new_price;
            if (input.new_description !== undefined) updates.description = input.new_description;
            if (input.new_category    !== undefined) updates.category    = input.new_category;
            if (!Object.keys(updates).length) return { error: 'No changes specified' };
            const { error } = await supabase.from('menu_items').update(updates).eq('id', found.id);
            if (error) return { error: error.message };
            return { success: true, updated_name: found.name, updates };
        }
        if (name === 'update_hh_schedule') {
            const { data: biz } = await supabase.from('businesses').select('metadata').eq('site_id', siteId).single();
            const meta = Object.assign({}, biz?.metadata || {}, { hh_schedule: { days: input.days, start: input.start, end: input.end } });
            const { error } = await supabase.from('businesses').update({ metadata: meta }).eq('site_id', siteId);
            if (error) return { error: error.message };
            return { success: true, schedule: input };
        }
        return { error: 'Unknown tool' };
    }

    try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const messages = [
            ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
        ];

        // Agentic loop — Claude may call multiple tools
        const toolResults = [];
        let finalReply = '';
        let loopMessages = [...messages];

        for (let i = 0; i < 5; i++) {  // max 5 tool-call rounds
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
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
                const assistantMsg = { role: 'assistant', content: response.content };
                loopMessages.push(assistantMsg);

                const toolResultMsgs = [];
                for (const block of response.content) {
                    if (block.type !== 'tool_use') continue;
                    const result = await executeTool(block.name, block.input);
                    if (result.count !== undefined)  toolResults.push({ tool: block.name, count: result.count, input: block.input });
                    if (result.cleared)             toolResults.push({ tool: block.name, cleared: result.cleared });
                    if (result.schedule)            toolResults.push({ tool: block.name, schedule: result.schedule });
                    if (result.updated_name)        toolResults.push({ tool: block.name, updated_name: result.updated_name, updates: result.updates });
                    if (result.deleted_name)        toolResults.push({ tool: block.name, deleted_name: result.deleted_name });
                    toolResultMsgs.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
                }
                loopMessages.push({ role: 'user', content: toolResultMsgs });
                continue;
            }

            // Fallback
            finalReply = response.content.filter(b => b.type === 'text').map(b => b.text).join('') || "Done!";
            break;
        }

        res.json({ reply: finalReply || "Done!", tool_results: toolResults });
    } catch (err) {
        console.error('Dashboard AI chat error:', err.message);
        res.json({ reply: "Something went wrong — try again!" });
    }
});

// ============================================
// POST /api/dashboard/search-structured — Natural language search with structured results
// ============================================
router.post('/search-structured', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });

    if (!process.env.OPENAI_API_KEY) {
        return res.json({ results: [], error: "AI search not configured" });
    }

    const siteId = req.siteId;

    try {
        // Step 1: Use OpenAI to extract search parameters from natural language
        const paramExtractionPrompt = `Extract search parameters from this user query. Return ONLY valid JSON (no markdown, no explanation).

Query: "${query}"

Return this exact JSON structure:
{
  "keywords": ["keyword1", "keyword2"],
  "tags": ["tag1", "tag2"],
  "allergen_exclude": ["allergen1"],
  "categories": ["category1"],
  "price_max": null,
  "search_type": "menu_items"
}

Valid search_type values: menu_items, events, services, fleet_types
Valid tags: gluten-free, vegan, vegetarian, organic, dairy-free, nut-free, spicy, fresh, grilled, crab, shrimp, fish, chicken, beef, pasta, salad, dessert, appetizer, entree, live music, happy hour, outdoor, waterfront, beachfront, kid-friendly
Valid categories: appetizer, entree, side, dessert, beverage, special`;

        const paramRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: paramExtractionPrompt }],
                max_tokens: 200,
                temperature: 0
            })
        });

        const paramData = await paramRes.json();
        let params;
        try {
            const content = paramData.choices?.[0]?.message?.content || '{}';
            params = JSON.parse(content);
        } catch (e) {
            console.error('Failed to parse OpenAI params:', e.message);
            params = { keywords: [query], search_type: 'menu_items' };
        }

        // Step 2: Build Supabase query based on extracted parameters
        let dbQuery = supabase.from('menu_items').select('*').eq('site_id', siteId).eq('available', true);

        // Filter by keywords
        if (params.keywords?.length) {
            const keywordFilter = params.keywords.map(k => `name.ilike.%${k}%`).join(',');
            dbQuery = dbQuery.or(keywordFilter);
        }

        // Filter by tags
        if (params.tags?.length) {
            params.tags.forEach(tag => {
                dbQuery = dbQuery.filter('tags', 'cs', `["${tag}"]`);
            });
        }

        // Exclude allergens
        if (params.allergen_exclude?.length) {
            params.allergen_exclude.forEach(allergen => {
                dbQuery = dbQuery.filter('allergens', 'not.cs', `["${allergen}"]`);
            });
        }

        // Filter by category
        if (params.categories?.length) {
            const catFilter = params.categories.map(c => `category.eq.${c}`).join(',');
            dbQuery = dbQuery.or(catFilter);
        }

        // Filter by price
        if (params.price_max) {
            dbQuery = dbQuery.lte('price', params.price_max);
        }

        const { data: results, error } = await dbQuery.limit(10);

        if (error) throw error;

        // Step 3: Format results for response
        const formatted = results.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            tags: item.tags || [],
            allergens: item.allergens || [],
            image_url: item.image_url
        }));

        res.json({
            query,
            extracted_params: params,
            results: formatted,
            count: formatted.length
        });

    } catch (err) {
        console.error('Structured search error:', err.message);
        res.json({ query, results: [], error: err.message });
    }
});

// ============================================
// WEBSITE CONTENT SECTIONS — generic GET/PUT per section
// Sections stored as JSONB columns in site_content
// ============================================

const WC_ALLOWED_SECTIONS = [
    'whats_included', 'steps', 'features', 'footer',
    'links_page', 'locations', 'group_rate', 'docks', 'qna',
    'hero_cta_text', 'hero_cta_url', 'promotions'
];

// GET /api/dashboard/website-content — all sections at once
router.get('/website-content', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('whats_included, steps, features, footer, links_page, locations, group_rate, docks, qna, hero_cta_text, hero_cta_url')
        .eq('site_id', req.siteId)
        .single();
    res.json(data || {});
});

// PUT /api/dashboard/website-content/:section — save one section
router.put('/website-content/:section', async (req, res) => {
    const { section } = req.params;
    if (!WC_ALLOWED_SECTIONS.includes(section)) {
        return res.status(400).json({ error: 'Unknown section: ' + section });
    }
    const value = req.body.value !== undefined ? req.body.value : req.body;
    const { error } = await supabase
        .from('site_content')
        .upsert({ site_id: req.siteId, [section]: value, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, section });
});

// PUT /api/dashboard/website-content — save multiple sections at once
router.put('/website-content', async (req, res) => {
    const updates = {};
    for (const key of WC_ALLOWED_SECTIONS) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid sections in body' });
    }
    updates.updated_at = new Date().toISOString();
    const { error } = await supabase
        .from('site_content')
        .upsert({ site_id: req.siteId, ...updates });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, updated: Object.keys(updates) });
});

// ============================================
// MODULES — GET/PUT /api/dashboard/modules
// ============================================

router.get('/modules', async (req, res) => {
    const { data, error } = await supabase
        .from('site_content')
        .select('modules')
        .eq('site_id', req.siteId)
        .single();

    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ modules: data?.modules || null });
});

router.put('/modules', async (req, res) => {
    const { modules } = req.body;
    if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules must be an array' });

    const { error } = await supabase
        .from('site_content')
        .upsert({ site_id: req.siteId, modules, updated_at: new Date().toISOString() });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// FAQ — CRUD /api/dashboard/faqs
// ============================================

router.get('/faqs', async (req, res) => {
    const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/faqs', async (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });

    const { data: existing } = await supabase
        .from('faqs')
        .select('sort_order')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

    const nextSort = (existing?.sort_order || 0) + 1;

    const { data, error } = await supabase
        .from('faqs')
        .insert({ site_id: req.siteId, question, answer, sort_order: nextSort })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/faqs/:id', async (req, res) => {
    const { question, answer, sort_order } = req.body;
    const updates = {};
    if (question !== undefined) updates.question = question;
    if (answer !== undefined) updates.answer = answer;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
        .from('faqs')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/faqs/:id', async (req, res) => {
    const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// ONBOARDING PROGRESS — GET/PUT /api/dashboard/onboarding
// ============================================

router.get('/onboarding', async (req, res) => {
    const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('site_id', req.siteId)
        .single();

    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json(data || {
        step1_done: false, step2_done: false, step3_done: false,
        step4_done: false, step5_done: false, step6_done: false,
        completed_at: null
    });
});

router.put('/onboarding', async (req, res) => {
    const allowed = ['step1_done','step2_done','step3_done','step4_done','step5_done','step6_done'];
    const updates = { site_id: req.siteId };
    for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = !!req.body[key];
    }

    // Auto-set completed_at if all 6 steps are done
    if (updates.step6_done) updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('onboarding_progress')
        .upsert(updates)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/dashboard/resend-confirmation
router.post('/resend-confirmation', async (req, res) => {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id required' });

    try {
        const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');
        const { sendEmail, customerConfirmationHtml, generateIcsContent } = require('../utils/email');

        const { data: bookingData } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', booking_id)
            .eq('site_id', req.siteId)
            .single();

        if (!bookingData) return res.status(404).json({ error: 'Booking not found' });

        const templateData = await buildTemplateData(bookingData, req.siteId);

        if (bookingData.customer_phone) {
            const tpl = '[{{business_name}}] Hi {{customer_name}}! Your booking is confirmed.\n\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\n\nQuestions? Reply to this number!';
            await sendSms(bookingData.customer_phone, fillTemplate(tpl, templateData), req.siteId, 'booking_confirmation', booking_id)
                .catch(err => console.error('Resend SMS failed:', err));
        }

        if (bookingData.customer_email) {
            const ics = [{ filename: 'booking.ics', content: Buffer.from(generateIcsContent(templateData)).toString('base64') }];
            await sendEmail({
                to: bookingData.customer_email,
                subject: 'Booking Confirmed — ' + (templateData.business_name || 'Your Reservation'),
                html: customerConfirmationHtml(templateData),
                attachments: ics
            }).catch(err => console.error('Resend email failed:', err));
        }

        res.json({ success: true, message: 'Confirmations resent to customer' });
    } catch (err) {
        console.error('Resend confirmation error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// MENU — AI Image Extraction
// ============================================

const MENU_EXTRACT_PROMPT = `You are a menu extraction assistant. Analyze this restaurant menu image and extract ALL visible menu items into structured JSON.

Return ONLY valid JSON with this exact structure:
{
  "categories": [
    {
      "name": "Category Name",
      "item_type": "food",
      "items": [
        {
          "name": "Item Name",
          "price": 12.99,
          "description": "Item description if visible, or empty string",
          "tags": [],
          "modifiers": [
            { "name": "Add Bacon", "price": 2 },
            { "name": "Add Fried Egg", "price": 2 }
          ]
        }
      ],
      "section_modifiers": [
        { "name": "Add Chicken (grilled/blackened/pulled)", "price": 5 },
        { "name": "Add Shrimp or Steak", "price": 6 }
      ]
    }
  ]
}

Rules for ITEMS:
- Extract ALL visible items — menus often span multiple columns; don't stop at a column edge
- Group items by their section/category exactly as shown on the menu
- If no category sections exist, use "Menu Items" as the single category
- price must be a number (e.g., 12.99). If not visible, use 0
- tags: only include "vegetarian", "vegan", "gluten-free", "spicy", "popular", "new" when clearly indicated
- description: item description text if visible, else empty string ""
- item_type: "food" | "drink" | "happy_hour" — use "drink" for any beverages/cocktails/beer/wine/spirits, "happy_hour" for HH sections, otherwise "food"

Rules for MODIFIERS (the add-on price upcharges):
- Per-item modifiers (e.g., "Add bacon $2", "Add avocado $1.50", "Add jalapeños $2", "Add fried egg $2") go in the item's "modifiers" array — one object per add-on
- Section-wide modifiers (e.g., "Add chicken +$5, shrimp +$6" printed above or across a whole section like Salads) go in "section_modifiers" so every item in that section inherits them
- Modifier price must be a number. Drop the "$" and "+". If a modifier has no price shown, use 0
- If no modifiers exist, return an empty array [] — never omit the key
- Do NOT duplicate modifiers in both places; put them where they belong structurally

Return ONLY the JSON object. No markdown. No commentary.`;

router.post('/menu/extract', async (req, res) => {
    const { image_base64, mime_type, provider, model } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

    try {
        const { result: extracted, provider: used } = await extractJsonFromImage({
            imageBase64: image_base64,
            mimeType: mime_type,
            systemPrompt: 'You extract structured menu data from images. Return ONLY valid JSON — no markdown, no commentary.',
            userPrompt: MENU_EXTRACT_PROMPT,
            provider, model,
            maxTokens: 4096,
        });
        if (!extracted.categories || !Array.isArray(extracted.categories)) {
            return res.status(422).json({ error: 'No menu items found in image.' });
        }
        res.json({ ...extracted, _provider: used });
    } catch (err) {
        console.error('Menu extract error:', err);
        const msg = err.message || 'unknown error';
        if (msg.startsWith('AI returned non-JSON')) {
            return res.status(422).json({ error: 'Could not parse menu from image. AI said: ' + msg.slice('AI returned non-JSON: '.length, 300) });
        }
        res.status(500).json({ error: 'AI extraction failed: ' + msg });
    }
});

// GET /api/dashboard/ai/vision-providers — list configured providers for UI dropdown
router.get('/ai/vision-providers', (req, res) => {
    res.json(getVisionProvidersStatus());
});

const EVENTS_EXTRACT_PROMPT = `Extract all events, specials, or promotions from this image into structured JSON.

Return ONLY valid JSON:
{
  "type": "events" or "specials",
  "items": [
    {
      "name": "Item/Event name",
      "description": "Description or deal details",
      "price_text": "Price or deal (e.g. $5, 2-for-1, Free)",
      "date": "Date if visible (e.g. Friday April 25)",
      "time": "Time if visible (e.g. 7:00 PM)",
      "days": "Days if recurring (e.g. Mon-Fri, Weekends)",
      "start_time": "HH:MM in 24hr if time-based",
      "end_time": "HH:MM in 24hr if time-based"
    }
  ]
}

Rules:
- Extract ALL visible items
- For happy hour / daily specials: set days and start_time/end_time
- For one-time events: set date and time
- price_text is a string like "$5 drafts" or "Half off appetizers"
- Return ONLY JSON, no markdown`;

// POST /api/dashboard/events/extract
router.post('/events/extract', async (req, res) => {
    const { image_base64, mime_type, provider, model } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

    try {
        const { result: extracted, provider: used } = await extractJsonFromImage({
            imageBase64: image_base64,
            mimeType: mime_type,
            systemPrompt: 'You extract structured event/special data from images. Return ONLY valid JSON — no markdown, no commentary.',
            userPrompt: EVENTS_EXTRACT_PROMPT,
            provider, model,
            maxTokens: 2048,
        });
        res.json({ ...extracted, _provider: used });
    } catch (err) {
        console.error('Events extract error:', err);
        const msg = err.message || 'unknown error';
        if (msg.startsWith('AI returned non-JSON')) {
            return res.status(422).json({ error: 'Could not parse image. Try a clearer photo.' });
        }
        res.status(500).json({ error: msg });
    }
});

// ═══════════════════════════════════════════════════════════════
// PROMOTIONS — QR Menu trigger-based offers
// ═══════════════════════════════════════════════════════════════

// GET/POST /api/dashboard/promotions
router.get('/promotions', async (req, res) => {
    const siteId = req.query.site_id || req.siteId;
    if (!siteId) return res.status(400).json({ error: 'site_id required' });
    const { data, error } = await supabase.from('promotions').select('*').eq('site_id', siteId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/promotions', async (req, res) => {
    const siteId = req.body.site_id || req.siteId;
    if (!siteId) return res.status(400).json({ error: 'site_id required' });
    const { title, description, cta_text, cta_url, type, trigger_config, coupon_prefix, discount_text } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const { data, error } = await supabase.from('promotions').insert({
        site_id: siteId, title, description, cta_text, cta_url,
        type: type || 'random',
        trigger_config: trigger_config || {},
        coupon_prefix: coupon_prefix || 'PROMO',
        discount_text, active: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/promotions/:id', async (req, res) => {
    const updates = { ...req.body }; delete updates.id; delete updates.site_id;
    const { data, error } = await supabase.from('promotions').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/promotions/:id', async (req, res) => {
    const { error } = await supabase.from('promotions').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

// POST /api/dashboard/promotions/claim
// Called when tourist taps a promo and enters their phone number.
// Creates/finds customer → assigns loyalty number → generates coupon → sends SMS.
router.post('/promotions/claim', async (req, res) => {
    const { promotion_id, phone, site_id, name } = req.body;
    if (!promotion_id || !phone || !site_id) return res.status(400).json({ error: 'promotion_id, phone, site_id required' });

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) return res.status(400).json({ error: 'Invalid phone number' });

    try {
        // Get the promotion
        const { data: promo } = await supabase.from('promotions').select('*').eq('id', promotion_id).single();
        if (!promo || !promo.active) return res.status(404).json({ error: 'Promotion not found' });

        // Find or create customer
        let { data: customer } = await supabase.from('customers').select('*').eq('phone', cleanPhone).eq('site_id', site_id).maybeSingle();
        if (!customer) {
            // Generate loyalty number: LOYAL + 6 random digits
            const loyaltyNum = 'LOYAL' + String(Math.floor(100000 + Math.random() * 900000));
            const { data: newCust } = await supabase.from('customers').insert({
                phone: cleanPhone, name: name || null, site_id,
                loyalty_number: loyaltyNum, loyalty_points: 0,
                source: 'qr_promo', tier: 'standard',
            }).select().single();
            customer = newCust;
        }

        // Generate unique coupon code
        const code = (promo.coupon_prefix || 'PROMO') + '-' + cleanPhone.slice(-4) + '-' + Math.random().toString(36).slice(2,6).toUpperCase();

        // Save the claim
        await supabase.from('coupon_claims').insert({
            promotion_id, customer_id: customer?.id,
            site_id, coupon_code: code, phone: cleanPhone,
        });

        // Increment shown count
        await supabase.from('promotions').update({ total_claimed: (promo.total_claimed || 0) + 1 }).eq('id', promotion_id);

        // Send SMS with coupon
        const sid  = process.env.TWILIO_ACCOUNT_SID;
        const tok  = process.env.TWILIO_AUTH_TOKEN;
        const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
        if (sid && tok && from) {
            const twilio = require('twilio')(sid, tok);
            const msg = `${promo.title}\n\n${promo.description || ''}\n\nYour code: ${code}${promo.discount_text ? '\n' + promo.discount_text : ''}\n\nYour loyalty #: ${customer?.loyalty_number || ''}`.trim();
            await twilio.messages.create({ body: msg, from, to: '+1' + cleanPhone }).catch(() => {});
        }

        res.json({
            ok: true,
            coupon_code: code,
            loyalty_number: customer?.loyalty_number,
            loyalty_points: customer?.loyalty_points || 0,
            message: `Your code ${code} has been sent to your phone!`,
            is_new_customer: !customer?.last_visit,
        });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/dashboard/promotions/public?site_id=X — public endpoint for QR menu
// Returns active promotions for a business (no auth needed — QR menu reads this)
router.get('/promotions/public', async (req, res) => {
    const { site_id } = req.query;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });
    const { data } = await supabase.from('promotions').select('id,title,description,cta_text,cta_url,type,trigger_config,coupon_prefix,discount_text').eq('site_id', site_id).eq('active', true);
    res.json(data || []);
});

// ═══════════════════════════════════════════════════════════════
// POST /api/dashboard/menu/generate-design
// AI-powered QR menu designer.
// Business describes how they want their menu to look.
// Claude reads their actual data and generates a complete custom design.
// Saves the result to businesses.metadata.qr_theme — live on their QR instantly.
// ═══════════════════════════════════════════════════════════════

router.post('/menu/generate-design', async (req, res) => {
    const { site_id, description, occasion } = req.body;
    if (!site_id) return res.status(400).json({ error: 'site_id required' });
    if (!description) return res.status(400).json({ error: 'description required — tell us how you want your menu to look' });

    try {
        // Fetch all the business's real data
        const [bizRes, itemsRes, specialsRes, eventsRes] = await Promise.all([
            supabase.from('businesses').select('name, tagline, logo_url, metadata').eq('site_id', site_id).maybeSingle(),
            supabase.from('menu_items').select('name, category, item_type, price, description, photo_url').eq('site_id', site_id).limit(30),
            supabase.from('specials').select('special_name, discount_text, days, start_time, end_time').eq('site_id', site_id).limit(10),
            supabase.from('events').select('name, description, event_date, start_time').eq('site_id', site_id).limit(5),
        ]);

        const biz = bizRes.data || {};
        const items = itemsRes.data || [];
        const specials = specialsRes.data || [];
        const events = eventsRes.data || [];

        // Group items by type for context
        const food = items.filter(i => i.item_type === 'food');
        const drinks = items.filter(i => i.item_type === 'drink');
        const happyHour = items.filter(i => i.item_type === 'happy_hour');
        const catchOfDay = food.filter(i => (i.category || '').toLowerCase().includes('catch'));

        const dataContext = `
BUSINESS: ${biz.name || 'Restaurant'}
TAGLINE: ${biz.tagline || ''}
FOOD SECTIONS: ${[...new Set(food.map(i => i.category))].join(', ')}
DRINK SECTIONS: ${[...new Set(drinks.map(i => i.category))].join(', ')}
HAS CATCH OF DAY: ${catchOfDay.length > 0 ? 'YES - ' + catchOfDay.map(i => i.name).join(', ') : 'NO'}
HAS HAPPY HOUR: ${happyHour.length > 0 ? 'YES' : 'NO'}
HAS SPECIALS: ${specials.length > 0 ? specials.map(s => s.special_name).join(', ') : 'NO'}
HAS LIVE EVENTS: ${events.length > 0 ? events.map(e => e.name).join(', ') : 'NO'}
SAMPLE DISHES: ${food.slice(0, 5).map(i => i.name + ' $' + i.price).join(', ')}
${occasion ? `OCCASION/SEASON: ${occasion}` : ''}`;

        const systemPrompt = `You are a QR menu designer for restaurants. You generate CSS custom properties and layout configuration that transforms a restaurant's menu into a beautiful, on-brand digital experience.

You output ONLY valid JSON — no markdown, no explanation. The JSON must match this exact schema:

{
  "bg": "#hex — main background color",
  "surface": "#hex — card/section background",
  "surface2": "#hex — secondary surface",
  "primary": "#hex — primary accent (prices, headings)",
  "primary_dark": "#hex — darker accent",
  "accent": "#hex — secondary accent (badges, highlights)",
  "text": "#hex — primary text",
  "text_muted": "#hex — secondary text",
  "border": "#hex — border color",
  "font": "Google Font name or system font",
  "radius": "border radius e.g. 8px or 16px or 4px",
  "special_bg": "#hex — specials section background",
  "special_border": "#hex — specials border",
  "hh_bg": "#hex — happy hour background",
  "hh_border": "#hex — happy hour border",
  "hh_text": "#hex — happy hour text",
  "catch_bg": "#hex — catch of day background",
  "catch_border": "#hex — catch of day border",
  "catch_text": "#hex — catch of day text",
  "hero_overlay": "CSS gradient for hero image overlay e.g. linear-gradient(to bottom, transparent, rgba(0,0,0,0.7))",
  "modules": {
    "catch_of_day": true or false,
    "live_music": true or false,
    "specials": true or false,
    "happy_hour": true or false,
    "menu": true or false,
    "drinks": true or false,
    "events": true or false
  },
  "module_order": ["catch_of_day", "live_music", "specials", "happy_hour", "menu", "drinks", "events"],
  "template": "a one-word name for this design e.g. beach, upscale, tropical, dark, coastal, rustic, modern",
  "design_note": "one sentence describing the design for the owner",
  "module_styles": {
    "catch_of_day": { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" },
    "live_music":   { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" },
    "specials":     { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" },
    "happy_hour":   { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" },
    "menu":         { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" },
    "drinks":       { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" },
    "events":       { "bg": "#hex", "border": "#hex", "text": "#hex", "accent": "#hex" }
  }
}

Rules:
- Make the design match the restaurant's personality and the owner's description
- Colors must have good contrast — text readable on backgrounds
- If they have a catch of the day, make catch_of_day prominent (first in order)
- If they have happy hour, use warm amber/gold for hh colors
- If they have live music/events, include live_music module
- Pick module_order based on what's most important for THIS restaurant
- Font must be a Google Font name (Playfair Display, Roboto, Lato, Oswald, Montserrat, Open Sans, Raleway, etc.)
- USE module_styles to give each section its OWN look — the top hero sections (catch, live music) can be dramatic/dark, the menu section clean/light, happy hour warm amber, etc.
- Sections don't have to match — that's the point. A dark moody hero + bright clean menu = professional contrast
- module_styles overrides only that section's colors, not the whole page`;

        const userPrompt = `Design a QR menu for this restaurant based on the owner's description.

OWNER'S VISION: "${description}"

RESTAURANT DATA:
${dataContext}

Generate the JSON design config now.`;

        // Call Claude via the existing adapter
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 2000,
                temperature: 0.7,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt },
                    { role: 'assistant', content: '{' }, // pre-fill to force JSON
                ],
            }),
        });

        if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
        const aiData = await aiRes.json();
        let rawText = '{' + ((aiData.content || []).find(c => c.type === 'text')?.text || '');

        // Parse the generated design
        let design;
        try {
            design = JSON.parse(rawText);
        } catch(e) {
            const m = rawText.match(/\{[\s\S]*\}/);
            if (m) design = JSON.parse(m[0]);
            else throw new Error('Could not parse AI design response');
        }

        // Save to businesses.metadata.qr_theme
        const currentMeta = biz.metadata || {};
        const newMeta = { ...currentMeta, qr_theme: design };
        await supabase.from('businesses').update({ metadata: newMeta }).eq('site_id', site_id);

        res.json({
            ok: true,
            design,
            message: design.design_note || 'Design applied to your QR menu',
            preview_url: `https://cybercheck-links.vercel.app/qr-menu.html?site_id=${site_id}`,
        });

    } catch (err) {
        console.error('generate-design error:', err.message);
        res.status(500).json({ error: 'Design generation failed: ' + err.message });
    }
});

module.exports = router;

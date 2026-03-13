const express = require('express');
const { authRequired } = require('../middleware/auth');
const supabase = require('../db');

const router = express.Router();

// All dashboard routes require authentication
router.use(authRequired);

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
            .not('status', 'eq', 'cancelled'),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
            .eq('site_id', req.siteId)
            .eq('booking_date', today)
            .not('status', 'eq', 'cancelled'),
        supabase.from('bookings').select('total')
            .eq('site_id', req.siteId)
            .not('status', 'eq', 'cancelled')
            .not('status', 'eq', 'pending'),
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
// GET /api/dashboard/profile
router.get('/profile', async (req, res) => {
    const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('site_id', req.siteId)
        .single();

    const { data: content } = await supabase
        .from('site_content')
        .select('*')
        .eq('site_id', req.siteId)
        .single();

    res.json({ business, content });
});

// PUT /api/dashboard/profile
router.put('/profile', async (req, res) => {
    const { business: bizUpdates, content: contentUpdates } = req.body;

    if (!bizUpdates && !contentUpdates) {
        return res.status(400).json({ error: 'Body must have "business" and/or "content" keys. Flat body format is not supported.' });
    }

    if (bizUpdates) {
        // Filter out undefined so we don't null out fields not included in the update
        const allowedBizFields = ['name', 'type', 'logo_url', 'cover_url'];
        const bizData = {};
        for (const key of allowedBizFields) {
            if (bizUpdates[key] !== undefined) bizData[key] = bizUpdates[key];
        }
        if (Object.keys(bizData).length > 0) {
            bizData.updated_at = new Date().toISOString();
            await supabase
                .from('businesses')
                .update(bizData)
                .eq('site_id', req.siteId);
        }
    }

    if (contentUpdates) {
        delete contentUpdates.site_id;
        // Accept tagline as alias for hero_text
        if (contentUpdates.tagline !== undefined && contentUpdates.hero_text === undefined) {
            contentUpdates.hero_text = contentUpdates.tagline;
        }
        delete contentUpdates.tagline;
        contentUpdates.updated_at = new Date().toISOString();

        await supabase
            .from('site_content')
            .upsert({ site_id: req.siteId, ...contentUpdates })
            .select();
    }

    // Return updated data
    const { data: business } = await supabase.from('businesses').select('*').eq('site_id', req.siteId).single();
    const { data: content } = await supabase.from('site_content').select('*').eq('site_id', req.siteId).single();

    // TODO: Emit event bus event: business.profile.updated
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

router.get('/gallery', async (req, res) => {
    const { data } = await supabase
        .from('media')
        .select('*')
        .eq('site_id', req.siteId)
        .eq('file_type', 'image')
        .order('uploaded_at', { ascending: false });

    res.json(data || []);
});

router.post('/gallery', async (req, res) => {
    const { url, filename, alt_text, file_size } = req.body;

    const { data, error } = await supabase
        .from('media')
        .insert({
            site_id: req.siteId,
            url,
            filename,
            alt_text,
            file_size,
            file_type: 'image',
            folder: 'gallery'
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Emit event: business.gallery.updated
    res.status(201).json(data);
});

router.put('/gallery/:id', async (req, res) => {
    const { alt_text, folder } = req.body;

    const { data, error } = await supabase
        .from('media')
        .update({ alt_text, folder })
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gallery/:id', async (req, res) => {
    const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    // TODO: Delete from R2 storage
    res.json({ success: true });
});

// ============================================
// FAQS
// ============================================

router.get('/faqs', async (req, res) => {
    const { data } = await supabase
        .from('faqs')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

router.post('/faqs', async (req, res) => {
    const faq = { ...req.body, site_id: req.siteId };
    delete faq.id;

    const { data, error } = await supabase
        .from('faqs')
        .insert(faq)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/faqs/:id', async (req, res) => {
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
    const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

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
    const { data } = await supabase
        .from('staff')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: true });

    res.json(data || []);
});

router.post('/team', async (req, res) => {
    const member = { ...req.body, site_id: req.siteId };
    delete member.id;

    const { data, error } = await supabase
        .from('staff')
        .insert(member)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/team/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('staff')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/team/:id', async (req, res) => {
    const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// MENU ITEMS (restaurants, bakeries, retail)
// ============================================

router.get('/menu-items', async (req, res) => {
    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/menu-items', async (req, res) => {
    const item = { ...req.body, site_id: req.siteId };
    delete item.id;

    const { data, error } = await supabase
        .from('menu_items')
        .insert(item)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/menu-items/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/menu-items/:id', async (req, res) => {
    const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

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
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('site_id', req.siteId)
        .order('event_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/events', async (req, res) => {
    const event = { ...req.body, site_id: req.siteId };
    delete event.id;

    const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/events/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/events/:id', async (req, res) => {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

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
    const { data } = await supabase
        .from('fleet_types')
        .select('*, fleet_items(id, unit_name, serial_number, condition)')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

router.post('/fleet', async (req, res) => {
    const fleet = { ...req.body, site_id: req.siteId };
    delete fleet.id;
    delete fleet.fleet_items;

    const { data, error } = await supabase
        .from('fleet_types')
        .insert(fleet)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/fleet/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;
    delete updates.fleet_items;

    const { data, error } = await supabase
        .from('fleet_types')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/fleet/:id', async (req, res) => {
    const { error } = await supabase
        .from('fleet_types')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// FLEET ITEMS (individual inventory units)
// ============================================

router.get('/fleet-items', async (req, res) => {
    let query = supabase
        .from('fleet_items')
        .select('*, fleet_types(name)')
        .eq('site_id', req.siteId);

    if (req.query.fleet_type_id) query = query.eq('fleet_type_id', req.query.fleet_type_id);

    const { data } = await query;
    res.json(data || []);
});

router.post('/fleet-items', async (req, res) => {
    const item = { ...req.body, site_id: req.siteId };
    delete item.id;

    const { data, error } = await supabase
        .from('fleet_items')
        .insert(item)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/fleet-items/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('fleet_items')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/fleet-items/:id', async (req, res) => {
    const { error } = await supabase
        .from('fleet_items')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

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

        return res.status(201).json(fullBooking);
    }

    // Non-fleet booking — direct insert
    const { data, error } = await supabase
        .from('bookings')
        .insert(booking)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
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
    res.json(data || []);
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
    let query = supabase
        .from('reviews')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false });

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.put('/reviews/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/reviews/:id', async (req, res) => {
    const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// REVIEW QUESTIONS — Custom per-business questions
// ============================================

// GET /api/dashboard/review-questions — Get all custom questions for business
router.get('/review-questions', async (req, res) => {
    const { data } = await supabase
        .from('review_questions')
        .select('*')
        .eq('site_id', req.siteId)
        .order('display_order', { ascending: true });

    res.json(data || []);
});

// POST /api/dashboard/review-questions — Add new custom question
router.post('/review-questions', async (req, res) => {
    const { question_text, question_type, display_order } = req.body;

    if (!question_text || !question_type) {
        return res.status(400).json({ error: 'question_text and question_type required' });
    }

    if (!['stars', 'yesno', 'text', 'rating'].includes(question_type)) {
        return res.status(400).json({ error: 'Invalid question_type' });
    }

    const { data, error } = await supabase
        .from('review_questions')
        .insert({
            site_id: req.siteId,
            question_text,
            question_type,
            display_order: display_order || 0,
            enabled: true
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// PUT /api/dashboard/review-questions/:id — Update custom question
router.put('/review-questions/:id', async (req, res) => {
    const { question_text, question_type, display_order, enabled } = req.body;

    const { data, error } = await supabase
        .from('review_questions')
        .update({
            question_text,
            question_type,
            display_order,
            enabled,
            updated_at: new Date().toISOString()
        })
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// DELETE /api/dashboard/review-questions/:id — Delete custom question
router.delete('/review-questions/:id', async (req, res) => {
    const { error } = await supabase
        .from('review_questions')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

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

    // Send SMS to customer if phone is available
    if (booking.customer_phone) {
        const name = booking.customer_name ? `, ${booking.customer_name.split(' ')[0]}` : '';
        await sendSms(
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
    const { data } = await supabase
        .from('coupons')
        .select('*')
        .eq('site_id', req.siteId)
        .order('created_at', { ascending: false });

    res.json(data || []);
});

router.post('/coupons', async (req, res) => {
    const coupon = { ...req.body, site_id: req.siteId };
    delete coupon.id;

    const { data, error } = await supabase
        .from('coupons')
        .insert(coupon)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/coupons/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('coupons')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/coupons/:id', async (req, res) => {
    const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// SPECIALS
// ============================================

router.get('/specials', async (req, res) => {
    const { data } = await supabase
        .from('specials')
        .select('*')
        .eq('site_id', req.siteId);

    res.json(data || []);
});

router.post('/specials', async (req, res) => {
    const special = { ...req.body, site_id: req.siteId };
    delete special.id;

    const { data, error } = await supabase
        .from('specials')
        .insert(special)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/specials/:id', async (req, res) => {
    const updates = { ...req.body };
    delete updates.site_id;
    delete updates.id;

    const { data, error } = await supabase
        .from('specials')
        .update(updates)
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/specials/:id', async (req, res) => {
    const { error } = await supabase
        .from('specials')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
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
    loyalty_reward_value: 10
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
            .not('status', 'eq', 'cancelled'),
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
        const end = new Date(year, month, 0).toISOString().split('T')[0]; // last day of month
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
// POST /api/dashboard/ai-chat — Business owner AI assistant
// ============================================
router.post('/ai-chat', async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    if (!process.env.OPENAI_API_KEY) {
        return res.json({ reply: "AI assistant is being set up — check back soon!" });
    }

    const siteId = req.siteId;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

    // Fetch all business data in parallel
    const [
        bizRes, contentRes, bookingsThisWeek, bookingsLastWeek,
        revenueRes, customersRes, servicesRes, fleetRes,
        reviewsRes, specialsRes, upcomingRes
    ] = await Promise.all([
        supabase.from('businesses').select('name, type, subdomain, tagline, plan').eq('id', siteId).single(),
        supabase.from('site_content').select('contact_phone, address, city, hours, hours_note, description').eq('site_id', siteId).maybeSingle(),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('booking_date', weekAgo).not('status', 'eq', 'cancelled'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('site_id', siteId).gte('booking_date', twoWeeksAgo).lt('booking_date', weekAgo).not('status', 'eq', 'cancelled'),
        supabase.from('bookings').select('total').eq('site_id', siteId).gte('booking_date', weekAgo).not('status', 'eq', 'cancelled'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
        supabase.from('services').select('name, price, duration, description').eq('site_id', siteId).eq('active', true),
        supabase.from('fleet_types').select('name, capacity, price_per_hour, quantity').eq('site_id', siteId),
        supabase.from('reviews').select('rating, comment, customer_name, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(5),
        supabase.from('specials').select('title, description, day_of_week').eq('site_id', siteId).eq('active', true),
        supabase.from('bookings').select('customer_name, booking_date, total, status').eq('site_id', siteId).gte('booking_date', today).order('booking_date').limit(10)
    ]);

    const biz = bizRes.data || {};
    const content = contentRes.data || {};
    const weekRevenue = (revenueRes.data || []).reduce((s, b) => s + (b.total || 0), 0);
    const avgRating = (reviewsRes.data || []).length > 0
        ? ((reviewsRes.data || []).reduce((s, r) => s + r.rating, 0) / reviewsRes.data.length).toFixed(1)
        : 'No reviews yet';

    // Build human-readable context
    let context = `BUSINESS: ${biz.name || 'Unknown'} (${biz.type || 'business'})`;
    if (content.address) context += `\nAddress: ${content.address}, ${content.city || ''}`;
    if (content.contact_phone) context += `\nPhone: ${content.contact_phone}`;
    if (content.hours) context += `\nHours: ${content.hours}`;

    context += `\n\nTHIS WEEK'S STATS:`;
    context += `\n• Bookings this week: ${bookingsThisWeek.count || 0} (last week: ${bookingsLastWeek.count || 0})`;
    context += `\n• Revenue this week: $${Math.round(weekRevenue)}`;
    context += `\n• Total customers: ${customersRes.count || 0}`;
    context += `\n• Average rating: ${avgRating}`;

    if ((servicesRes.data || []).length) {
        context += `\n\nSERVICES:`;
        servicesRes.data.forEach(s => { context += `\n• ${s.name} — $${s.price}${s.duration ? ' (' + s.duration + ' min)' : ''}`; });
    }

    if ((fleetRes.data || []).length) {
        context += `\n\nFLEET:`;
        fleetRes.data.forEach(f => { context += `\n• ${f.name} — $${f.price_per_hour}/hr, capacity: ${f.capacity}, qty: ${f.quantity}`; });
    }

    if ((reviewsRes.data || []).length) {
        context += `\n\nRECENT REVIEWS:`;
        reviewsRes.data.forEach(r => { context += `\n• ${r.rating}★ from ${r.customer_name || 'Anonymous'}: "${(r.comment || '').slice(0, 100)}"`; });
    }

    if ((specialsRes.data || []).length) {
        context += `\n\nACTIVE SPECIALS:`;
        specialsRes.data.forEach(s => { context += `\n• ${s.title}${s.day_of_week ? ' (' + s.day_of_week + ')' : ''}: ${s.description || ''}`; });
    }

    if ((upcomingRes.data || []).length) {
        context += `\n\nUPCOMING BOOKINGS:`;
        upcomingRes.data.forEach(b => { context += `\n• ${b.booking_date} — ${b.customer_name || 'Unknown'} ($${b.total || 0}) [${b.status}]`; });
    }

    const systemPrompt = `You are the AI business assistant for ${biz.name || 'this business'}. You're a smart, friendly advisor who knows everything about the owner's business.

YOUR DATA (use this to answer questions — never make up numbers):
${context}

WHAT YOU CAN HELP WITH:
- Business questions ("How many bookings this week?" "What's my revenue?")
- Comparisons ("Am I doing better than last week?")
- Marketing help ("Write me an Instagram post" "Help me respond to this review")
- Pricing advice ("Should I raise my prices?" "What should I charge for a new service?")
- Strategy ("How can I get more bookings?" "What days are slowest?")

STYLE:
- Be direct and specific — use the actual numbers from their data
- Keep it concise (2-4 sentences unless they ask for something longer like a social post)
- Be encouraging but honest
- If you don't have enough data to answer, say so
- Always be actionable — give them something they can DO`;

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-10), { role: 'user', content: message }],
                max_tokens: 500, temperature: 0.7
            })
        });
        const data = await openaiRes.json();
        if (!openaiRes.ok) throw new Error(data.error?.message || 'OpenAI error');
        res.json({ reply: data.choices?.[0]?.message?.content || "Try rephrasing!" });
    } catch (err) {
        console.error('Dashboard AI chat error:', err.message);
        res.json({ reply: "Something went wrong — try again!" });
    }
});

module.exports = router;

const express = require('express');
const { authRequired } = require('../middleware/auth');
const supabase = require('../db');

const router = express.Router();

// All dashboard routes require authentication
router.use(authRequired);

// ============================================
// PROFILE
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

    if (bizUpdates) {
        const { name, type, logo_url, cover_url } = bizUpdates;
        await supabase
            .from('businesses')
            .update({ name, type, logo_url, cover_url, updated_at: new Date().toISOString() })
            .eq('site_id', req.siteId);
    }

    if (contentUpdates) {
        delete contentUpdates.site_id;
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

router.delete('/pricing/:id', async (req, res) => {
    const { error } = await supabase
        .from('rental_pricing')
        .delete()
        .eq('id', req.params.id)
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
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
        .select('*')
        .eq('site_id', req.siteId)
        .order('booking_date', { ascending: true });

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.date) query = query.eq('booking_date', req.query.date);
    if (req.query.from) query = query.gte('booking_date', req.query.from);
    if (req.query.to) query = query.lte('booking_date', req.query.to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
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
    // TODO: Emit event based on status change
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

    res.json(data || []);
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

router.get('/messaging-settings', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('messaging_settings')
        .eq('site_id', req.siteId)
        .single();

    res.json(data?.messaging_settings || {});
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

module.exports = router;

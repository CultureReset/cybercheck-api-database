const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { adminRequired } = require('../middleware/auth');
const supabase = require('../db');
const getGcrDb = require('../gcr-db');
const gcrDb = getGcrDb();

const router = express.Router();

// ============================================
// ADMIN LOGIN — must be BEFORE adminRequired middleware
// ============================================

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    // Admin can log in with email or username
    const { data: user, error } = await supabase
        .from('users')
        .select('id, site_id, email, password_hash, name, role')
        .eq('role', 'admin')
        .or(`email.eq.${username.toLowerCase()},name.eq.${username}`)
        .single();

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { userId: user.id, siteId: user.site_id || 'admin', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        success: true,
        token,
        name: user.name,
        email: user.email
    });
});

// Auth disabled — single admin dashboard, no auth system connected

// ============================================
// DASHBOARD HOME — Platform stats
// ============================================

router.get('/stats', adminRequired, async (req, res) => {
    const [businesses, users, bookings, orders] = await Promise.all([
        supabase.from('businesses').select('site_id, plan, status, created_at', { count: 'exact' }),
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('bookings').select('id, total, status, created_at', { count: 'exact' }),
        supabase.from('orders').select('id, total, status, created_at', { count: 'exact' })
    ]);

    const totalBusinesses = businesses.count || 0;
    const activeBusinesses = (businesses.data || []).filter(b => b.status === 'active').length;
    const totalBookings = bookings.count || 0;
    const totalRevenue = (bookings.data || []).reduce((sum, b) => sum + (b.total || 0), 0)
        + (orders.data || []).reduce((sum, o) => sum + (o.total || 0), 0);

    // Recent signups (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentSignups = (businesses.data || []).filter(b => b.created_at > weekAgo).length;

    res.json({
        total_businesses: totalBusinesses,
        active_businesses: activeBusinesses,
        total_users: users.count || 0,
        total_bookings: totalBookings,
        total_revenue: totalRevenue,
        recent_signups: recentSignups,
        plans: {
            free: (businesses.data || []).filter(b => b.plan === 'free').length,
            starter: (businesses.data || []).filter(b => b.plan === 'starter').length,
            pro: (businesses.data || []).filter(b => b.plan === 'pro').length,
            enterprise: (businesses.data || []).filter(b => b.plan === 'enterprise').length
        }
    });
});

// ============================================
// BUSINESSES — List, view, create, update, delete
// ============================================

router.get('/businesses', async (req, res) => {
    let query = supabase
        .from('businesses')
        .select('*, users(id, email, name, role)')
        .order('created_at', { ascending: false });

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.plan) query = query.eq('plan', req.query.plan);
    if (req.query.type) query = query.eq('type', req.query.type);
    if (req.query.search) {
        query = query.or(`name.ilike.%${req.query.search}%,subdomain.ilike.%${req.query.search}%,domain.ilike.%${req.query.search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.get('/businesses/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('businesses')
        .select('*, users(id, email, name, role), site_content(*), site_apps(app_id, enabled, apps(name, monthly_price))')
        .eq('site_id', req.params.id)
        .single();

    if (error) return res.status(404).json({ error: 'Business not found' });
    res.json(data);
});

router.post('/businesses', async (req, res) => {
    const { businessName, businessType, ownerName, ownerEmail, ownerPassword, plan, subdomain, domain, skipOnboarding } = req.body;

    if (!businessName || !businessType || !ownerEmail) {
        return res.status(400).json({ error: 'businessName, businessType, and ownerEmail required' });
    }

    const finalSubdomain = subdomain || businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Create business
    const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
            name: businessName,
            type: businessType,
            subdomain: finalSubdomain,
            domain: domain || null,
            plan: plan || 'free',
            status: skipOnboarding ? 'active' : 'setup'
        })
        .select()
        .single();

    if (bizError) return res.status(500).json({ error: bizError.message });

    // Create owner user
    const passwordHash = await bcrypt.hash(ownerPassword || 'changeme123', 12);

    const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
            site_id: business.site_id,
            email: ownerEmail.toLowerCase(),
            name: ownerName || businessName,
            password_hash: passwordHash,
            role: 'owner'
        })
        .select()
        .single();

    if (userError) {
        await supabase.from('businesses').delete().eq('site_id', business.site_id);
        return res.status(500).json({ error: userError.message });
    }

    // Create empty site_content
    await supabase.from('site_content').insert({
        site_id: business.site_id,
        contact_email: ownerEmail.toLowerCase()
    });

    res.status(201).json({ business, user: { id: user.id, email: user.email, name: user.name } });
});

router.put('/businesses/:id', async (req, res) => {
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.site_id;

    const { data, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('site_id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/businesses/:id', async (req, res) => {
    // Cascade delete handles all related data
    const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('site_id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// IMPERSONATION — Login as a business
// ============================================

router.post('/businesses/:id/impersonate', async (req, res) => {
    // Get the business owner
    const { data: user } = await supabase
        .from('users')
        .select('id, site_id, email, name, role')
        .eq('site_id', req.params.id)
        .eq('role', 'owner')
        .single();

    if (!user) {
        return res.status(404).json({ error: 'Business owner not found' });
    }

    const { data: business } = await supabase
        .from('businesses')
        .select('site_id, name, type, domain, subdomain, plan')
        .eq('site_id', req.params.id)
        .single();

    // Generate impersonation token (short-lived, marked as admin)
    const token = jwt.sign(
        {
            userId: user.id,
            siteId: user.site_id,
            role: user.role,
            impersonatedBy: req.userId,
            isImpersonation: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '4h' }
    );

    // Log impersonation in audit trail
    await supabase.from('audit_log').insert({
        admin_id: req.userId,
        action: 'impersonate',
        target_type: 'business',
        target_id: req.params.id,
        details: { business_name: business.name }
    }).catch(() => {}); // Audit table may not exist yet

    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        business
    });
});

// ============================================
// SUSPEND / UNSUSPEND
// ============================================

router.post('/businesses/:id/suspend', async (req, res) => {
    const { data, error } = await supabase
        .from('businesses')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('site_id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/businesses/:id/unsuspend', async (req, res) => {
    const { data, error } = await supabase
        .from('businesses')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('site_id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// USERS — List, update
// ============================================

router.get('/users', adminRequired, async (req, res) => {
    let query = supabase
        .from('users')
        .select('id, site_id, email, name, role, avatar_url, created_at, businesses(name, type)')
        .order('created_at', { ascending: false });

    if (req.query.search) {
        query = query.or(`name.ilike.%${req.query.search}%,email.ilike.%${req.query.search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.put('/users/:id', async (req, res) => {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.email) updates.email = req.body.email;

    if (req.body.password) {
        updates.password_hash = await bcrypt.hash(req.body.password, 12);
    }

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', req.params.id)
        .select('id, email, name, role')
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// APPS — Marketplace app management
// ============================================

router.get('/apps', async (req, res) => {
    const { data } = await supabase
        .from('apps')
        .select('*')
        .order('name', { ascending: true });

    // Get install counts
    const { data: installs } = await supabase
        .from('site_apps')
        .select('app_id')
        .eq('enabled', true);

    const installCounts = {};
    (installs || []).forEach(i => {
        installCounts[i.app_id] = (installCounts[i.app_id] || 0) + 1;
    });

    const apps = (data || []).map(app => ({
        ...app,
        install_count: installCounts[app.app_id] || 0
    }));

    res.json(apps);
});

router.post('/apps', async (req, res) => {
    const { data, error } = await supabase
        .from('apps')
        .insert(req.body)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/apps/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('apps')
        .update(req.body)
        .eq('app_id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/apps/:id', async (req, res) => {
    const { error } = await supabase
        .from('apps')
        .update({ status: 'disabled' })
        .eq('app_id', req.params.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// PLANS
// ============================================

router.get('/plans', async (req, res) => {
    // Plans are defined in config for now, not a DB table
    res.json([
        { id: 'free', name: 'Free', price: 0, features: ['Website', 'Linktree', 'Basic SEO', 'GCR Listing'] },
        { id: 'starter', name: 'Starter', price: 29, features: ['Everything in Free', 'Custom Domain', '2 Apps', 'Email Support'] },
        { id: 'pro', name: 'Pro', price: 79, features: ['Everything in Starter', 'Unlimited Apps', 'AI Assistant', 'Priority Support'] },
        { id: 'enterprise', name: 'Enterprise', price: 199, features: ['Everything in Pro', 'Multi-location', 'Dedicated Support', 'Custom Integrations'] }
    ]);
});

// ============================================
// REVENUE
// ============================================

router.get('/revenue', async (req, res) => {
    // Get all bookings with totals
    const { data: bookings } = await supabase
        .from('bookings')
        .select('total, created_at, payment_status')
        .eq('payment_status', 'paid');

    const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .neq('status', 'cancelled');

    const totalBookingRevenue = (bookings || []).reduce((sum, b) => sum + (b.total || 0), 0);
    const totalOrderRevenue = (orders || []).reduce((sum, o) => sum + (o.total || 0), 0);

    res.json({
        total_revenue: totalBookingRevenue + totalOrderRevenue,
        booking_revenue: totalBookingRevenue,
        order_revenue: totalOrderRevenue,
        total_transactions: (bookings || []).length + (orders || []).length
    });
});

// ============================================
// AUDIT LOG
// ============================================

router.get('/audit', async (req, res) => {
    const { data } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

    res.json(data || []);
});

// ============================================
// SYSTEM HEALTH
// ============================================

router.get('/system/health', async (req, res) => {
    const checks = {};

    // Supabase check
    try {
        const start = Date.now();
        await supabase.from('businesses').select('site_id').limit(1);
        checks.supabase = { status: 'ok', latency_ms: Date.now() - start };
    } catch (e) {
        checks.supabase = { status: 'error', error: e.message };
    }

    // Server info
    checks.server = {
        status: 'ok',
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb: Math.floor(process.memoryUsage().rss / 1024 / 1024),
        node_version: process.version
    };

    res.json({
        status: Object.values(checks).every(c => c.status === 'ok') ? 'healthy' : 'degraded',
        checks,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// TEMPLATES
// ============================================

router.get('/templates', async (req, res) => {
    const { data } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

    res.json(data || []);
});

router.post('/templates', async (req, res) => {
    const { data, error } = await supabase
        .from('templates')
        .insert(req.body)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/templates/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('templates')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// SUPPORT TICKETS
// ============================================

router.get('/support/tickets', async (req, res) => {
    const { data } = await supabase
        .from('support_tickets')
        .select('*, businesses(name)')
        .order('created_at', { ascending: false });

    res.json(data || []);
});

router.put('/support/tickets/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('support_tickets')
        .update(req.body)
        .eq('id', req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// TEST AI CONNECTION — POST /api/admin/test-ai
// ============================================
router.post('/test-ai', async (req, res) => {
    const { provider, api_key } = req.body;
    if (!provider || !api_key) {
        return res.status(400).json({ success: false, error: 'provider and api_key required' });
    }

    try {
        if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Say "ok"' }]
                })
            });
            const data = await response.json();
            if (data.error) return res.json({ success: false, error: data.error.message });
            return res.json({ success: true, provider: 'anthropic', model: data.model });

        } else if (provider === 'grok') {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + api_key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'grok-beta',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Say "ok"' }]
                })
            });
            const data = await response.json();
            if (data.error) return res.json({ success: false, error: data.error.message });
            return res.json({ success: true, provider: 'grok', model: data.model });

        } else if (provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + api_key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Say "ok"' }]
                })
            });
            const data = await response.json();
            if (data.error) return res.json({ success: false, error: data.error.message });
            return res.json({ success: true, provider: 'openai', model: data.model });

        } else {
            return res.status(400).json({ success: false, error: 'Unknown provider: ' + provider });
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// SET BUSINESS CONNECTION — POST /api/admin/set-connection
// Manually set any connection row for a business
// ============================================
router.post('/set-connection', async (req, res) => {
    const { site_id, provider, value } = req.body;
    if (!site_id || !provider || !value) return res.status(400).json({ error: 'site_id, provider, value required' });
    const now = new Date().toISOString();
    await supabase.from('connections').delete().eq('site_id', site_id).eq('provider', provider);
    const { error } = await supabase.from('connections').insert({ site_id, provider, account_name: value, status: 'connected', connected_at: now, updated_at: now });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// SAVE API KEY — POST /api/admin/save-api-key
// ============================================
router.post('/save-api-key', async (req, res) => {
    const { provider, ...keyData } = req.body;
    if (!provider) return res.status(400).json({ error: 'provider required' });

    // Store in Supabase platform_settings table
    const { error } = await supabase
        .from('platform_settings')
        .upsert({ key: 'api_key_' + provider, value: keyData, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// TEST OAUTH — POST /api/admin/test-oauth
// ============================================
router.post('/test-oauth', async (req, res) => {
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;
    const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    res.json({
        success: hasStripe && hasTwilio,
        message: [
            !hasStripe ? 'STRIPE_SECRET_KEY missing' : null,
            !hasTwilio ? 'Twilio credentials missing' : null
        ].filter(Boolean).join(', ') || 'All OAuth credentials configured'
    });
});

// ============================================
// GET /api/admin/businesses/:id/full — Full business data (CyberCheck legacy)
// ============================================
router.get('/businesses/:id/full', async (req, res) => {
    try {
        const { id } = req.params;
        const [bizRes, contentRes] = await Promise.all([
            supabase.from('businesses').select('*').eq('site_id', id).single(),
            supabase.from('site_content').select('*').eq('site_id', id).single(),
        ]);
        if (bizRes.error && bizRes.error.code !== 'PGRST116') return res.status(500).json({ error: bizRes.error.message });
        if (!bizRes.data) return res.status(404).json({ error: 'Business not found' });
        res.json({ business: bizRes.data, content: contentRes.data || {} });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// PUT /api/admin/businesses/:id/full — Update ALL tables for a business
// ============================================
router.put('/businesses/:id/full', async (req, res) => {
    const entityId = req.params.id;
    // Support both admin editor format (basic/location/social) and bd-dashboard format (business/content)
    const body = req.body;
    const basic    = body.basic    || (body.business ? body.business : null);
    const location = body.location || (body.content  ? { address: body.content.address, city: body.content.city, state: body.content.state, zip: body.content.zip, phone: body.content.contact_phone || body.content.phone, email: body.content.contact_email || body.content.email, website: body.content.website_url || body.content.website } : null);
    const social   = body.social   || (body.business ? { instagram: body.business.instagram, facebook: body.business.facebook, tiktok: body.business.tiktok } : null);
    const hours    = body.hours;
    const happyHour= body.happyHour || (body.content?.happy_hour ? body.content.happy_hour : null);
    const menu     = body.menu;
    const drinks   = body.drinks;
    const specials = body.specials;
    const events   = body.events;
    const packages = body.packages;
    // bd-dashboard extras
    const content  = body.content || {};
    const errors = [];

    // ── 1. entity core fields ─────────────────────────────────────────
    if (basic || location || social) {
        const upd = {};
        if (basic) {
            if (basic.name        !== undefined) upd.name         = basic.name;
            if (basic.tagline     !== undefined) upd.subtitle     = basic.tagline;
            if (basic.description !== undefined) upd.description  = basic.description;
            if (basic.priceRange  !== undefined) upd.price_range  = basic.priceRange;
            if (basic.price_from  !== undefined) upd.price_from   = basic.price_from  !== '' ? Number(basic.price_from)  : null;
            if (basic.price_to    !== undefined) upd.price_to     = basic.price_to    !== '' ? Number(basic.price_to)    : null;
            if (basic.price_unit  !== undefined) upd.price_unit   = basic.price_unit  || null;
            if (basic.emoji       !== undefined) upd.icon         = basic.emoji;
            if (basic.featured    !== undefined) upd.featured     = basic.featured;
            if (basic.type        !== undefined) upd.entity_subtype = basic.type;
            if (basic.status      !== undefined) upd.is_active    = basic.status === 'active';
        }
        if (location) {
            if (location.address !== undefined) upd.address_line_1 = location.address;
            if (location.city    !== undefined) upd.city           = location.city;
            if (location.state   !== undefined) upd.state          = location.state;
            if (location.zip     !== undefined) upd.zip            = location.zip;
            if (location.phone   !== undefined) upd.phone          = location.phone;
            if (location.email   !== undefined) upd.email          = location.email;
            if (location.website !== undefined) upd.website_url    = location.website;
            if (location.directions_url !== undefined) upd.directions_url = location.directions_url;
            if (location.booking_url    !== undefined) upd.booking_url    = location.booking_url;
            if (location.reservation_url !== undefined) upd.reservation_url = location.reservation_url;
        }
        if (social) {
            if (social.instagram !== undefined) upd.social_instagram = social.instagram;
            if (social.facebook  !== undefined) upd.social_facebook  = social.facebook;
            if (social.tiktok    !== undefined) upd.social_tiktok    = social.tiktok;
        }
        upd.updated_at = new Date().toISOString();
        const { error } = await gcrDb.from('entity').update(upd).eq('id', entityId);
        if (error) errors.push('entity: ' + error.message);
    }

    // ── 2. Hours ─────────────────────────────────────────────────────
    if (hours) {
        // Format 1: hours.schedule = [{day, open, close, closed}]
        if (Array.isArray(hours.schedule)) {
            for (const h of hours.schedule) {
                await gcrDb.from('entity_hours').upsert({ entity_id: entityId, day_of_week: h.day, open_time: h.open || null, close_time: h.close || null, is_closed: h.closed || false }, { onConflict: 'entity_id,day_of_week' });
            }
        }
        // Format 2: hours_mon, hours_tue etc. as strings "9am-5pm" or object {open,close}
        const dayMap = { hours_mon:'Monday', hours_tue:'Tuesday', hours_wed:'Wednesday', hours_thu:'Thursday', hours_fri:'Friday', hours_sat:'Saturday', hours_sun:'Sunday' };
        for (const [key, dayName] of Object.entries(dayMap)) {
            if (hours[key] === undefined) continue;
            const val = hours[key];
            let open = null, close = null, is_closed = false;
            if (!val || val === 'closed') { is_closed = true; }
            else if (typeof val === 'string' && val.includes('-')) {
                const parts = val.split('-').map(s => s.trim());
                open = parts[0]; close = parts[1];
            } else if (typeof val === 'object') { open = val.open; close = val.close; is_closed = val.closed || false; }
            await gcrDb.from('entity_hours').upsert({ entity_id: entityId, day_of_week: dayName, open_time: open, close_time: close, is_closed }, { onConflict: 'entity_id,day_of_week' });
        }
        // Format 3: content.hours object {mon, tue, ...}
        if (content.hours && typeof content.hours === 'object') {
            const cDayMap = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
            for (const [k, dayName] of Object.entries(cDayMap)) {
                const val = content.hours[k]; if (val === undefined) continue;
                let open = null, close = null, is_closed = false;
                if (!val || val === 'closed') { is_closed = true; }
                else if (typeof val === 'string' && val.includes('-')) { const p = val.split('-'); open = p[0]?.trim(); close = p[1]?.trim(); }
                else if (typeof val === 'object') { open = val.open; close = val.close; is_closed = val.closed || false; }
                await gcrDb.from('entity_hours').upsert({ entity_id: entityId, day_of_week: dayName, open_time: open, close_time: close, is_closed }, { onConflict: 'entity_id,day_of_week' });
            }
        }
    }

    // ── 3. Amenity tags (kids_friendly, pet_friendly etc.) ────────────
    if (hours) {
        const amenityMap = {
            kids_friendly: 'kids_friendly', pet_friendly: 'pet_friendly',
            live_music: 'live_music', outdoor_seating: 'outdoor_seating',
            reservations: 'reservations', delivery: 'delivery',
            takeout: 'takeout', alcohol: 'full_bar',
        };
        for (const [field, tag] of Object.entries(amenityMap)) {
            if (hours[field] === undefined) continue;
            if (hours[field]) {
                await gcrDb.from('entity_tags').upsert({ entity_id: entityId, tag, tag_category: 'amenity' }, { onConflict: 'entity_id,tag' });
            } else {
                await gcrDb.from('entity_tags').delete().eq('entity_id', entityId).eq('tag', tag);
            }
        }
    }

    // ── 4. Happy Hour ─────────────────────────────────────────────────
    if (happyHour !== undefined) {
        const upd = {};
        if (happyHour.days  !== undefined) upd.hh_days        = happyHour.days;
        if (happyHour.start !== undefined) upd.hh_start       = happyHour.start;
        if (happyHour.end   !== undefined) upd.hh_end         = happyHour.end;
        if (happyHour.description !== undefined) upd.hh_description = happyHour.description;
        if (Object.keys(upd).length) {
            const { error } = await gcrDb.from('entity').update(upd).eq('id', entityId);
            if (error) errors.push('happy_hour entity: ' + error.message);
        }
        // HH items
        if (Array.isArray(happyHour.items) && happyHour.items.length) {
            await gcrDb.from('happy_hour_items').delete().eq('entity_id', entityId);
            await gcrDb.from('happy_hour_sections').delete().eq('entity_id', entityId);
            const { data: sec } = await gcrDb.from('happy_hour_sections').insert({ entity_id: entityId, section_name: 'Happy Hour', sort_order: 0 }).select('id').single();
            if (sec?.id) {
                await gcrDb.from('happy_hour_items').insert(happyHour.items.map((item, i) => ({
                    entity_id: entityId, hh_section_id: sec.id,
                    item_name: item.name, description: item.description || null,
                    regular_price: item.regular_price || null, hh_price: item.price || item.hh_price || null,
                    price_text: item.price_text || null, sort_order: i
                })));
            }
        }
    }

    // ── 5. Specials ───────────────────────────────────────────────────
    if (specials !== undefined) {
        await gcrDb.from('entity_specials').delete().eq('entity_id', entityId);
        if (specials.length > 0) {
            const { error } = await gcrDb.from('entity_specials').insert(
                specials.map(s => ({
                    entity_id: entityId,
                    special_name: s.name || s.special_name,
                    description: s.description || null,
                    special_type: s.type || s.special_type || 'special',
                    days: Array.isArray(s.days) ? JSON.stringify(s.days) : (s.day || s.days || null),
                    start_time: s.start_time || s.time || null,
                    end_time: s.end_time || null,
                    discount_text: s.discount_text || null,
                    is_active: s.active !== false
                }))
            );
            if (error) errors.push('specials: ' + error.message);
        }
    }

    // ── 6. Events ─────────────────────────────────────────────────────
    if (events !== undefined) {
        // Delete only entity-linked events (not standalone CSV imports)
        await gcrDb.from('entity_events').delete().eq('entity_id', entityId);
        if (events.length > 0) {
            const { error } = await gcrDb.from('entity_events').insert(
                events.map(e => ({
                    entity_id: entityId,
                    event_name: e.name || e.event_name || e.title,
                    event_type: e.category || e.event_type || 'event',
                    description: e.description || null,
                    artist_name: e.artist_name || null,
                    day_of_week: e.recurring_day || e.day_of_week || null,
                    event_date: e.date || e.event_date || null,
                    start_time: e.time || e.start_time || null,
                    end_time: e.end_time || null,
                    recurring: e.recurring || false,
                    cover_charge: e.cover_charge ? String(e.cover_charge) : null,
                    is_active: e.active !== false
                }))
            );
            if (error) errors.push('events: ' + error.message);
        }
    }

    // ── 7. Menu items ─────────────────────────────────────────────────
    if (menu !== undefined) {
        // Split food vs drink if mixed in one array (admin editor sends item_type field)
        const foodItems  = menu.filter(i => (i.item_type || 'food') !== 'drink');
        const drinkItems = menu.filter(i => i.item_type === 'drink');
        // If drinks mixed in, merge into drinks array for step 8
        if (drinkItems.length && !drinks) { body.drinks_from_menu = drinkItems; }
        const menuOnly = foodItems;
        await gcrDb.from('menu_items').delete().eq('entity_id', entityId);
        await gcrDb.from('menu_sections').delete().eq('entity_id', entityId);
        if (menuOnly.length > 0) {
            const sectionCache = {};
            for (const [i, item] of menuOnly.entries()) {
                const secName = item.category || 'Menu';
                if (!sectionCache[secName]) {
                    const { data: sec } = await gcrDb.from('menu_sections').insert({ entity_id: entityId, section_name: secName, sort_order: Object.keys(sectionCache).length }).select('id').single();
                    sectionCache[secName] = sec?.id;
                }
                await gcrDb.from('menu_items').insert({
                    entity_id: entityId,
                    menu_section_id: sectionCache[secName] || null,
                    item_name: item.name,
                    description: item.description || null,
                    price: item.price || null,
                    allergens: Array.isArray(item.allergens) ? item.allergens.join(', ') : (item.allergens || null),
                    is_available: item.available !== false,
                    sort_order: i
                });
            }
        }
    }

    // ── 8. Drink items ────────────────────────────────────────────────
    const drinksToSave = drinks || body.drinks_from_menu;
    if (drinksToSave !== undefined) {
        await gcrDb.from('drink_items').delete().eq('entity_id', entityId);
        await gcrDb.from('drink_sections').delete().eq('entity_id', entityId);
        if (drinksToSave.length > 0) {
            const secCache = {};
            for (const [i, item] of drinksToSave.entries()) {
                const secName = item.category || 'Drinks';
                if (!secCache[secName]) {
                    const { data: sec } = await gcrDb.from('drink_sections').insert({ entity_id: entityId, section_name: secName, sort_order: Object.keys(secCache).length }).select('id').single();
                    secCache[secName] = sec?.id;
                }
                await gcrDb.from('drink_items').insert({
                    entity_id: entityId,
                    drink_section_id: secCache[secName] || null,
                    item_name: item.name,
                    description: item.description || null,
                    price: item.price || null,
                    item_style: item.style || null,
                    abv: item.abv || null,
                    brewery: item.brewery || null,
                    is_available: item.available !== false,
                    sort_order: i
                });
            }
        }
    }

    // ── 9. Packages ───────────────────────────────────────────────────
    if (packages !== undefined) {
        await gcrDb.from('packages').delete().eq('entity_id', entityId);
        if (packages.length > 0) {
            const { error } = await gcrDb.from('packages').insert(
                packages.filter(p => p.name).map((p, i) => ({
                    entity_id: entityId,
                    name: p.name,
                    description: p.description || null,
                    price: p.price || null,
                    price_label: p.price_label || null,
                    duration_minutes: p.duration_minutes || null,
                    whats_included: p.whats_included || [],
                    min_guests: p.min_guests || null,
                    max_guests: p.max_guests || null,
                    booking_url: p.booking_url || null,
                    active: p.active !== false,
                    sort_order: i
                }))
            );
            if (error) errors.push('packages: ' + error.message);
        }
    }

    // ── 10. bd-dashboard content fields (SEO, about, FAQ) ────────────
    if (content && Object.keys(content).length) {
        const entUpd = {};
        if (content.about_text)    entUpd.description = content.about_text;
        if (content.seo_description) entUpd.description = content.seo_description;
        if (Object.keys(entUpd).length) await gcrDb.from('entity').update(entUpd).eq('id', entityId);

        // SEO settings
        if (content.seo_title || content.seo_description || content.seo_keywords) {
            await gcrDb.from('gcr_seo_settings').upsert({
                entity_id: entityId,
                seo_title: content.seo_title || null,
                seo_description: content.seo_description || null,
                seo_keywords: content.seo_keywords || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'entity_id' });
        }

        // FAQ
        if (Array.isArray(content.faq) && content.faq.length) {
            await gcrDb.from('gcr_faqs').delete().eq('entity_id', entityId);
            await gcrDb.from('gcr_faqs').insert(content.faq.map((f, i) => ({
                entity_id: entityId,
                question: f.q || f.question,
                answer: f.a || f.answer,
                sort_order: i
            })));
        }
    }

    // ── 11. Custom tags (from bd-dashboard custom tags input) ─────────
    if (Array.isArray(body.custom_tags)) {
        for (const tag of body.custom_tags) {
            if (!tag) continue;
            const norm = tag.toLowerCase().replace(/[\s\-]+/g, '_');
            await gcrDb.from('entity_tags').upsert({ entity_id: entityId, tag: norm, tag_category: 'search' }, { onConflict: 'entity_id,tag' });
        }
    }

    // ── 12. Custom sections (arbitrary key/label/type) ────────────────
    if (Array.isArray(body.custom_sections)) {
        for (const sec of body.custom_sections) {
            if (!sec.key || !sec.label || !sec.type) continue;
            const { data: existing } = await gcrDb.from('entity_sections').select('id').eq('entity_id', entityId).eq('section_key', sec.key).single();
            if (!existing) {
                await gcrDb.from('entity_sections').insert({ entity_id: entityId, section_key: sec.key, section_label: sec.label, section_type: sec.type, sort_order: sec.sort_order || 99 });
            } else if (sec.label || sec.sort_order !== undefined) {
                await gcrDb.from('entity_sections').update({ section_label: sec.label, section_type: sec.type, sort_order: sec.sort_order || 99 }).eq('id', existing.id);
            }
        }
    }

    if (errors.length > 0) return res.status(207).json({ success: false, errors });
    res.json({ success: true });
});

// ============================================
// POST /api/admin/businesses/create-full — Create new GCR business (no user account)
// ============================================
router.post('/businesses/create-full', async (req, res) => {
    const { basic, location, hours, happyHour, menu, specials, events, social, packages } = req.body;

    if (!basic || !basic.name) {
        return res.status(400).json({ error: 'business name required' });
    }

    const slug = (basic.slug || basic.name)
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Create business row
    const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
            name: basic.name,
            type: basic.type || 'other',
            subdomain: slug,
            plan: 'free',
            status: basic.status || 'active',
            emoji: basic.emoji || null,
            featured: basic.featured || false,
            gcr_listed: basic.gcr_listed !== false,
            instagram: social?.instagram || null,
            facebook: social?.facebook || null,
            tiktok: social?.tiktok || null,
            spotify: social?.spotify || null
        })
        .select()
        .single();

    if (bizError) return res.status(500).json({ error: bizError.message });

    const siteId = business.site_id;

    // Create site_content
    await supabase.from('site_content').insert({
        site_id: siteId,
        tagline: basic.tagline || null,
        seo_description: basic.description || null,
        price_range: basic.priceRange || null,
        address: location?.address || null,
        city: location?.city || null,
        state: location?.state || null,
        zip: location?.zip || null,
        contact_phone: location?.phone || null,
        contact_email: location?.email || null,
        website_url: location?.website || null,
        hours: hours?.hours_text || null,
        hours_mon: hours?.hours_mon || null,
        hours_tue: hours?.hours_tue || null,
        hours_wed: hours?.hours_wed || null,
        hours_thu: hours?.hours_thu || null,
        hours_fri: hours?.hours_fri || null,
        hours_sat: hours?.hours_sat || null,
        hours_sun: hours?.hours_sun || null,
        kids_friendly: hours?.kids_friendly || false,
        pet_friendly: hours?.pet_friendly || false,
        live_music: hours?.live_music || false,
        outdoor_seating: hours?.outdoor_seating || false,
        reservations: hours?.reservations || false,
        delivery: hours?.delivery || false,
        takeout: hours?.takeout || false,
        alcohol: hours?.alcohol || false,
        happy_hour: happyHour || null
    });

    // Forward to the full update handler to insert specials, events, menu, packages
    if ((specials && specials.length) || (events && events.length) || (menu && menu.length) || (packages && packages.length)) {
        req.params = { id: siteId };
        req.body = { specials, events, menu, packages };
        // Inline the inserts rather than re-routing
        if (specials && specials.length) {
            await supabase.from('specials').insert(
                specials.map((s, i) => ({ site_id: siteId, name: s.name, description: s.description, discount_text: s.discount_text, day_of_week: s.day, time_range: s.time, active: true, sort_order: i }))
            );
        }
        if (events && events.length) {
            await supabase.from('events').insert(
                events.map(e => ({ site_id: siteId, name: e.name, description: e.description, event_date: e.date || null, event_time: e.time || null, active: true }))
            );
        }
        if (menu && menu.length) {
            await supabase.from('menu_items').insert(
                menu.map((item, i) => ({ site_id: siteId, name: item.name, description: item.description || null, price: item.price || null, category: item.category || 'Menu', available: true, sort_order: i }))
            );
        }
        if (packages && packages.length) {
            await supabase.from('services').insert(
                packages.filter(p => p.name).map((p, i) => ({ site_id: siteId, name: p.name, description: p.description || null, price: p.price || null, capacity: p.max_guests || null, duration_minutes: p.duration_minutes || null, category: 'package', available: true, sort_order: i }))
            );
        }
    }

    res.status(201).json({ success: true, site_id: siteId, business });
});

// ============================================
// GCR CSV IMPORT — All endpoints write to new GCR DB
// ============================================

// Shared helpers for import endpoints
function gcrImportHelpers(gcrDb) {
    async function getEntityId(slug) {
        if (!slug) return null;
        const { data } = await gcrDb.from('entity').select('id').eq('slug', slug).single();
        return data?.id || null;
    }
    async function upsertTag(entityId, tag, tag_category) {
        if (!tag || !entityId) return;
        await gcrDb.from('entity_tags').upsert(
            { entity_id: entityId, tag: tag.toLowerCase().trim(), tag_category },
            { onConflict: 'entity_id,tag', ignoreDuplicates: true }
        );
    }
    async function getOrCreate(table, match, insertData) {
        const query = Object.entries(match).reduce((q, [k, v]) => q.eq(k, v), gcrDb.from(table).select('id'));
        const { data: existing } = await query.single();
        if (existing) return existing.id;
        const { data: created } = await gcrDb.from(table).insert(insertData).select('id').single();
        return created?.id || null;
    }
    return { getEntityId, upsertTag, getOrCreate };
}

// ── POST /api/admin/gcr/import-entity — business row → GCR entity table
router.post('/gcr/import-entity', async (req, res) => {
    const gcrDb = getGcrDb();
    const row = req.body;
    if (!row.name) return res.status(400).json({ error: 'name required' });
    const { upsertTag } = gcrImportHelpers(gcrDb);

    const slug = (row.slug || row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const entityData = {
        slug, name: row.name, entity_subtype: row.entity_subtype || null,
        icon: row.icon || null, subtitle: row.subtitle || null,
        description: row.business_description || null,
        phone: row.phone || null, email: row.email || null,
        website_url: row.website_url || null, directions_url: row.directions_url || null,
        call_url: row.call_url || null, booking_url: row.booking_url || null,
        reservation_url: row.reservation_url || null, order_url: row.order_url || null,
        address_line_1: row.address_line_1 || null, city: row.city || null,
        state: row.state || null, zip: row.zip || null,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        price_range: row.price_range || null,
        rating: row.rating ? parseFloat(row.rating) : null,
        review_count: row.review_count ? parseInt(row.review_count) : null,
        hero_image_url: row.hero_image_url || null,
        featured: row.featured === 'true' || row.featured === true,
        hh_days: row.hh_days || null, hh_start: row.hh_start || null,
        hh_end: row.hh_end || null, hh_description: row.hh_description || null,
        social_instagram: row.social_instagram || null,
        social_facebook: row.social_facebook || null,
        social_tiktok: row.social_tiktok || null, is_active: true,
    };

    const { data: existing } = await gcrDb.from('entity').select('id').eq('slug', slug).single();
    let entityId, action;

    if (existing) {
        await gcrDb.from('entity').update(entityData).eq('id', existing.id);
        entityId = existing.id; action = 'updated';
    } else {
        const { data: created, error } = await gcrDb.from('entity').insert(entityData).select('id').single();
        if (error) return res.status(500).json({ error: error.message });
        entityId = created.id; action = 'created';
    }

    // Hours
    const fullDay = { mon:'monday', tue:'tuesday', wed:'wednesday', thu:'thursday', fri:'friday', sat:'saturday', sun:'sunday' };
    for (const [d, full] of Object.entries(fullDay)) {
        const open = row[`${d}_open`], close = row[`${d}_close`];
        if (open || close) {
            await gcrDb.from('entity_hours').upsert(
                { entity_id: entityId, day_of_week: full, open_time: open || null, close_time: close || null, is_closed: !open },
                { onConflict: 'entity_id,day_of_week' }
            );
        }
    }

    // About bullets
    if (row.bullet_text) {
        await gcrDb.from('entity_about_bullets').insert({ entity_id: entityId, icon: row.bullet_icon || null, text: row.bullet_text });
    }

    // Tags
    if (row.tags) {
        for (const tag of row.tags.split(',').map(t => t.trim()).filter(Boolean))
            await upsertTag(entityId, tag, 'feature');
    }

    res.json({ success: true, entity_id: entityId, action });
});

// Alias: old endpoint name still works
router.post('/gcr/import-csv', async (req, res) => {
    req.url = '/gcr/import-entity';
    router.handle(req, res, () => {});
});

// ── Grok AI normalization helper — cleans up messy CSV data before saving
async function normalizeRowsWithAI(rows, type, skipAI = false) {
    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey || !rows.length || skipAI) {
        return { rows, questions: [], skipped: skipAI ? 'skip_ai requested' : 'no API key' };
    }

    const prompts = {
        menu: `You are normalizing restaurant menu CSV import rows. Fix each row:
- menu_item_price: strip "$", commas, words like "each" → numeric string (e.g. "12.99"). Free/complimentary → "0". Unclear price → null.
- menu_item_name: proper title case, fix obvious typos.
- menu_section_name: normalize (e.g. "Apps" → "Appetizers", "Mains" → "Entrees", "Drinks" → "Beverages").
- If a row has no menu_item_name AND no menu_section_name, flag it in questions.
Return ONLY valid JSON: { "rows": [...normalized rows], "questions": ["any clarification questions"] }`,

        drinks: `You are normalizing drink menu CSV import rows. Fix:
- drink_item_price: strip "$", text → numeric (e.g. "7 dollars" → "7"). Free → "0".
- drink_item_style: normalize (IPA, Lager, Pale Ale, Stout, Sour, Cider, Wine, Cocktail, Mocktail, NA Beer, etc.)
- drink_section_name: normalize (e.g. "Beers on Tap" → "Draft Beer", "Wines" → "Wine", "Cocktails").
- drink_item_abv: strip "%" → numeric string.
Return ONLY valid JSON: { "rows": [...normalized rows], "questions": ["any clarification questions"] }`,

        events: `You are normalizing event CSV import rows. Fix:
- event_date: convert to YYYY-MM-DD. Use year ${new Date().getFullYear()} if not specified and date hasn't passed, ${new Date().getFullYear() + 1} if it has.
- event_start_time / event_end_time: normalize to "H:MM AM/PM" (e.g. "7pm" → "7:00 PM", "19:00" → "7:00 PM").
- event_name: proper title case.
- If days like "Every Friday" appear in name/description, set event_recurring="true" and event_day_of_week to that day name.
Return ONLY valid JSON: { "rows": [...normalized rows], "questions": ["any clarification questions"] }`,

        specials: `You are normalizing daily specials CSV import rows. Fix:
- special_days: normalize to comma-separated full day names (e.g. "Mon-Fri" → "Monday,Tuesday,Wednesday,Thursday,Friday", "every day" → "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday").
- special_start_time / special_end_time: normalize to "H:MM AM/PM".
- discount_text: if price/deal is in special_name or description but discount_text is empty, extract it (e.g. "$5 Long Islands" → "$5").
- special_type: classify as "food", "drink", "combo", or "event".
Return ONLY valid JSON: { "rows": [...normalized rows], "questions": ["any clarification questions"] }`,

        happyhour: `You are normalizing happy hour CSV import rows. Fix:
- hh_start / hh_end: normalize times to "H:MM AM/PM" (e.g. "4pm" → "4:00 PM", "16:00" → "4:00 PM").
- hh_days: comma-separated full day names (e.g. "Mon-Fri" → "Monday,Tuesday,Wednesday,Thursday,Friday", "weekdays" → "Monday,Tuesday,Wednesday,Thursday,Friday").
- hh_hh_price: strip "$" → numeric string. If it's a percentage discount, put in hh_price_text instead.
- hh_item_name: proper title case.
Return ONLY valid JSON: { "rows": [...normalized rows], "questions": ["any clarification questions"] }`,

        section_based: `You are normalizing section-based business data CSV import rows. Fix:
- section_type: must be one of: profile, tags, menu, drinks, special, event, service, dietary. Infer from content if missing (food item with price → "menu", has days + deal → "special", drink item → "drinks").
- item_name: proper title case.
- price: strip "$" and text → numeric string.
- For events: date → YYYY-MM-DD, time → "H:MM AM/PM".
- For specials: days → comma-separated full day names.
Return ONLY valid JSON: { "rows": [...normalized rows], "questions": ["any clarification questions"] }`,
    };

    const systemPrompt = prompts[type] || prompts.menu;
    const sample = rows.slice(0, 20);

    try {
        const controller = new AbortController();
        const aiTimeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
        const resp = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'grok-3-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Normalize these rows:\n${JSON.stringify(sample, null, 2)}\n\nReturn ONLY valid JSON.` },
                ],
                temperature: 0.1,
                max_tokens: 4000,
            }),
        });
        clearTimeout(aiTimeout);
        if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(`Grok API ${resp.status}: ${errData.error?.message || 'unknown error'}`);
        }
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || content.match(/(\{[\s\S]*\})/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : content);
        const normalizedRows = [...(parsed.rows || sample), ...rows.slice(20)];
        return { rows: normalizedRows, questions: parsed.questions?.filter(Boolean) || [], normalized: true };
    } catch (err) {
        // Gracefully fall back to original rows if Grok fails
        console.warn(`[normalizeRowsWithAI] Grok failed (${type}), using original rows:`, err.message);
        return { rows, questions: [], normalized: false, grok_error: err.message };
    }
}

// ── POST /api/admin/gcr/import-menu
// Query params: skip_ai=true to skip Grok normalization
router.post('/gcr/import-menu', async (req, res) => {
    const gcrDb = getGcrDb();
    let rows = Array.isArray(req.body) ? req.body : [req.body];
    if (!rows.length || rows.every(r => !r || (!r.slug && !r.menu_item_name && !r.menu_section_name)))
        return res.status(400).json({ error: 'No valid rows — required: slug, menu_item_name' });
    const aiResult = await normalizeRowsWithAI(rows, 'menu', !!req.query.skip_ai);
    if (aiResult.skipped) console.log(`[import-menu] Skipped AI normalization: ${aiResult.skipped}`);
    if (!aiResult.normalized && aiResult.grok_error) console.log(`[import-menu] Grok failed, proceeding with original rows: ${aiResult.grok_error}`);
    if (aiResult.questions.length) return res.json({ needs_clarification: true, questions: aiResult.questions, preview: aiResult.rows });
    rows = aiResult.rows;
    const { getEntityId, upsertTag, getOrCreate } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }

        const sectionId = row.menu_section_name ? await getOrCreate('menu_sections',
            { entity_id: entityId, section_name: row.menu_section_name },
            { entity_id: entityId, section_name: row.menu_section_name, icon: row.menu_section_icon || null, section_description: row.menu_section_description || null, section_note: row.menu_section_note || null, image_url: row.menu_section_image_url || null, available_days: row.menu_available_days || null, available_start: row.menu_available_start || null, available_end: row.menu_available_end || null, show_on_links_page: row.menu_show_on_links_page !== 'false' }
        ) : null;
        if (sectionId) await upsertTag(entityId, row.menu_section_name, 'menu_section');

        const subSectionId = (sectionId && row.menu_sub_section_name) ? await getOrCreate('menu_sub_sections',
            { entity_id: entityId, menu_section_id: sectionId, sub_section_name: row.menu_sub_section_name },
            { entity_id: entityId, menu_section_id: sectionId, sub_section_name: row.menu_sub_section_name, section_note: row.menu_sub_section_note || null }
        ) : null;
        if (subSectionId) await upsertTag(entityId, row.menu_sub_section_name, 'menu_sub_section');

        if (row.menu_item_name) {
            const { data: existing } = await gcrDb.from('menu_items').select('id')
                .eq('entity_id', entityId).eq('item_name', row.menu_item_name)
                .eq('menu_section_id', sectionId || null).maybeSingle();
            if (existing) { errors.push(`skipped duplicate menu item: ${row.menu_item_name}`); continue; }
            await gcrDb.from('menu_items').insert({
                entity_id: entityId, menu_section_id: sectionId, menu_sub_section_id: subSectionId,
                item_name: row.menu_item_name, description: row.menu_item_description || null,
                price: row.menu_item_price ? parseFloat(row.menu_item_price) : null,
                price_text: row.menu_item_price_text || null, allergens: row.menu_item_allergens || null,
                is_available: row.menu_item_is_available !== 'false', image_url: row.menu_item_image_url || null,
            });
            if (row.menu_item_allergens) {
                for (const a of row.menu_item_allergens.split(',').map(x => x.trim()).filter(Boolean))
                    await upsertTag(entityId, a, 'allergen');
            }
            inserted++;
        }
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-drinks
router.post('/gcr/import-drinks', async (req, res) => {
    const gcrDb = getGcrDb();
    let rows = Array.isArray(req.body) ? req.body : [req.body];
    if (!rows.length || rows.every(r => !r || (!r.slug && !r.drink_item_name)))
        return res.status(400).json({ error: 'No valid rows — required: slug, drink_item_name' });
    const aiResult = await normalizeRowsWithAI(rows, 'drinks', !!req.query.skip_ai);
    if (aiResult.questions.length) return res.json({ needs_clarification: true, questions: aiResult.questions, preview: aiResult.rows });
    rows = aiResult.rows;
    const { getEntityId, upsertTag, getOrCreate } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }

        const sectionId = row.drink_section_name ? await getOrCreate('drink_sections',
            { entity_id: entityId, section_name: row.drink_section_name },
            { entity_id: entityId, section_name: row.drink_section_name, section_note: row.drink_section_note || null, image_url: row.drink_section_image_url || null, available_days: row.drink_available_days || null, available_start: row.drink_available_start || null, available_end: row.drink_available_end || null }
        ) : null;
        if (sectionId) await upsertTag(entityId, row.drink_section_name, 'drink_type');

        if (row.drink_item_name) {
            const { data: existing } = await gcrDb.from('drink_items').select('id')
                .eq('entity_id', entityId).eq('item_name', row.drink_item_name)
                .eq('drink_section_id', sectionId || null).maybeSingle();
            if (existing) { errors.push(`skipped duplicate drink item: ${row.drink_item_name}`); continue; }
            await gcrDb.from('drink_items').insert({
                entity_id: entityId, drink_section_id: sectionId,
                item_name: row.drink_item_name, description: row.drink_item_description || null,
                price: row.drink_item_price ? parseFloat(row.drink_item_price) : null,
                price_text: row.drink_item_price_text || null,
                item_style: row.drink_item_style || null, abv: row.drink_item_abv || null,
                ibu: row.drink_item_ibu || null, brewery: row.drink_item_brewery || null,
                is_available: row.drink_item_is_available !== 'false', image_url: row.drink_item_image_url || null,
            });
            if (row.drink_item_style) await upsertTag(entityId, row.drink_item_style, 'beer_style');
            if (row.drink_item_brewery) await upsertTag(entityId, row.drink_item_brewery, 'brewery');
            inserted++;
        }
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-happyhour
router.post('/gcr/import-happyhour', async (req, res) => {
    const gcrDb = getGcrDb();
    let rows = Array.isArray(req.body) ? req.body : [req.body];
    if (!rows.length || rows.every(r => !r || !r.slug))
        return res.status(400).json({ error: 'No valid rows — required: slug' });
    const aiResult = await normalizeRowsWithAI(rows, 'happyhour', !!req.query.skip_ai);
    if (aiResult.questions.length) return res.json({ needs_clarification: true, questions: aiResult.questions, preview: aiResult.rows });
    rows = aiResult.rows;
    const { getEntityId, getOrCreate } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }

        if (row.hh_days || row.hh_start || row.hh_end) {
            await gcrDb.from('entity').update({ hh_days: row.hh_days || null, hh_start: row.hh_start || null, hh_end: row.hh_end || null, hh_description: row.hh_description || null }).eq('id', entityId);
        }

        const hhSectionId = row.hh_section_name ? await getOrCreate('happy_hour_sections',
            { entity_id: entityId, section_name: row.hh_section_name },
            { entity_id: entityId, section_name: row.hh_section_name }
        ) : null;

        if (row.hh_item_name) {
            await gcrDb.from('happy_hour_items').insert({
                entity_id: entityId, hh_section_id: hhSectionId,
                item_name: row.hh_item_name, description: row.hh_item_description || null,
                regular_price: row.hh_regular_price ? parseFloat(row.hh_regular_price) : null,
                hh_price: row.hh_hh_price ? parseFloat(row.hh_hh_price) : null,
                price_text: row.hh_price_text || null, image_url: row.hh_item_image_url || null,
            });
            inserted++;
        }
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-events
router.post('/gcr/import-events', async (req, res) => {
    const gcrDb = getGcrDb();
    let rows = Array.isArray(req.body) ? req.body : [req.body];
    if (!rows.length || rows.every(r => !r || (!r.slug && !r.event_name)))
        return res.status(400).json({ error: 'No valid rows — required: slug, event_name' });
    const aiResult = await normalizeRowsWithAI(rows, 'events', !!req.query.skip_ai);
    if (aiResult.questions.length) return res.json({ needs_clarification: true, questions: aiResult.questions, preview: aiResult.rows });
    rows = aiResult.rows;
    const { getEntityId, upsertTag } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        const { data: existingEvent } = await gcrDb.from('entity_events').select('id')
            .eq('entity_id', entityId).eq('event_name', row.event_name)
            .eq('event_date', row.event_date || null).maybeSingle();
        if (existingEvent) { errors.push(`skipped duplicate event: ${row.event_name}`); continue; }
        await gcrDb.from('entity_events').insert({
            entity_id: entityId, event_name: row.event_name, event_type: row.event_type || null,
            description: row.event_description || null, artist_name: row.event_artist_name || null,
            artist_about: row.event_artist_about || null, music_style: row.event_music_style || null,
            venue_location: row.event_venue_location || null, day_of_week: row.event_day_of_week || null,
            event_date: row.event_date || null, start_time: row.event_start_time || null,
            end_time: row.event_end_time || null,
            recurring: row.event_recurring === 'true' || row.event_recurring === true,
            recurring_start_date: row.event_recurring_start_date || null,
            recurring_end_date: row.event_recurring_end_date || null,
            cover_charge: row.event_cover_charge || null, image_url: row.event_image_url || null, is_active: true,
        });
        if (row.event_music_style) await upsertTag(entityId, row.event_music_style, 'music_style');
        if (row.event_type) await upsertTag(entityId, row.event_type, 'event_type');
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-specials
router.post('/gcr/import-specials', async (req, res) => {
    const gcrDb = getGcrDb();
    let rows = Array.isArray(req.body) ? req.body : [req.body];
    if (!rows.length || rows.every(r => !r || (!r.slug && !r.special_name)))
        return res.status(400).json({ error: 'No valid rows — required: slug, special_name' });
    const aiResult = await normalizeRowsWithAI(rows, 'specials', !!req.query.skip_ai);
    if (aiResult.questions.length) return res.json({ needs_clarification: true, questions: aiResult.questions, preview: aiResult.rows });
    rows = aiResult.rows;
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        const { data: existingSpecial } = await gcrDb.from('entity_specials').select('id')
            .eq('entity_id', entityId).eq('special_name', row.special_name).maybeSingle();
        if (existingSpecial) { errors.push(`skipped duplicate special: ${row.special_name}`); continue; }
        await gcrDb.from('entity_specials').insert({
            entity_id: entityId, special_name: row.special_name,
            description: row.special_description || null, special_type: row.special_type || null,
            days: row.special_days || null, start_time: row.special_start_time || null,
            end_time: row.special_end_time || null, discount_text: row.special_discount_text || null,
            image_url: row.special_image_url || null, is_active: true,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-photos
router.post('/gcr/import-photos', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        if (row.photo_image_url) {
            await gcrDb.from('entity_photos').insert({
                entity_id: entityId, image_url: row.photo_image_url,
                caption: row.photo_caption || null,
                is_cover: row.photo_is_cover === 'true' || row.photo_is_cover === true,
                sort_order: row.photo_sort_order ? parseInt(row.photo_sort_order) : 0,
            });
            inserted++;
        }
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-activities
router.post('/gcr/import-activities', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId, upsertTag } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('activities').insert({
            entity_id: entityId, activity_name: row.activity_name,
            activity_type: row.activity_type || null, description: row.activity_description || null,
            duration: row.activity_duration || null,
            min_age: row.activity_min_age ? parseInt(row.activity_min_age) : null,
            max_capacity: row.activity_max_capacity ? parseInt(row.activity_max_capacity) : null,
            image_url: row.activity_image_url || null,
            sort_order: row.activity_sort_order ? parseInt(row.activity_sort_order) : 0,
        });
        if (row.activity_type) await upsertTag(entityId, row.activity_type, 'activity_type');
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-section-based
// Accepts rows with columns: restaurant_name, section_type, section, item_name, description, price, tags, ...
// section_type values: profile | tags | menu | special | event | service | dietary
// Routes each row to the correct table automatically. Looks up entity by name or creates it.
router.post('/gcr/import-section-based', async (req, res) => {
    const gcrDb = getGcrDb();
    let rows = Array.isArray(req.body) ? req.body : [req.body];
    const aiResult = await normalizeRowsWithAI(rows, 'section_based', !!req.query.skip_ai);
    if (aiResult.questions.length) return res.json({ needs_clarification: true, questions: aiResult.questions, preview: aiResult.rows });
    rows = aiResult.rows;
    const { upsertTag } = gcrImportHelpers(gcrDb);

    // Group rows by entity_slug (if provided) or restaurant_name or slug
    const byRestaurant = {};
    for (const row of rows) {
        // Prefer entity_slug as the grouping key if explicitly provided
        const key = (row.entity_slug || row.restaurant_name || row.slug || '').trim();
        if (!key) continue;
        if (!byRestaurant[key]) byRestaurant[key] = [];
        byRestaurant[key].push(row);
    }

    let totalInserted = 0;
    const errors = [];

    for (const [key, rRows] of Object.entries(byRestaurant)) {
        const rname = key;
        // If key looks like a slug (no spaces), use directly; otherwise derive from name
        const slug = rname.includes(' ')
            ? rname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            : rname;

        // If entity_slug provided, try it directly first (exact slug, no derivation)
        const directSlug = rRows[0]?.entity_slug?.trim();

        // Find entity: prefer direct entity_slug → derived slug → name match
        let entity = null;
        if (directSlug) {
            const { data } = await gcrDb.from('entity').select('id, slug').eq('slug', directSlug).maybeSingle();
            entity = data;
        }
        if (!entity) {
            const { data } = await gcrDb.from('entity').select('id, slug').eq('slug', slug).maybeSingle();
            entity = data;
        }
        if (!entity) {
            // Try name match
            const { data: byName } = await gcrDb.from('entity').select('id, slug').ilike('name', rname).limit(1).maybeSingle();
            entity = byName;
        }

        // If still not found, create from profile row
        if (!entity) {
            const profileRow = rRows.find(r => r.section_type === 'profile');
            const addr = profileRow?.address || null;
            const { data: created, error: createErr } = await gcrDb.from('entity').insert({
                name: rname, slug,
                phone: profileRow?.phone || null,
                address_line_1: addr, city: profileRow?.city || null,
                state: profileRow?.state || null,
                entity_subtype: 'restaurant', is_active: false,
            }).select('id, slug').single();
            if (createErr || !created) { errors.push(`Failed to create entity: ${rname} — ${createErr?.message}`); continue; }
            entity = created;
        }

        const entityId = entity.id;
        const entitySlug = entity.slug;

        // Track created sections to avoid duplicate creates
        const sectionCache = {};
        async function getOrCreateSection(key, label, type, order) {
            if (sectionCache[key]) return sectionCache[key];
            const { data: existing } = await gcrDb.from('entity_sections').select('id').eq('entity_id', entityId).eq('section_key', key).maybeSingle();
            if (existing) { sectionCache[key] = existing.id; return existing.id; }
            const { data: created } = await gcrDb.from('entity_sections').insert({ entity_id: entityId, section_key: key, section_label: label, section_type: type, sort_order: order }).select('id').single();
            sectionCache[key] = created?.id;
            return created?.id;
        }

        // Track groups per section
        const groupCache = {};
        async function getOrCreateGroup(sectionId, title) {
            const cacheKey = `${sectionId}|${title}`;
            if (groupCache[cacheKey]) return groupCache[cacheKey];
            const { data: existing } = await gcrDb.from('section_groups').select('id').eq('section_id', sectionId).eq('title', title).maybeSingle();
            if (existing) { groupCache[cacheKey] = existing.id; return existing.id; }
            const { data: created } = await gcrDb.from('section_groups').insert({ section_id: sectionId, title, sort_order: 0 }).select('id').single();
            groupCache[cacheKey] = created?.id;
            return created?.id;
        }

        let menuOrder = 1;

        for (const row of rRows) {
            const stype = (row.section_type || '').toLowerCase().trim();

            try {
                if (stype === 'profile') {
                    // Update entity with profile fields if they're empty
                    const updates = {};
                    if (row.phone) updates.phone = row.phone;
                    if (row.city) updates.city = row.city;
                    if (row.state) updates.state = row.state;
                    if (row.address) updates.address_line_1 = row.address;
                    if (row.description) updates.description = row.description;
                    if (Object.keys(updates).length) await gcrDb.from('entity').update(updates).eq('id', entityId);
                    totalInserted++;

                } else if (stype === 'tags') {
                    // Tags from item_name column (comma-separated) or tags column
                    const tagStr = row.item_name || row.tags || '';
                    const tagList = tagStr.split(',').map(t => t.trim()).filter(Boolean);
                    for (const tag of tagList) await upsertTag(entityId, tag, 'feature');
                    totalInserted += tagList.length;

                } else if (stype === 'menu') {
                    const sectionName = (row.section || 'Menu').trim();
                    const sectionKey = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                    const sectionId = await getOrCreateSection(sectionKey, sectionName, 'grouped_items', menuOrder++);
                    if (!sectionId) { errors.push(`Section create failed: ${sectionName}`); continue; }

                    const groupId = await getOrCreateGroup(sectionId, sectionName);

                    const priceNum = parseFloat(row.price) || null;
                    const priceText = row.price ? '$' + row.price : null;
                    await gcrDb.from('section_items').insert({
                        section_id: sectionId, group_id: groupId || null,
                        item_name: row.item_name, item_description: row.description || null,
                        price_text: priceText, price_numeric: priceNum,
                        item_type: 'menu_item', sort_order: 0,
                    });
                    totalInserted++;

                } else if (stype === 'drinks') {
                    // Drinks: save to drink_sections + drink_items (dedicated tables)
                    const { getOrCreate: getOrCreateDrink } = gcrImportHelpers(gcrDb);
                    const drinkSectionName = (row.section || 'Drinks').trim();
                    const drinkSectionId = await (async () => {
                        const { data: ex } = await gcrDb.from('drink_sections').select('id').eq('entity_id', entityId).eq('section_name', drinkSectionName).maybeSingle();
                        if (ex) return ex.id;
                        const { data: cr } = await gcrDb.from('drink_sections').insert({ entity_id: entityId, section_name: drinkSectionName }).select('id').single();
                        return cr?.id;
                    })();
                    if (drinkSectionId && row.item_name) {
                        await gcrDb.from('drink_items').insert({
                            entity_id: entityId, drink_section_id: drinkSectionId,
                            item_name: row.item_name, description: row.description || null,
                            price: row.price ? parseFloat(row.price) : null,
                            price_text: row.price ? '$' + row.price : null,
                            is_available: true,
                        });
                        totalInserted++;
                    }

                } else if (stype === 'special') {
                    if (row.item_name) {
                        await gcrDb.from('entity_specials').insert({
                            entity_id: entityId, special_name: row.item_name,
                            description: row.description || null, is_active: true,
                        });
                        totalInserted++;
                    }

                } else if (stype === 'event') {
                    if (row.item_name) {
                        await gcrDb.from('entity_events').insert({
                            entity_id: entityId, event_name: row.item_name,
                            description: row.description || null,
                            recurring: true, is_active: true,
                        });
                        totalInserted++;
                    }

                } else if (stype === 'service') {
                    // Happy hour or other service notes — save as about bullet
                    if (row.item_name && row.description) {
                        await gcrDb.from('entity_about_bullets').insert({
                            entity_id: entityId, text: row.item_name + ': ' + row.description, icon: '🍺',
                        });
                        totalInserted++;
                    }

                } else if (stype === 'dietary') {
                    if (row.description) {
                        await gcrDb.from('entity_about_bullets').insert({
                            entity_id: entityId, text: row.description, icon: '🥗',
                        });
                        totalInserted++;
                    }
                }
            } catch (e) {
                errors.push(`[${rname}] ${stype}/${row.item_name}: ${e.message}`);
            }
        }
    }

    res.json({ success: true, inserted: totalInserted, errors, restaurants: Object.keys(byRestaurant).length });
});

// ── POST /api/admin/gcr/import-pricing
router.post('/gcr/import-pricing', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('pricing_items').insert({
            entity_id: entityId, package_name: row.pricing_package_name,
            description: row.pricing_description || null,
            price: row.pricing_price ? parseFloat(row.pricing_price) : null,
            price_text: row.pricing_price_text || null, price_unit: row.pricing_price_unit || null,
            time_slot_start: row.pricing_time_slot_start || null, time_slot_end: row.pricing_time_slot_end || null,
            available_days: row.pricing_available_days || null,
            min_people: row.pricing_min_people ? parseInt(row.pricing_min_people) : null,
            max_people: row.pricing_max_people ? parseInt(row.pricing_max_people) : null,
            duration: row.pricing_duration || null, image_url: row.pricing_image_url || null,
            sort_order: row.pricing_sort_order ? parseInt(row.pricing_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-slots
router.post('/gcr/import-slots', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('booking_slots').insert({
            entity_id: entityId, slot_name: row.slot_name,
            start_time: row.slot_start_time || null, end_time: row.slot_end_time || null,
            available_days: row.slot_available_days || null,
            sort_order: row.slot_sort_order ? parseInt(row.slot_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-fleet
router.post('/gcr/import-fleet', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('fleet_items').insert({
            entity_id: entityId, item_name: row.fleet_item_name,
            description: row.fleet_description || null,
            capacity: row.fleet_capacity ? parseInt(row.fleet_capacity) : null,
            weight: row.fleet_weight || null, dimensions: row.fleet_dimensions || null,
            max_capacity_text: row.fleet_max_capacity_text || null,
            image_url: row.fleet_image_url || null,
            sort_order: row.fleet_sort_order ? parseInt(row.fleet_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-addons
router.post('/gcr/import-addons', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('addons').insert({
            entity_id: entityId, addon_name: row.addon_name,
            description: row.addon_description || null,
            price: row.addon_price ? parseFloat(row.addon_price) : null,
            price_min: row.addon_price_min ? parseFloat(row.addon_price_min) : null,
            price_max: row.addon_price_max ? parseFloat(row.addon_price_max) : null,
            price_type: row.addon_price_type || 'add_on',
            dimensions: row.addon_dimensions || null, capacity_text: row.addon_capacity_text || null,
            image_url: row.addon_image_url || null,
            sort_order: row.addon_sort_order ? parseInt(row.addon_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-included
router.post('/gcr/import-included', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('whats_included').insert({
            entity_id: entityId, item_name: row.included_item_name,
            description: row.included_description || null, image_url: row.included_image_url || null,
            sort_order: row.included_sort_order ? parseInt(row.included_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-requirements
router.post('/gcr/import-requirements', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('requirements').insert({
            entity_id: entityId, requirement_text: row.requirement_text,
            sort_order: row.requirement_sort_order ? parseInt(row.requirement_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-policies
router.post('/gcr/import-policies', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('policies').insert({
            entity_id: entityId, policy_type: row.policy_type || null,
            policy_text: row.policy_text,
            sort_order: row.policy_sort_order ? parseInt(row.policy_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-meetingpoint
router.post('/gcr/import-meetingpoint', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('meeting_points').insert({
            entity_id: entityId, location_name: row.meetup_location_name || null,
            address: row.meetup_address || null, parking_info: row.meetup_parking_info || null,
            checkin_instructions: row.meetup_checkin_instructions || null,
            what_to_bring: row.meetup_what_to_bring || null, image_url: row.meetup_image_url || null,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-qna
router.post('/gcr/import-qna', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
        await gcrDb.from('entity_qna').insert({
            entity_id: entityId, section_label: row.qna_section_label || null,
            question: row.qna_question, answer: row.qna_answer || null,
            sort_order: row.qna_sort_order ? parseInt(row.qna_sort_order) : 0,
        });
        inserted++;
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-shopping
router.post('/gcr/import-shopping', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId, upsertTag, getOrCreate } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }

        const sectionId = row.product_section_name ? await getOrCreate('product_sections',
            { entity_id: entityId, section_name: row.product_section_name },
            { entity_id: entityId, section_name: row.product_section_name, available_days: row.product_section_available_days || null, available_start: row.product_section_available_start || null, available_end: row.product_section_available_end || null }
        ) : null;
        if (sectionId) await upsertTag(entityId, row.product_section_name, 'product_section');

        const subSectionId = (sectionId && row.product_sub_section_name) ? await getOrCreate('product_sub_sections',
            { entity_id: entityId, product_section_id: sectionId, sub_section_name: row.product_sub_section_name },
            { entity_id: entityId, product_section_id: sectionId, sub_section_name: row.product_sub_section_name }
        ) : null;
        if (subSectionId) await upsertTag(entityId, row.product_sub_section_name, 'product_sub_section');

        if (row.product_item_name) {
            await gcrDb.from('product_items').insert({
                entity_id: entityId, product_section_id: sectionId, product_sub_section_id: subSectionId,
                item_name: row.product_item_name, description: row.product_item_description || null,
                price: row.product_item_price ? parseFloat(row.product_item_price) : null,
                price_max: row.product_item_price_max ? parseFloat(row.product_item_price_max) : null,
                image_url: row.product_item_image_url || null,
                is_available: row.product_item_is_available !== 'false',
                sort_order: row.product_item_sort_order ? parseInt(row.product_item_sort_order) : 0,
            });
            inserted++;
        }
    }
    res.json({ success: true, inserted, errors });
});

// ── POST /api/admin/gcr/import-master — routes all record_types from master CSV
router.post('/gcr/import-master', async (req, res) => {
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const grouped = {};
    const typeToEndpoint = {
        business: 'import-entity', bullet: 'import-entity',
        menu: 'import-menu', drink: 'import-drinks',
        happy_hour: 'import-happyhour', event: 'import-events',
        special: 'import-specials', photo: 'import-photos',
        activity: 'import-activities', pricing: 'import-pricing',
        slot: 'import-slots', fleet: 'import-fleet',
        addon: 'import-addons', included: 'import-included',
        requirement: 'import-requirements', policy: 'import-policies',
        meetup: 'import-meetingpoint', qna: 'import-qna',
        shopping: 'import-shopping',
    };

    for (const row of rows) {
        const t = (row.record_type || '').toLowerCase().trim();
        if (!grouped[t]) grouped[t] = [];
        grouped[t].push(row);
    }

    const allResults = {};
    for (const [type, typeRows] of Object.entries(grouped)) {
        const endpoint = typeToEndpoint[type];
        if (!endpoint) { allResults[type] = { skipped: typeRows.length }; continue; }

        const mockReq = { body: typeRows };
        const mockRes = { json: (data) => { allResults[type] = data; } };
        // Call the matching sub-router handler inline
        await new Promise(resolve => {
            mockRes.json = (data) => { allResults[type] = data; resolve(); };
            router.handle({ ...mockReq, method: 'POST', url: `/gcr/${endpoint}`, path: `/gcr/${endpoint}` }, mockRes, resolve);
        });
    }

    res.json({ success: true, results: allResults });
});

// ============================================
// GCR BUSINESSES — list all gcr-listed businesses
// ============================================

// ── POST /api/admin/gcr/auto-activate-top5
// Score every entity by data completeness, activate top 5 per GCR category, deactivate rest
router.post('/gcr/auto-activate-top5', async (req, res) => {
    const db = getGcrDb();
    const topN = parseInt(req.body?.top_n) || 5;

    // Load all entities with the fields we score on
    const { data: entities, error } = await db.from('entity')
        .select('id, slug, name, entity_subtype, hero_image_url, description, phone, address_line_1, city, website_url, subtitle, rating, review_count, hh_days');
    if (error) return res.status(500).json({ error: error.message });

    // Load tag counts per entity
    const { data: tagRows } = await db.from('entity_tags').select('entity_id');
    const tagCounts = {};
    (tagRows || []).forEach(t => { tagCounts[t.entity_id] = (tagCounts[t.entity_id] || 0) + 1; });

    // Load hours counts per entity
    const { data: hourRows } = await db.from('entity_hours').select('entity_id');
    const hourCounts = {};
    (hourRows || []).forEach(h => { hourCounts[h.entity_id] = (hourCounts[h.entity_id] || 0) + 1; });

    // Map entity_subtype → GCR category
    const SUBTYPE_CAT = {
        restaurant:'restaurants', restaurants:'restaurants', bar:'restaurants', bar_grill:'restaurants',
        seafood:'restaurants', seafood_restaurant:'restaurants', casual_dining:'restaurants',
        steakhouse:'restaurants', pizza:'restaurants', mexican:'restaurants', breakfast_spot:'restaurants',
        beach_bar:'restaurants', hybrid_venue:'restaurants', southern:'restaurants',
        coffee_shop:'coffee-sweets', cafe:'coffee-sweets', bakery:'coffee-sweets',
        ice_cream:'coffee-sweets', dessert_bar:'coffee-sweets', smoothie:'coffee-sweets',
        boutique:'shopping', souvenir:'shopping', retail:'shopping', shopping:'shopping',
        surf_shop:'shopping', gift_shop:'shopping', clothing:'shopping', art_gallery:'shopping',
        parasailing:'things-to-do', dolphin_cruise:'things-to-do', boat_rental:'things-to-do',
        fishing_charter:'things-to-do', kayak_rental:'things-to-do', snorkeling:'things-to-do',
        tour:'things-to-do', attraction:'things-to-do', jet_ski:'things-to-do',
        nightlife:'nightlife', bar_club:'nightlife', nightclub:'nightlife',
        sports_bar:'nightlife', rooftop_bar:'nightlife', lounge:'nightlife',
    };

    // Score each entity
    const scored = entities.map(e => {
        const sub = (e.entity_subtype || '').toLowerCase().replace(/-/g, '_');
        const category = SUBTYPE_CAT[sub] || 'other';
        let score = 0;
        if (e.hero_image_url)   score += 4;
        if (e.description)      score += 3;
        if (e.phone)            score += 2;
        if (e.address_line_1)   score += 2;
        if (e.city)             score += 1;
        if (e.website_url)      score += 1;
        if (e.subtitle)         score += 1;
        if (e.rating)           score += 2;
        if (e.hh_days)          score += 1;
        score += Math.min(tagCounts[e.id] || 0, 8);   // up to 8pts for tags
        score += Math.min(hourCounts[e.id] || 0, 7);  // up to 7pts for hours
        return { id: e.id, name: e.name, category, score };
    });

    // Group by category, pick top N
    const byCategory = {};
    scored.forEach(e => {
        if (!byCategory[e.category]) byCategory[e.category] = [];
        byCategory[e.category].push(e);
    });

    const activateIds = new Set();
    const summary = {};
    for (const [cat, list] of Object.entries(byCategory)) {
        const top = list.sort((a, b) => b.score - a.score).slice(0, topN);
        top.forEach(e => activateIds.add(e.id));
        summary[cat] = top.map(e => ({ name: e.name, score: e.score }));
    }

    // Batch update: activate top, deactivate rest
    const allIds = entities.map(e => e.id);
    const deactivateIds = allIds.filter(id => !activateIds.has(id));

    if (activateIds.size)   await db.from('entity').update({ is_active: true  }).in('id', [...activateIds]);
    if (deactivateIds.length) await db.from('entity').update({ is_active: false }).in('id', deactivateIds);

    res.json({
        success: true,
        activated: activateIds.size,
        deactivated: deactivateIds.length,
        top_n: topN,
        summary,
    });
});

router.get('/gcr/businesses', adminRequired, async (req, res) => {
    const { search, category, status } = req.query;
    const db = getGcrDb();
    let query = db.from('entity').select('id, slug, name, entity_subtype, is_active, hero_image_url, phone, city, state').order('name', { ascending: true });
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'hidden') query = query.eq('is_active', false);
    if (category) query = query.ilike('entity_subtype', `%${category}%`);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ============================================
// GCR EVENTS — stored as section_cards in entity sections
// ============================================

// ============================================
// GCR EVENTS — new entity_events table
// ============================================

router.get('/gcr/events', async (req, res) => {
    const db = getGcrDb();
    let query = db.from('entity_events')
        .select('*, entity(name, slug)')
        .order('event_date', { ascending: true });
    if (req.query.entity_id) query = query.eq('entity_id', req.query.entity_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/gcr/events', async (req, res) => {
    const db = getGcrDb();
    const { entity_id, event_name, description, event_type, artist_name, artist_about, music_style, venue_location, day_of_week, event_date, start_time, end_time, recurring, recurring_start_date, recurring_end_date, cover_charge, image_url } = req.body;
    if (!entity_id || !event_name) return res.status(400).json({ error: 'entity_id and event_name required' });
    const { data, error } = await db.from('entity_events').insert({
        entity_id, event_name, description: description || null, event_type: event_type || null,
        artist_name: artist_name || null, artist_about: artist_about || null, music_style: music_style || null,
        venue_location: venue_location || null, day_of_week: day_of_week || null,
        event_date: event_date || null, start_time: start_time || null, end_time: end_time || null,
        recurring: recurring || false, recurring_start_date: recurring_start_date || null,
        recurring_end_date: recurring_end_date || null, cover_charge: cover_charge || null,
        image_url: image_url || null, is_active: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/events/:id', async (req, res) => {
    const db = getGcrDb();
    const { event_name, description, event_type, artist_name, artist_about, music_style, venue_location, day_of_week, event_date, start_time, end_time, recurring, recurring_start_date, recurring_end_date, cover_charge, image_url, is_active } = req.body;
    const { data, error } = await db.from('entity_events').update({
        event_name, description: description || null, event_type: event_type || null,
        artist_name: artist_name || null, artist_about: artist_about || null, music_style: music_style || null,
        venue_location: venue_location || null, day_of_week: day_of_week || null,
        event_date: event_date || null, start_time: start_time || null, end_time: end_time || null,
        recurring: recurring || false, recurring_start_date: recurring_start_date || null,
        recurring_end_date: recurring_end_date || null, cover_charge: cover_charge || null,
        image_url: image_url || null, is_active: is_active !== false,
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/events/:id', async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('entity_events').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GCR SPECIALS — new entity_specials table
// ============================================

router.get('/gcr/specials', async (req, res) => {
    const db = getGcrDb();
    let query = db.from('entity_specials')
        .select('*, entity(name, slug)')
        .not('special_name', 'ilike', '%happy hour%')
        .order('id', { ascending: false });
    if (req.query.entity_id) query = query.eq('entity_id', req.query.entity_id);
    if (req.query.type) query = query.eq('special_type', req.query.type);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/gcr/specials', async (req, res) => {
    const db = getGcrDb();
    const { entity_id, special_name, description, special_type, days, start_time, end_time, discount_text, image_url } = req.body;
    if (!entity_id || !special_name) return res.status(400).json({ error: 'entity_id and special_name required' });
    const { data, error } = await db.from('entity_specials').insert({
        entity_id, special_name, description: description || null, special_type: special_type || null,
        days: days || null, start_time: start_time || null, end_time: end_time || null,
        discount_text: discount_text || null, image_url: image_url || null, is_active: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/specials/:id', async (req, res) => {
    const db = getGcrDb();
    const { special_name, description, special_type, days, start_time, end_time, discount_text, image_url, is_active } = req.body;
    const { data, error } = await db.from('entity_specials').update({
        special_name, description: description || null, special_type: special_type || null,
        days: days || null, start_time: start_time || null, end_time: end_time || null,
        discount_text: discount_text || null, image_url: image_url || null,
        is_active: is_active !== false,
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/specials/:id', async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('entity_specials').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GCR MENU ITEMS — direct CRUD
// ============================================

router.put('/gcr/menu-sections/:sectionId', async (req, res) => {
    const db = getGcrDb();
    const { section_name, icon, section_description, sort_order } = req.body;
    const { data, error } = await db.from('menu_sections').update({
        section_name, icon: icon||null, section_description: section_description||null, sort_order: sort_order||0,
    }).eq('id', req.params.sectionId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/menu-sections/:sectionId', async (req, res) => {
    const db = getGcrDb();
    await db.from('menu_items').delete().eq('menu_section_id', req.params.sectionId);
    const { error } = await db.from('menu_sections').delete().eq('id', req.params.sectionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.post('/gcr/entities/:id/menu-sections', async (req, res) => {
    const db = getGcrDb();
    const { section_name, icon, section_description, sort_order } = req.body;
    if (!section_name) return res.status(400).json({ error: 'section_name required' });
    const { data, error } = await db.from('menu_sections').insert({
        entity_id: req.params.id, section_name, icon: icon||null,
        section_description: section_description||null, sort_order: sort_order||0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.post('/gcr/entities/:id/menu-items', async (req, res) => {
    const db = getGcrDb();
    const { item_name, description, price, price_text, menu_section_id, allergens, image_url } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const { data, error } = await db.from('menu_items').insert({
        entity_id: req.params.id, menu_section_id: menu_section_id||null,
        item_name, description: description||null,
        price: price != null ? parseFloat(price) : null, price_text: price_text||null,
        allergens: allergens||null, image_url: image_url||null, is_available: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/menu-items/:itemId', async (req, res) => {
    const db = getGcrDb();
    const { item_name, description, price, price_text, menu_section_id, allergens, image_url, is_available } = req.body;
    const { data, error } = await db.from('menu_items').update({
        item_name, description: description||null,
        price: price != null ? parseFloat(price) : null, price_text: price_text||null,
        menu_section_id: menu_section_id||null, allergens: allergens||null,
        image_url: image_url||null, is_available: is_available !== false,
    }).eq('id', req.params.itemId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/menu-items/:itemId', async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('menu_items').delete().eq('id', req.params.itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GCR DRINK ITEMS — direct CRUD
// ============================================

router.post('/gcr/entities/:id/drink-sections', async (req, res) => {
    const db = getGcrDb();
    const { section_name, section_note, sort_order } = req.body;
    if (!section_name) return res.status(400).json({ error: 'section_name required' });
    const { data, error } = await db.from('drink_sections').insert({
        entity_id: req.params.id, section_name, section_note: section_note||null, sort_order: sort_order||0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.post('/gcr/entities/:id/drink-items', async (req, res) => {
    const db = getGcrDb();
    const { item_name, description, price, price_text, drink_section_id, item_style, image_url } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const { data, error } = await db.from('drink_items').insert({
        entity_id: req.params.id, drink_section_id: drink_section_id||null,
        item_name, description: description||null,
        price: price != null ? parseFloat(price) : null, price_text: price_text||null,
        item_style: item_style||null, image_url: image_url||null, is_available: true,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/drink-items/:itemId', async (req, res) => {
    const db = getGcrDb();
    const { item_name, description, price, price_text, drink_section_id, item_style, image_url, is_available } = req.body;
    const { data, error } = await db.from('drink_items').update({
        item_name, description: description||null,
        price: price != null ? parseFloat(price) : null, price_text: price_text||null,
        drink_section_id: drink_section_id||null, item_style: item_style||null,
        image_url: image_url||null, is_available: is_available !== false,
    }).eq('id', req.params.itemId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/drink-items/:itemId', async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('drink_items').delete().eq('id', req.params.itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GCR HAPPY HOUR ITEMS — direct CRUD
// ============================================

router.post('/gcr/entities/:id/hh-sections', async (req, res) => {
    const db = getGcrDb();
    const { section_name, sort_order } = req.body;
    if (!section_name) return res.status(400).json({ error: 'section_name required' });
    const { data, error } = await db.from('happy_hour_sections').insert({
        entity_id: req.params.id, section_name, sort_order: sort_order||0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.post('/gcr/entities/:id/hh-items', async (req, res) => {
    const db = getGcrDb();
    const { item_name, description, price, price_text, hh_section_id } = req.body;
    if (!item_name) return res.status(400).json({ error: 'item_name required' });
    const { data, error } = await db.from('happy_hour_items').insert({
        entity_id: req.params.id, hh_section_id: hh_section_id||null,
        item_name, description: description||null,
        price: price != null ? parseFloat(price) : null, price_text: price_text||null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/hh-items/:itemId', async (req, res) => {
    const db = getGcrDb();
    const { item_name, description, price, price_text } = req.body;
    const { data, error } = await db.from('happy_hour_items').update({
        item_name, description: description||null,
        price: price != null ? parseFloat(price) : null, price_text: price_text||null,
    }).eq('id', req.params.itemId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/hh-items/:itemId', async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('happy_hour_items').delete().eq('id', req.params.itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// PUT /api/admin/gcr/entities/:id/happy-hour — update HH schedule on entity
router.put('/gcr/entities/:id/happy-hour', async (req, res) => {
    const db = getGcrDb();
    const { hh_days, hh_start, hh_end, hh_description } = req.body;
    const { data, error } = await db.from('entity').update({
        hh_days: hh_days||null, hh_start: hh_start||null,
        hh_end: hh_end||null, hh_description: hh_description||null,
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ============================================
// GET /api/admin/gcr/business-data/:siteId — fetch all data for full editor
// ============================================
// Duplicate removed — see GCR version below

// ============================================
// POST /api/admin/upload-photo — upload photo to Supabase Storage
// ============================================
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ============================================
// POST /api/admin/scrape-url — Fetch and extract text from any URL
// ============================================

router.post('/scrape-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        const r = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; GCR-Admin-Bot/1.0)',
                'Accept': 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
        const html = await r.text();

        // Strip HTML tags and extract readable text
        const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
            .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
            .replace(/<header[\s\S]*?<\/header>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
            .replace(/\s{3,}/g, '\n\n')
            .trim()
            .slice(0, 15000);  // Cap at 15k chars to keep AI prompt manageable

        res.json({ url, text, length: text.length });
    } catch (err) {
        res.status(500).json({ error: 'Scrape failed: ' + err.message });
    }
});

// ============================================
// POST /api/admin/ai-save-business — Save AI-organized business data to Supabase
// Body: { business: {...structured data from ai-organize...} }
// ============================================

router.post('/ai-save-business', async (req, res) => {
    const { business: d } = req.body;
    if (!d || !d.name) return res.status(400).json({ error: 'business.name is required' });

    const subdomain = (d.subdomain || d.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
        // Upsert into businesses table
        const bizRow = {
            name:             d.name,
            type:             d.type || 'other',
            subdomain:        subdomain,
            tagline:          d.tagline || null,
            emoji:            d.emoji   || null,
            tags:             d.tags    || [],
            price_range:      d.price_range || null,
            happy_hour:       !!d.happy_hour,
            live_music:       !!d.live_music,
            waterfront:       !!d.waterfront,
            kids_friendly:    !!d.kids_friendly,
            pet_friendly:     !!d.pet_friendly,
            outdoor:          !!d.outdoor,
            alcohol:          !!d.alcohol,
            booking_required: !!d.booking_required,
            status:           'active',
            gcr_listed:       true,
            gcr_verified:     false,
        };

        // Check if business already exists
        const { data: existing } = await supabase.from('businesses').select('site_id').eq('subdomain', subdomain).single();

        let siteId;
        if (existing) {
            siteId = existing.site_id;
            await supabase.from('businesses').update(bizRow).eq('site_id', siteId);
        } else {
            const { data: inserted, error: bizErr } = await supabase.from('businesses').insert(bizRow).select('site_id').single();
            if (bizErr) throw new Error('businesses insert: ' + bizErr.message);
            siteId = inserted.site_id;
        }

        // Upsert site_content
        const social = d.social || {};
        const contentRow = {
            site_id:       siteId,
            about_text:    d.description || null,
            contact_phone: d.phone       || null,
            website_url:   d.website     || null,
            address:       d.address     || null,
            city:          d.city        || null,
            state:         d.state       || null,
            zip:           d.zip         || null,
            hours:         d.hours       || null,
            social_links:  Object.keys(social).length ? social : null,
            features:      d.features    || [],
            perfect_for:   d.perfect_for || [],
            highlights:    d.highlights  || [],
            restrictions:  d.restrictions || [],
            what_to_bring: d.what_to_bring || [],
            schedules:     d.schedules   || [],
            happy_hour:    d.happy_hour  || null,
            bar_menu:      d.bar_menu    || null,
        };

        const { error: contentErr } = await supabase.from('site_content').upsert(contentRow, { onConflict: 'site_id' });
        if (contentErr) throw new Error('site_content upsert: ' + contentErr.message);

        // Insert menu items (delete existing first if updating)
        if (d.menu_items && d.menu_items.length) {
            if (existing) await supabase.from('menu_items').delete().eq('site_id', siteId);
            const menuRows = d.menu_items.map((item, i) => ({
                site_id:     siteId,
                name:        item.name,
                description: item.description || null,
                price:       item.price ? String(item.price).replace('$','') : null,
                category:    item.category || 'Menu',
                available:   true,
                sort_order:  i,
            }));
            const { error: menuErr } = await supabase.from('menu_items').insert(menuRows);
            if (menuErr) throw new Error('menu_items insert: ' + menuErr.message);
        }

        // Insert specials
        if (d.specials && d.specials.length) {
            if (existing) await supabase.from('specials').delete().eq('site_id', siteId);
            const specialRows = d.specials.map(s => ({
                site_id:       siteId,
                name:          s.name,
                description:   s.description || null,
                type:          s.type || 'daily_special',
                days:          s.days || [],
                start_time:    s.start_time || null,
                end_time:      s.end_time   || null,
                discount_text: s.discount_text || null,
                active:        true,
            }));
            await supabase.from('specials').insert(specialRows);
        }

        // Insert events
        if (d.events && d.events.length) {
            if (existing) await supabase.from('events').delete().eq('site_id', siteId);
            const eventRows = d.events.map(e => ({
                site_id:     siteId,
                title:       e.title || e.name,
                description: e.description || null,
                event_date:  e.event_date  || null,
                event_time:  e.event_time  || null,
                active:      true,
            }));
            await supabase.from('events').insert(eventRows);
        }

        // Insert fleet
        if (d.fleet && d.fleet.length) {
            if (existing) await supabase.from('fleet_types').delete().eq('site_id', siteId);
            const fleetRows = d.fleet.map((f, i) => ({
                site_id:        siteId,
                name:           f.name,
                description:    f.description || null,
                capacity:       f.capacity || null,
                price_per_hour: f.price_per_hour || null,
                active:         true,
                sort_order:     i,
            }));
            await supabase.from('fleet_types').insert(fleetRows);
        }

        res.json({
            success: true,
            site_id: siteId,
            slug: subdomain,
            message: `${d.name} saved to Supabase (${existing ? 'updated' : 'created'}). Profile at /business.html?id=${subdomain}`,
        });

    } catch (err) {
        console.error('ai-save-business error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/upload-photo', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { site_id, folder } = req.body;
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${site_id || 'admin'}/${Date.now()}.${ext}`;
    const bucket = 'media';
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) return res.status(500).json({ error: error.message });
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
    // Save to media table if site_id provided
    if (site_id) {
        await supabase.from('media').insert({ site_id, url: publicUrl, filename: req.file.originalname, file_type: 'image', folder: folder || 'gallery', file_size: req.file.size });
    }
    res.json({ url: publicUrl });
});

// ============================================
// GET /api/admin/ai-settings — Get AI config
// PUT /api/admin/ai-settings — Save AI config
// ============================================

router.get('/ai-settings', async (req, res) => {
    const { data, error } = await supabase.from('ai_settings').select('*').eq('id', 1).single();
    if (error) return res.status(500).json({ error: error.message });
    // Mask API keys in response — show enough to confirm they exist
    const masked = { ...data };
    const maskKey = k => { if (masked[k]) masked[k] = masked[k].slice(0, 8) + '••••••••'; };
    maskKey('chat_api_key');
    maskKey('embed_api_key');
    maskKey('api_key_anthropic');
    maskKey('api_key_openai');
    maskKey('api_key_grok');
    res.json(masked);
});

router.put('/ai-settings', async (req, res) => {
    const allowed = ['chat_provider','chat_model','chat_api_key','embed_provider','embed_model','embed_api_key','embed_dimensions','rag_enabled','voice_enabled','system_prompt','api_key_anthropic','api_key_openai','api_key_grok'];
    const update = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    // Don't overwrite keys if they're masked (client sent back a masked value)
    ['chat_api_key','embed_api_key','api_key_anthropic','api_key_openai','api_key_grok'].forEach(k => {
        if (update[k] && update[k].includes('••••')) delete update[k];
    });
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('ai_settings').upsert({ id: 1, ...update }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// ============================================
// GET /api/admin/rag-status — Index status
// ============================================

router.get('/rag-status', async (req, res) => {
    const { data: indexed, error } = await supabase
        .from('business_embeddings')
        .select('slug, business_name, chunk_type, updated_at')
        .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Summarize by business
    const bySlug = {};
    (indexed || []).forEach(row => {
        if (!bySlug[row.slug]) bySlug[row.slug] = { name: row.business_name, slug: row.slug, chunks: 0, last_indexed: row.updated_at };
        bySlug[row.slug].chunks++;
        if (row.updated_at > bySlug[row.slug].last_indexed) bySlug[row.slug].last_indexed = row.updated_at;
    });

    // Total businesses in GCR
    const { count: totalBiz } = await supabase.from('businesses').select('site_id', { count: 'exact' }).eq('gcr_listed', true).eq('status', 'active');

    res.json({
        indexed_businesses: Object.keys(bySlug).length,
        total_gcr_businesses: totalBiz || 0,
        total_chunks: (indexed || []).length,
        businesses: Object.values(bySlug).sort((a, b) => b.last_indexed.localeCompare(a.last_indexed)),
    });
});

// ============================================
// POST /api/admin/ai-organize — Parse raw business text into structured data
// Body: { raw_text, business_type? }
// Returns: structured JSON matching the DB schema for admin to review + approve
// ============================================

router.post('/ai-organize', async (req, res) => {
    const { raw_text, business_type } = req.body;
    if (!raw_text || raw_text.trim().length < 20) {
        return res.status(400).json({ error: 'raw_text is required (at least 20 characters)' });
    }

    // Load AI settings
    const { data: settings } = await supabase.from('ai_settings').select('*').eq('id', 1).single();
    const cfg = settings || {};

    const provider  = cfg.chat_provider || 'grok';
    const model     = cfg.chat_model    || 'grok-3';

    // Pick the right API key for the active provider
    let apiKey;
    if (provider === 'anthropic') {
        apiKey = cfg.api_key_anthropic || cfg.chat_api_key || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    } else if (provider === 'openai') {
        apiKey = cfg.api_key_openai || cfg.chat_api_key || process.env.OPENAI_API_KEY;
    } else if (provider === 'grok') {
        apiKey = cfg.api_key_grok || cfg.chat_api_key || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    } else if (provider === 'groq') {
        apiKey = cfg.chat_api_key || process.env.GROQ_API_KEY;
    } else {
        apiKey = cfg.chat_api_key;
    }

    if (!apiKey) {
        return res.status(503).json({ error: `No API key configured for ${provider}. Go to AI Settings and add your ${provider} key.` });
    }

    const systemPrompt = `You are a data extraction assistant for Gulf Coast Radar, a tourism directory for Orange Beach and Gulf Shores, Alabama.

Your job is to extract structured business information from raw text (website copy, scraped HTML, PDFs, or pasted content) and output ONLY valid JSON matching the exact schema below. No explanation, no markdown — just the raw JSON object.

SCHEMA:
{
  "name": "string — business display name",
  "type": "one of: restaurants | things-to-do | nightlife | coffee-sweets | shopping | hotels | services | other",
  "subdomain": "string — lowercase slug (e.g. cobalt-the-restaurant)",
  "tagline": "string — short one-liner",
  "emoji": "single emoji that fits the business",
  "description": "string — 2-3 sentence about section",
  "phone": "string — phone number",
  "address": "string — street address",
  "city": "string",
  "state": "string — 2 letter abbreviation",
  "zip": "string",
  "website": "string — website URL",
  "price_range": "$ | $$ | $$$ | $$$$",
  "hours": { "Monday": "open–close or Closed", "Tuesday": "...", "Wednesday": "...", "Thursday": "...", "Friday": "...", "Saturday": "...", "Sunday": "..." },
  "social": { "instagram": "url", "facebook": "url", "google_maps": "url" },
  "features": ["array of feature strings like 'Waterfront', 'Pet Friendly', 'Live Music'"],
  "perfect_for": ["array like 'Date night', 'Families', 'Groups'"],
  "happy_hour": "string time range OR { schedule: 'string', deals: [{name, desc, price}] } OR null",
  "menu_items": [{ "item_name": "string", "description": "string", "price": "number or null", "category": "section name like 'Starters' or 'Lunch' or 'Dinner'" }],
  "bar_menu": [{ "category": "string", "items": [{ "item_name": "string", "desc": "string", "price": "string" }] }] or null,
  "specials": [{ "special_name": "string", "description": "string", "type": "daily_special|happy_hour|weekly", "days": ["Monday","Friday"], "start_time": "HH:MM", "end_time": "HH:MM", "discount_text": "string" }],
  "events": [{ "event_name": "string", "description": "string", "event_date": "YYYY-MM-DD or null", "start_time": "HH:MM or null" }],
  "fleet": [{ "name": "string", "description": "string", "capacity": number_or_null, "price_per_hour": number_or_null }],
  "schedules": [{ "name": "slot name", "time": "departure time", "tickets": [{ "name": "Adult|Child|Senior", "price": "dollar amount" }] }],
  "highlights": ["array of included items or experience highlights"],
  "restrictions": ["array of guest info or restriction strings"],
  "what_to_bring": ["array of items guests should bring"],
  "tags": ["array of relevant tags for search"],
  "kids_friendly": true or false,
  "pet_friendly": true or false,
  "live_music": true or false,
  "waterfront": true or false,
  "outdoor": true or false,
  "alcohol": true or false,
  "booking_required": true or false
}

Only include fields that have actual data in the source. Use null for unknown fields. Never invent data that isn't present.${business_type ? `\n\nThis business is type: ${business_type}` : ''}`;

    const userMessage = `Extract all structured data from the following business information:\n\n${raw_text.slice(0, 12000)}`;

    try {
        let answer = '';

        if (provider === 'anthropic') {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userMessage }] }),
            });
            if (!r.ok) { const e = await r.text(); throw new Error(`Anthropic ${r.status}: ${e}`); }
            const d = await r.json();
            answer = d.content?.[0]?.text || '';
        } else if (provider === 'openai' || provider === 'groq' || provider === 'grok') {
            const baseUrl = provider === 'groq' ? 'https://api.groq.com/openai/v1'
                         : provider === 'grok'  ? 'https://api.x.ai/v1'
                         : 'https://api.openai.com/v1';
            const r = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: model || 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], max_tokens: 4096, response_format: { type: 'json_object' } }),
            });
            if (!r.ok) { const e = await r.text(); throw new Error(`${provider} ${r.status}: ${e}`); }
            const d = await r.json();
            answer = d.choices?.[0]?.message?.content || '';
        } else {
            return res.status(400).json({ error: `Unsupported provider: ${provider}` });
        }

        // Parse the JSON response
        let structured;
        try {
            // Strip markdown code fences if present
            const cleaned = answer.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
            structured = JSON.parse(cleaned);
        } catch (parseErr) {
            return res.status(422).json({ error: 'AI returned invalid JSON', raw: answer.slice(0, 500) });
        }

        res.json({ success: true, structured });

    } catch (err) {
        console.error('ai-organize error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ============================================
// GCR BUSINESS EDITOR — Full data loader
// ============================================

router.get('/gcr/business-data/:siteId', async (req, res) => {
    const { siteId } = req.params;
    // siteId is entity_id in GCR DB
    const entityId = siteId;
    const [
        entityRes, menuSecRes, menuItemsRes, drinkSecRes, drinkItemsRes,
        specialsRes, eventsRes, reviewsRes, photosRes, hoursRes,
        tagsRes, featuresRes, pfRes, sectionsRes, hhSecRes, hhItemsRes,
        highlightsRes, detailsRes, atmosphereRes, filtersRes, logisticsRes,
        packagesRes, staffRes, faqsRes, qaRes, mediaRes
    ] = await Promise.all([
        gcrDb.from('entity').select('*').eq('id', entityId).single(),
        gcrDb.from('menu_sections').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('menu_items').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('drink_sections').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('drink_items').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('entity_specials').select('*').eq('entity_id', entityId),
        gcrDb.from('entity_events').select('*').eq('entity_id', entityId).order('event_date'),
        gcrDb.from('gcr_reviews').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }),
        gcrDb.from('entity_photos').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('entity_hours').select('*').eq('entity_id', entityId),
        gcrDb.from('entity_tags').select('*').eq('entity_id', entityId),
        gcrDb.from('entity_features').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('entity_perfect_for').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('entity_sections').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('happy_hour_sections').select('*').eq('entity_id', entityId),
        gcrDb.from('happy_hour_items').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('business_highlights').select('*').eq('site_id', entityId).single(),
        gcrDb.from('business_details').select('*').eq('site_id', entityId).single(),
        gcrDb.from('business_atmosphere').select('*').eq('site_id', entityId).single(),
        gcrDb.from('business_filters').select('*').eq('site_id', entityId).single(),
        gcrDb.from('business_logistics').select('*').eq('site_id', entityId).single(),
        gcrDb.from('packages').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('staff').select('*').eq('entity_id', entityId),
        gcrDb.from('gcr_faqs').select('*').eq('entity_id', entityId).order('sort_order'),
        gcrDb.from('qa_pairs').select('*').eq('entity_id', entityId),
        gcrDb.from('business_media').select('*').eq('entity_id', entityId).order('sort_order'),
    ]);
    res.json({
        business:      entityRes.data    || {},
        menu_sections: menuSecRes.data   || [],
        menu:          menuItemsRes.data || [],
        drink_sections:drinkSecRes.data  || [],
        drinks:        drinkItemsRes.data|| [],
        specials:      specialsRes.data  || [],
        events:        eventsRes.data    || [],
        reviews:       reviewsRes.data   || [],
        photos:        photosRes.data    || [],
        hours:         hoursRes.data     || [],
        tags:          tagsRes.data      || [],
        features:      featuresRes.data  || [],
        perfect_for:   pfRes.data        || [],
        sections:      sectionsRes.data  || [],
        hh_sections:   hhSecRes.data     || [],
        hh_items:      hhItemsRes.data   || [],
        highlights:    highlightsRes.data|| {},
        details:       detailsRes.data   || {},
        atmosphere:    atmosphereRes.data|| {},
        filters:       filtersRes.data   || {},
        logistics:     logisticsRes.data || {},
        packages:      packagesRes.data  || [],
        staff:         staffRes.data     || [],
        faqs:          faqsRes.data      || [],
        qa_pairs:      qaRes.data        || [],
        media:         mediaRes.data     || [],
    });
});

// Fleet — Circle Boats only, stays on old DB
router.post('/businesses/:siteId/fleet', async (req, res) => {
    const { siteId } = req.params;
    const { items } = req.body;
    await supabase.from('fleet_types').delete().eq('site_id', siteId);
    if (items && items.length) {
        const rows = items.map((it, i) => ({ ...it, site_id: siteId, sort_order: i, active: it.active !== false }));
        const { error } = await supabase.from('fleet_types').insert(rows);
        if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
});

// Addons — Circle Boats only, stays on old DB
router.post('/businesses/:siteId/addons', async (req, res) => {
    const { siteId } = req.params;
    const { items } = req.body;
    await supabase.from('rental_addons').delete().eq('site_id', siteId);
    if (items && items.length) {
        const rows = items.map((it, i) => ({ ...it, site_id: siteId, sort_order: i, active: it.active !== false }));
        const { error } = await supabase.from('rental_addons').insert(rows);
        if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
});

// Schedule → GCR DB entity_sections (grouped_items)
router.put('/businesses/:siteId/schedule', async (req, res) => {
    const entityId = req.params.siteId;
    const { schedules } = req.body;
    // Upsert the schedules section
    const { data: sec } = await gcrDb.from('entity_sections').upsert({ entity_id: entityId, section_key: 'schedules', section_label: 'Schedules', section_type: 'grouped_items', sort_order: 5 }, { onConflict: 'entity_id,section_key' }).select('id').single();
    if (sec?.id) {
        await gcrDb.from('section_groups').delete().eq('section_id', sec.id);
        for (const [i, sched] of (schedules || []).entries()) {
            const { data: grp } = await gcrDb.from('section_groups').insert({ section_id: sec.id, title: sched.name, subtitle: sched.time, sort_order: i }).select('id').single();
            if (grp?.id) {
                for (const [j, t] of (sched.tickets || []).entries()) {
                    await gcrDb.from('section_items').insert({ section_id: sec.id, group_id: grp.id, item_name: t.name || 'Ticket', price_numeric: t.price || null, item_type: 'ticket', sort_order: j });
                }
            }
        }
    }
    res.json({ success: true });
});

// Highlights / restrictions / what_to_bring → GCR DB sections
router.put('/businesses/:siteId/highlights', async (req, res) => {
    const entityId = req.params.siteId;
    const { highlights, restrictions, what_to_bring } = req.body;
    const sections = [
        { key: 'highlights', label: 'Highlights', items: highlights, sort: 2 },
        { key: 'restrictions', label: 'Requirements', items: restrictions, sort: 20 },
        { key: 'what_to_bring', label: 'What to Bring', items: what_to_bring, sort: 21 },
    ];
    for (const s of sections) {
        if (!s.items?.length) continue;
        const { data: sec } = await gcrDb.from('entity_sections').upsert({ entity_id: entityId, section_key: s.key, section_label: s.label, section_type: 'bullets', sort_order: s.sort }, { onConflict: 'entity_id,section_key' }).select('id').single();
        if (sec?.id) {
            await gcrDb.from('section_bullets').delete().eq('section_id', sec.id);
            await gcrDb.from('section_bullets').insert(s.items.map((t, i) => ({ section_id: sec.id, bullet_text: String(t), sort_order: i })));
        }
    }
    res.json({ success: true });
});

// Photos → GCR DB entity_photos
router.post('/businesses/:siteId/photos', async (req, res) => {
    const entityId = req.params.siteId;
    const { url, caption, section } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    const { data, error } = await gcrDb.from('entity_photos').insert({ entity_id: entityId, image_url: url, caption: caption || '', sort_order: 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, photo: data });
});

router.delete('/businesses/:siteId/photos/:photoId', async (req, res) => {
    const { photoId } = req.params;
    const { error } = await gcrDb.from('entity_photos').delete().eq('id', photoId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Reviews → GCR DB gcr_reviews
router.put('/businesses/:siteId/reviews/:reviewId', async (req, res) => {
    const { reviewId } = req.params;
    const { active, status } = req.body;
    const upd = {};
    if (active !== undefined) upd.status = active ? 'approved' : 'pending';
    if (status) upd.status = status;
    const { error } = await gcrDb.from('gcr_reviews').update(upd).eq('id', reviewId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/businesses/:siteId/reviews/:reviewId', async (req, res) => {
    const { reviewId } = req.params;
    const { error } = await gcrDb.from('gcr_reviews').delete().eq('id', reviewId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Menu → GCR DB menu_items
router.post('/businesses/:siteId/menu', async (req, res) => {
    const entityId = req.params.siteId;
    const item = req.body;
    // Find or create the section
    const sectionName = item.category || 'General';
    let sectionId = item.menu_section_id;
    if (!sectionId) {
        const { data: sec } = await gcrDb.from('menu_sections').insert({ entity_id: entityId, section_name: sectionName, sort_order: 0 }).select('id').single();
        sectionId = sec?.id;
    }
    const row = { entity_id: entityId, menu_section_id: sectionId, item_name: item.name || item.item_name, description: item.description || null, price: item.price || null, allergens: item.allergens || null, is_available: item.available !== false, image_url: item.image_url || null, sort_order: item.sort_order || 0 };
    const { data, error } = item.id
        ? await gcrDb.from('menu_items').update(row).eq('id', item.id).select().single()
        : await gcrDb.from('menu_items').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/businesses/:siteId/menu/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const { error } = await gcrDb.from('menu_items').delete().eq('id', itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Specials → GCR DB entity_specials
router.post('/businesses/:siteId/specials', async (req, res) => {
    const entityId = req.params.siteId;
    const item = { ...req.body, entity_id: entityId };
    delete item.site_id;
    if (!item.special_name) item.special_name = item.name || 'Special';
    const { data, error } = item.id
        ? await gcrDb.from('entity_specials').update(item).eq('id', item.id).select().single()
        : await gcrDb.from('entity_specials').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/businesses/:siteId/specials/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const { error } = await gcrDb.from('entity_specials').delete().eq('id', itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Events → GCR DB entity_events
router.post('/businesses/:siteId/events', async (req, res) => {
    const entityId = req.params.siteId;
    const item = { ...req.body, entity_id: entityId };
    delete item.site_id;
    if (!item.event_name) item.event_name = item.name || item.title || 'Event';
    const { data, error } = item.id
        ? await gcrDb.from('entity_events').update(item).eq('id', item.id).select().single()
        : await gcrDb.from('entity_events').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/businesses/:siteId/events/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const { error } = await gcrDb.from('entity_events').delete().eq('id', itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================================
// GCR ENTITY ADMIN — Full CRUD for new entity/section schema
// ============================================================

// ── Entity CRUD ──────────────────────────────────────────────

// GET /api/admin/gcr/entities
router.get('/gcr/entities', adminRequired, async (req, res) => {
    // Try with sponsored column first, fall back without it
    let data, error;
    ({ data, error } = await gcrDb
        .from('entity')
        .select('id, slug, name, subtitle, entity_type, entity_subtype, icon, rating, review_count, city, state, is_active, is_sponsored, hero_image_url, phone, address_line_1, directions_url, website_url, created_at')
        .order('name')
        .range(0, 999));

    if (error) {
        // Retry without is_sponsored in case column doesn't exist
        ({ data, error } = await gcrDb
            .from('entity')
            .select('id, slug, name, subtitle, entity_type, entity_subtype, icon, rating, review_count, city, state, is_active, hero_image_url, phone, address_line_1, directions_url, website_url, created_at')
            .order('name')
            .range(0, 999));
    }
    if (error) return res.status(500).json({ error: error.message });

    // Batch-fetch tags for all entities (graceful if table doesn't exist)
    const entityIds = (data || []).map(e => e.id);
    let tagMap = {};
    if (entityIds.length) {
        try {
            const { data: tagRows } = await gcrDb.from('entity_tags').select('entity_id, id, tag, tag_category').in('entity_id', entityIds);
            (tagRows || []).forEach(r => {
                if (!tagMap[r.entity_id]) tagMap[r.entity_id] = [];
                tagMap[r.entity_id].push({ id: r.id, tag: r.tag, tag_category: r.tag_category });
            });
        } catch(e) { /* entity_tags table may not exist yet */ }
    }

    const entities = (data || []).map(e => ({ ...e, _tags: tagMap[e.id] || [] }));
    res.json({ entities });
});

// POST /api/admin/gcr/entities
router.post('/gcr/entities', async (req, res) => {
    const { entity, features, perfect_for, tags } = req.body;
    if (!entity || !entity.slug || !entity.name) {
        return res.status(400).json({ error: 'slug and name are required' });
    }

    const { data: created, error } = await gcrDb.from('entity').insert({ ...entity, is_active: true }).select('id').single();
    if (error) return res.status(500).json({ error: error.message });

    const entityId = created.id;

    // Insert features, perfect_for, tags if provided
    if (features?.length) {
        await gcrDb.from('entity_features').insert(features.map((f, i) => ({ entity_id: entityId, label: f.label || f, sort_order: f.sort_order || i })));
    }
    if (perfect_for?.length) {
        await gcrDb.from('entity_perfect_for').insert(perfect_for.map((p, i) => ({ entity_id: entityId, label: p.label || p, sort_order: p.sort_order || i })));
    }
    if (tags?.length) {
        await gcrDb.from('entity_tags').insert(tags.map((t, i) => ({ entity_id: entityId, tag: t.tag || t, tag_category: t.tag_category || null, sort_order: i })));
    }

    // Auto-create location + hours sections
    const defaultSections = [
        { entity_id: entityId, section_key: 'location', section_label: 'Location', section_type: 'location', sort_order: 99 },
        { entity_id: entityId, section_key: 'hours', section_label: 'Hours', section_type: 'hours', sort_order: 98 },
    ];
    await gcrDb.from('entity_sections').insert(defaultSections);

    res.json({ success: true, id: entityId });
});

// GET /api/admin/gcr/entities/:id — single entity with all related data
router.get('/gcr/entities/:id', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { id } = req.params;
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRe.test(id)) return res.status(400).json({ error: 'Invalid entity ID format' });
        const [entRes, hoursRes, featRes, tagsRes, pfRes] = await Promise.all([
            gcrDb.from('entity').select('*').eq('id', id).single(),
            gcrDb.from('entity_hours').select('*').eq('entity_id', id).order('id'),
            gcrDb.from('entity_features').select('*').eq('entity_id', id).order('sort_order'),
            gcrDb.from('entity_tags').select('*').eq('entity_id', id),
            gcrDb.from('entity_perfect_for').select('*').eq('entity_id', id).order('sort_order'),
        ]);
        if (entRes.error && entRes.error.code !== 'PGRST116') return res.status(500).json({ error: entRes.error.message });
        if (!entRes.data) return res.status(404).json({ error: 'Entity not found' });
        res.json({
            entity:      entRes.data,
            hours:       hoursRes.data || [],
            features:    featRes.data || [],
            tags:        tagsRes.data || [],
            perfect_for: pfRes.data || [],
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/gcr/entities/:id/features
router.get('/gcr/entities/:id/features', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { id } = req.params;
        const { data, error } = await gcrDb.from('entity_features').select('*').eq('entity_id', id).order('sort_order');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/gcr/entities/:id
router.put('/gcr/entities/:id', async (req, res) => {
    const { id } = req.params;
    const { entity } = req.body;
    const { error } = await gcrDb.from('entity').update({ ...entity, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// DELETE /api/admin/gcr/entities/:id (soft delete)
router.delete('/gcr/entities/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await gcrDb.from('entity').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Features / Perfect For / Tags ─────────────────────────────

// POST /api/admin/gcr/entities/:id/features
router.post('/gcr/entities/:id/features', async (req, res) => {
    const { id } = req.params;
    const { label, sort_order } = req.body;
    const { data, error } = await gcrDb.from('entity_features').insert({ entity_id: id, label, sort_order: sort_order || 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, feature: data });
});

router.delete('/gcr/entities/:id/features/:featureId', async (req, res) => {
    const { id, featureId } = req.params;
    const { error } = await gcrDb.from('entity_features').delete().eq('id', featureId).eq('entity_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// POST /api/admin/gcr/entities/:id/perfect-for
router.post('/gcr/entities/:id/perfect-for', async (req, res) => {
    const { id } = req.params;
    const { label, sort_order } = req.body;
    const { data, error } = await gcrDb.from('entity_perfect_for').insert({ entity_id: id, label, sort_order: sort_order || 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/gcr/entities/:id/perfect-for/:itemId', async (req, res) => {
    const { id, itemId } = req.params;
    const { error } = await gcrDb.from('entity_perfect_for').delete().eq('id', itemId).eq('entity_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// POST /api/admin/gcr/entities/:id/tags — Add a tag
router.post('/gcr/entities/:id/tags', async (req, res) => {
    const { id } = req.params;
    const { tag, tag_category } = req.body;
    if (!tag) return res.status(400).json({ error: 'tag is required' });
    const { data, error } = await gcrDb.from('entity_tags').insert({ entity_id: id, tag: tag.toLowerCase().trim(), tag_category: tag_category || null }).select().single();
    if (error && error.code === '23505') return res.status(409).json({ error: 'Tag already exists' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, tag: data });
});

router.delete('/gcr/entities/:id/tags/:tagId', async (req, res) => {
    const { id, tagId } = req.params;
    const { error } = await gcrDb.from('entity_tags').delete().eq('id', tagId).eq('entity_id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Sections CRUD ────────────────────────────────────────────

// GET /api/admin/gcr/entities/:id/sections — all sections + content
router.get('/gcr/entities/:id/sections', async (req, res) => {
    const { id } = req.params;
    const { data: sections, error } = await gcrDb
        .from('entity_sections')
        .select('id, section_key, section_label, section_type, sort_order')
        .eq('entity_id', id)
        .order('sort_order');

    if (error) return res.status(500).json({ error: error.message });
    res.json({ sections: sections || [] });
});

// POST /api/admin/gcr/entities/:id/sections — add section
router.post('/gcr/entities/:id/sections', async (req, res) => {
    const { id } = req.params;
    const { section_key, section_label, section_type, sort_order } = req.body;
    const { data, error } = await gcrDb.from('entity_sections').insert({
        entity_id: id, section_key, section_label, section_type, sort_order: sort_order || 0,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, section: data });
});

// PUT /api/admin/gcr/entities/:id/sections/:sectionId — update section meta
router.put('/gcr/entities/:id/sections/:sectionId', async (req, res) => {
    const { sectionId } = req.params;
    const { section_label, sort_order } = req.body;
    const { error } = await gcrDb.from('entity_sections').update({ section_label, sort_order }).eq('id', sectionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// DELETE /api/admin/gcr/entities/:id/sections/:sectionId
router.delete('/gcr/entities/:id/sections/:sectionId', async (req, res) => {
    const { sectionId } = req.params;
    // Cascade deletes all content rows via FK
    const { error } = await gcrDb.from('entity_sections').delete().eq('id', sectionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Section Content: Rich Text ────────────────────────────────

// GET /api/admin/gcr/sections/:sectionId/rich-text-get
router.get('/gcr/sections/:sectionId/rich-text-get', async (req, res) => {
    const { sectionId } = req.params;
    const { data, error } = await gcrDb.from('section_rich_text').select('body_text').eq('section_id', sectionId).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ body_text: data?.body_text || '' });
});

// PUT /api/admin/gcr/sections/:sectionId/rich-text
router.put('/gcr/sections/:sectionId/rich-text', async (req, res) => {
    const { sectionId } = req.params;
    const { body_text } = req.body;
    const { error } = await gcrDb.from('section_rich_text').upsert({ section_id: sectionId, body_text }, { onConflict: 'section_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Section Content: Bullets ──────────────────────────────────

// GET /api/admin/gcr/sections/:sectionId/bullets
router.get('/gcr/sections/:sectionId/bullets', async (req, res) => {
    const { sectionId } = req.params;
    const { data, error } = await gcrDb.from('section_bullets').select('*').eq('section_id', sectionId).order('sort_order');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ bullets: data || [] });
});

// POST /api/admin/gcr/sections/:sectionId/bullets
router.post('/gcr/sections/:sectionId/bullets', async (req, res) => {
    const { sectionId } = req.params;
    const { bullet_text, sort_order } = req.body;
    const { data, error } = await gcrDb.from('section_bullets').insert({ section_id: sectionId, bullet_text, sort_order: sort_order || 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, bullet: data });
});

// PUT /api/admin/gcr/sections/:sectionId/bullets/:bulletId
router.put('/gcr/sections/:sectionId/bullets/:bulletId', async (req, res) => {
    const { bulletId } = req.params;
    const { bullet_text, sort_order } = req.body;
    const { error } = await gcrDb.from('section_bullets').update({ bullet_text, sort_order }).eq('id', bulletId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/gcr/sections/:sectionId/bullets/:bulletId', async (req, res) => {
    const { bulletId } = req.params;
    const { error } = await gcrDb.from('section_bullets').delete().eq('id', bulletId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Section Content: Groups + Items ──────────────────────────

// GET /api/admin/gcr/sections/:sectionId/groups
router.get('/gcr/sections/:sectionId/groups', async (req, res) => {
    const { sectionId } = req.params;
    const [groupsRes, itemsRes] = await Promise.all([
        gcrDb.from('section_groups').select('*').eq('section_id', sectionId).order('sort_order'),
        gcrDb.from('section_items').select('*').eq('section_id', sectionId).order('sort_order'),
    ]);
    const groups = (groupsRes.data || []).map(g => ({
        ...g,
        items: (itemsRes.data || []).filter(i => i.group_id === g.id),
    }));
    res.json({ groups, ungrouped: (itemsRes.data || []).filter(i => !i.group_id) });
});

// POST /api/admin/gcr/sections/:sectionId/groups
router.post('/gcr/sections/:sectionId/groups', async (req, res) => {
    const { sectionId } = req.params;
    const { title, subtitle, note_text, sort_order } = req.body;
    const { data, error } = await gcrDb.from('section_groups').insert({ section_id: sectionId, title, subtitle, note_text, sort_order: sort_order || 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, group: data });
});

// PUT /api/admin/gcr/sections/:sectionId/groups/:groupId
router.put('/gcr/sections/:sectionId/groups/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { title, subtitle, note_text, sort_order } = req.body;
    const { error } = await gcrDb.from('section_groups').update({ title, subtitle, note_text, sort_order }).eq('id', groupId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/gcr/sections/:sectionId/groups/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { error } = await gcrDb.from('section_groups').delete().eq('id', groupId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// POST /api/admin/gcr/sections/:sectionId/items
router.post('/gcr/sections/:sectionId/items', async (req, res) => {
    const { sectionId } = req.params;
    const item = { ...req.body, section_id: sectionId };
    // Dedup: skip insert if identical item_name already exists in this section
    if (item.item_name) {
        const { data: existing } = await gcrDb.from('section_items')
            .select('id').eq('section_id', sectionId).ilike('item_name', item.item_name).maybeSingle();
        if (existing) return res.json({ success: true, item: existing, duplicate: true });
    }
    const { data, error } = await gcrDb.from('section_items').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

// PUT /api/admin/gcr/sections/:sectionId/items/:itemId
router.put('/gcr/sections/:sectionId/items/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const { error } = await gcrDb.from('section_items').update(req.body).eq('id', itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/gcr/sections/:sectionId/items/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const { error } = await gcrDb.from('section_items').delete().eq('id', itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Section Content: Cards ────────────────────────────────────

router.get('/gcr/sections/:sectionId/cards', async (req, res) => {
    const { sectionId } = req.params;
    const { data, error } = await gcrDb.from('section_cards').select('*').eq('section_id', sectionId).order('sort_order');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ cards: data || [] });
});

router.post('/gcr/sections/:sectionId/cards', async (req, res) => {
    const { sectionId } = req.params;
    const { data, error } = await gcrDb.from('section_cards').insert({ ...req.body, section_id: sectionId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, card: data });
});

router.put('/gcr/sections/:sectionId/cards/:cardId', async (req, res) => {
    const { cardId } = req.params;
    const { error } = await gcrDb.from('section_cards').update(req.body).eq('id', cardId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/gcr/sections/:sectionId/cards/:cardId', async (req, res) => {
    const { cardId } = req.params;
    const { error } = await gcrDb.from('section_cards').delete().eq('id', cardId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Section Content: Photos ───────────────────────────────────

router.get('/gcr/sections/:sectionId/photos', async (req, res) => {
    const { sectionId } = req.params;
    const { data, error } = await gcrDb.from('section_photos').select('*').eq('section_id', sectionId).order('sort_order');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ photos: data || [] });
});

router.post('/gcr/sections/:sectionId/photos', async (req, res) => {
    const { sectionId } = req.params;
    const { image_url, caption, alt_text, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url required' });
    const { data, error } = await gcrDb.from('section_photos').insert({ section_id: sectionId, image_url, caption, alt_text, sort_order: sort_order || 0 }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, photo: data });
});

router.delete('/gcr/sections/:sectionId/photos/:photoId', async (req, res) => {
    const { photoId } = req.params;
    const { error } = await gcrDb.from('section_photos').delete().eq('id', photoId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Section Content: Location ─────────────────────────────────

router.put('/gcr/sections/:sectionId/location', async (req, res) => {
    const { sectionId } = req.params;
    const { error } = await gcrDb.from('section_location').upsert({ ...req.body, section_id: sectionId }, { onConflict: 'section_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Image Upload ──────────────────────────────────────────────
// POST /api/admin/gcr/upload-image — upload file to Supabase Storage, return public URL
// Also supports adding image via URL directly to a section's photos

router.post('/gcr/upload-image', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `gcr/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await gcrDb.storage.from('entity-media').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) return res.status(500).json({ error: error.message });
    const { data: { publicUrl } } = gcrDb.storage.from('entity-media').getPublicUrl(fileName);
    res.json({ success: true, url: publicUrl });
});

// ── Section Content: Hours ────────────────────────────────────

// PUT /api/admin/gcr/sections/:sectionId/hours — replace all hours rows
router.put('/gcr/sections/:sectionId/hours', async (req, res) => {
    const { sectionId } = req.params;
    const { hours } = req.body; // array of { day_of_week, open_time, close_time, is_closed, note_text }
    if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours must be an array' });

    await gcrDb.from('section_hours').delete().eq('section_id', sectionId);

    const rows = hours.map((h, i) => ({ section_id: sectionId, day_of_week: h.day_of_week, open_time: h.open_time || null, close_time: h.close_time || null, is_closed: h.is_closed || false, note_text: h.note_text || null, sort_order: i }));
    const { error } = await gcrDb.from('section_hours').insert(rows);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
// GCR Dashboard — Reviews, Customers
// ══════════════════════════════════════════════════════════

// GET /api/admin/gcr/reviews
router.get('/gcr/reviews', async (req, res) => {
    let query = gcrDb.from('gcr_reviews').select('*').order('created_at', { ascending: false }).range(0, 499);
    if (req.query.status && req.query.status !== 'all') query = query.eq('status', req.query.status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ reviews: data || [] });
});

// PUT /api/admin/gcr/reviews/:id
router.put('/gcr/reviews/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date().toISOString();
    const { error } = await gcrDb.from('gcr_reviews').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// DELETE /api/admin/gcr/reviews/:id
router.delete('/gcr/reviews/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await gcrDb.from('gcr_reviews').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// GET /api/admin/gcr/customers
router.get('/gcr/customers', async (req, res) => {
    const { data, error } = await gcrDb.from('gcr_customers').select('*').order('created_at', { ascending: false }).range(0, 499);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ customers: data || [] });
});

// POST /api/admin/gcr/customers
router.post('/gcr/customers', async (req, res) => {
    const customer = req.body;
    const { data, error } = await gcrDb.from('gcr_customers').insert(customer).select('id').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, id: data.id });
});

// PUT /api/admin/gcr/customers/:id
router.put('/gcr/customers/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date().toISOString();
    const { error } = await gcrDb.from('gcr_customers').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Analytics ──────────────────────────────────────────────
// GET /api/admin/gcr/analytics
router.get('/gcr/analytics', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const [pvToday, pvMonth, convToday, topEntities] = await Promise.all([
        gcrDb.from('gcr_page_views').select('id, visitor_id', { count: 'exact' }).gte('created_at', today + 'T00:00:00Z'),
        gcrDb.from('gcr_page_views').select('id', { count: 'exact' }).gte('created_at', monthStart + 'T00:00:00Z'),
        gcrDb.from('gcr_conversions').select('id, conversion_type', { count: 'exact' }).gte('created_at', today + 'T00:00:00Z'),
        gcrDb.from('gcr_page_views').select('entity_id, entity(name, slug, icon)').gte('created_at', monthStart + 'T00:00:00Z').limit(1000),
    ]);

    // Count unique visitors today
    const todayVisitors = new Set((pvToday.data || []).map(r => r.visitor_id).filter(Boolean)).size;

    // Tally top entities by page views
    const entityCounts = {};
    (topEntities.data || []).forEach(r => {
        const key = r.entity_id;
        if (!key) return;
        if (!entityCounts[key]) entityCounts[key] = { entity: r.entity, count: 0 };
        entityCounts[key].count++;
    });
    const top = Object.values(entityCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    res.json({
        today_visitors: todayVisitors,
        today_views: pvToday.count || 0,
        today_conversions: convToday.count || 0,
        month_views: pvMonth.count || 0,
        top_entities: top,
    });
});

// POST /api/admin/gcr/analytics/track — record a page view
router.post('/gcr/analytics/track', async (req, res) => {
    const { entity_id, page_path, referrer, utm_source, utm_medium, device_type, session_id, visitor_id } = req.body;
    const { error } = await gcrDb.from('gcr_page_views').insert({ entity_id, page_path, referrer, utm_source, utm_medium, device_type, session_id, visitor_id });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// POST /api/admin/gcr/analytics/convert — record a conversion
router.post('/gcr/analytics/convert', async (req, res) => {
    const { entity_id, conversion_type, source } = req.body;
    const { error } = await gcrDb.from('gcr_conversions').insert({ entity_id, conversion_type, source });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Messaging Settings ─────────────────────────────────────
// GET /api/admin/gcr/messaging/:entity_id
router.get('/gcr/messaging/:entity_id', async (req, res) => {
    const { data, error } = await gcrDb.from('gcr_messaging_settings').select('*').eq('entity_id', req.params.entity_id).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ settings: data || null });
});

// PUT /api/admin/gcr/messaging/:entity_id
router.put('/gcr/messaging/:entity_id', async (req, res) => {
    const updates = { ...req.body, entity_id: req.params.entity_id, updated_at: new Date().toISOString() };
    const { error } = await gcrDb.from('gcr_messaging_settings').upsert(updates, { onConflict: 'entity_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Coupons ────────────────────────────────────────────────
// GET /api/admin/gcr/coupons
router.get('/gcr/coupons', async (req, res) => {
    let query = gcrDb.from('gcr_coupons').select('*, entity(name, slug)').order('created_at', { ascending: false }).range(0, 499);
    if (req.query.entity_id) query = query.eq('entity_id', req.query.entity_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ coupons: data || [] });
});

// POST /api/admin/gcr/coupons
router.post('/gcr/coupons', async (req, res) => {
    const { data, error } = await gcrDb.from('gcr_coupons').insert(req.body).select('id').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, id: data.id });
});

// PUT /api/admin/gcr/coupons/:id
router.put('/gcr/coupons/:id', async (req, res) => {
    const { error } = await gcrDb.from('gcr_coupons').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// DELETE /api/admin/gcr/coupons/:id
router.delete('/gcr/coupons/:id', async (req, res) => {
    const { error } = await gcrDb.from('gcr_coupons').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── SEO Settings ───────────────────────────────────────────
// GET /api/admin/gcr/seo/:entity_id
router.get('/gcr/seo/:entity_id', async (req, res) => {
    const { data, error } = await gcrDb.from('gcr_seo_settings').select('*').eq('entity_id', req.params.entity_id).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    res.json({ seo: data || null });
});

// PUT /api/admin/gcr/seo/:entity_id
router.put('/gcr/seo/:entity_id', async (req, res) => {
    const updates = { ...req.body, entity_id: req.params.entity_id, updated_at: new Date().toISOString() };
    const { error } = await gcrDb.from('gcr_seo_settings').upsert(updates, { onConflict: 'entity_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ── Bookings Management ────────────────────────────────────
// GET /api/admin/bookings?site_id=xxx
router.get('/bookings', async (req, res) => {
    const { site_id, status, from, to } = req.query;
    let query = supabase
        .from('bookings')
        .select('id, customer_name, customer_email, customer_phone, booking_date, time_slot_id, total, status, payment_status, notes, created_at, site_id')
        .order('booking_date', { ascending: false });
    if (site_id) query = query.eq('site_id', site_id);
    if (status) query = query.eq('status', status);
    if (from) query = query.gte('booking_date', from);
    if (to) query = query.lte('booking_date', to);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', async (req, res) => {
    const { error } = await supabase.from('bookings').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// PATCH /api/admin/bookings/:id/cancel
router.patch('/bookings/:id/cancel', async (req, res) => {
    const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// POST /api/admin/gcr/entities/:id/invite
// Creates a GCR Supabase auth user for the business and sends invite email
router.post('/gcr/entities/:id/invite', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const entityId = req.params.id;

        // Get entity email + slug
        const { data: entity, error: entErr } = await gcrDb
            .from('entity')
            .select('id, slug, name, email')
            .eq('id', entityId)
            .single();

        if (entErr || !entity) return res.status(404).json({ error: 'Entity not found' });
        if (!entity.email) return res.status(400).json({ error: 'Entity has no email address' });

        const redirectTo = 'https://cybercheck-links.vercel.app/reset-password.html';

        // Invite user via Supabase auth — sends email with magic link
        const { data: authData, error: authErr } = await gcrDb.auth.admin.inviteUserByEmail(entity.email, {
            redirectTo,
            data: { business_name: entity.name, entity_slug: entity.slug }
        });

        if (authErr) return res.status(400).json({ error: authErr.message });

        const userId = authData.user.id;

        // Upsert profiles row linking auth user to entity slug
        await gcrDb.from('profiles').upsert({
            id: userId,
            business_name: entity.name,
            slug: entity.slug,
        }, { onConflict: 'id' });

        res.json({ success: true, email: entity.email, userId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// SITE CONFIG — Site Editor Home Hero tab
// ============================================

router.get('/gcr/site-config', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { data, error } = await gcrDb
            .from('gcr_site_config')
            .select('*')
            .order('id')
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
        res.json(data || {});
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/gcr/site-config/hero', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { hero_title, hero_subtitle, hero_image_url, hero_cta_text, hero_cta_url } = req.body;
        const payload = { hero_title, hero_subtitle, hero_image_url, hero_cta_text, hero_cta_url, updated_at: new Date().toISOString() };
        // Upsert — only one row
        const { data: existing } = await gcrDb.from('gcr_site_config').select('id').limit(1).single();
        let result;
        if (existing?.id) {
            result = await gcrDb.from('gcr_site_config').update(payload).eq('id', existing.id).select().single();
        } else {
            result = await gcrDb.from('gcr_site_config').insert(payload).select().single();
        }
        if (result.error) return res.status(500).json({ error: result.error.message });
        res.json({ success: true, data: result.data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CATEGORY CARDS — Site Editor Category Cards tab
// ============================================

router.get('/gcr/category-cards', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { data, error } = await gcrDb
            .from('gcr_category_cards')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/gcr/category-cards/:id', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { id } = req.params;
        const { label, emoji, image_url, href, sort_order } = req.body;
        const { data, error } = await gcrDb
            .from('gcr_category_cards')
            .upsert({ id, label, emoji, image_url, href, sort_order, updated_at: new Date().toISOString() }, { onConflict: 'id' })
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// PAGE ASSIGNMENTS — Site Editor Page Assignments tab
// Controls which sections show on each category listing page
// ============================================

router.get('/gcr/page-assignments/:catId', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { catId } = req.params;
        const { data, error } = await gcrDb
            .from('gcr_page_assignments')
            .select('*')
            .eq('category_id', catId)
            .order('sort_order', { ascending: true });
        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/gcr/page-assignments/:catId/order', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { catId } = req.params;
        const { assignments } = req.body; // [{entity_id, sort_order}]
        if (!Array.isArray(assignments)) return res.status(400).json({ error: 'assignments array required' });
        for (const a of assignments) {
            await gcrDb.from('gcr_page_assignments')
                .upsert({ category_id: catId, entity_id: a.entity_id, sort_order: a.sort_order }, { onConflict: 'category_id,entity_id' });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// ENTITY PAGES — Site Editor Entity Pages tab
// Custom page layout / section order per entity
// ============================================

router.get('/gcr/entity-pages/:entityId', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { entityId } = req.params;
        const { data, error } = await gcrDb
            .from('gcr_entity_pages')
            .select('*')
            .eq('entity_id', entityId)
            .order('sort_order', { ascending: true });
        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
        res.json(data || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/gcr/entity-pages/:entityId', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { entityId } = req.params;
        const { section_key, section_label, sort_order, is_visible } = req.body;
        const { data, error } = await gcrDb
            .from('gcr_entity_pages')
            .upsert({ entity_id: entityId, section_key, section_label, sort_order: sort_order || 0, is_visible: is_visible !== false }, { onConflict: 'entity_id,section_key' })
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/gcr/entity-pages/:entityId/:pageId', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { pageId } = req.params;
        const { sort_order, is_visible, section_label } = req.body;
        const { data, error } = await gcrDb
            .from('gcr_entity_pages')
            .update({ sort_order, is_visible, section_label, updated_at: new Date().toISOString() })
            .eq('id', pageId)
            .select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, data });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CATEGORY PAGE CONFIG — Site Editor / Page Headers
// ============================================

router.get('/gcr/category-page-config/:catId', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { catId } = req.params;
        const { data, error } = await gcrDb
            .from('gcr_category_page_config')
            .select('category_id, page_title, page_description, hero_image_url')
            .eq('category_id', catId)
            .single();
        if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
        res.json(data || { category_id: catId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/gcr/category-page-config/:catId', async (req, res) => {
    try {
        const gcrDb = getGcrDb();
        const { catId } = req.params;
        const { page_title, page_description, hero_image_url } = req.body;
        const { data, error } = await gcrDb
            .from('gcr_category_page_config')
            .upsert({
                category_id: catId,
                page_title: page_title || null,
                page_description: page_description || null,
                hero_image_url: hero_image_url || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'category_id' })
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// POST /api/admin/ai-scrape-url
// Body: { url }
// Fetches the page, cleans HTML to text, sends to Grok, returns structured preview JSON
// ============================================
router.post('/ai-scrape-url', adminRequired, async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'Valid URL required' });

    // Fetch the page
    let rawHtml;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const r = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GCRBot/1.0; +https://gulfcoastradar.com)' }
        });
        clearTimeout(timeout);
        if (!r.ok) return res.status(400).json({ error: `Site returned ${r.status}` });
        rawHtml = await r.text();
    } catch (e) {
        return res.status(400).json({ error: `Could not fetch URL: ${e.message}` });
    }

    // Strip HTML to clean text — keep structure hints
    const cleanText = rawHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 14000);

    // Get xAI key
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'XAI_API_KEY not configured' });

    const systemPrompt = `You are a data extraction assistant for Gulf Coast Radar, a tourism & dining directory for Orange Beach and Gulf Shores, Alabama.

Extract ALL structured business data from the page text. Output ONLY a single valid JSON object — no markdown, no explanation.

Use this exact schema:
{
  "name": "business display name",
  "entity_type": "gcr_business",
  "entity_subtype": "restaurant | bar | nightlife | coffee_sweets | shopping | hotel | activity | rental | service | attraction",
  "slug": "lowercase-hyphenated-slug",
  "subtitle": "short one-line tagline",
  "description": "2-3 sentence about section",
  "icon": "single emoji",
  "phone": "phone number",
  "address_line_1": "street address",
  "city": "city name",
  "state": "AL",
  "zip": "zip code",
  "website_url": "website URL",
  "email": "email if found",
  "price_range": "$ | $$ | $$$ | $$$$",
  "social_instagram": "instagram URL or handle",
  "social_facebook": "facebook URL",
  "social_tiktok": "tiktok URL or handle",
  "hh_days": "Mon-Fri or similar",
  "hh_start": "3:00 PM",
  "hh_end": "6:00 PM",
  "hours": [
    { "day_of_week": 0, "day_name": "Sunday", "open_time": "11:00", "close_time": "21:00", "is_closed": false }
  ],
  "tags": ["tag1", "tag2"],
  "features": ["Waterfront", "Pet Friendly", "Live Music"],
  "perfect_for": ["Date night", "Families", "Groups"],
  "menu_sections": [
    {
      "section_name": "Starters",
      "items": [
        { "item_name": "Gulf Shrimp Cocktail", "description": "Chilled shrimp with cocktail sauce", "price": 14.00, "price_text": "$14" }
      ]
    }
  ],
  "drink_sections": [
    {
      "section_name": "Cocktails",
      "items": [
        { "item_name": "Gulf Sunset", "description": "Vodka, OJ, grenadine", "price": 10.00, "price_text": "$10" }
      ]
    }
  ],
  "happy_hour_items": [
    { "item_name": "House Draft", "description": "Any draft beer", "hh_price": 3.00, "regular_price": 6.00 }
  ],
  "specials": [
    { "special_name": "Taco Tuesday", "description": "$2 tacos all day", "days": "Tuesday", "discount_text": "$2 tacos", "start_time": null, "end_time": null }
  ],
  "events": [
    { "event_name": "Live Music Friday", "description": "Local bands every Friday night", "event_date": null, "start_time": "19:00" }
  ],
  "fleet": [
    { "name": "Pontoon Boat", "description": "6-person pontoon rental", "capacity": 6, "price_per_hour": 150 }
  ],
  "pricing": [
    { "package_name": "Adult Ticket", "price": 45.00, "price_text": "$45/person", "description": "Full tour experience" }
  ],
  "activities": [
    { "title": "Dolphin Cruise", "description": "2-hour dolphin watching tour", "duration_minutes": 120 }
  ],
  "about_bullets": [
    { "text": "Family owned since 1987", "icon": "🏠" }
  ],
  "kids_friendly": true,
  "pet_friendly": false,
  "live_music": false,
  "waterfront": false,
  "outdoor_seating": false,
  "alcohol": true,
  "booking_required": false
}

Only include fields with actual data found on the page. Use null for unknown fields. Never invent data.`;

    try {
        const r = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'grok-3',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Extract all data from this business page (URL: ${url}):\n\n${cleanText}` }
                ],
                max_tokens: 4096,
                response_format: { type: 'json_object' }
            })
        });
        if (!r.ok) { const e = await r.text(); throw new Error(`Grok ${r.status}: ${e}`); }
        const d = await r.json();
        const raw = d.choices?.[0]?.message?.content || '{}';
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const structured = JSON.parse(cleaned);
        res.json({ success: true, url, structured });
    } catch (e) {
        console.error('ai-scrape-url error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// POST /api/admin/ai-scrape-approve
// Body: { structured } — the reviewed/edited JSON from ai-scrape-url
// Saves everything to the correct GCR tables in one shot
// ============================================
router.post('/ai-scrape-approve', adminRequired, async (req, res) => {
    const { structured } = req.body;
    if (!structured?.name) return res.status(400).json({ error: 'structured.name required' });

    const { upsertTag } = gcrImportHelpers(gcrDb);
    const saved = {};
    const errors = [];

    // Derive slug if missing
    if (!structured.slug) {
        structured.slug = structured.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    // ── Upsert entity ──
    const entityFields = {
        name: structured.name,
        slug: structured.slug,
        entity_type: structured.entity_type || 'gcr_business',
        entity_subtype: structured.entity_subtype || 'restaurant',
        subtitle: structured.subtitle || null,
        description: structured.description || null,
        icon: structured.icon || null,
        phone: structured.phone || null,
        email: structured.email || null,
        address_line_1: structured.address_line_1 || null,
        city: structured.city || null,
        state: structured.state || 'AL',
        zip: structured.zip || null,
        website_url: structured.website_url || null,
        price_range: structured.price_range || null,
        social_instagram: structured.social_instagram || null,
        social_facebook: structured.social_facebook || null,
        social_tiktok: structured.social_tiktok || null,
        hh_days: structured.hh_days || null,
        hh_start: structured.hh_start || null,
        hh_end: structured.hh_end || null,
        is_active: false, // admin activates manually after review
    };

    const { data: entity, error: entErr } = await gcrDb
        .from('entity')
        .upsert(entityFields, { onConflict: 'slug' })
        .select('id, slug')
        .single();
    if (entErr || !entity) return res.status(500).json({ error: `Entity save failed: ${entErr?.message}` });

    const eid = entity.id;
    saved.entity = { id: eid, slug: entity.slug };

    // ── Feature flags → tags ──
    const featureFlags = { kids_friendly: 'kids_friendly', pet_friendly: 'pet_friendly', live_music: 'live_music', waterfront: 'waterfront', outdoor_seating: 'outdoor_seating', alcohol: 'full_bar', booking_required: 'booking_required' };
    for (const [key, tag] of Object.entries(featureFlags)) {
        if (structured[key]) await gcrDb.from('entity_tags').upsert({ entity_id: eid, tag, tag_category: 'amenity' }, { onConflict: 'entity_id,tag' });
    }

    // ── Hours ──
    if (structured.hours?.length) {
        await gcrDb.from('entity_hours').delete().eq('entity_id', eid);
        const { error } = await gcrDb.from('entity_hours').insert(
            structured.hours.map(h => ({ entity_id: eid, ...h }))
        );
        if (error) errors.push(`hours: ${error.message}`);
        else saved.hours = structured.hours.length;
    }

    // ── Tags ──
    if (structured.tags?.length) {
        for (const tag of structured.tags) await upsertTag(eid, tag, 'tag');
        saved.tags = structured.tags.length;
    }

    // ── Features ──
    if (structured.features?.length) {
        await gcrDb.from('entity_features').delete().eq('entity_id', eid);
        const { error } = await gcrDb.from('entity_features').insert(
            structured.features.map((f, i) => ({ entity_id: eid, label: f, sort_order: i }))
        );
        if (error) errors.push(`features: ${error.message}`);
        else saved.features = structured.features.length;
    }

    // ── Perfect For ──
    if (structured.perfect_for?.length) {
        await gcrDb.from('entity_perfect_for').delete().eq('entity_id', eid);
        const { error } = await gcrDb.from('entity_perfect_for').insert(
            structured.perfect_for.map((p, i) => ({ entity_id: eid, label: p, sort_order: i }))
        );
        if (error) errors.push(`perfect_for: ${error.message}`);
        else saved.perfect_for = structured.perfect_for.length;
    }

    // ── About bullets ──
    if (structured.about_bullets?.length) {
        const { error } = await gcrDb.from('entity_about_bullets').insert(
            structured.about_bullets.map((b, i) => ({ entity_id: eid, text: b.text, icon: b.icon || '•', sort_order: i }))
        );
        if (error) errors.push(`about_bullets: ${error.message}`);
        else saved.about_bullets = structured.about_bullets.length;
    }

    // ── Menu sections + items ──
    if (structured.menu_sections?.length) {
        let menuItemCount = 0;
        for (let i = 0; i < structured.menu_sections.length; i++) {
            const sec = structured.menu_sections[i];
            const { data: ms, error: msErr } = await gcrDb.from('menu_sections')
                .insert({ entity_id: eid, section_name: sec.section_name, sort_order: i })
                .select('id').single();
            if (msErr || !ms) { errors.push(`menu_section ${sec.section_name}: ${msErr?.message}`); continue; }
            if (sec.items?.length) {
                const { error: miErr } = await gcrDb.from('menu_items').insert(
                    sec.items.map((item, j) => ({
                        entity_id: eid, menu_section_id: ms.id,
                        item_name: item.item_name, description: item.description || null,
                        price: item.price || null, price_text: item.price_text || null,
                        sort_order: j
                    }))
                );
                if (miErr) errors.push(`menu_items in ${sec.section_name}: ${miErr.message}`);
                else menuItemCount += sec.items.length;
            }
        }
        saved.menu_items = menuItemCount;
    }

    // ── Drink sections + items ──
    if (structured.drink_sections?.length) {
        let drinkItemCount = 0;
        for (let i = 0; i < structured.drink_sections.length; i++) {
            const sec = structured.drink_sections[i];
            const { data: ds, error: dsErr } = await gcrDb.from('drink_sections')
                .insert({ entity_id: eid, section_name: sec.section_name, sort_order: i })
                .select('id').single();
            if (dsErr || !ds) { errors.push(`drink_section ${sec.section_name}: ${dsErr?.message}`); continue; }
            if (sec.items?.length) {
                const { error: diErr } = await gcrDb.from('drink_items').insert(
                    sec.items.map((item, j) => ({
                        entity_id: eid, drink_section_id: ds.id,
                        item_name: item.item_name, description: item.description || null,
                        price: item.price || null, price_text: item.price_text || null,
                        sort_order: j
                    }))
                );
                if (diErr) errors.push(`drink_items in ${sec.section_name}: ${diErr.message}`);
                else drinkItemCount += sec.items.length;
            }
        }
        saved.drink_items = drinkItemCount;
    }

    // ── Happy hour items ──
    if (structured.happy_hour_items?.length) {
        const { data: hhSec } = await gcrDb.from('happy_hour_sections')
            .insert({ entity_id: eid, section_name: 'Happy Hour', sort_order: 0 })
            .select('id').single();
        if (hhSec) {
            const { error } = await gcrDb.from('happy_hour_items').insert(
                structured.happy_hour_items.map((item, i) => ({
                    entity_id: eid, hh_section_id: hhSec.id,
                    item_name: item.item_name, description: item.description || null,
                    hh_price: item.hh_price || null, regular_price: item.regular_price || null,
                    sort_order: i
                }))
            );
            if (error) errors.push(`hh_items: ${error.message}`);
            else saved.happy_hour_items = structured.happy_hour_items.length;
        }
    }

    // ── Specials ──
    if (structured.specials?.length) {
        const { error } = await gcrDb.from('entity_specials').insert(
            structured.specials.map(s => ({
                entity_id: eid,
                special_name: s.special_name,
                description: s.description || null,
                days: s.days || null,
                discount_text: s.discount_text || null,
                start_time: s.start_time || null,
                end_time: s.end_time || null,
                is_active: true
            }))
        );
        if (error) errors.push(`specials: ${error.message}`);
        else saved.specials = structured.specials.length;
    }

    // ── Events ──
    if (structured.events?.length) {
        const { error } = await gcrDb.from('entity_events').insert(
            structured.events.map(e => ({
                entity_id: eid,
                event_name: e.event_name,
                description: e.description || null,
                event_date: e.event_date || null,
                start_time: e.start_time || null,
                is_active: true, recurring: !e.event_date
            }))
        );
        if (error) errors.push(`events: ${error.message}`);
        else saved.events = structured.events.length;
    }

    // ── Fleet (rentals/boats) ──
    if (structured.fleet?.length) {
        const { error } = await gcrDb.from('fleet_items').insert(
            structured.fleet.map((f, i) => ({
                entity_id: eid,
                name: f.name, description: f.description || null,
                capacity: f.capacity || null, price_per_hour: f.price_per_hour || null,
                sort_order: i
            }))
        );
        if (error) errors.push(`fleet: ${error.message}`);
        else saved.fleet = structured.fleet.length;
    }

    // ── Pricing ──
    if (structured.pricing?.length) {
        const { error } = await gcrDb.from('pricing_items').insert(
            structured.pricing.map((p, i) => ({
                entity_id: eid,
                package_name: p.package_name, description: p.description || null,
                price: p.price || null, price_text: p.price_text || null,
                sort_order: i
            }))
        );
        if (error) errors.push(`pricing: ${error.message}`);
        else saved.pricing = structured.pricing.length;
    }

    // ── Activities ──
    if (structured.activities?.length) {
        const { error } = await gcrDb.from('activities').insert(
            structured.activities.map((a, i) => ({
                entity_id: eid,
                title: a.title, description: a.description || null,
                duration_minutes: a.duration_minutes || null,
                sort_order: i
            }))
        );
        if (error) errors.push(`activities: ${error.message}`);
        else saved.activities = structured.activities.length;
    }

    // Auto-create sections for whatever data was saved
    const autoSections = [
        { entity_id: eid, section_key: 'location', section_label: 'Location', section_type: 'location', sort_order: 99 },
        { entity_id: eid, section_key: 'hours', section_label: 'Hours', section_type: 'hours', sort_order: 98 },
    ];
    if (saved.menu_items)   autoSections.push({ entity_id: eid, section_key: 'menu',      section_label: 'Menu',       section_type: 'menu',      sort_order: 1 });
    if (saved.drink_items)  autoSections.push({ entity_id: eid, section_key: 'drinks',    section_label: 'Drinks',     section_type: 'drinks',    sort_order: 2 });
    if (saved.happy_hour)   autoSections.push({ entity_id: eid, section_key: 'happy_hour',section_label: 'Happy Hour', section_type: 'happy_hour',sort_order: 3 });
    if (saved.specials)     autoSections.push({ entity_id: eid, section_key: 'specials',  section_label: 'Specials',   section_type: 'specials',  sort_order: 4 });
    if (saved.events)       autoSections.push({ entity_id: eid, section_key: 'events',    section_label: 'Events',     section_type: 'events',    sort_order: 5 });
    if (saved.activities)   autoSections.push({ entity_id: eid, section_key: 'activities',section_label: 'Activities', section_type: 'activities',sort_order: 6 });
    if (saved.fleet)        autoSections.push({ entity_id: eid, section_key: 'fleet',     section_label: 'Fleet',      section_type: 'fleet',     sort_order: 7 });
    if (saved.about_bullets)autoSections.push({ entity_id: eid, section_key: 'about',     section_label: 'About',      section_type: 'bullets',   sort_order: 0 });
    await gcrDb.from('entity_sections').insert(autoSections).then(() => {}).catch(() => {});

    res.json({ success: true, entity_id: eid, slug: entity.slug, saved, errors });
});

// ══════════════════════════════════════════════════════════════
// GROK AGENTIC AI — tool definitions + executor + agent loop
// ══════════════════════════════════════════════════════════════

const GCR_AGENT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_business_profile',
            description: 'Get the full profile of the current business: name, type, address, contact, social links, hours, pricing, active flags.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_menu',
            description: 'Get all menu sections and items for this business including prices, descriptions, availability.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_drinks',
            description: 'Get all drink sections and drink items for this business.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_events',
            description: 'Get events for this business. Can filter to only upcoming events.',
            parameters: {
                type: 'object',
                properties: {
                    upcoming_only: { type: 'boolean', description: 'If true, only return future events' }
                }
            },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_specials',
            description: 'Get all active daily specials and deals for this business.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_happy_hours',
            description: 'Get happy hour schedule (days, start/end times) and all happy hour items with prices for this business.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_analytics',
            description: 'Get GCR analytics: page views and link clicks for this business profile.',
            parameters: {
                type: 'object',
                properties: {
                    days: { type: 'number', description: 'How many days back to look (default 30)' }
                }
            },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_reviews',
            description: 'Get customer reviews, ratings and feedback for this business.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_connected_platforms',
            description: 'Check which external platforms are connected (Google Business, Facebook, Instagram, Square, Stripe). Returns connection status and what data each provides.',
            parameters: { type: 'object', properties: {} },
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_platform_data',
            description: 'Pull live data from a connected external platform (Google Business, Facebook, Instagram). Returns error if platform not connected yet.',
            parameters: {
                type: 'object',
                properties: {
                    platform: {
                        type: 'string',
                        enum: ['google_business', 'facebook', 'instagram'],
                        description: 'Which platform to query'
                    },
                    metric: {
                        type: 'string',
                        description: 'What to retrieve: views, clicks, followers, reach, impressions, reviews, posts'
                    }
                },
                required: ['platform']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_all_gcr_businesses',
            description: 'Get a summary of all businesses in the GCR directory — useful for platform-wide questions about counts, categories, missing data.',
            parameters: {
                type: 'object',
                properties: {
                    entity_type: { type: 'string', description: 'Filter by type (restaurants, things-to-do, etc.) — optional' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_website_analytics',
            description: 'Get real website analytics from the main CyberCheck database: page views, unique visitors, conversions, revenue, top pages, traffic sources, device breakdown. Works across all sites or for a specific site.',
            parameters: {
                type: 'object',
                properties: {
                    site_id: { type: 'string', description: 'Specific site/business ID — omit for all sites' },
                    days: { type: 'number', description: 'Days to look back (default 30)' },
                    breakdown: { type: 'string', enum: ['pages', 'sources', 'devices', 'conversions', 'funnel', 'summary'], description: 'What breakdown to return' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_leads',
            description: 'Get leads and customer data from the CRM. Shows total leads, new leads today/this week, lead details, and conversion stats.',
            parameters: {
                type: 'object',
                properties: {
                    site_id: { type: 'string', description: 'Filter by site — omit for all' },
                    status: { type: 'string', description: 'Filter by status: lead, customer, vip, inactive' },
                    limit: { type: 'number', description: 'Max records to return (default 20)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_social_analytics',
            description: 'Get social media analytics from connected accounts: followers, reach, impressions, engagement rate, post count. Covers Facebook, Instagram, TikTok.',
            parameters: {
                type: 'object',
                properties: {
                    site_id: { type: 'string', description: 'Site/entity ID — omit for all' },
                    platform: { type: 'string', description: 'Filter by platform: facebook, instagram, tiktok — omit for all' },
                    days: { type: 'number', description: 'Days to look back (default 30)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_google_business_data',
            description: 'Get Google Business Profile data for a site: reviews, star rating, location details, and review response status. Uses the existing Google Business OAuth connection.',
            parameters: {
                type: 'object',
                properties: {
                    site_id: { type: 'string', description: 'Site ID to query' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_seo_data',
            description: 'Get SEO settings and keyword rankings for a site: meta titles, descriptions, GA4 ID, pixel IDs, tracked keywords and their current rankings.',
            parameters: {
                type: 'object',
                properties: {
                    site_id: { type: 'string', description: 'Site/entity ID' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_session_events',
            description: 'Get detailed user interaction events: clicks, scroll depth, section views, phone clicks, map clicks, gallery views — shows exactly what visitors are doing on a page.',
            parameters: {
                type: 'object',
                properties: {
                    site_id: { type: 'string', description: 'Site ID' },
                    event_type: { type: 'string', description: 'Filter by event type: click, scroll, section_view, phone_click, map_click, gallery_view' },
                    days: { type: 'number', description: 'Days to look back (default 7)' }
                }
            }
        }
    },
];

async function executeGCRTool(name, args, { gcrDb, entityId, mainDb }) {
    try {
        switch (name) {
            case 'get_business_profile': {
                if (!entityId) return { error: 'No business selected' };
                const { data } = await gcrDb.from('entity').select('*').eq('id', entityId).single();
                return data || { error: 'Entity not found' };
            }
            case 'get_menu': {
                if (!entityId) return { error: 'No business selected' };
                const [s, i] = await Promise.all([
                    gcrDb.from('menu_sections').select('*').eq('entity_id', entityId).order('sort_order'),
                    gcrDb.from('menu_items').select('*').eq('entity_id', entityId).order('sort_order'),
                ]);
                return { sections: s.data || [], items: i.data || [], total_items: (i.data || []).length };
            }
            case 'get_drinks': {
                if (!entityId) return { error: 'No business selected' };
                const [s, i] = await Promise.all([
                    gcrDb.from('drink_sections').select('*').eq('entity_id', entityId),
                    gcrDb.from('drink_items').select('*').eq('entity_id', entityId),
                ]);
                return { sections: s.data || [], items: i.data || [], total_items: (i.data || []).length };
            }
            case 'get_events': {
                if (!entityId) return { error: 'No business selected' };
                let q = gcrDb.from('entity_events').select('*').eq('entity_id', entityId).eq('is_active', true).order('event_date', { ascending: true });
                if (args.upcoming_only) q = q.gte('event_date', new Date().toISOString().split('T')[0]);
                const { data } = await q;
                return { events: data || [], count: (data || []).length };
            }
            case 'get_specials': {
                if (!entityId) return { error: 'No business selected' };
                const { data } = await gcrDb.from('entity_specials').select('*').eq('entity_id', entityId).eq('is_active', true);
                return { specials: data || [], count: (data || []).length };
            }
            case 'get_happy_hours': {
                if (!entityId) return { error: 'No business selected' };
                const [ent, sec, items] = await Promise.all([
                    gcrDb.from('entity').select('hh_days,hh_start,hh_end,hh_description').eq('id', entityId).single(),
                    gcrDb.from('happy_hour_sections').select('*').eq('entity_id', entityId),
                    gcrDb.from('happy_hour_items').select('*').eq('entity_id', entityId),
                ]);
                return { schedule: ent.data || {}, sections: sec.data || [], items: items.data || [] };
            }
            case 'get_analytics': {
                if (!entityId) return { error: 'No business selected' };
                const days = args.days || 30;
                const since = new Date(Date.now() - days * 86400000).toISOString();
                const { data } = await gcrDb.from('entity_analytics').select('*').eq('entity_id', entityId).gte('created_at', since).order('created_at', { ascending: false });
                if (!data || !data.length) return { views: 0, clicks: 0, days, note: 'Analytics tracked when visitors view this profile on GCR.' };
                const totals = (data || []).reduce((acc, r) => {
                    acc.views += (r.page_views || 0); acc.clicks += (r.link_clicks || 0); return acc;
                }, { views: 0, clicks: 0 });
                return { ...totals, records: data.length, days, recent: data.slice(0, 5) };
            }
            case 'get_reviews': {
                if (!entityId) return { error: 'No business selected' };
                const { data } = await gcrDb.from('entity_reviews').select('*').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20);
                const avg = (data || []).reduce((s, r) => s + (r.rating || 0), 0) / Math.max(1, (data || []).length);
                return { reviews: data || [], count: (data || []).length, avg_rating: Math.round(avg * 10) / 10 };
            }
            case 'get_connected_platforms': {
                if (!entityId) return { connected: [], note: 'No business selected' };
                const { data } = await gcrDb.from('entity_integrations').select('platform,connected_at,platform_user,scope').eq('entity_id', entityId);
                const connected = (data || []).map(i => ({ platform: i.platform, connected_at: i.connected_at, user: i.platform_user }));
                return {
                    connected,
                    available: ['google_business', 'facebook', 'instagram', 'square', 'stripe'],
                    what_each_provides: {
                        google_business: 'Search impressions, direction requests, phone clicks, review count',
                        facebook: 'Page followers, post reach, engagement, reviews',
                        instagram: 'Followers, story/post reach, impressions, profile visits',
                        square: 'Transaction count, revenue, top items sold',
                        stripe: 'Booking revenue, payment counts',
                    }
                };
            }
            case 'get_platform_data': {
                if (!entityId) return { error: 'No business selected' };
                const { data: integ } = await gcrDb.from('entity_integrations')
                    .select('access_token,platform_id,scope,token_expires_at').eq('entity_id', entityId).eq('platform', args.platform).single();
                if (!integ || !integ.access_token) return { error: `${args.platform} is not connected. Go to the Integrations tab to connect it.` };

                if (args.platform === 'facebook' || args.platform === 'instagram') {
                    const pageId = integ.platform_id;
                    const fields = args.metric === 'followers' ? 'followers_count,fan_count,name'
                        : args.metric === 'reach' || args.metric === 'impressions' ? 'name'  // insights need separate call
                        : 'followers_count,name,posts{message,created_time,full_picture}';
                    const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=${fields}&access_token=${integ.access_token}`);
                    const d = await r.json();
                    if (d.error) return { error: `Facebook API: ${d.error.message}` };
                    return d;
                }
                if (args.platform === 'google_business') {
                    return { note: 'Google Business Insights API requires server-side OAuth refresh. Integration coming soon.', connected: true };
                }
                return { error: `No API handler for ${args.platform}` };
            }
            case 'get_all_gcr_businesses': {
                let q = gcrDb.from('entity').select('id,name,entity_type,entity_subtype,is_active,featured,hero_image_url,description,phone').eq('is_active', true);
                if (args.entity_type) q = q.eq('entity_type', args.entity_type);
                const { data } = await q.limit(200);
                const byType = {};
                (data || []).forEach(b => { const t = b.entity_type || 'unknown'; byType[t] = (byType[t] || 0) + 1; });
                return {
                    total: (data || []).length,
                    by_type: byType,
                    missing_photo: (data || []).filter(b => !b.hero_image_url).length,
                    missing_description: (data || []).filter(b => !b.description).length,
                    missing_phone: (data || []).filter(b => !b.phone).length,
                    featured_count: (data || []).filter(b => b.featured).length,
                };
            }
            // ── Main CyberCheck DB tools ──────────────────────
            case 'get_website_analytics': {
                const db = mainDb;
                const days = args.days || 30;
                const since = new Date(Date.now() - days * 86400000).toISOString();
                let pvQ = db.from('page_views').select('page_path,referrer,utm_source,utm_medium,device_type,created_at').gte('created_at', since);
                let convQ = db.from('conversions').select('conversion_type,revenue,utm_source,created_at').gte('created_at', since);
                if (args.site_id) { pvQ = pvQ.eq('entity_id', args.site_id); convQ = convQ.eq('entity_id', args.site_id); }

                const [pvRes, convRes] = await Promise.all([pvQ.limit(5000), convQ.limit(2000)]);
                const pvs = pvRes.data || [];
                const convs = convRes.data || [];

                const breakdown = args.breakdown || 'summary';
                if (breakdown === 'pages') {
                    const pages = {};
                    pvs.forEach(p => { pages[p.page_path] = (pages[p.page_path] || 0) + 1; });
                    return { top_pages: Object.entries(pages).sort((a,b) => b[1]-a[1]).slice(0,15).map(([p,c]) => ({ page: p, views: c })), total_views: pvs.length, days };
                }
                if (breakdown === 'sources') {
                    const src = {};
                    pvs.forEach(p => { const s = p.utm_source || (p.referrer ? new URL(p.referrer).hostname : 'direct') || 'direct'; src[s] = (src[s] || 0) + 1; });
                    return { traffic_sources: Object.entries(src).sort((a,b) => b[1]-a[1]).slice(0,10).map(([s,c]) => ({ source: s, visits: c })), days };
                }
                if (breakdown === 'devices') {
                    const dev = {};
                    pvs.forEach(p => { dev[p.device_type || 'unknown'] = (dev[p.device_type || 'unknown'] || 0) + 1; });
                    return { devices: dev, total: pvs.length, days };
                }
                if (breakdown === 'conversions') {
                    const types = {};
                    let revenue = 0;
                    convs.forEach(c => { types[c.conversion_type || 'unknown'] = (types[c.conversion_type || 'unknown'] || 0) + 1; revenue += (c.revenue || 0); });
                    return { conversion_types: types, total_conversions: convs.length, total_revenue: revenue, days };
                }
                // summary
                const uniqueSessions = new Set(pvs.map(p => p.session_id || p.created_at?.slice(0,10))).size;
                const revenue = convs.reduce((s, c) => s + (c.revenue || 0), 0);
                return { total_views: pvs.length, unique_sessions: uniqueSessions, total_conversions: convs.length, revenue: revenue.toFixed(2), days };
            }
            case 'get_leads': {
                const db = mainDb;
                // Check both gcr_customers and conversions table for leads
                const [custRes, convRes] = await Promise.all([
                    gcrDb.from('gcr_customers').select('id,name,email,phone,status,total_visits,total_spent,last_visit,created_at').order('created_at', { ascending: false }).limit(args.limit || 20),
                    db.from('conversions').select('customer_name,customer_email,conversion_type,revenue,created_at').order('created_at', { ascending: false }).limit(50),
                ]);
                const today = new Date().toISOString().split('T')[0];
                const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
                const custs = custRes.data || [];
                const convLeads = (convRes.data || []).filter(c => c.customer_email);
                return {
                    crm_customers: custs,
                    crm_total: custs.length,
                    new_today: custs.filter(c => c.created_at?.startsWith(today)).length,
                    new_this_week: custs.filter(c => c.created_at >= weekAgo).length,
                    conversion_leads: convLeads.slice(0, 10),
                    total_conversion_leads: convLeads.length,
                };
            }
            case 'get_social_analytics': {
                const db = mainDb;
                const days = args.days || 30;
                const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
                let q = db.from('social_media_analytics').select('platform,date,followers,reach,impressions,engagement_rate,likes,comments,shares').gte('date', since).order('date', { ascending: false });
                if (args.site_id) q = q.eq('entity_id', args.site_id);
                if (args.platform) q = q.eq('platform', args.platform);
                const { data } = await q.limit(500);
                if (!data || !data.length) {
                    // Also check gcr_social_accounts for connection status
                    const { data: accts } = await gcrDb.from('gcr_social_accounts').select('platform,account_name,is_connected,connected_at');
                    return { message: 'No analytics data yet.', connected_accounts: accts || [], note: 'Social analytics populate once accounts are connected and syncing.' };
                }
                // Aggregate by platform
                const byPlatform = {};
                data.forEach(r => {
                    if (!byPlatform[r.platform]) byPlatform[r.platform] = { platform: r.platform, followers: 0, reach: 0, impressions: 0, posts: 0 };
                    byPlatform[r.platform].followers = Math.max(byPlatform[r.platform].followers, r.followers || 0);
                    byPlatform[r.platform].reach += (r.reach || 0);
                    byPlatform[r.platform].impressions += (r.impressions || 0);
                    byPlatform[r.platform].posts++;
                });
                return { platforms: Object.values(byPlatform), days, records: data.length };
            }
            case 'get_google_business_data': {
                const db = mainDb;
                const siteId = args.site_id || entityId;
                if (!siteId) return { error: 'site_id required' };
                const [tokenRes, reviewRes] = await Promise.all([
                    db.from('oauth_tokens').select('provider,account_name,account_email,created_at').eq('site_id', siteId).eq('provider', 'google_business').maybeSingle(),
                    db.from('reviews').select('customer_name,rating,text,source,owner_reply,status,created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(20),
                ]);
                const reviews = reviewRes.data || [];
                const avgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;
                return {
                    connected: !!tokenRes.data,
                    account: tokenRes.data ? { name: tokenRes.data.account_name, email: tokenRes.data.account_email, connected: tokenRes.data.created_at } : null,
                    reviews_total: reviews.length,
                    avg_rating: avgRating,
                    unanswered: reviews.filter(r => !r.owner_reply).length,
                    recent_reviews: reviews.slice(0, 5),
                };
            }
            case 'get_seo_data': {
                const db = mainDb;
                const siteId = args.site_id || entityId;
                if (!siteId) return { error: 'site_id required' };
                const [metaRes, kwRes, gcrSeoRes] = await Promise.all([
                    db.from('seo_meta_tags').select('*').eq('entity_id', siteId).order('created_at').limit(20),
                    db.from('seo_keywords').select('keyword,current_ranking,search_volume,last_checked_at').eq('entity_id', siteId).limit(20),
                    gcrDb.from('gcr_seo_settings').select('seo_title,seo_description,seo_keywords,ga4_id,facebook_pixel_id').eq('entity_id', siteId).maybeSingle(),
                ]);
                return {
                    meta_pages: metaRes.data || [],
                    tracked_keywords: kwRes.data || [],
                    gcr_seo: gcrSeoRes.data || null,
                    has_ga4: !!(gcrSeoRes.data?.ga4_id),
                    has_pixel: !!(gcrSeoRes.data?.facebook_pixel_id),
                };
            }
            case 'get_session_events': {
                const db = mainDb;
                const days = args.days || 7;
                const since = new Date(Date.now() - days * 86400000).toISOString();
                let q = db.from('session_events').select('event_type,event_label,page_path,device_type,created_at').gte('created_at', since).order('created_at', { ascending: false });
                if (args.site_id) q = q.eq('entity_id', args.site_id);
                if (args.event_type) q = q.eq('event_type', args.event_type);
                const { data } = await q.limit(1000);
                const byType = {};
                (data || []).forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1; });
                return { event_counts: byType, total: (data || []).length, sample: (data || []).slice(0, 10), days };
            }
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (err) {
        return { error: `Tool ${name} error: ${err.message}` };
    }
}

// ── POST /api/admin/gcr/grok-chat — Agentic AI with tool use
router.post('/gcr/grok-chat', async (req, res) => {
    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Grok API key not configured (set XAI_API_KEY in env)' });

    const { message, history = [], slug, entity_id } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });

    const gcrDb = getGcrDb();

    // Resolve entity ID from slug if needed
    let entityId = entity_id || null;
    if (!entityId && slug) {
        const { data } = await gcrDb.from('entity').select('id').eq('slug', slug).maybeSingle();
        entityId = data?.id || null;
    }

    const systemPrompt = `You are an autonomous business intelligence and operations agent for a multi-platform digital agency dashboard.
You manage multiple websites and the GCR (Gulf Coast Radar) local directory platform.
You have tools connected to TWO live databases:
  1. Main CyberCheck DB — website analytics (page_views, session_events, conversions), leads/CRM (gcr_customers), SEO data, social analytics, reviews, OAuth platform tokens
  2. GCR DB — business directory entities, menus, events, specials, happy hours, HH items
RULES:
- Always pull real data using your tools first. Never estimate or make up numbers.
- Proactively surface insights: low engagement, missing data, unanswered reviews, traffic drops, opportunities.
- If a platform isn't connected yet, explain exactly what data it would unlock.
- Be concise and direct. Use bullets. Bold key numbers.
- For ads questions (Google Ads, Facebook Ads, Instagram Ads): explain that ad campaign management requires connecting the respective Ads APIs (separate from Business Profile) — the infrastructure is ready to add.
- Today: ${new Date().toISOString().split('T')[0]}
${entityId ? `Currently viewing entity_id: ${entityId}` : 'Platform-wide view — no single business selected.'}`;

    const messages = [
        ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
    ];

    const toolsActivity = [];

    try {
        // Agent loop — up to 6 rounds of tool calls
        for (let round = 0; round < 6; round++) {
            const resp = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'grok-3',
                    messages: [{ role: 'system', content: systemPrompt }, ...messages],
                    tools: GCR_AGENT_TOOLS,
                    tool_choice: 'auto',
                    temperature: 0.3,
                    max_tokens: 1500,
                }),
            });
            if (!resp.ok) throw new Error(`Grok API ${resp.status}: ${await resp.text()}`);
            const data = await resp.json();
            const choice = data.choices?.[0];
            if (!choice) throw new Error('No response from Grok');

            // Done — return the final text reply
            if (!choice.message.tool_calls || !choice.message.tool_calls.length) {
                return res.json({ reply: choice.message.content, tools_called: toolsActivity });
            }

            // Execute all tool calls in parallel
            messages.push(choice.message);
            const toolResults = await Promise.all(
                choice.message.tool_calls.map(async (call) => {
                    const args = JSON.parse(call.function.arguments || '{}');
                    toolsActivity.push({ tool: call.function.name, args });
                    const result = await executeGCRTool(call.function.name, args, { gcrDb, entityId, mainDb: supabase });
                    return { tool_call_id: call.id, content: JSON.stringify(result) };
                })
            );
            toolResults.forEach(r => messages.push({ role: 'tool', ...r }));
        }

        res.json({ reply: 'Reached max tool call rounds. Try a more specific question.', tools_called: toolsActivity });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


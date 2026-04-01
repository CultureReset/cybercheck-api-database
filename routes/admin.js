const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { adminRequired } = require('../middleware/auth');
const supabase = require('../db');
const getGcrDb = require('../gcr-db');

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

// All remaining admin routes require admin role
router.use(adminRequired);

// ============================================
// DASHBOARD HOME — Platform stats
// ============================================

router.get('/stats', async (req, res) => {
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

router.get('/users', async (req, res) => {
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
router.post('/test-ai', adminRequired, async (req, res) => {
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
router.post('/set-connection', adminRequired, async (req, res) => {
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
router.post('/save-api-key', adminRequired, async (req, res) => {
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
router.post('/test-oauth', adminRequired, async (req, res) => {
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
// PUT /api/admin/businesses/:id/full — Update ALL tables for a business
// ============================================
router.put('/businesses/:id/full', adminRequired, async (req, res) => {
    const siteId = req.params.id;
    const { basic, location, hours, happyHour, menu, specials, events, social, packages } = req.body;

    const errors = [];

    // 1. Update businesses table
    if (basic || social) {
        const bizUpdate = {};
        if (basic) {
            if (basic.name !== undefined) bizUpdate.name = basic.name;
            if (basic.type !== undefined) bizUpdate.type = basic.type;
            if (basic.status !== undefined) bizUpdate.status = basic.status;
            if (basic.plan !== undefined) bizUpdate.plan = basic.plan;
            if (basic.emoji !== undefined) bizUpdate.emoji = basic.emoji;
            if (basic.featured !== undefined) bizUpdate.featured = basic.featured;
            if (basic.gcr_listed !== undefined) bizUpdate.gcr_listed = basic.gcr_listed;
        }
        if (social) {
            if (social.instagram !== undefined) bizUpdate.instagram = social.instagram;
            if (social.facebook !== undefined) bizUpdate.facebook = social.facebook;
            if (social.tiktok !== undefined) bizUpdate.tiktok = social.tiktok;
            if (social.spotify !== undefined) bizUpdate.spotify = social.spotify;
        }
        bizUpdate.updated_at = new Date().toISOString();
        const { error } = await supabase.from('businesses').update(bizUpdate).eq('site_id', siteId);
        if (error) errors.push('businesses: ' + error.message);
    }

    // 2. Upsert site_content
    if (basic || location || hours) {
        const contentUpdate = { site_id: siteId };
        if (basic) {
            if (basic.tagline !== undefined) contentUpdate.tagline = basic.tagline;
            if (basic.description !== undefined) contentUpdate.seo_description = basic.description;
            if (basic.priceRange !== undefined) contentUpdate.price_range = basic.priceRange;
        }
        if (location) {
            if (location.address !== undefined) contentUpdate.address = location.address;
            if (location.city !== undefined) contentUpdate.city = location.city;
            if (location.state !== undefined) contentUpdate.state = location.state;
            if (location.zip !== undefined) contentUpdate.zip = location.zip;
            if (location.phone !== undefined) contentUpdate.contact_phone = location.phone;
            if (location.email !== undefined) contentUpdate.contact_email = location.email;
            if (location.website !== undefined) contentUpdate.website_url = location.website;
        }
        if (hours) {
            if (hours.hours_text !== undefined) contentUpdate.hours = hours.hours_text;
            if (hours.hours_mon !== undefined) contentUpdate.hours_mon = hours.hours_mon;
            if (hours.hours_tue !== undefined) contentUpdate.hours_tue = hours.hours_tue;
            if (hours.hours_wed !== undefined) contentUpdate.hours_wed = hours.hours_wed;
            if (hours.hours_thu !== undefined) contentUpdate.hours_thu = hours.hours_thu;
            if (hours.hours_fri !== undefined) contentUpdate.hours_fri = hours.hours_fri;
            if (hours.hours_sat !== undefined) contentUpdate.hours_sat = hours.hours_sat;
            if (hours.hours_sun !== undefined) contentUpdate.hours_sun = hours.hours_sun;
            if (hours.seasonal_notes !== undefined) contentUpdate.seasonal_notes = hours.seasonal_notes;
            if (hours.kids_friendly !== undefined) contentUpdate.kids_friendly = hours.kids_friendly;
            if (hours.pet_friendly !== undefined) contentUpdate.pet_friendly = hours.pet_friendly;
            if (hours.live_music !== undefined) contentUpdate.live_music = hours.live_music;
            if (hours.outdoor_seating !== undefined) contentUpdate.outdoor_seating = hours.outdoor_seating;
            if (hours.reservations !== undefined) contentUpdate.reservations = hours.reservations;
            if (hours.delivery !== undefined) contentUpdate.delivery = hours.delivery;
            if (hours.takeout !== undefined) contentUpdate.takeout = hours.takeout;
            if (hours.alcohol !== undefined) contentUpdate.alcohol = hours.alcohol;
            if (hours.booking_required !== undefined) contentUpdate.booking_required = hours.booking_required;
        }
        const { error } = await supabase.from('site_content').upsert(contentUpdate, { onConflict: 'site_id' });
        if (error) errors.push('site_content: ' + error.message);
    }

    // 3. Happy hour — store as JSON in site_content.happy_hour
    if (happyHour !== undefined) {
        const { error } = await supabase.from('site_content')
            .update({ happy_hour: happyHour })
            .eq('site_id', siteId);
        if (error) errors.push('happy_hour: ' + error.message);
    }

    // 4. Replace specials
    if (specials !== undefined) {
        await supabase.from('specials').delete().eq('site_id', siteId);
        if (specials.length > 0) {
            const { error } = await supabase.from('specials').insert(
                specials.map((s, i) => ({ site_id: siteId, name: s.name, description: s.description, discount_text: s.discount_text, day_of_week: s.day, time_range: s.time, active: true, sort_order: i }))
            );
            if (error) errors.push('specials: ' + error.message);
        }
    }

    // 5. Replace events
    if (events !== undefined) {
        await supabase.from('events').delete().eq('site_id', siteId);
        if (events.length > 0) {
            const { error } = await supabase.from('events').insert(
                events.map(e => ({ site_id: siteId, name: e.name, description: e.description, event_date: e.date || null, event_time: e.time || null, active: true }))
            );
            if (error) errors.push('events: ' + error.message);
        }
    }

    // 6. Replace menu items
    if (menu !== undefined) {
        await supabase.from('menu_items').delete().eq('site_id', siteId);
        if (menu.length > 0) {
            const { error } = await supabase.from('menu_items').insert(
                menu.map((item, i) => ({
                    site_id: siteId,
                    name: item.name,
                    description: item.description || null,
                    price: item.price || null,
                    category: item.category || 'Menu',
                    tags: item.tags || [],
                    allergens: item.allergens || [],
                    available: item.available !== false,
                    sort_order: i
                }))
            );
            if (error) errors.push('menu_items: ' + error.message);
        }
    }

    // 7. Replace packages (stored as services with type='package')
    if (packages !== undefined) {
        await supabase.from('services').delete().eq('site_id', siteId).eq('category', 'package');
        if (packages.length > 0) {
            const { error } = await supabase.from('services').insert(
                packages.filter(p => p.name).map((p, i) => ({
                    site_id: siteId,
                    name: p.name,
                    description: p.description || null,
                    price: p.price || null,
                    capacity: p.max_guests || null,
                    duration_minutes: p.duration_minutes || null,
                    category: 'package',
                    available: true,
                    sort_order: i
                }))
            );
            if (error) errors.push('packages: ' + error.message);
        }
    }

    if (errors.length > 0) {
        return res.status(207).json({ success: false, errors });
    }
    res.json({ success: true });
});

// ============================================
// POST /api/admin/businesses/create-full — Create new GCR business (no user account)
// ============================================
router.post('/businesses/create-full', adminRequired, async (req, res) => {
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

// ── POST /api/admin/gcr/import-menu
router.post('/gcr/import-menu', async (req, res) => {
    const gcrDb = getGcrDb();
    const rows = Array.isArray(req.body) ? req.body : [req.body];
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
    const rows = Array.isArray(req.body) ? req.body : [req.body];
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
    const rows = Array.isArray(req.body) ? req.body : [req.body];
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
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId, upsertTag } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
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
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const { getEntityId } = gcrImportHelpers(gcrDb);
    let inserted = 0; const errors = [];

    for (const row of rows) {
        const entityId = await getEntityId(row.slug);
        if (!entityId) { errors.push(`entity not found: ${row.slug}`); continue; }
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

router.get('/gcr/events', adminRequired, async (req, res) => {
    const db = getGcrDb();
    let query = db.from('entity_events')
        .select('*, entity(name, slug)')
        .order('event_date', { ascending: true });
    if (req.query.entity_id) query = query.eq('entity_id', req.query.entity_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/gcr/events', adminRequired, async (req, res) => {
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

router.put('/gcr/events/:id', adminRequired, async (req, res) => {
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

router.delete('/gcr/events/:id', adminRequired, async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('entity_events').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GCR SPECIALS — new entity_specials table
// ============================================

router.get('/gcr/specials', adminRequired, async (req, res) => {
    const db = getGcrDb();
    let query = db.from('entity_specials')
        .select('*, entity(name, slug)')
        .neq('special_type', 'happy_hour')
        .not('special_name', 'ilike', '%happy hour%')
        .order('id', { ascending: false });
    if (req.query.entity_id) query = query.eq('entity_id', req.query.entity_id);
    if (req.query.type) query = query.eq('special_type', req.query.type);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/gcr/specials', adminRequired, async (req, res) => {
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

router.put('/gcr/specials/:id', adminRequired, async (req, res) => {
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

router.delete('/gcr/specials/:id', adminRequired, async (req, res) => {
    const db = getGcrDb();
    const { error } = await db.from('entity_specials').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GET /api/admin/gcr/business-data/:siteId — fetch all data for full editor
// ============================================
router.get('/gcr/business-data/:siteId', adminRequired, async (req, res) => {
    const { siteId } = req.params;
    const [bizRes, contentRes, menuRes, specialsRes, eventsRes, mediaRes, fleetRes, addonsRes, reviewsRes] = await Promise.all([
        supabase.from('businesses').select('*').eq('site_id', siteId).single(),
        supabase.from('site_content').select('*').eq('site_id', siteId).single(),
        supabase.from('menu_items').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('specials').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('events').select('*').eq('site_id', siteId).order('event_date'),
        supabase.from('media').select('*').eq('site_id', siteId).order('uploaded_at', { ascending: false }),
        supabase.from('fleet_types').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('rental_addons').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('reviews').select('*').eq('site_id', siteId).order('created_at', { ascending: false })
    ]);
    const content = contentRes.data || {};
    res.json({
        business:     bizRes.data    || {},
        content,
        menu:         menuRes.data   || [],
        specials:     specialsRes.data || [],
        events:       eventsRes.data || [],
        media:        mediaRes.data  || [],
        fleet:        fleetRes.data  || [],
        addons:       addonsRes.data || [],
        reviews:      reviewsRes.data|| [],
        schedules:    content.schedules    || [],
        highlights:   content.highlights   || [],
        restrictions: content.restrictions || [],
        whatToBring:  content.what_to_bring|| [],
    });
});

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

router.post('/upload-photo', adminRequired, upload.single('file'), async (req, res) => {
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

    const provider  = cfg.chat_provider || 'anthropic';
    const model     = cfg.chat_model    || 'claude-sonnet-4-6';

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
  "menu_items": [{ "name": "string", "description": "string", "price": "number or null", "category": "section name like 'Starters' or 'Lunch' or 'Dinner'" }],
  "bar_menu": [{ "category": "string", "items": [{ "name": "string", "desc": "string", "price": "string" }] }] or null,
  "specials": [{ "name": "string", "description": "string", "type": "daily_special|happy_hour|weekly", "days": ["Monday","Friday"], "start_time": "HH:MM", "end_time": "HH:MM", "discount_text": "string" }],
  "events": [{ "title": "string", "description": "string", "event_date": "YYYY-MM-DD or null", "event_time": "HH:MM or null" }],
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
    const [biz, content, menu, specials, events, fleet, addons, reviews, media] = await Promise.all([
        supabase.from('businesses').select('*').eq('site_id', siteId).single(),
        supabase.from('site_content').select('*').eq('site_id', siteId).single(),
        supabase.from('menu_items').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('specials').select('*').eq('site_id', siteId).order('created_at'),
        supabase.from('events').select('*').eq('site_id', siteId).order('event_date'),
        supabase.from('fleet_types').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('rental_addons').select('*').eq('site_id', siteId).order('sort_order'),
        supabase.from('reviews').select('*').eq('site_id', siteId).order('created_at', { ascending: false }),
        supabase.from('business_media').select('*').eq('site_id', siteId).order('sort_order'),
    ]);
    res.json({
        business: biz.data || {},
        content: content.data || {},
        menu: menu.data || [],
        specials: specials.data || [],
        events: events.data || [],
        fleet: fleet.data || [],
        addons: addons.data || [],
        reviews: reviews.data || [],
        media: media.data || [],
    });
});

// Save basic + location + flags
router.put('/businesses/:siteId/full', async (req, res) => {
    const { siteId } = req.params;
    const { business, content } = req.body;
    const errs = [];
    if (business) {
        const { error } = await supabase.from('businesses').update({ ...business, updated_at: new Date().toISOString() }).eq('site_id', siteId);
        if (error) errs.push(error.message);
    }
    if (content) {
        const { error } = await supabase.from('site_content').upsert({ ...content, site_id: siteId, updated_at: new Date().toISOString() }, { onConflict: 'site_id' });
        if (error) errs.push(error.message);
    }
    if (errs.length) return res.status(500).json({ error: errs.join('; ') });
    res.json({ success: true });
});

// Save fleet (delete all + reinsert)
router.post('/businesses/:siteId/fleet', async (req, res) => {
    const { siteId } = req.params;
    const { items } = req.body; // array
    await supabase.from('fleet_types').delete().eq('site_id', siteId);
    if (items && items.length) {
        const rows = items.map((it, i) => ({ ...it, site_id: siteId, sort_order: i, active: it.active !== false }));
        const { error } = await supabase.from('fleet_types').insert(rows);
        if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ success: true });
});

// Save addons (delete all + reinsert)
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

// Save schedule/pricing JSON to site_content
router.put('/businesses/:siteId/schedule', async (req, res) => {
    const { siteId } = req.params;
    const { schedules, pricing_notes } = req.body;
    const { error } = await supabase.from('site_content').upsert({
        site_id: siteId,
        schedules: schedules || [],
        pricing_notes: pricing_notes || '',
        updated_at: new Date().toISOString()
    }, { onConflict: 'site_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Save highlights / restrictions / what_to_bring
router.put('/businesses/:siteId/highlights', async (req, res) => {
    const { siteId } = req.params;
    const { highlights, restrictions, what_to_bring } = req.body;
    const { error } = await supabase.from('site_content').upsert({
        site_id: siteId,
        highlights: highlights || [],
        restrictions: restrictions || [],
        what_to_bring: what_to_bring || [],
        updated_at: new Date().toISOString()
    }, { onConflict: 'site_id' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Add photo URL (or handle base64 upload) to business_media
router.post('/businesses/:siteId/photos', async (req, res) => {
    const { siteId } = req.params;
    const { url, caption, section, linked_id } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    const { data, error } = await supabase.from('business_media').insert({
        site_id: siteId,
        url,
        caption: caption || '',
        section: section || 'gallery', // 'gallery' | 'menu' | 'event' | 'fleet'
        linked_id: linked_id || null,  // menu_item id, event id, etc.
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, photo: data });
});

// Delete a photo
router.delete('/businesses/:siteId/photos/:photoId', async (req, res) => {
    const { siteId, photoId } = req.params;
    const { error } = await supabase.from('business_media').delete().eq('id', photoId).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Approve / reject a review
router.put('/businesses/:siteId/reviews/:reviewId', async (req, res) => {
    const { siteId, reviewId } = req.params;
    const { active } = req.body;
    const { error } = await supabase.from('reviews').update({ active }).eq('id', reviewId).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/businesses/:siteId/reviews/:reviewId', async (req, res) => {
    const { siteId, reviewId } = req.params;
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Save a single menu item (upsert)
router.post('/businesses/:siteId/menu', async (req, res) => {
    const { siteId } = req.params;
    const item = { ...req.body, site_id: siteId };
    const { data, error } = item.id
        ? await supabase.from('menu_items').update(item).eq('id', item.id).select().single()
        : await supabase.from('menu_items').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/businesses/:siteId/menu/:itemId', async (req, res) => {
    const { siteId, itemId } = req.params;
    const { error } = await supabase.from('menu_items').delete().eq('id', itemId).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Save a single special (upsert)
router.post('/businesses/:siteId/specials', async (req, res) => {
    const { siteId } = req.params;
    const item = { ...req.body, site_id: siteId };
    const { data, error } = item.id
        ? await supabase.from('specials').update(item).eq('id', item.id).select().single()
        : await supabase.from('specials').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/businesses/:siteId/specials/:itemId', async (req, res) => {
    const { siteId, itemId } = req.params;
    const { error } = await supabase.from('specials').delete().eq('id', itemId).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Save a single event (upsert)
router.post('/businesses/:siteId/events', async (req, res) => {
    const { siteId } = req.params;
    const item = { ...req.body, site_id: siteId };
    const { data, error } = item.id
        ? await supabase.from('events').update(item).eq('id', item.id).select().single()
        : await supabase.from('events').insert(item).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data });
});

router.delete('/businesses/:siteId/events/:itemId', async (req, res) => {
    const { siteId, itemId } = req.params;
    const { error } = await supabase.from('events').delete().eq('id', itemId).eq('site_id', siteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================================
// GCR ENTITY ADMIN — Full CRUD for new entity/section schema
// ============================================================

let gcrDb; try { gcrDb = getGcrDb(); } catch(e) { console.warn('GCR DB not initialized:', e.message); }

// ── Entity CRUD ──────────────────────────────────────────────

// GET /api/admin/gcr/entities
router.get('/gcr/entities', async (req, res) => {
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

module.exports = router;


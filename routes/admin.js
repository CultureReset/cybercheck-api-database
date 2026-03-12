const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { adminRequired } = require('../middleware/auth');
const supabase = require('../db');

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
                    available: true,
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
// POST /api/admin/gcr/import-csv — Import single business row from businesses.csv
// ============================================
router.post('/gcr/import-csv', adminRequired, async (req, res) => {
    const row = req.body;
    if (!row.name) return res.status(400).json({ error: 'name required' });

    const slug = (row.slug || row.name)
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Upsert into businesses (match on subdomain/slug)
    const { data: existing } = await supabase
        .from('businesses')
        .select('site_id')
        .eq('subdomain', slug)
        .single();

    let siteId;

    if (existing) {
        siteId = existing.site_id;
        await supabase.from('businesses').update({
            name: row.name,
            type: row.category || 'other',
            status: row.status || 'active',
            emoji: row.emoji || null,
            featured: row.featured === 'true' || row.featured === true,
            gcr_listed: true,
            instagram: row.social_instagram || null,
            facebook: row.social_facebook || null,
            tiktok: row.social_tiktok || null
        }).eq('site_id', siteId);
    } else {
        const { data: biz, error } = await supabase.from('businesses').insert({
            name: row.name,
            type: row.category || 'other',
            subdomain: slug,
            plan: 'free',
            status: row.status || 'active',
            emoji: row.emoji || null,
            featured: row.featured === 'true' || row.featured === true,
            gcr_listed: true,
            instagram: row.social_instagram || null,
            facebook: row.social_facebook || null,
            tiktok: row.social_tiktok || null
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        siteId = biz.site_id;
    }

    // Build hours object
    const hoursObj = {};
    ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => {
        if (row['hours_' + d]) hoursObj['hours_' + d] = row['hours_' + d];
    });

    // Upsert site_content
    await supabase.from('site_content').upsert({
        site_id: siteId,
        tagline: row.tagline || null,
        seo_description: row.about || row.description || null,
        price_range: row.priceRange || row.price_range || null,
        address: row.address || null,
        city: row.city || (row.city_state ? row.city_state.split(',')[0].trim() : null),
        state: row.state || (row.city_state ? (row.city_state.split(',')[1] || '').trim() : null),
        zip: row.zip || null,
        contact_phone: row.phone || null,
        contact_email: row.email || null,
        website_url: row.website || null,
        hours: row.hours || null,
        ...hoursObj,
        seasonal_notes: row.seasonal_notes || null,
        kids_friendly: row.kidsFriendly === 'true' || row.kidsFriendly === true,
        pet_friendly: row.petFriendly === 'true' || row.petFriendly === true,
        live_music: row.liveMusic === 'true' || row.liveMusic === true,
        outdoor_seating: row.outdoor_seating === 'true' || row.outdoor_seating === true,
        reservations: row.reservations === 'true' || row.reservations === true,
        delivery: row.delivery === 'true' || row.delivery === true,
        takeout: row.takeout === 'true' || row.takeout === true,
        alcohol: row.alcohol === 'true' || row.alcohol === true,
        happy_hour: row.happyHour ? { text: row.happyHour, days: row.happyHour_days, start: row.happyHour_start, end: row.happyHour_end, drinks: row.happyHour_drink_specials, food: row.happyHour_food_specials } : null
    }, { onConflict: 'site_id' });

    // Insert specials if present
    if (row.specials) {
        const specialList = typeof row.specials === 'string'
            ? row.specials.split('|').map(s => s.trim()).filter(Boolean)
            : (Array.isArray(row.specials) ? row.specials : []);
        if (specialList.length) {
            await supabase.from('specials').delete().eq('site_id', siteId);
            await supabase.from('specials').insert(
                specialList.map((s, i) => ({ site_id: siteId, name: s, active: true, sort_order: i }))
            );
        }
    }

    // Insert menu highlights if present
    if (row.menuHighlights) {
        const items = typeof row.menuHighlights === 'string'
            ? row.menuHighlights.split('|').map(s => s.trim()).filter(Boolean)
            : [];
        if (items.length) {
            await supabase.from('menu_items').delete().eq('site_id', siteId);
            await supabase.from('menu_items').insert(
                items.map((name, i) => ({ site_id: siteId, name, category: 'Highlights', available: true, sort_order: i }))
            );
        }
    }

    res.json({ success: true, site_id: siteId, action: existing ? 'updated' : 'created' });
});

// ============================================
// GCR EVENTS — admin manage all events across businesses
// ============================================

router.get('/gcr/events', requireAdmin, async (req, res) => {
    const { site_id, upcoming } = req.query;
    let query = supabase.from('events').select('*, businesses(name)').order('event_date', { ascending: true });
    if (site_id) query = query.eq('site_id', site_id);
    if (upcoming === 'true') query = query.gte('event_date', new Date().toISOString().split('T')[0]);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/gcr/events', requireAdmin, async (req, res) => {
    const { site_id, name, description, event_date, event_time, location, image_url, active } = req.body;
    if (!site_id || !name) return res.status(400).json({ error: 'site_id and name required' });
    const { data, error } = await supabase.from('events').insert({ site_id, name, description, event_date: event_date || null, event_time: event_time || null, location: location || null, image_url: image_url || null, active: active !== false }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/events/:id', requireAdmin, async (req, res) => {
    const updates = { ...req.body }; delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('events').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/events/:id', requireAdmin, async (req, res) => {
    const { error } = await supabase.from('events').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// GCR SPECIALS — admin manage all specials across businesses
// ============================================

router.get('/gcr/specials', requireAdmin, async (req, res) => {
    const { site_id } = req.query;
    let query = supabase.from('specials').select('*, businesses(name)').order('sort_order').order('created_at', { ascending: false });
    if (site_id) query = query.eq('site_id', site_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

router.post('/gcr/specials', requireAdmin, async (req, res) => {
    const { site_id, name, description, discount_text, day_of_week, time_range, active } = req.body;
    if (!site_id || !name) return res.status(400).json({ error: 'site_id and name required' });
    const { data, error } = await supabase.from('specials').insert({ site_id, name, description, discount_text: discount_text || null, day_of_week: day_of_week || null, time_range: time_range || null, active: active !== false }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/gcr/specials/:id', requireAdmin, async (req, res) => {
    const updates = { ...req.body }; delete updates.site_id; delete updates.id;
    const { data, error } = await supabase.from('specials').update(updates).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/gcr/specials/:id', requireAdmin, async (req, res) => {
    const { error } = await supabase.from('specials').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;

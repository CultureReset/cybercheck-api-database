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

module.exports = router;

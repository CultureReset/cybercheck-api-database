// Script to add missing routes to dashboard.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'routes', 'dashboard.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Fix bookings list to join fleet_types and rental_time_slots (only for bookings query)
code = code.replace(
  `router.get('/bookings', async (req, res) => {
    let query = supabase
        .from('bookings')
        .select('*')
        .eq('site_id', req.siteId)
        .order('booking_date', { ascending: true });`,
  `router.get('/bookings', async (req, res) => {
    let query = supabase
        .from('bookings')
        .select('*, fleet_types(name), rental_time_slots(name, start_time, end_time)')
        .eq('site_id', req.siteId)
        .order('booking_date', { ascending: true });`
);

// 2. Add GET /bookings/:id right before POST /bookings
const bookingsGetById = `
// GET /api/dashboard/bookings/:id — single booking by ID
router.get('/bookings/:id', async (req, res) => {
    const { data, error } = await supabase
        .from('bookings')
        .select('*, fleet_types(name), rental_time_slots(name, start_time, end_time)')
        .eq('id', req.params.id)
        .eq('site_id', req.siteId)
        .single();

    if (error) return res.status(404).json({ error: 'Booking not found' });
    res.json(data);
});

`;
code = code.replace(
  `router.post('/bookings', async (req, res) => {`,
  bookingsGetById + `router.post('/bookings', async (req, res) => {`
);

// 3. Add PUT /pricing/:id before DELETE /pricing/:id
const pricingPut = `
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

`;
code = code.replace(
  `router.delete('/pricing/:id', async (req, res) => {`,
  pricingPut + `router.delete('/pricing/:id', async (req, res) => {`
);

// 4. Add waiver template and link routes after GET /waivers
const waiverRoutes = `

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

// POST /api/dashboard/waivers/link — generate a waiver link for a booking
router.post('/waivers/link', async (req, res) => {
    const { booking_id } = req.body;
    if (!booking_id) return res.status(400).json({ error: 'booking_id required' });

    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');

    const { data: booking } = await supabase
        .from('bookings')
        .select('id, customer_name')
        .eq('id', booking_id)
        .eq('site_id', req.siteId)
        .single();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { data: biz } = await supabase
        .from('businesses')
        .select('subdomain')
        .eq('site_id', req.siteId)
        .single();

    const baseUrl = process.env.PUBLIC_SITE_BASE_URL || ('https://' + (biz?.subdomain || 'site') + '.cybercheck.com');
    const link = baseUrl + '/waiver?token=' + token + '&booking=' + booking_id;

    res.json({ link, token, booking_id });
});
`;

// Insert after the waivers GET block (find the closing of waivers section)
code = code.replace(
  `router.get('/waivers', async (req, res) => {
    const { data } = await supabase
        .from('waivers')
        .select('*')
        .eq('site_id', req.siteId)
        .order('signed_at', { ascending: false });

    res.json(data || []);
});`,
  `router.get('/waivers', async (req, res) => {
    const { data } = await supabase
        .from('waivers')
        .select('*')
        .eq('site_id', req.siteId)
        .order('signed_at', { ascending: false });

    res.json(data || []);
});` + waiverRoutes
);

// 5. Add loyalty + stripe-status routes before module.exports
const loyaltyAndStripeRoutes = `

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

    const { data, error } = await supabase
        .from('site_content')
        .update({ messaging_settings: updated, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .select('messaging_settings')
        .single();

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

`;

code = code.replace(
  'module.exports = router;',
  loyaltyAndStripeRoutes + 'module.exports = router;'
);

fs.writeFileSync(file, code);
console.log('Dashboard routes fixed. New line count:', code.split('\n').length);

// Script to add missing routes to public.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'routes', 'public.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Fix requireSite to also check body.subdomain for POST requests
code = code.replace(
  `if (!req.siteId && req.query.subdomain) {`,
  `if (!req.siteId && (req.query.subdomain || (req.body && req.body.subdomain))) {`
);
code = code.replace(
  `.eq('subdomain', req.query.subdomain)`,
  `.eq('subdomain', req.query.subdomain || req.body.subdomain)`
);

// 2. Add GET /api/public/waiver before POST /api/public/waiver
const waiverGet = `
// ============================================
// GET /api/public/waiver — Fetch waiver template for a business
// ============================================
router.get('/waiver', async (req, res) => {
    const { data } = await supabase
        .from('waivers')
        .select('id, waiver_text, customer_name, signed_at')
        .eq('site_id', req.siteId)
        .is('booking_id', null)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) return res.status(404).json({ error: 'No waiver template found' });
    res.json({ waiver_text: data.waiver_text, title: data.customer_name || 'Waiver' });
});

`;
code = code.replace(
  `// ============================================\n// POST /api/public/waiver — Sign waiver\n// ============================================`,
  waiverGet + `// ============================================\n// POST /api/public/waiver — Sign waiver\n// ============================================`
);

// 3. Add loyalty signup, balance, and redeem routes before module.exports
const loyaltyRoutes = `

// ============================================
// POST /api/public/loyalty/signup — Enroll customer in loyalty program
// ============================================
router.post('/loyalty/signup', async (req, res) => {
    const { email, name, phone } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    const { data: existing } = await supabase
        .from('customers')
        .select('id, name, email, total_bookings, total_spent')
        .eq('site_id', req.siteId)
        .eq('email', email)
        .single();

    if (existing) {
        return res.json({
            success: true,
            message: 'Already enrolled',
            customer_id: existing.id,
            points: Math.floor(existing.total_spent || 0)
        });
    }

    const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
            site_id: req.siteId,
            name: name || null,
            email: email,
            phone: phone || null,
            total_bookings: 0,
            total_spent: 0,
            tags: ['loyalty']
        })
        .select('id')
        .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
        success: true,
        message: 'Enrolled in loyalty program',
        customer_id: newCustomer.id,
        points: 0
    });
});

// ============================================
// GET /api/public/loyalty/balance — Check loyalty balance by email
// ============================================
router.get('/loyalty/balance', async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'email query param required' });

    const { data: customer } = await supabase
        .from('customers')
        .select('name, total_bookings, total_spent, tags')
        .eq('site_id', req.siteId)
        .eq('email', email)
        .single();

    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
        name: customer.name,
        total_bookings: customer.total_bookings,
        total_spent: customer.total_spent,
        points: Math.floor(customer.total_spent || 0)
    });
});

// ============================================
// POST /api/public/loyalty/redeem — Redeem loyalty points
// ============================================
router.post('/loyalty/redeem', async (req, res) => {
    const { email, points_to_redeem } = req.body;

    if (!email || !points_to_redeem) {
        return res.status(400).json({ error: 'email and points_to_redeem required' });
    }

    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, total_spent')
        .eq('site_id', req.siteId)
        .eq('email', email)
        .single();

    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    const available = Math.floor(customer.total_spent || 0);
    if (points_to_redeem > available) {
        return res.status(400).json({
            error: 'Insufficient points',
            available: available,
            requested: points_to_redeem
        });
    }

    res.json({
        success: true,
        points_redeemed: points_to_redeem,
        points_remaining: available - points_to_redeem,
        discount_value: points_to_redeem * 0.10
    });
});

`;

code = code.replace(
  'module.exports = router;',
  loyaltyRoutes + 'module.exports = router;'
);

fs.writeFileSync(file, code);
console.log('Public routes fixed. New line count:', code.split('\n').length);

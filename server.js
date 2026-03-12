require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS — allow dashboard + dev origins
var corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(function(s) { return s.trim(); })
    : [
        'http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080',
        'http://127.0.0.1:5500', 'http://127.0.0.1:5501',
        'https://gulf-coast-radar-launch.vercel.app',
        'https://gulf-coast-radar.vercel.app',
        'https://gulfcoastradar.com',
        'https://www.gulfcoastradar.com'
      ];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (corsOrigins.indexOf(origin) !== -1 || corsOrigins[0] === '*') {
            return callback(null, true);
        }
        // In development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Webhooks need raw body for signature verification — must be before express.json()
app.use('/api/webhooks', require('./routes/webhooks'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (dev)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path}`);
        next();
    });
}

// Domain resolution - resolves hostname to site_id for public routes
const { resolveDomain } = require('./middleware/domain');

// ============================================
// API ROUTES
// ============================================

// Auth (login, signup, logout, refresh, reset)
app.use('/api/auth', require('./routes/auth'));

// Dashboard routes (authenticated business owner)
app.use('/api/dashboard', require('./routes/dashboard'));

// Public API (customer-facing, per domain)
app.use('/api/public', resolveDomain, require('./routes/public'));

// Admin routes (platform admin only)
app.use('/api/admin', require('./routes/admin'));

// GCR routes (platform-wide search & discovery)
app.use('/api/gcr', require('./routes/gcr'));

// Stripe Connect + Payments
app.use('/api/stripe', require('./routes/stripe'));

// Analytics (page views, conversions, tracking)
app.use('/api/analytics', require('./routes/analytics'));

// SMS Inbox — two-way messaging, booking confirmations, promo blasts
app.use('/api/sms', require('./routes/sms'));

// Webhooks registered above (before express.json for raw body access)

// Root — API status
app.get('/', (req, res) => res.json({ status: 'CyberCheck API running', version: '1.0.0' }));

// ============================================
// HEALTH CHECK
// ============================================

// Image upload — disabled on Vercel (use Supabase Storage instead)
app.post('/api/upload-image', (req, res) => {
    res.status(503).json({ error: 'Image upload: use Supabase Storage on production' });
});

// Site data — read/write via Supabase (Vercel filesystem is read-only)
const SITE_DATA_PATH = path.join(__dirname, 'site-data.json');
const SITE_DATA_KEY = 'circle-boats';

// Convert structured hours object → readable string for website display
function formatHoursString(hours) {
    if (!hours || typeof hours !== 'object') return '';
    const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const abbr  = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' };
    const open  = order.filter(d => hours[d] && !hours[d].closed);
    if (!open.length) return '';
    return open.map(d => `${abbr[d]} ${hours[d].open}–${hours[d].close}`).join(', ');
}

app.get('/api/site-data', async (req, res) => {
    // 1. Load bundled fallback JSON (always succeeds — ships with the repo)
    let base = {};
    try {
        base = JSON.parse(fs.readFileSync(SITE_DATA_PATH, 'utf8'));
    } catch (e) {
        console.warn('Could not read site-data.json:', e.message);
    }

    try {
        // 2. Check site_data_store for any full-blob saves (legacy / manual)
        const { data: stored } = await supabase
            .from('site_data_store')
            .select('value')
            .eq('key', SITE_DATA_KEY)
            .single();
        if (stored && stored.value) {
            base = stored.value;
        }

        // 3. Overlay live data from proper Supabase tables —
        //    these are the tables the dashboard actually writes to.
        const siteId = req.query.site_id || SITE_DATA_KEY;
        const [bizRes, contentRes, mediaRes, reviewsRes] = await Promise.all([
            supabase.from('businesses').select('*').eq('site_id', siteId).single(),
            supabase.from('site_content').select('*').eq('site_id', siteId).single(),
            supabase.from('media').select('*').eq('site_id', siteId).order('uploaded_at', { ascending: false }),
            supabase.from('reviews').select('id, customer_name, rating, text, photos, owner_reply, created_at').eq('site_id', siteId).eq('status', 'published').order('created_at', { ascending: false })
        ]);

        const biz     = bizRes.data;
        const content = contentRes.data;
        const media   = mediaRes.data || [];
        const reviews = reviewsRes.data || [];

        if (biz || content) {
            if (!base.business) base.business = {};

            // From businesses table
            if (biz) {
                if (biz.name)      base.business.name      = biz.name;
                if (biz.logo_url)  base.business.logo_url  = biz.logo_url;
                if (biz.cover_url) base.business.cover_url = biz.cover_url;
            }

            // From site_content table
            if (content) {
                if (content.about_text)    base.business.description = content.about_text;
                if (content.contact_phone) base.business.phone       = content.contact_phone;
                if (content.contact_email) base.business.email       = content.contact_email;
                if (content.logo_url)      base.business.logo_url    = content.logo_url;

                // Build full address string
                if (content.address) {
                    base.business.address = [content.address, content.city, content.state, content.zip]
                        .filter(Boolean).join(', ');
                }

                // Convert structured hours → readable string for website
                if (content.hours && Object.keys(content.hours).length > 0) {
                    base.business.hours = formatHoursString(content.hours);
                    base.business._hours_structured = content.hours;
                }

                // Location tag (city, state)
                if (content.city && content.state) {
                    const loc = content.city + ', ' + content.state;
                    base.business.location = loc;
                    if (!base.hero) base.hero = {};
                    base.hero.location = loc;
                }

                // Social links
                if (content.social_links && Object.keys(content.social_links).length > 0) {
                    base.social = Object.assign({}, base.social || {}, content.social_links);
                }

                // Theme color
                if (content.theme_color) {
                    if (!base.theme) base.theme = {};
                    base.theme.primary = content.theme_color;
                }
            }
        }

        // 4. Gallery from media table (only if records exist)
        if (media.length > 0) {
            base.gallery = media.map(m => m.url);
        }

        // 5. Published reviews (displayed on website)
        if (reviews.length > 0) {
            const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
            base.reviews = reviews;
            base.reviews_summary = {
                avg_rating: Math.round(avgRating * 10) / 10,
                total: reviews.length
            };
        }

    } catch (e) {
        console.warn('Supabase overlay failed, serving base data:', e.message);
    }

    res.set('Cache-Control', 'no-store');
    return res.json(base);
});

app.post('/api/site-data', async (req, res) => {
    try {
        const { error } = await supabase
            .from('site_data_store')
            .upsert({ key: SITE_DATA_KEY, value: req.body, updated_at: new Date().toISOString() });
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('site-data save error:', e);
        res.status(500).json({ error: 'Could not save site data: ' + e.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// ============================================
// PERIODIC CLEANUP
// ============================================

// Clean up expired booking holds every 2 minutes
const supabase = require('./db');
setInterval(async () => {
    try {
        const { count } = await supabase
            .from('booking_holds')
            .delete()
            .lt('expires_at', new Date().toISOString())
            .select('id', { count: 'exact', head: true });
        if (count > 0) console.log(`Cleaned up ${count} expired booking hold(s)`);
    } catch (err) {
        // Non-critical — holds also get cleaned up on each new hold creation
    }
}, 2 * 60 * 1000);

// ============================================
// START
// ============================================

app.listen(PORT, () => {
    console.log(`CyberCheck API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

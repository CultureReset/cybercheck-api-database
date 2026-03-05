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
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501'];

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

// Site data — read/write site-data.json (dashboard → website)
const SITE_DATA_PATH = path.join(__dirname, 'site-data.json');
app.get('/api/site-data', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(SITE_DATA_PATH, 'utf8'));
        res.set('Cache-Control', 'no-store');
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Could not load site data' });
    }
});
app.post('/api/site-data', (req, res) => {
    try {
        fs.writeFileSync(SITE_DATA_PATH, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Could not save site data' });
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

const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const _supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Verify JWT and attach site_id to request
// Accepts both Express JWTs (JWT_SECRET) and Supabase JWTs
function authRequired(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.split(' ')[1];

    // Try Express JWT first
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.siteId = decoded.siteId;
        req.role = decoded.role;
        return next();
    } catch (err) {
        // Not an Express JWT — try Supabase JWT
    }

    // Try Supabase JWT
    _supabaseAdmin.auth.getUser(token).then(({ data, error }) => {
        if (error || !data.user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        // Look up site_id from users table
        return _supabaseAdmin
            .from('users')
            .select('site_id, role')
            .eq('auth_id', data.user.id)
            .single()
            .then(({ data: user, error: userErr }) => {
                if (userErr || !user) {
                    return res.status(401).json({ error: 'User not found' });
                }
                req.userId = data.user.id;
                req.siteId = user.site_id;
                req.role = user.role || 'owner';
                next();
            });
    }).catch(() => res.status(401).json({ error: 'Invalid token' }));
}

// Admin only (your account)
function adminRequired(req, res, next) {
    authRequired(req, res, () => {
        if (req.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
}

module.exports = { authRequired, adminRequired };

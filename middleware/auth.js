const jwt = require('jsonwebtoken');
const supabase = require('../db');

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
    supabase.auth.getUser(token).then(async ({ data, error }) => {
        if (error || !data.user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Look up site_id — first by auth_id (fast path)
        let { data: user } = await supabase
            .from('users')
            .select('id, site_id, role')
            .eq('auth_id', data.user.id)
            .maybeSingle();

        // Fallback: look up by email (handles rows created before auth_id was linked)
        if (!user && data.user.email) {
            const { data: byEmail } = await supabase
                .from('users')
                .select('id, site_id, role')
                .eq('email', data.user.email)
                .maybeSingle();
            if (byEmail) {
                user = byEmail;
                // Auto-link auth_id so future lookups use fast path
                await supabase.from('users').update({ auth_id: data.user.id }).eq('id', byEmail.id);
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.userId = data.user.id;
        req.userEmail = data.user.email || null;
        req.siteId = user.site_id;
        req.role = user.role || 'owner';
        next();
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

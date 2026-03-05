const jwt = require('jsonwebtoken');

// Verify JWT and attach site_id to request
function authRequired(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.siteId = decoded.siteId;
        req.role = decoded.role;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
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

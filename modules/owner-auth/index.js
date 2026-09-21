/**
 * Business Owner Auth
 *
 * Login, signup, logout, refresh and password reset for business owners.
 *
 * Mount: /api/auth
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'owner-auth',
    name:         'Business Owner Auth',
    icon:         '🔑',
    version:      '1.0.0',
    description:  "Login, signup, logout, refresh and password reset for business owners.",
    mountPath:    '/api/auth',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   9,
    requiredCore: ['db', 'auth'],
    requiredEnv:  ['JWT_SECRET'],
    ownsTables:   [],
    sharedTables: ['businesses', 'site_apps', 'site_content', 'users'],
});

module.exports = router;

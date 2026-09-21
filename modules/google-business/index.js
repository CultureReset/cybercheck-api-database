/**
 * Google Business Profile
 *
 * Google Business Profile OAuth and review sync.
 *
 * Mount: /api/google-business, /api/dashboard/google-business
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'google-business',
    name:         'Google Business Profile',
    icon:         '🔵',
    version:      '1.0.0',
    description:  "Google Business Profile OAuth and review sync.",
    router,
    mounts: [
        { path: '/api/google-business' },
        { path: '/api/dashboard/google-business' },
    ],
    accessLevel:  'client',
    panelId:      'connections',
    routeCount:   10,
    requiredCore: ['db', 'auth', 'crypto'],
    requiredEnv:  [
        'DASHBOARD_BASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
        'GOOGLE_REDIRECT_URI'
    ],
    ownsTables:   [],
    sharedTables: ['oauth_tokens', 'reviews'],
});

module.exports = router;

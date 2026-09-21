/**
 * Trip Swipe Auth
 *
 * Tourist signup with a 6-digit email code, signin and password reset.
 *
 * Mount: /api/tourist-auth
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'tourist-auth',
    name:         'Trip Swipe Auth',
    icon:         '🔐',
    version:      '1.0.0',
    description:  "Tourist signup with a 6-digit email code, signin and password reset.",
    mountPath:    '/api/tourist-auth',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   8,
    requiredCore: ['db', 'email'],
    requiredEnv:  [
        'SENDBLUE_KEY_ID', 'SENDBLUE_SECRET', 'SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_KEY', 'SUPABASE_URL', 'TRIP_SWIPE_URL'
    ],
    ownsTables:   [],
    sharedTables: [
        'gcr_page_views', 'platform_settings', 'qr_scans', 'session_events',
        'tourist_profiles', 'tourist_sessions'
    ],
});

module.exports = router;

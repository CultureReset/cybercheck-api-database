/**
 * Admin Tourists
 *
 * Admin view/edit of Trip Swipe signups. Never mounted in server.js — the
 * same endpoints exist inside the tourist module. Registered disabled.
 *
 * Mount: /api/admin/tourists
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'admin-tourists',
    name:         'Admin Tourists',
    icon:         '🧳',
    version:      '1.0.0',
    description:  "Admin view/edit of Trip Swipe signups. Never mounted in server.js \u2014 the same endpoints exist inside the tourist module. Registered disabled.",
    mountPath:    '/api/admin/tourists',
    router,
    enabled:      false,   // not mounted today — see description
    accessLevel:  'admin',
    panelId:      null,
    routeCount:   7,
    requiredCore: ['auth'],
    requiredEnv:  ['SUPABASE_SERVICE_KEY', 'SUPABASE_URL'],
    ownsTables:   [],
    sharedTables: [
        'tourist_itineraries', 'tourist_profiles', 'tourist_saves',
        'tourist_swipe_events', 'user_preference_scores'
    ],
});

module.exports = router;

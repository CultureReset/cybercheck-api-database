/**
 * Menu Editor (legacy)
 *
 * Passcode-based menu editor. Never mounted in server.js — registered
 * disabled so it is visible without changing behaviour.
 *
 * Mount: /api/menu-edit
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'menu-edit',
    name:         'Menu Editor (legacy)',
    icon:         '🍴',
    version:      '1.0.0',
    description:  "Passcode-based menu editor. Never mounted in server.js \u2014 registered disabled so it is visible without changing behaviour.",
    mountPath:    '/api/menu-edit',
    router,
    enabled:      false,   // not mounted today — see description
    accessLevel:  'public',
    panelId:      null,
    routeCount:   6,
    requiredCore: [],
    requiredEnv:  ['GCR_SUPABASE_KEY', 'GCR_SUPABASE_URL'],
    ownsTables:   [],
    sharedTables: [
        'drink_items', 'drink_sections', 'entity', 'happy_hour_items',
        'happy_hour_sections', 'menu_items', 'menu_sections'
    ],
});

module.exports = router;

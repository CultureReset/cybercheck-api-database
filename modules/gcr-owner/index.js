/**
 * GCR Owner Self-Service
 *
 * GCR-authenticated business owner editing of their own entity, menus and
 * hours.
 *
 * Mount: /api/user
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'gcr-owner',
    name:         'GCR Owner Self-Service',
    icon:         '👤',
    version:      '1.0.0',
    description:  "GCR-authenticated business owner editing of their own entity, menus and hours.",
    mountPath:    '/api/user',
    router,
    accessLevel:  'client',
    panelId:      'gcr-owner',
    routeCount:   34,
    requiredCore: ['gcr-db', 'auth'],
    requiredEnv:  [],
    ownsTables:   ['installed_modules'],
    sharedTables: [
        'bookings', 'drink_items', 'drink_sections', 'entity',
        'entity_events', 'entity_features', 'entity_hours', 'entity_photos',
        'entity_specials', 'fleet_items', 'happy_hour_items',
        'happy_hour_sections', 'menu_items', 'menu_sections',
        'menu_sub_sections', 'profiles'
    ],
});

module.exports = router;

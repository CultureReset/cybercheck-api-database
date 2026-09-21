/**
 * Simple Menu Editor
 *
 * Slug-based menu and specials editor, no auth.
 *
 * Mount: /api/simple
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'simple-menu-edit',
    name:         'Simple Menu Editor',
    icon:         '🍽️',
    version:      '1.0.0',
    description:  "Slug-based menu and specials editor, no auth.",
    mountPath:    '/api/simple',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   6,
    requiredCore: ['gcr-db'],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: [
        'drink_items', 'drink_sections', 'entity', 'entity_events',
        'entity_photos', 'entity_specials', 'happy_hour_items',
        'happy_hour_sections', 'menu_items', 'menu_sections'
    ],
});

module.exports = router;

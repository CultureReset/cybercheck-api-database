/**
 * Site Content API
 *
 * Read/write layer over a site’s content, pages, theme and inventory.
 *
 * Mount: /api/site
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'site-api',
    name:         'Site Content API',
    icon:         '🖥️',
    version:      '1.0.0',
    description:  "Read/write layer over a site\u2019s content, pages, theme and inventory.",
    mountPath:    '/api/site',
    router,
    accessLevel:  'client',
    panelId:      'site',
    routeCount:   41,
    requiredCore: ['db', 'auth'],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: [
        'bookings', 'businesses', 'connections', 'customers', 'events',
        'fleet_types', 'menu_items', 'orders', 'rental_addons',
        'rental_pricing', 'rental_time_slots', 'services', 'site_apps',
        'site_content', 'specials', 'waivers'
    ],
});

module.exports = router;

/**
 * App Catalog
 *
 * The marketplace catalog and which apps a business has installed.
 *
 * Mount: /api/apps
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'apps-catalog',
    name:         'App Catalog',
    icon:         '🧩',
    version:      '1.0.0',
    description:  "The marketplace catalog and which apps a business has installed.",
    mountPath:    '/api/apps',
    router,
    accessLevel:  'client',
    panelId:      'apps',
    routeCount:   3,
    requiredCore: ['db', 'auth'],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: ['apps', 'site_apps'],
});

module.exports = router;

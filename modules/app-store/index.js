/**
 * App Store
 *
 * Per-site module install, uninstall, config and ordering.
 *
 * Mount: /api/modules
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'app-store',
    name:         'App Store',
    icon:         '🏪',
    version:      '1.0.0',
    description:  "Per-site module install, uninstall, config and ordering.",
    mountPath:    '/api/modules',
    router,
    accessLevel:  'client',
    panelId:      'apps',
    routeCount:   7,
    requiredCore: ['db', 'auth'],
    requiredEnv:  [],
    ownsTables:   ['module_manifest', 'user_modules'],
    sharedTables: [],
    migrations:   './migrations.sql',
});

module.exports = router;

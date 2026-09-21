/**
 * Links Pages
 *
 * Menu data loader for CyberCheck Links pages.
 *
 * Mount: /api/links
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'links',
    name:         'Links Pages',
    icon:         '🔗',
    version:      '1.0.0',
    description:  "Menu data loader for CyberCheck Links pages.",
    mountPath:    '/api/links',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   1,
    requiredCore: [],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: [],
});

module.exports = router;

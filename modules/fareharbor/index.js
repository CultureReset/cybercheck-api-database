/**
 * FareHarbor
 *
 * FareHarbor API-key connection, item and availability sync, webhooks.
 *
 * Mount: /api/integrations/fareharbor
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'fareharbor',
    name:         'FareHarbor',
    icon:         '🌊',
    version:      '1.0.0',
    description:  "FareHarbor API-key connection, item and availability sync, webhooks.",
    mountPath:    '/api/integrations/fareharbor',
    router,
    accessLevel:  'client',
    panelId:      'connections',
    routeCount:   7,
    requiredCore: ['db', 'auth', 'crypto'],
    requiredEnv:  ['CRON_SECRET'],
    ownsTables:   ['integrations'],
    sharedTables: ['availability_slots', 'integration_items'],
    migrations:   './migrations.sql',
});

module.exports = router;

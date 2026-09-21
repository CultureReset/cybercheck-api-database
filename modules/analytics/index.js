/**
 * Analytics
 *
 * Page views, conversions and session events.
 *
 * Mount: /api/analytics
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'analytics',
    name:         'Analytics',
    icon:         '📈',
    version:      '1.0.0',
    description:  "Page views, conversions and session events.",
    mountPath:    '/api/analytics',
    router,
    accessLevel:  'client',
    panelId:      'analytics',
    routeCount:   5,
    requiredCore: ['db'],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: ['businesses', 'conversions', 'page_views'],
});

module.exports = router;

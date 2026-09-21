/**
 * Availability Search
 *
 * Real-time availability search across connected booking platforms.
 *
 * Mount: /api/availability
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'availability-search',
    name:         'Availability Search',
    icon:         '🔎',
    version:      '1.0.0',
    description:  "Real-time availability search across connected booking platforms.",
    mountPath:    '/api/availability',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   3,
    requiredCore: ['db'],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: ['availability_slots', 'integration_items'],
});

module.exports = router;

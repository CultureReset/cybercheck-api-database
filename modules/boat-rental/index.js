/**
 * Boat Rental
 *
 * Boat inventory with hourly, half-day, full-day and multi-day rentals.
 *
 * Mount: /api/boat-rental
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'boat-rental',
    name:         'Boat Rental',
    icon:         '⛵',
    version:      '1.0.0',
    description:  "Boat inventory with hourly, half-day, full-day and multi-day rentals.",
    mountPath:    '/api/boat-rental',
    router,
    accessLevel:  'client',
    panelId:      'boat-rental',
    routeCount:   11,
    requiredCore: ['db', 'auth', 'sms'],
    requiredEnv:  ['STRIPE_SECRET_KEY'],
    ownsTables:   ['boat_blocks', 'boat_listings', 'boat_rentals'],
    sharedTables: ['businesses', 'connections'],
    migrations:   './migrations.sql',
});

module.exports = router;

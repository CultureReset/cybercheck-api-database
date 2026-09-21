/**
 * Charter Booking
 *
 * Fishing charter listings, departure times, liability waiver and deposit.
 *
 * Mount: /api/charter
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'charter-booking',
    name:         'Charter Booking',
    icon:         '🎣',
    version:      '1.0.0',
    description:  "Fishing charter listings, departure times, liability waiver and deposit.",
    mountPath:    '/api/charter',
    router,
    accessLevel:  'client',
    panelId:      'charter-booking',
    routeCount:   13,
    requiredCore: ['db', 'auth', 'sms'],
    requiredEnv:  ['STRIPE_SECRET_KEY'],
    ownsTables:   [
        'charter_blocks', 'charter_bookings', 'charter_departure_times',
        'charter_listings'
    ],
    sharedTables: ['businesses', 'connections'],
    migrations:   './migrations.sql',
});

module.exports = router;

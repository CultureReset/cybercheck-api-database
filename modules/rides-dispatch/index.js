/**
 * Rides Dispatch
 *
 * SMS ride lead dispatch with driver rotation, bidding and payment links.
 *
 * Mount: /api/rides
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'rides-dispatch',
    name:         'Rides Dispatch',
    icon:         '🚗',
    version:      '1.0.0',
    description:  "SMS ride lead dispatch with driver rotation, bidding and payment links.",
    mountPath:    '/api/rides',
    router,
    accessLevel:  'client',
    panelId:      'rides-dispatch',
    routeCount:   11,
    requiredCore: ['db', 'auth', 'sms'],
    requiredEnv:  ['CRON_SECRET', 'STRIPE_SECRET_KEY'],
    ownsTables:   ['ride_dispatches', 'ride_requests', 'taxi_drivers'],
    sharedTables: ['businesses', 'connections'],
});

module.exports = router;

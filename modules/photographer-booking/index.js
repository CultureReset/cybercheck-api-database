/**
 * Photographer Booking
 *
 * Session types, availability, slots, deposit payment and model release.
 *
 * Mount: /api/photographer
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'photographer-booking',
    name:         'Photographer Booking',
    icon:         '📷',
    version:      '1.0.0',
    description:  "Session types, availability, slots, deposit payment and model release.",
    mountPath:    '/api/photographer',
    router,
    accessLevel:  'client',
    panelId:      'photographer-booking',
    routeCount:   17,
    requiredCore: ['db', 'auth', 'sms'],
    requiredEnv:  ['STRIPE_SECRET_KEY'],
    ownsTables:   [
        'photo_availability', 'photo_blocks', 'photo_bookings',
        'photo_sessions'
    ],
    sharedTables: ['businesses', 'connections'],
    migrations:   './migrations.sql',
});

module.exports = router;

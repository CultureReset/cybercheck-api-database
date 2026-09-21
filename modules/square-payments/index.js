/**
 * Square Payments
 *
 * Square payments over the REST API with per-business encrypted keys.
 *
 * Mount: /api/square
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'square-payments',
    name:         'Square Payments',
    icon:         '◻️',
    version:      '1.0.0',
    description:  "Square payments over the REST API with per-business encrypted keys.",
    mountPath:    '/api/square',
    router,
    accessLevel:  'client',
    panelId:      'payments',
    routeCount:   8,
    requiredCore: ['db', 'auth', 'sms', 'email', 'crypto'],
    requiredEnv:  [
        'ADMIN_SMS_NUMBER', 'PUBLIC_SITE_BASE_URL',
        'STRIPE_KEY_ENCRYPTION_KEY'
    ],
    ownsTables:   [],
    sharedTables: [
        'bookings', 'businesses', 'connections', 'messaging_settings',
        'platform_settings', 'waivers'
    ],
});

module.exports = router;

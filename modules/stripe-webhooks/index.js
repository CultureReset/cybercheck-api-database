/**
 * Stripe Webhooks
 *
 * Inbound Stripe payment events. Mounted before the JSON body parser so
 * raw-body signature verification works.
 *
 * Mount: /api/webhooks
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'stripe-webhooks',
    name:         'Stripe Webhooks',
    icon:         '🪝',
    version:      '1.0.0',
    description:  "Inbound Stripe payment events. Mounted before the JSON body parser so raw-body signature verification works.",
    mountPath:    '/api/webhooks',
    router,
    preBodyParser: true,   // needs the raw body for signature verification
    accessLevel:  'public',
    panelId:      null,
    routeCount:   4,
    requiredCore: ['db'],
    requiredEnv:  [
        'API_BASE', 'SENDBLUE_KEY_ID', 'SENDBLUE_SECRET',
        'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'
    ],
    ownsTables:   [],
    sharedTables: [
        'bookings', 'businesses', 'notifications', 'orders',
        'platform_settings', 'site_content', 'sms_log', 'sms_opt_outs',
        'tourist_profiles', 'tourist_sms_log'
    ],
});

module.exports = router;

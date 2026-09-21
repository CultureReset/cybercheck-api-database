/**
 * Stripe Payments
 *
 * Stripe Connect onboarding, checkout, per-business encrypted keys.
 *
 * Mount: /api/stripe
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'stripe-payments',
    name:         'Stripe Payments',
    icon:         '💳',
    version:      '1.0.0',
    description:  "Stripe Connect onboarding, checkout, per-business encrypted keys.",
    mountPath:    '/api/stripe',
    router,
    accessLevel:  'client',
    panelId:      'payments',
    routeCount:   15,
    requiredCore: ['db', 'auth', 'sms', 'email', 'crypto'],
    requiredEnv:  [
        'DASHBOARD_URL', 'PLATFORM_FEE_PERCENT', 'PUBLIC_SITE_BASE_URL',
        'STRIPE_CLIENT_ID', 'STRIPE_CONNECT_REDIRECT_URI',
        'STRIPE_KEY_ENCRYPTION_KEY', 'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'
    ],
    ownsTables:   [],
    sharedTables: ['bookings', 'businesses', 'connections', 'site_content', 'waivers'],
});

module.exports = router;

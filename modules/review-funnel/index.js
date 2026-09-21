/**
 * Review Funnel
 *
 * POS webhook to review-request SMS to routed response, with custom review
 * questions.
 *
 * Mount: /api/reviews
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'review-funnel',
    name:         'Review Funnel',
    icon:         '⭐',
    version:      '1.0.0',
    description:  "POS webhook to review-request SMS to routed response, with custom review questions.",
    mountPath:    '/api/reviews',
    router,
    accessLevel:  'client',
    panelId:      'reviews',
    routeCount:   15,
    requiredCore: ['db', 'gcr-db', 'auth', 'sms'],
    requiredEnv:  ['CRON_SECRET', 'REVIEW_WEBHOOK_SECRET'],
    ownsTables:   [
        'customer_consents', 'pos_orders', 'review_requests',
        'review_sms_state'
    ],
    sharedTables: ['entity', 'reviews'],
});

module.exports = router;

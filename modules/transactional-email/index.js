/**
 * Transactional Email
 *
 * Generic one-off email send, used by Trip Swipe OTP and other lightweight
 * senders.
 *
 * Mount: /api/send-email
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'transactional-email',
    name:         'Transactional Email',
    icon:         '✉️',
    version:      '1.0.0',
    description:  "Generic one-off email send, used by Trip Swipe OTP and other lightweight senders.",
    mountPath:    '/api/send-email',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   1,
    requiredCore: ['email'],
    requiredEnv:  [],
    ownsTables:   [],
    sharedTables: [],
});

module.exports = router;

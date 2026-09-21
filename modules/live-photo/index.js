/**
 * Live Photo
 *
 * Verified customer food photos with AI validation and loyalty points.
 *
 * Mount: /api/live-photo
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'live-photo',
    name:         'Live Photo',
    icon:         '📸',
    version:      '1.0.0',
    description:  "Verified customer food photos with AI validation and loyalty points.",
    mountPath:    '/api/live-photo',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   4,
    requiredCore: ['db', 'gcr-db', 'sms'],
    requiredEnv:  ['ANTHROPIC_API_KEY'],
    ownsTables:   ['customer_live_photos'],
    sharedTables: ['customers'],
});

module.exports = router;

/**
 * SMS Inbox
 *
 * Two-way SMS threads, replies, outbound sends and the daily cron jobs.
 *
 * Mount: /api/sms
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'sms-inbox',
    name:         'SMS Inbox',
    icon:         '💬',
    version:      '1.0.0',
    description:  "Two-way SMS threads, replies, outbound sends and the daily cron jobs.",
    mountPath:    '/api/sms',
    router,
    accessLevel:  'client',
    panelId:      'messaging',
    routeCount:   9,
    requiredCore: ['db', 'gcr-db', 'sms'],
    requiredEnv:  [
        'CRON_SECRET', 'MENU_EDITOR_BASE_URL', 'OWNER_PHONE',
        'PUBLIC_SITE_BASE_URL'
    ],
    ownsTables:   [],
    sharedTables: [
        'bookings', 'businesses', 'customers', 'entity', 'entity_specials',
        'menu_items', 'messages', 'site_content', 'waivers'
    ],
});

module.exports = router;

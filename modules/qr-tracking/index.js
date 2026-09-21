/**
 * QR Tracking
 *
 * Numbered QR scan intelligence: stickers, cards, tables, ads, geofences
 * and referrals.
 *
 * Mount: /api/qr
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'qr-tracking',
    name:         'QR Tracking',
    icon:         '📲',
    version:      '1.0.0',
    description:  "Numbered QR scan intelligence: stickers, cards, tables, ads, geofences and referrals.",
    mountPath:    '/api/qr',
    router,
    accessLevel:  'client',
    panelId:      'qr-codes',
    routeCount:   25,
    requiredCore: ['db', 'gcr-db', 'auth', 'sms'],
    requiredEnv:  ['ADMIN_SMS_NUMBER', 'CRON_SECRET'],
    ownsTables:   [
        'app_settings', 'qr_codes', 'qr_events', 'referral_events',
        'referral_partners'
    ],
    sharedTables: ['customers', 'qr_scans'],
});

module.exports = router;

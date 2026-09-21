/**
 * Module manifest — the install list.
 *
 * Requiring a module runs its index.js, which registers it with core/registry.
 * **Order here is mount order**, and Express matches in mount order, so this list
 * is behaviour, not decoration. It reproduces the order server.js used before the
 * modules split — notably:
 *
 *   - stripe-webhooks is `preBodyParser`, so it mounts before express.json()
 *     regardless of where it sits in this list.
 *   - tourist must come before tourist-groups and setup-questions: all three
 *     answer under /api/tourist, and the first match wins.
 *
 * To add a module: drop it in modules/<id>/ and add one line. To take one out of
 * service, set `enabled: false` in its index.js rather than deleting the line —
 * it stays visible in GET /api/_modules and in the manifest.
 */

module.exports = [
    // raw-body first (mounted by the preBodyParser pass)
    require('./stripe-webhooks'),

    // core product surfaces
    require('./owner-auth'),
    require('./dashboard'),
    require('./public-site'),
    require('./admin'),
    require('./gcr-discovery'),
    require('./links'),
    require('./gcr-owner'),

    // payments
    require('./stripe-payments'),
    require('./square-payments'),

    // integrations
    require('./google-business'),

    // platform services
    require('./analytics'),
    require('./apps-catalog'),
    require('./site-api'),
    require('./sms-inbox'),
    require('./transactional-email'),

    // content editors
    require('./update-link'),
    require('./simple-menu-edit'),

    // customer intelligence
    require('./qr-tracking'),
    require('./review-funnel'),

    // booking verticals
    require('./rides-dispatch'),
    require('./fareharbor'),
    require('./photographer-booking'),
    require('./app-store'),
    require('./charter-booking'),
    require('./boat-rental'),
    require('./availability-search'),
    require('./live-photo'),

    // trip swipe — tourist must precede tourist-groups and setup-questions
    require('./tourist'),
    require('./tourist-groups'),
    require('./tourist-auth'),
    require('./setup-questions'),

    // registered but not mounted (enabled: false)
    require('./menu-edit'),
    require('./admin-tourists'),
    require('./sms-automation'),
    require('./social-manager'),
];

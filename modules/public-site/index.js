/**
 * Public Site
 *
 * Customer-facing routes for a business site, scoped by Host header to a
 * site_id.
 *
 * Mount: /api/public
 */

const registry = require('../../core/registry');
const router   = require('./routes');
const { resolveDomain } = require('../../core/domain');

registry.register({
    id:           'public-site',
    name:         'Public Site',
    icon:         '🌐',
    version:      '1.0.0',
    description:  "Customer-facing routes for a business site, scoped by Host header to a site_id.",
    mountPath:    '/api/public',
    router,
    middleware:   [resolveDomain],
    accessLevel:  'public',
    panelId:      null,
    routeCount:   51,
    requiredCore: ['db', 'gcr-db', 'sms', 'email'],
    requiredEnv:  [
        'ADMIN_SMS_NUMBER', 'CRON_SECRET', 'GROK_API_KEY', 'OPENAI_API_KEY',
        'PLATFORM_FEE_PERCENT', 'PUBLIC_SITE_BASE_URL',
        'SQUARE_PLATFORM_FEE_PERCENT', 'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_PUBLISHABLE_KEY_LIVE', 'STRIPE_PUBLISHABLE_KEY_TEST'
    ],
    ownsTables:   [
        'blackout_dates', 'booking_holds', 'review_answers',
        'signed_waivers', 'social_media_accounts', 'tourist_conversations'
    ],
    sharedTables: [
        'availability', 'availability_blocks', 'booking_funnel', 'bookings',
        'business_atmosphere', 'business_details', 'business_leads',
        'business_logistics', 'businesses', 'connections', 'conversions',
        'customers', 'drink_items', 'drink_sections', 'entity',
        'entity_events', 'entity_hours', 'entity_photos', 'entity_specials',
        'events', 'faqs', 'fleet_items', 'fleet_types', 'happy_hour_items',
        'happy_hour_sections', 'media', 'menu_items', 'menu_sections',
        'messaging_settings', 'notifications', 'orders', 'page_views',
        'qa_pairs', 'rental_addons', 'rental_group_rates', 'rental_pricing',
        'rental_time_slots', 'review_questions', 'reviews', 'services',
        'session_events', 'site_apps', 'site_content', 'specials', 'staff',
        'tourist_sessions', 'waivers'
    ],
});

module.exports = router;

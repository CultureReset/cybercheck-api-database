/**
 * Business Dashboard
 *
 * Everything a signed-in business owner can do: profile, menus, bookings,
 * CRM, reviews, waivers, campaigns, AI assistant.
 *
 * Mount: /api/dashboard
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'dashboard',
    name:         'Business Dashboard',
    icon:         '📊',
    version:      '1.0.0',
    description:  "Everything a signed-in business owner can do: profile, menus, bookings, CRM, reviews, waivers, campaigns, AI assistant.",
    mountPath:    '/api/dashboard',
    router,
    accessLevel:  'client',
    panelId:      'dashboard',
    routeCount:   189,
    requiredCore: [
        'db', 'gcr-db', 'auth', 'sms', 'email', 'ai', 'entity-resolver',
        'menu-gcr'
    ],
    requiredEnv:  [
        'AI_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY',
        'PUBLIC_SITE_BASE_URL', 'STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_KEY',
        'SUPABASE_URL'
    ],
    ownsTables:   [
        'activity_log', 'coupon_claims', 'domains', 'entity_promotions',
        'faq_items', 'media_library', 'promotions'
    ],
    sharedTables: [
        'ai_conversations', 'ai_messages', 'apps', 'availability',
        'availability_blocks', 'bookings', 'business_atmosphere',
        'business_details', 'business_logistics', 'business_memories',
        'businesses', 'connections', 'coupons', 'customers', 'drink_items',
        'drink_sections', 'entity', 'entity_events', 'entity_hours',
        'entity_photos', 'entity_specials', 'entity_tags', 'events', 'faqs',
        'fleet_items', 'fleet_types', 'gcr_reviews', 'happy_hour_items',
        'happy_hour_sections', 'media', 'menu_categories', 'menu_items',
        'menu_subcategories', 'messaging_settings', 'notifications',
        'onboarding_progress', 'orders', 'qa_pairs', 'rental_addons',
        'rental_group_rates', 'rental_pricing', 'rental_time_slots',
        'review_questions', 'reviews', 'services', 'site_apps',
        'site_content', 'site_pages', 'sms_campaigns', 'sms_log',
        'sms_opt_outs', 'specials', 'staff', 'waivers'
    ],
});

module.exports = router;

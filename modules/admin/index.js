/**
 * Platform Admin
 *
 * Platform administration plus the full GCR entity CRUD and CSV/AI import
 * pipeline.
 *
 * Mount: /api/admin
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'admin',
    name:         'Platform Admin',
    icon:         '🛠️',
    version:      '1.0.0',
    description:  "Platform administration plus the full GCR entity CRUD and CSV/AI import pipeline.",
    mountPath:    '/api/admin',
    router,
    accessLevel:  'admin',
    panelId:      'admin',
    routeCount:   254,
    requiredCore: ['db', 'gcr-db', 'auth', 'ai'],
    requiredEnv:  [
        'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'GROK_API_KEY',
        'GROQ_API_KEY', 'JWT_SECRET', 'LINKS_BASE_URL', 'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY', 'XAI_API_KEY'
    ],
    ownsTables:   [
        'ai_chat_conversations', 'audit_log', 'business_filters',
        'business_highlights', 'entity_activities', 'entity_analytics',
        'entity_booking_slots', 'entity_drink_items',
        'entity_drink_sections', 'entity_happy_hour_items',
        'entity_integrations', 'entity_menu_items', 'entity_menu_sections',
        'entity_policies', 'entity_pricing', 'entity_requirements',
        'entity_reviews', 'entity_section_bullets', 'entity_section_items',
        'gcr_category_cards', 'gcr_conversions', 'gcr_coupons',
        'gcr_customers', 'gcr_entity_pages', 'gcr_faqs',
        'gcr_messaging_settings', 'gcr_page_assignments',
        'gcr_seo_settings', 'gcr_site_config', 'gcr_social_accounts',
        'geofence_triggers', 'geofences', 'itineraries', 'packages',
        'platform_page_views', 'seo_keywords', 'seo_meta_tags',
        'sms_blasts', 'social_media_analytics', 'support_tickets',
        'templates', 'tourist_location_settings', 'tourist_locations',
        'tourist_preferences', 'tripswipe_business_settings'
    ],
    sharedTables: [
        'activities', 'addons', 'ai_conversations', 'ai_messages',
        'ai_settings', 'apps', 'availability', 'availability_blocks',
        'booking_funnel', 'booking_slots', 'bookings',
        'business_atmosphere', 'business_details', 'business_embeddings',
        'business_leads', 'business_logistics', 'business_media',
        'business_memories', 'businesses', 'connections', 'conversions',
        'coupons', 'customers', 'daily_rotation_options',
        'daily_rotation_sections', 'drink_items', 'drink_sections',
        'entity', 'entity_about_bullets', 'entity_events',
        'entity_features', 'entity_happy_hours', 'entity_hours',
        'entity_perfect_for', 'entity_photos', 'entity_qna',
        'entity_sections', 'entity_specials', 'entity_tags', 'events',
        'faqs', 'fleet_items', 'fleet_types', 'gcr_ads',
        'gcr_category_page_config', 'gcr_claims', 'gcr_page_views',
        'gcr_reviews', 'happy_hour_items', 'happy_hour_sections',
        'item_swipes', 'media', 'meeting_points', 'menu_categories',
        'menu_items', 'menu_sections', 'menu_subcategories',
        'messaging_settings', 'notifications', 'oauth_tokens',
        'onboarding_progress', 'orders', 'page_views', 'platform_settings',
        'policies', 'pricing_items', 'product_items', 'profiles',
        'qa_pairs', 'rental_addons', 'rental_group_rates', 'rental_pricing',
        'rental_time_slots', 'requirements', 'reviews', 'sales_leads',
        'section_bullets', 'section_cards', 'section_groups',
        'section_hours', 'section_items', 'section_location',
        'section_photos', 'section_rich_text', 'services', 'session_events',
        'site_apps', 'site_content', 'site_pages', 'sms_campaigns',
        'sms_log', 'sms_opt_outs', 'specials', 'staff', 'tourist_photos',
        'tourist_profiles', 'tourist_saves', 'update_links',
        'user_preference_scores', 'users', 'waivers', 'whats_included'
    ],
});

module.exports = router;

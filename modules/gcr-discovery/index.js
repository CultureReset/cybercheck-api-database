/**
 * GCR Discovery
 *
 * Public Gulf Coast Radar: search, browse, entity detail, RAG chat, ad
 * network, QR menu themes.
 *
 * Mount: /api/gcr
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'gcr-discovery',
    name:         'GCR Discovery',
    icon:         '📍',
    version:      '1.0.0',
    description:  "Public Gulf Coast Radar: search, browse, entity detail, RAG chat, ad network, QR menu themes.",
    mountPath:    '/api/gcr',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   53,
    requiredCore: ['db', 'gcr-db', 'sms', 'email', 'ai'],
    requiredEnv:  [
        'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'EMBED_API_KEY',
        'GCR_ADMIN_SECRET', 'GEMINI_API_KEY', 'GOOGLE_AI_KEY',
        'GROK_API_KEY', 'GROQ_API_KEY', 'JWT_SECRET', 'OPENAI_API_KEY',
        'REINDEX_SECRET', 'XAI_API_KEY'
    ],
    ownsTables:   [
        'entity_galleries', 'gcr_settings', 'product_sections',
        'product_sub_sections', 'qr_menu_themes', 'section_reviews',
        'site_data_store'
    ],
    sharedTables: [
        'activities', 'addons', 'ai_settings', 'booking_slots', 'bookings',
        'business_embeddings', 'business_media', 'businesses',
        'drink_items', 'drink_sections', 'entity', 'entity_about_bullets',
        'entity_events', 'entity_features', 'entity_happy_hours',
        'entity_hours', 'entity_perfect_for', 'entity_photos', 'entity_qna',
        'entity_sections', 'entity_specials', 'entity_tags', 'events',
        'faqs', 'fleet_items', 'fleet_types', 'gcr_ads',
        'gcr_category_page_config', 'gcr_claims', 'gcr_page_views',
        'happy_hour_items', 'happy_hour_sections', 'item_swipes',
        'meeting_points', 'menu_items', 'menu_sections',
        'menu_sub_sections', 'policies', 'pricing_items', 'product_items',
        'rental_addons', 'rental_group_rates', 'rental_pricing',
        'rental_time_slots', 'requirements', 'reviews', 'sales_leads',
        'section_bullets', 'section_cards', 'section_groups',
        'section_hours', 'section_items', 'section_location',
        'section_photos', 'section_rich_text', 'services', 'site_content',
        'specials', 'staff', 'tourist_photos', 'tourist_profiles',
        'tourist_saves', 'tourist_sessions', 'user_preference_scores',
        'whats_included'
    ],
});

module.exports = router;

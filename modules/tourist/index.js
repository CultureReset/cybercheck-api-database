/**
 * Trip Swipe
 *
 * Tourist saves, profile, itinerary, preference scoring and AI concierge.
 *
 * Mount: /api/tourist
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'tourist',
    name:         'Trip Swipe',
    icon:         '✈️',
    version:      '1.0.0',
    description:  "Tourist saves, profile, itinerary, preference scoring and AI concierge.",
    mountPath:    '/api/tourist',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   30,
    requiredCore: ['db', 'gcr-db', 'auth', 'email', 'ai'],
    requiredEnv:  [
        'ANTHROPIC_API_KEY', 'GCR_SUPABASE_KEY', 'GCR_SUPABASE_URL',
        'JWT_SECRET', 'SENDBLUE_KEY_ID', 'SENDBLUE_SECRET',
        'SUPABASE_SERVICE_KEY', 'SUPABASE_URL'
    ],
    ownsTables:   ['tourist_ai_conversations', 'tourist_ai_messages', 'tourist_memories'],
    sharedTables: [
        'entity', 'entity_tags', 'gcr_page_views', 'platform_settings',
        'qr_scans', 'session_events', 'specials', 'tourist_itineraries',
        'tourist_photos', 'tourist_profiles', 'tourist_saves',
        'tourist_sms_log', 'tourist_swipe_events', 'user_preference_scores'
    ],
});

module.exports = router;

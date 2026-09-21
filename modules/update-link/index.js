/**
 * Daily Update Link
 *
 * Token-based mobile editor a business owner opens from an SMS to update
 * menus, specials and catch of the day.
 *
 * Mount: /api/update, /update
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'update-link',
    name:         'Daily Update Link',
    icon:         '📝',
    version:      '1.0.0',
    description:  "Token-based mobile editor a business owner opens from an SMS to update menus, specials and catch of the day.",
    router,
    mounts: [
        { path: '/api/update' },
        { path: '/update' },
    ],
    accessLevel:  'public',
    panelId:      'update-link',
    routeCount:   36,
    requiredCore: ['db', 'gcr-db', 'auth', 'sms', 'ai'],
    requiredEnv:  ['GROK_API_KEY', 'LINKS_BASE_URL', 'XAI_API_KEY'],
    ownsTables:   ['daily_rotation_picks'],
    sharedTables: [
        'businesses', 'daily_rotation_options', 'daily_rotation_sections',
        'drink_items', 'drink_sections', 'entity', 'entity_events',
        'entity_photos', 'entity_sections', 'entity_specials', 'events',
        'happy_hour_items', 'happy_hour_sections', 'menu_items',
        'menu_sections', 'section_items', 'specials', 'update_links'
    ],
});

module.exports = router;

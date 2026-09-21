/**
 * Trip Swipe Groups
 *
 * Group trip planning: invite codes, shared saves and overlap view.
 *
 * Mount: /api/tourist/groups
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:           'tourist-groups',
    name:         'Trip Swipe Groups',
    icon:         '👥',
    version:      '1.0.0',
    description:  "Group trip planning: invite codes, shared saves and overlap view.",
    mountPath:    '/api/tourist/groups',
    router,
    accessLevel:  'public',
    panelId:      null,
    routeCount:   9,
    requiredCore: ['db'],
    requiredEnv:  ['SUPABASE_SERVICE_KEY', 'SUPABASE_URL', 'TRIP_SWIPE_URL'],
    ownsTables:   ['tourist_group_invites', 'tourist_group_members', 'tourist_groups'],
    sharedTables: ['tourist_saves'],
});

module.exports = router;

/**
 * Setup Questions
 *
 * Editable Trip Swipe signup questionnaire: public read plus admin CRUD.
 *
 * Mount: /api/tourist, /api/admin/setup-questions
 */

const registry = require('../../core/registry');
const { publicRouter, adminRouter } = require('./routes');

registry.register({
    id:           'setup-questions',
    name:         'Setup Questions',
    icon:         '❓',
    version:      '1.0.0',
    description:  "Editable Trip Swipe signup questionnaire: public read plus admin CRUD.",
    mounts: [
        { path: '/api/tourist', router: publicRouter },
        { path: '/api/admin/setup-questions', router: adminRouter },
    ],
    accessLevel:  'public',
    panelId:      null,
    routeCount:   0,
    requiredCore: ['db', 'auth'],
    requiredEnv:  [],
    ownsTables:   ['tourist_setup_questions'],
    sharedTables: [],
});

module.exports = { publicRouter, adminRouter };

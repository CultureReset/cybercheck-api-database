/**
 * Social Manager Module
 *
 * Facebook, Instagram management:
 *  - Page insights (reach, impressions, followers)
 *  - Post scheduling and publishing
 *  - Ad campaign overview (read performance)
 *  - Story and reel stats
 *  - Comment monitoring
 *
 * Mount path: /api/m/social
 * OAuth: Facebook Login with pages_manage_posts, ads_read, instagram_basic scopes
 */

const registry = require('../../core/registry');
const router   = require('./routes');

registry.register({
    id:          'social-manager',
    name:        'Social Manager',
    icon:        '📱',
    version:     '1.0.0',
    description: 'Manage Facebook & Instagram: posts, insights, ads performance, comments. One place for all social.',
    mountPath:   '/api/m/social',
    accessLevel: 'client',  // clients can access their own social data
    router,
    panelId:     'social-manager',
    enabled:     false,   // routes return 501 until the Graph integration is built
    routeCount:  7,
    requiredCore:['auth'],
    requiredEnv: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    ownsTables:  ['social_media_accounts', 'social_media_posts', 'social_media_analytics'],
    sharedTables:[],
    grokTools: [
        {
            accessLevel: 'client',
            type: 'function',
            function: {
                name: 'get_social_accounts',
                description: 'List connected Facebook and Instagram accounts for a business, including connection status and last sync.',
                parameters: {
                    type: 'object',
                    properties: {
                        entity_id: { type: 'string' }
                    }
                }
            }
        },
        {
            accessLevel: 'client',
            type: 'function',
            function: {
                name: 'get_social_posts',
                description: 'Get recent and scheduled social media posts for a business: content, platform, publish status, engagement stats.',
                parameters: {
                    type: 'object',
                    properties: {
                        entity_id: { type: 'string' },
                        platform: { type: 'string', enum: ['facebook', 'instagram', 'all'] },
                        status: { type: 'string', enum: ['published', 'scheduled', 'draft', 'all'] },
                        limit: { type: 'number' }
                    }
                }
            }
        },
        {
            accessLevel: 'admin',
            type: 'function',
            function: {
                name: 'get_ads_performance',
                description: 'Get Facebook/Instagram ad campaign performance: spend, reach, clicks, conversions, ROAS.',
                parameters: {
                    type: 'object',
                    properties: {
                        entity_id: { type: 'string' },
                        days: { type: 'number', description: 'Lookback window (default 30)' }
                    }
                }
            }
        },
    ],
});

module.exports = router;

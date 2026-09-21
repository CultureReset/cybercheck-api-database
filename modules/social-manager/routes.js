/**
 * Social Manager — routes
 *
 * The module manifest (index.js) has always referenced this file, but it did not
 * exist, so requiring the module threw. This is the declared surface, wired up and
 * returning 501 until the Facebook Graph calls are implemented. The module stays
 * registered with `enabled: false` so nothing mounts by accident.
 *
 * Implementing it means: Facebook Login (pages_manage_posts, ads_read,
 * instagram_basic), tokens through core/crypto into `connections`/`oauth_tokens`,
 * then Graph API reads for insights and writes for scheduled posts.
 *
 *   GET    /api/m/social/accounts            — connected FB/IG accounts
 *   GET    /api/m/social/posts               — recent + scheduled posts
 *   POST   /api/m/social/posts               — schedule or publish
 *   DELETE /api/m/social/posts/:id           — cancel a scheduled post
 *   GET    /api/m/social/insights            — reach, impressions, followers
 *   GET    /api/m/social/ads                 — campaign performance
 *   GET    /api/m/social/comments            — comment monitoring
 */

const express = require('express');
const { authRequired, adminRequired } = require('../../core/auth');

const router = express.Router();

const notImplemented = (what) => (req, res) =>
    res.status(501).json({
        error: 'not_implemented',
        module: 'social-manager',
        endpoint: what,
        message: 'Social Manager is registered but its Facebook/Instagram integration is not built yet.',
        requiredEnv: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
    });

router.get('/accounts',        authRequired,  notImplemented('list connected accounts'));
router.get('/posts',           authRequired,  notImplemented('list posts'));
router.post('/posts',          authRequired,  notImplemented('schedule or publish a post'));
router.delete('/posts/:id',    authRequired,  notImplemented('cancel a scheduled post'));
router.get('/insights',        authRequired,  notImplemented('page insights'));
router.get('/comments',        authRequired,  notImplemented('comment monitoring'));
router.get('/ads',             adminRequired, notImplemented('ad campaign performance'));

module.exports = router;

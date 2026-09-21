// Resolve the authenticated request to a GCR entity_id.
// Priority:
//   1. Explicit entity_id on the request (query/body/x-entity-id header)
//   2. Admin-supplied target site_id (query/body) → entity.legacy_site_id
//   3. entity_owners row for the logged-in user
//   4. entity.legacy_site_id matching req.siteId (user's own site)
// Returns null when nothing matches.

const getGcrDb = require('./gcr-db');

async function resolveEntityId(req) {
    if (req._resolvedEntityId !== undefined) return req._resolvedEntityId;

    const explicit =
        req.query.entity_id ||
        (req.body && req.body.entity_id) ||
        req.get('x-entity-id');
    if (explicit) {
        req._resolvedEntityId = explicit;
        return explicit;
    }

    const gcrDb = getGcrDb();

    // Admin can switch between businesses by passing ?site_id=X
    if (req.role === 'admin') {
        const targetSiteId = req.query.site_id || (req.body && req.body.site_id);
        if (targetSiteId) {
            const { data } = await gcrDb
                .from('entity').select('id').eq('legacy_site_id', targetSiteId).limit(1).maybeSingle();
            if (data && data.id) {
                req._resolvedEntityId = data.id;
                return data.id;
            }
        }
    }

    const userId = req.gcrUserId || req.userId;
    if (userId) {
        const { data } = await gcrDb
            .from('entity_owners').select('entity_id').eq('user_id', userId).limit(1).maybeSingle();
        if (data && data.entity_id) {
            req._resolvedEntityId = data.entity_id;
            return data.entity_id;
        }
    }

    if (req.siteId) {
        const { data } = await gcrDb
            .from('entity').select('id').eq('legacy_site_id', req.siteId).limit(1).maybeSingle();
        if (data && data.id) {
            req._resolvedEntityId = data.id;
            return data.id;
        }
    }

    req._resolvedEntityId = null;
    return null;
}

module.exports = { resolveEntityId };

/**
 * Admin — view/edit tourist users (trip-swipe signups).
 * All routes require admin JWT.
 *
 *   GET    /api/admin/tourists                 — list (summary with counts)
 *   GET    /api/admin/tourists/:user_id        — detail (profile + saves + itinerary + auth)
 *   DELETE /api/admin/tourists/:user_id/saves/:save_id
 *   DELETE /api/admin/tourists/:user_id/itinerary/:itin_id
 *   DELETE /api/admin/tourists/:user_id        — delete auth user (cascades profile/saves/itinerary)
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { adminRequired } = require('../middleware/auth');

const router = express.Router();

// Service-role client for admin access (bypasses RLS, can list auth users)
function admin() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

router.get('/', adminRequired, async (req, res) => {
    const sb = admin();
    const [{ data: profiles }, { data: savesCounts }, { data: itinCounts }] = await Promise.all([
        sb.from('tourist_profiles').select('*'),
        sb.from('tourist_saves').select('user_id'),
        sb.from('tourist_itineraries').select('user_id'),
    ]);

    // Auth users via admin API
    const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const authUsers = authList?.users || [];

    const savesByUser = {};
    (savesCounts || []).forEach(r => { savesByUser[r.user_id] = (savesByUser[r.user_id] || 0) + 1; });
    const itinByUser = {};
    (itinCounts || []).forEach(r => { itinByUser[r.user_id] = (itinByUser[r.user_id] || 0) + 1; });
    const profByUser = {};
    (profiles || []).forEach(p => { profByUser[p.user_id] = p; });

    // Only include users who have any tourist_* record (so we don't show non-tourist auth users)
    const touristIds = new Set([
        ...Object.keys(savesByUser),
        ...Object.keys(itinByUser),
        ...Object.keys(profByUser),
    ]);

    const tourists = authUsers
        .filter(u => touristIds.has(u.id))
        .map(u => {
            const p = profByUser[u.id] || {};
            return {
                user_id: u.id,
                email: u.email,
                email_confirmed: !!u.email_confirmed_at,
                created_at: u.created_at,
                last_sign_in_at: u.last_sign_in_at,
                name: p.name || null,
                destination: p.destination || null,
                arrival: p.arrival || null,
                departure: p.departure || null,
                trip_days: p.trip_days || null,
                group_type: p.group_type || null,
                saves_count: savesByUser[u.id] || 0,
                itineraries_count: itinByUser[u.id] || 0,
                setup_complete: !!p.setup_complete,
            };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ tourists });
});

router.get('/:user_id', adminRequired, async (req, res) => {
    const sb = admin();
    const uid = req.params.user_id;
    const [{ data: profile }, { data: saves }, { data: itineraries }, { data: authUser }] = await Promise.all([
        sb.from('tourist_profiles').select('*').eq('user_id', uid).maybeSingle(),
        sb.from('tourist_saves').select('*').eq('user_id', uid).order('saved_at', { ascending: false }),
        sb.from('tourist_itineraries').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
        sb.auth.admin.getUserById(uid).then(r => ({ data: r.data?.user })).catch(() => ({ data: null })),
    ]);
    if (!authUser && !profile) return res.status(404).json({ error: 'Tourist not found' });
    res.json({
        user: authUser ? {
            id: authUser.id, email: authUser.email,
            email_confirmed: !!authUser.email_confirmed_at,
            created_at: authUser.created_at, last_sign_in_at: authUser.last_sign_in_at,
        } : { id: uid },
        profile: profile || null,
        saves: saves || [],
        itineraries: itineraries || [],
    });
});

router.delete('/:user_id/saves/:save_id', adminRequired, async (req, res) => {
    const { error } = await admin().from('tourist_saves')
        .delete().eq('id', req.params.save_id).eq('user_id', req.params.user_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/:user_id/itinerary/:itin_id', adminRequired, async (req, res) => {
    const { error } = await admin().from('tourist_itineraries')
        .delete().eq('id', req.params.itin_id).eq('user_id', req.params.user_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/:user_id', adminRequired, async (req, res) => {
    // Deleting the auth user cascades delete to tourist_* tables via FK
    const { error } = await admin().auth.admin.deleteUser(req.params.user_id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;

/**
 * Trip-swipe group planning endpoints.
 *   POST   /api/tourist/groups                  — create
 *   POST   /api/tourist/groups/join             { invite_code }
 *   GET    /api/tourist/groups                  — list groups I'm in
 *   GET    /api/tourist/groups/:slug            — group + members + overlaps + all saves
 *   POST   /api/tourist/groups/:slug/saves      — save a place to this group
 *   DELETE /api/tourist/groups/:slug/saves/:entity_slug
 *   POST   /api/tourist/groups/:slug/leave
 *
 * All routes use Supabase JWT from the trip-swipe frontend.
 */

const express = require('express');
const crypto = require('crypto');
const mainDb = require('../db');
const { touristAuth } = require('./tourist');

const router = express.Router();

function slugify(s) {
    return String(s || '').toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'trip';
}
function shortCode() {
    // 6-char readable invite code (no confusing chars)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
async function uniqueSlug(base) {
    const b = slugify(base);
    for (let i = 0; i < 5; i++) {
        const s = i === 0 ? b : `${b}-${Math.random().toString(36).slice(2, 6)}`;
        const { data } = await mainDb.from('tourist_groups').select('id').eq('slug', s).maybeSingle();
        if (!data) return s;
    }
    return `${b}-${Date.now().toString(36)}`;
}
async function uniqueInviteCode() {
    for (let i = 0; i < 10; i++) {
        const c = shortCode();
        const { data } = await mainDb.from('tourist_groups').select('id').eq('invite_code', c).maybeSingle();
        if (!data) return c;
    }
    return shortCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE a group
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', touristAuth, async (req, res) => {
    const { name, destination, arrival, departure } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });

    const slug = await uniqueSlug(name);
    const invite_code = await uniqueInviteCode();

    const { data: group, error } = await mainDb.from('tourist_groups').insert({
        slug, invite_code,
        name: name.trim(),
        destination: destination || null,
        arrival: arrival || null,
        departure: departure || null,
        owner_user_id: req.touristId,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Auto-add owner as member
    await mainDb.from('tourist_group_members').insert({
        group_id: group.id, user_id: req.touristId, display_name: (req.touristEmail || '').split('@')[0],
    });

    res.json({ group });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOIN a group via invite code
// ─────────────────────────────────────────────────────────────────────────────
router.post('/join', touristAuth, async (req, res) => {
    const code = String(req.body?.invite_code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ error: 'Invite code is required' });

    const { data: group } = await mainDb.from('tourist_groups').select('*').eq('invite_code', code).maybeSingle();
    if (!group) return res.status(404).json({ error: 'Group not found — check the code' });

    // Already a member?
    const { data: existing } = await mainDb.from('tourist_group_members')
        .select('id').eq('group_id', group.id).eq('user_id', req.touristId).maybeSingle();
    if (!existing) {
        const { error } = await mainDb.from('tourist_group_members').insert({
            group_id: group.id, user_id: req.touristId, display_name: (req.touristEmail || '').split('@')[0],
        });
        if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ group });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIST groups I'm a member of
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', touristAuth, async (req, res) => {
    const { data: memberships } = await mainDb.from('tourist_group_members')
        .select('group_id').eq('user_id', req.touristId);
    const ids = (memberships || []).map(m => m.group_id);
    if (!ids.length) return res.json({ groups: [] });

    const { data: groups } = await mainDb.from('tourist_groups')
        .select('*').in('id', ids).order('created_at', { ascending: false });
    res.json({ groups: groups || [] });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET one group (members + saves + overlap summary)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:slug', touristAuth, async (req, res) => {
    const { data: group } = await mainDb.from('tourist_groups').select('*').eq('slug', req.params.slug).maybeSingle();
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Must be a member
    const { data: mySelf } = await mainDb.from('tourist_group_members')
        .select('id').eq('group_id', group.id).eq('user_id', req.touristId).maybeSingle();
    if (!mySelf) return res.status(403).json({ error: 'Not a member of this group' });

    const [{ data: members }, { data: saves }] = await Promise.all([
        mainDb.from('tourist_group_members').select('*').eq('group_id', group.id),
        mainDb.from('tourist_saves').select('*').eq('group_id', group.id).order('saved_at', { ascending: false }),
    ]);

    // Member email lookup — include email for display
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: authList } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const emailById = {};
    (authList?.users || []).forEach(u => { emailById[u.id] = u.email; });
    const membersOut = (members || []).map(m => ({
        ...m,
        email: emailById[m.user_id] || null,
        display_name: m.display_name || (emailById[m.user_id] || '').split('@')[0] || 'member',
    }));

    // Overlap: group saves by entity_slug, count unique users
    const bySlug = {};
    (saves || []).forEach(s => {
        const key = s.entity_slug;
        if (!bySlug[key]) bySlug[key] = {
            entity_slug: key, business_name: s.business_name, hero_image_url: s.hero_image_url,
            subtitle: s.subtitle, category: s.category, rating: s.rating, price_range: s.price_range,
            savers: [], count: 0,
        };
        const displayName = membersOut.find(m => m.user_id === s.user_id)?.display_name || 'someone';
        if (!bySlug[key].savers.find(x => x.user_id === s.user_id)) {
            bySlug[key].savers.push({ user_id: s.user_id, display_name: displayName });
            bySlug[key].count++;
        }
    });
    const overlaps = Object.values(bySlug).sort((a, b) => b.count - a.count);

    res.json({
        group,
        members: membersOut,
        saves: saves || [],
        overlaps,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SAVE a place to the group
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:slug/saves', touristAuth, async (req, res) => {
    const { data: group } = await mainDb.from('tourist_groups').select('id').eq('slug', req.params.slug).maybeSingle();
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { data: mySelf } = await mainDb.from('tourist_group_members')
        .select('id').eq('group_id', group.id).eq('user_id', req.touristId).maybeSingle();
    if (!mySelf) return res.status(403).json({ error: 'Not a member' });

    const b = req.body || {};
    if (!b.entity_slug) return res.status(400).json({ error: 'entity_slug required' });

    const row = {
        user_id: req.touristId,
        group_id: group.id,
        entity_slug: b.entity_slug,
        entity_id: b.entity_id && /^[0-9a-f-]{36}$/i.test(String(b.entity_id)) ? b.entity_id : null,
        business_name: b.business_name || null,
        hero_image_url: b.hero_image_url || null,
        subtitle: b.subtitle || null,
        category: b.category || null,
        rating: b.rating ?? null,
        price_range: b.price_range || null,
    };
    const { data, error } = await mainDb.from('tourist_saves')
        .upsert(row, { onConflict: 'user_id,entity_slug' })
        .select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ save: data });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:slug/leave', touristAuth, async (req, res) => {
    const { data: group } = await mainDb.from('tourist_groups').select('id,owner_user_id').eq('slug', req.params.slug).maybeSingle();
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.owner_user_id === req.touristId) return res.status(400).json({ error: 'Owner cannot leave — delete the group instead' });

    const { error } = await mainDb.from('tourist_group_members')
        .delete().eq('group_id', group.id).eq('user_id', req.touristId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;

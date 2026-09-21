// ============================================================
// Module / App Store API
// Manages which apps a business has installed from the marketplace
//
// Schema: ./migrations.sql
// ============================================================

const express    = require('express');
const { authRequired } = require('../../core/auth');
const supabase   = require('../../core/db');
const router     = express.Router();

// ── Public: list all available modules ───────────────────────
router.get('/available', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('module_manifest')
      .select('*')
      .eq('active', true)
      .order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Auth: get installed modules for a site ────────────────────
router.get('/installed', authRequired, async (req, res) => {
  try {
    const { site_id } = req.query;
    const { data, error } = await supabase
      .from('user_modules')
      .select('*, module_manifest(*)')
      .eq('site_id', site_id)
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    res.json(data || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Auth: install a module ────────────────────────────────────
router.post('/install', authRequired, async (req, res) => {
  try {
    const { site_id, module_id, config, show_on_public } = req.body;
    if (!site_id || !module_id) return res.status(400).json({ error: 'site_id and module_id required' });

    // Get current max sort_order for this site
    const { data: existing } = await supabase
      .from('user_modules')
      .select('sort_order')
      .eq('site_id', site_id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;

    const { data, error } = await supabase
      .from('user_modules')
      .upsert({
        site_id,
        module_id,
        config: config || {},
        show_on_public: show_on_public !== false,
        is_active: true,
        sort_order: nextOrder,
      }, { onConflict: 'site_id,module_id' })
      .select('*, module_manifest(*)')
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Auth: uninstall a module ──────────────────────────────────
router.delete('/uninstall/:module_id', authRequired, async (req, res) => {
  try {
    const { site_id } = req.query;
    const { module_id } = req.params;

    // Prevent uninstalling core modules
    const { data: manifest } = await supabase
      .from('module_manifest')
      .select('is_core')
      .eq('id', module_id)
      .single();

    if (manifest?.is_core) return res.status(400).json({ error: 'Core modules cannot be uninstalled' });

    const { error } = await supabase
      .from('user_modules')
      .update({ is_active: false })
      .eq('site_id', site_id)
      .eq('module_id', module_id);

    if (error) throw error;
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Auth: update module config ────────────────────────────────
router.patch('/config/:module_id', authRequired, async (req, res) => {
  try {
    const { site_id, config, show_on_public, sort_order } = req.body;
    const updates = {};
    if (config !== undefined) updates.config = config;
    if (show_on_public !== undefined) updates.show_on_public = show_on_public;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { data, error } = await supabase
      .from('user_modules')
      .update(updates)
      .eq('site_id', site_id)
      .eq('module_id', req.params.module_id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Auth: reorder installed modules ──────────────────────────
router.post('/reorder', authRequired, async (req, res) => {
  try {
    const { site_id, order } = req.body; // order = [{module_id, sort_order}]
    const updates = order.map(({ module_id, sort_order }) =>
      supabase.from('user_modules').update({ sort_order }).eq('site_id', site_id).eq('module_id', module_id)
    );
    await Promise.all(updates);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Auth: get what modules should show for this site ──────────
// Used by module-loader.js as a drop-in replacement
router.get('/active-ids', authRequired, async (req, res) => {
  try {
    const { site_id } = req.query;

    // Get installed modules
    const { data: installed } = await supabase
      .from('user_modules')
      .select('module_id, sort_order')
      .eq('site_id', site_id)
      .eq('is_active', true)
      .order('sort_order');

    // Always include core modules
    const { data: core } = await supabase
      .from('module_manifest')
      .select('id')
      .eq('is_core', true);

    const coreIds = (core || []).map(m => m.id);
    const installedIds = (installed || []).map(m => m.module_id);

    // Merge: core first, then installed (deduped)
    const all = [...new Set([...coreIds, ...installedIds])];
    res.json({ modules: all });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

// Simple passcode validation
const PASSCODE = '1234'; // TODO: make this configurable per entity

function validatePasscode(req, res, next) {
  const passcode = req.headers['x-link-passcode'];
  if (passcode !== PASSCODE) {
    return res.status(401).json({ error: 'Invalid passcode' });
  }
  next();
}

// GET /update/:id/data - Load menu data for entity
router.get('/:id/data', validatePasscode, async (req, res) => {
  try {
    const { id } = req.params;

    // Get entity
    const { data: entity, error: entErr } = await db
      .from('entity')
      .select('*')
      .eq('id', id)
      .single();

    if (entErr || !entity) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Get sections
    const { data: sections, error: secErr } = await db
      .from('entity_sections')
      .select('*')
      .eq('entity_id', id);

    res.json({ entity, sections: sections || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /update/:id/menu-items - Add menu item
router.post('/:id/menu-items', validatePasscode, async (req, res) => {
  try {
    const { id } = req.params;
    const { section_id, name, description, price } = req.body;

    const { data, error } = await db
      .from('section_items')
      .insert({
        section_id,
        item_name: name,
        item_description: description,
        item_price: price,
      })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /update/:id/menu-items/:itemId - Update menu item
router.put('/:id/menu-items/:itemId', validatePasscode, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, description, price } = req.body;

    const { data, error } = await db
      .from('section_items')
      .update({
        item_name: name,
        item_description: description,
        item_price: price,
      })
      .eq('id', itemId)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, item: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /update/:id/menu-items/:itemId - Delete menu item
router.delete('/:id/menu-items/:itemId', validatePasscode, async (req, res) => {
  try {
    const { itemId } = req.params;

    const { error } = await db
      .from('section_items')
      .delete()
      .eq('id', itemId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /update/:id/menu-sections - Add section
router.post('/:id/menu-sections', validatePasscode, async (req, res) => {
  try {
    const { id } = req.params;
    const { section_label, section_type } = req.body;

    const { data, error } = await db
      .from('entity_sections')
      .insert({
        entity_id: id,
        section_label,
        section_type: section_type || 'items',
      })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, section: data[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /update/:id/menu-sections/:sectionId - Delete section
router.delete('/:id/menu-sections/:sectionId', validatePasscode, async (req, res) => {
  try {
    const { sectionId } = req.params;

    // Delete items first
    await db.from('section_items').delete().eq('section_id', sectionId);

    // Delete section
    const { error } = await db
      .from('entity_sections')
      .delete()
      .eq('id', sectionId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

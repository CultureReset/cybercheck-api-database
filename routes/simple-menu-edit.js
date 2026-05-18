const express = require('express');
const router = express.Router();
const multer = require('multer');
const getGcrDb = require('../gcr-db');

const db = () => getGcrDb();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /simple/:slug/data - Load menu by business slug
router.get('/:slug/data', async (req, res) => {
  try {
    const { slug } = req.params;

    // Find entity by slug
    const { data: entity, error: entErr } = await db()
      .from('entity')
      .select('id, name, slug, description, hero_image_url')
      .eq('slug', slug)
      .single();

    if (entErr || !entity) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const eid = entity.id;

    // Get all menu data in parallel
    const [sections, items, specials, events, photos] = await Promise.all([
      db().from('entity_sections').select('*').eq('entity_id', eid),
      db().from('section_items').select('*').eq('entity_id', eid),
      db().from('entity_specials').select('*').eq('entity_id', eid),
      db().from('entity_events').select('*').eq('entity_id', eid).eq('is_active', true),
      db().from('entity_photos').select('*').eq('entity_id', eid),
    ]);

    res.json({
      entity,
      sections: sections.data || [],
      items: items.data || [],
      specials: specials.data || [],
      events: events.data || [],
      photos: photos.data || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /simple/:slug/items - Add/update menu item
router.post('/:slug/items', async (req, res) => {
  try {
    const { slug } = req.params;
    const { id, section_id, item_name, item_description, item_price } = req.body;

    const { data: entity } = await db()
      .from('entity')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!entity) return res.status(404).json({ error: 'Business not found' });

    let result;
    if (id) {
      // Update
      const { data, error } = await db()
        .from('section_items')
        .update({ item_name, item_description, item_price })
        .eq('id', id)
        .eq('entity_id', entity.id)
        .select();
      if (error) return res.status(500).json({ error: error.message });
      result = data[0];
    } else {
      // Create
      const { data, error } = await db()
        .from('section_items')
        .insert({ entity_id: entity.id, section_id, item_name, item_description, item_price })
        .select();
      if (error) return res.status(500).json({ error: error.message });
      result = data[0];
    }

    res.json({ success: true, item: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /simple/:slug/items/:id
router.delete('/:slug/items/:id', async (req, res) => {
  try {
    const { slug, id } = req.params;

    const { data: entity } = await db()
      .from('entity')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!entity) return res.status(404).json({ error: 'Business not found' });

    const { error } = await db()
      .from('section_items')
      .delete()
      .eq('id', id)
      .eq('entity_id', entity.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /simple/:slug/specials - Add/update special
router.post('/:slug/specials', async (req, res) => {
  try {
    const { slug } = req.params;
    const { id, special_name, description, days, start_time, end_time } = req.body;

    const { data: entity } = await db()
      .from('entity')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!entity) return res.status(404).json({ error: 'Business not found' });

    let result;
    if (id) {
      const { data, error } = await db()
        .from('entity_specials')
        .update({ special_name, description, days, start_time, end_time })
        .eq('id', id)
        .eq('entity_id', entity.id)
        .select();
      if (error) return res.status(500).json({ error: error.message });
      result = data[0];
    } else {
      const { data, error } = await db()
        .from('entity_specials')
        .insert({ entity_id: entity.id, special_name, description, days, start_time, end_time, is_active: true })
        .select();
      if (error) return res.status(500).json({ error: error.message });
      result = data[0];
    }

    res.json({ success: true, item: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /simple/:slug/specials/:id
router.delete('/:slug/specials/:id', async (req, res) => {
  try {
    const { slug, id } = req.params;

    const { data: entity } = await db()
      .from('entity')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!entity) return res.status(404).json({ error: 'Business not found' });

    const { error } = await db()
      .from('entity_specials')
      .delete()
      .eq('id', id)
      .eq('entity_id', entity.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /simple/:slug/upload - Upload photo
router.post('/:slug/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file' });

    const { slug } = req.params;
    const { data: entity } = await db()
      .from('entity')
      .select('id')
      .eq('slug', slug)
      .single();

    if (!entity) return res.status(404).json({ error: 'Business not found' });

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const name = `simple-edit/${entity.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await db().storage
      .from('entity-media')
      .upload(name, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (upErr) return res.status(500).json({ error: upErr.message });

    const { data: { publicUrl } } = db().storage.from('entity-media').getPublicUrl(name);

    // Save to entity_photos
    const { data: photo } = await db()
      .from('entity_photos')
      .insert({ entity_id: entity.id, image_url: publicUrl })
      .select()
      .single();

    res.json({ success: true, url: publicUrl, photo });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

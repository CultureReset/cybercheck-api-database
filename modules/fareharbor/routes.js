// ============================================================
// FareHarbor Integration
// Connect via API keys → pull items + availability → webhook sync
//
// Schema: ./migrations.sql
// ============================================================

const express = require('express');
const { authRequired } = require('../../core/auth');
const supabase = require('../../core/db');
const router   = express.Router();

const FH_BASE = 'https://fareharbor.com/api/external/v1';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// Credential encryption lives in core/crypto. passthrough:true preserves this
// module's original behaviour of storing/returning plaintext when no key is set.
// (The previous local decrypt() passed the IV as the key, so it threw on every
// call and silently returned ciphertext — fixed by using the shared helper.)
const _crypto = require('../../core/crypto');
const encrypt = (text)   => _crypto.encrypt(text,   { passthrough: true });
const decrypt = (stored) => _crypto.decrypt(stored, { passthrough: true });

async function fhGet(shortname, appKey, userKey, path) {
  const r = await fetch(`${FH_BASE}/companies/${shortname}${path}`, {
    headers: {
      'X-FareHarbor-API-App':  appKey,
      'X-FareHarbor-API-User': userKey,
    }
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`FareHarbor ${r.status}: ${t.slice(0, 200)}`);
  }
  return r.json();
}

// Pull items + 90-day availability for a connected integration
async function syncFareHarbor(integration) {
  const shortname = integration.fh_shortname;
  const appKey    = decrypt(integration.fh_api_app_key);
  const userKey   = decrypt(integration.fh_api_user_key);
  const siteId    = integration.site_id;
  const intId     = integration.id;

  // ── 1. Pull items ──
  const itemsRes = await fhGet(shortname, appKey, userKey, '/items/');
  const items    = itemsRes.items || [];

  for (const item of items) {
    const category = inferCategory(item.name + ' ' + (item.description || ''));
    await supabase.from('integration_items').upsert({
      site_id:          siteId,
      integration_id:   intId,
      provider:         'fareharbor',
      external_id:      String(item.pk),
      name:             item.name,
      description:      item.description || null,
      category,
      min_capacity:     item.customer_type_rates?.[0]?.minimum_party_size || 1,
      max_capacity:     item.total_capacity || null,
      duration_minutes: item.duration || null,
      image_url:        item.image_cdn_url || item.thumbnail_image_cdn_url || null,
      booking_url:      `https://fareharbor.com/embeds/book/${shortname}/items/${item.pk}/`,
      active:           !item.is_pickup_only,
      raw_data:         item,
    }, { onConflict: 'site_id,provider,external_id' });
  }

  // ── 2. Pull availability for next 90 days ──
  const today    = new Date();
  const end      = new Date(today);
  end.setDate(end.getDate() + 90);
  const startStr = today.toISOString().slice(0, 10);
  const endStr   = end.toISOString().slice(0, 10);

  for (const item of items) {
    try {
      const avRes = await fhGet(
        shortname, appKey, userKey,
        `/availabilities/item/${item.pk}/date-range/${startStr}/${endStr}/`
      );
      const slots = avRes.availabilities || [];

      for (const slot of slots) {
        const startDt = new Date(slot.start_at);
        const endDt   = new Date(slot.finish_at);
        const minPrice = slot.customer_type_rates?.[0]?.total_including_tax || null;
        const maxPrice = slot.customer_type_rates?.[slot.customer_type_rates.length - 1]?.total_including_tax || minPrice;

        await supabase.from('availability_slots').upsert({
          site_id:            siteId,
          integration_id:     intId,
          provider:           'fareharbor',
          external_id:        String(slot.pk),
          item_id:            String(item.pk),
          item_name:          item.name,
          slot_date:          startDt.toISOString().slice(0, 10),
          start_time:         startDt.toTimeString().slice(0, 5),
          end_time:           endDt.toTimeString().slice(0, 5),
          capacity:           slot.capacity,
          available_capacity: slot.customer_count < slot.capacity ? slot.capacity - slot.customer_count : 0,
          price_min:          minPrice ? minPrice / 100 : null,
          price_max:          maxPrice ? maxPrice / 100 : null,
          status:             slot.is_available ? 'available' : 'full',
          booking_url:        `https://fareharbor.com/embeds/book/${shortname}/items/${item.pk}/availability/${slot.pk}/`,
          raw_data:           slot,
          synced_at:          new Date().toISOString(),
        }, { onConflict: 'site_id,provider,external_id' });
      }
    } catch (e) {
      console.warn(`FH availability sync failed for item ${item.pk}:`, e.message);
    }
  }

  // Update last_sync_at
  await supabase.from('integrations')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', intId);

  return { items: items.length };
}

function inferCategory(text) {
  const t = text.toLowerCase();
  if (t.includes('fish') || t.includes('angl'))   return 'fishing';
  if (t.includes('charter') || t.includes('boat')) return 'charter';
  if (t.includes('kayak'))                         return 'kayak';
  if (t.includes('snorkel') || t.includes('dive')) return 'snorkel';
  if (t.includes('jet ski') || t.includes('waverunner')) return 'jetski';
  if (t.includes('pontoon'))                       return 'pontoon';
  if (t.includes('dolphin') || t.includes('cruise')) return 'cruise';
  if (t.includes('surf') || t.includes('paddleboard')) return 'surf';
  if (t.includes('parasail'))                      return 'parasail';
  if (t.includes('tour'))                          return 'tour';
  return 'activity';
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/fareharbor/connect
// Business enters shortname + API keys → validate + initial sync
// ─────────────────────────────────────────────────────────────
router.post('/connect', authRequired, async (req, res) => {
  const siteId  = req.body.site_id || req.siteId;
  const { shortname, api_app_key, api_user_key } = req.body;

  if (!shortname || !api_app_key || !api_user_key) {
    return res.status(400).json({ error: 'shortname, api_app_key, api_user_key required' });
  }

  // Validate credentials by hitting FareHarbor
  try {
    await fhGet(shortname, api_app_key, api_user_key, '/items/');
  } catch (e) {
    return res.status(400).json({ error: 'FareHarbor credentials invalid: ' + e.message });
  }

  // Store integration
  const { data: integration, error } = await supabase
    .from('integrations')
    .upsert({
      site_id:          siteId,
      provider:         'fareharbor',
      status:           'connected',
      fh_shortname:     shortname.toLowerCase().trim(),
      fh_api_app_key:   encrypt(api_app_key),
      fh_api_user_key:  encrypt(api_user_key),
    }, { onConflict: 'site_id,provider' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Initial sync async — don't block response
  syncFareHarbor({ ...integration, fh_api_app_key: api_app_key, fh_api_user_key: api_user_key })
    .catch(e => console.error('FH initial sync error:', e.message));

  res.json({ ok: true, integration_id: integration.id, message: 'Connected. Syncing availability in the background.' });
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/fareharbor/status
// ─────────────────────────────────────────────────────────────
router.get('/status', authRequired, async (req, res) => {
  const siteId = req.query.site_id || req.siteId;
  const { data } = await supabase
    .from('integrations')
    .select('id, status, fh_shortname, last_sync_at, metadata')
    .eq('site_id', siteId)
    .eq('provider', 'fareharbor')
    .maybeSingle();

  if (!data) return res.json({ connected: false });

  const { count } = await supabase
    .from('integration_items')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('provider', 'fareharbor');

  res.json({ connected: true, shortname: data.fh_shortname, last_sync_at: data.last_sync_at, item_count: count || 0 });
});

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/fareharbor/sync
// Manual or cron-triggered re-sync
// ─────────────────────────────────────────────────────────────
router.post('/sync', authRequired, async (req, res) => {
  const siteId = req.body.site_id || req.siteId;

  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('site_id', siteId)
    .eq('provider', 'fareharbor')
    .eq('status', 'connected')
    .single();

  if (!integration) return res.status(404).json({ error: 'FareHarbor not connected' });

  const appKey  = decrypt(integration.fh_api_app_key);
  const userKey = decrypt(integration.fh_api_user_key);

  try {
    const result = await syncFareHarbor({ ...integration, fh_api_app_key: appKey, fh_api_user_key: userKey });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/fareharbor/sync-all (cron — daily 3am)
// Sync every connected FareHarbor account
// ─────────────────────────────────────────────────────────────
router.get('/sync-all', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', 'fareharbor')
    .eq('status', 'connected');

  if (!integrations?.length) return res.json({ synced: 0 });

  let synced = 0, failed = 0;
  for (const integration of integrations) {
    try {
      const appKey  = decrypt(integration.fh_api_app_key);
      const userKey = decrypt(integration.fh_api_user_key);
      await syncFareHarbor({ ...integration, fh_api_app_key: appKey, fh_api_user_key: userKey });
      synced++;
    } catch (e) {
      console.error(`FH sync failed for ${integration.site_id}:`, e.message);
      failed++;
    }
  }

  res.json({ synced, failed });
});

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/fareharbor/webhook
// FareHarbor fires this on booking.created / booking.cancelled
// Set webhook URL in FareHarbor dashboard → your API URL
// ─────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // ack immediately

  const event   = req.body;
  const type    = event.type || event.event || '';
  const booking = event.booking || event.data?.booking;

  if (!booking) return;

  const shortname = event.company?.shortname || booking.company?.shortname;
  if (!shortname) return;

  // Find the integration by shortname
  const { data: integration } = await supabase
    .from('integrations')
    .select('site_id, id')
    .eq('provider', 'fareharbor')
    .eq('fh_shortname', shortname)
    .eq('status', 'connected')
    .maybeSingle();

  if (!integration) return;

  const availPk = booking.availability?.pk;
  if (!availPk) return;

  if (type.includes('cancelled') || type.includes('cancel')) {
    // Restore capacity — mark slot as available
    await supabase
      .from('availability_slots')
      .update({ status: 'available', synced_at: new Date().toISOString() })
      .eq('site_id', integration.site_id)
      .eq('provider', 'fareharbor')
      .eq('external_id', String(availPk));
  } else {
    // Booking created — decrement available capacity or mark full
    const { data: slot } = await supabase
      .from('availability_slots')
      .select('available_capacity, capacity')
      .eq('site_id', integration.site_id)
      .eq('provider', 'fareharbor')
      .eq('external_id', String(availPk))
      .maybeSingle();

    if (slot) {
      const booked    = booking.customers?.length || booking.customer_count || 1;
      const remaining = Math.max(0, (slot.available_capacity || 0) - booked);
      await supabase
        .from('availability_slots')
        .update({
          available_capacity: remaining,
          status:             remaining === 0 ? 'full' : 'available',
          synced_at:          new Date().toISOString(),
        })
        .eq('site_id', integration.site_id)
        .eq('provider', 'fareharbor')
        .eq('external_id', String(availPk));
    }
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/fareharbor/disconnect
// ─────────────────────────────────────────────────────────────
router.delete('/disconnect', authRequired, async (req, res) => {
  const siteId = req.body.site_id || req.siteId;
  await supabase.from('integrations').update({ status: 'disconnected' }).eq('site_id', siteId).eq('provider', 'fareharbor');
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/fareharbor/items
// List synced items for a business
// ─────────────────────────────────────────────────────────────
router.get('/items', authRequired, async (req, res) => {
  const siteId = req.query.site_id || req.siteId;
  const { data, error } = await supabase
    .from('integration_items')
    .select('*')
    .eq('site_id', siteId)
    .eq('provider', 'fareharbor')
    .eq('active', true)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;

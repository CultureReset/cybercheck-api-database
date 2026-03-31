#!/usr/bin/env node
/**
 * migrate-businesses-to-entities.js
 *
 * One-time migration: copies all gcr_listed businesses from the old CyberCheck DB
 * into the new GCR entity DB. Skips any that already exist by slug.
 * Also creates entity_tags, hours section, and about section for each.
 *
 * Usage: node scripts/migrate-businesses-to-entities.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Old DB (businesses)
const oldDb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// New GCR DB (entities)
const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

// Map old business type → entity_subtype
const TYPE_MAP = {
  'restaurant':    'restaurant',
  'restaurants':   'restaurant',
  'bar':           'bar',
  'bar_grill':     'bar_grill',
  'coffee-sweets': 'coffee_shop',
  'things-to-do':  'attraction',
  'nightlife':     'bar',
  'shopping':      'boutique',
  'services':      'services',
  'other':         'other',
  'rental':        'boat_rental',
};

async function main() {
  console.log('=== Migrating businesses → entities ===\n');

  // 1. Fetch all gcr_listed businesses from old DB
  const { data: businesses, error: bizErr } = await oldDb
    .from('businesses')
    .select(`site_id, name, type, subdomain, domain, emoji, tagline, tags,
      rating, review_count, featured, happy_hour, kids_friendly, pet_friendly,
      live_music, waterfront, subcategory, price_range,
      site_content(address, city, state, zip, lat, lng, hours, contact_phone,
        website_url, google_maps, about_text, seo_description, happy_hour, social_links),
      business_media(url, section, sort_order)`)
    .eq('status', 'active')
    .eq('gcr_listed', true);

  if (bizErr) { console.error('Failed to fetch businesses:', bizErr.message); process.exit(1); }
  console.log(`Found ${businesses.length} businesses in old DB\n`);

  // 2. Fetch existing entity slugs from GCR DB
  const { data: existing } = await gcrDb.from('entity').select('slug');
  const existingSlugs = new Set((existing || []).map(e => e.slug));
  console.log(`${existingSlugs.size} entities already in GCR DB\n`);

  let created = 0, skipped = 0, errors = 0;

  for (const biz of businesses) {
    const slug = biz.subdomain || biz.site_id;
    if (!slug) { skipped++; continue; }

    // Skip if already exists
    if (existingSlugs.has(slug)) {
      console.log(`  SKIP (exists): ${slug}`);
      skipped++;
      continue;
    }

    const content = biz.site_content || {};
    const media = (biz.business_media || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const coverImg = media.find(m => m.section === 'cover')?.url || media[0]?.url || null;

    // Determine entity_subtype
    const rawType = (biz.type || 'other').toLowerCase().replace(/\s+/g, '_');
    const entitySubtype = TYPE_MAP[rawType] || rawType;

    // Build entity record
    const entity = {
      slug,
      name: biz.name || slug,
      subtitle: biz.tagline || '',
      entity_type: 'business',
      entity_subtype: entitySubtype,
      icon: biz.emoji || '📍',
      phone: content.contact_phone || '',
      rating: biz.rating || null,
      review_count: biz.review_count || 0,
      address_line_1: content.address || '',
      city: content.city || '',
      state: content.state || '',
      zip: content.zip || '',
      latitude: content.lat || null,
      longitude: content.lng || null,
      hero_image_url: coverImg,
      website_url: content.website_url || '',
      directions_url: content.google_maps || '',
      call_url: content.contact_phone ? `tel:${content.contact_phone.replace(/\D/g, '')}` : '',
      is_active: true,
    };

    // Insert entity
    const { data: inserted, error: insertErr } = await gcrDb
      .from('entity')
      .insert(entity)
      .select('id')
      .single();

    if (insertErr) {
      console.error(`  ERROR inserting ${slug}:`, insertErr.message);
      errors++;
      continue;
    }

    const entityId = inserted.id;
    console.log(`  CREATED: ${slug} (${entityId})`);
    existingSlugs.add(slug);

    // --- Create entity_tags from old tags array ---
    const oldTags = biz.tags || [];
    if (oldTags.length) {
      const tagRows = oldTags.map((tag, i) => ({
        entity_id: entityId,
        tag: typeof tag === 'string' ? tag : tag.tag || String(tag),
        tag_category: 'search',
        sort_order: i,
      }));
      // Add feature-based tags
      if (biz.happy_hour) tagRows.push({ entity_id: entityId, tag: 'happy_hour', tag_category: 'amenity', sort_order: tagRows.length });
      if (biz.live_music) tagRows.push({ entity_id: entityId, tag: 'live_music', tag_category: 'amenity', sort_order: tagRows.length });
      if (biz.waterfront) tagRows.push({ entity_id: entityId, tag: 'waterfront', tag_category: 'vibe', sort_order: tagRows.length });
      if (biz.pet_friendly) tagRows.push({ entity_id: entityId, tag: 'pet_friendly', tag_category: 'amenity', sort_order: tagRows.length });
      if (biz.kids_friendly) tagRows.push({ entity_id: entityId, tag: 'kids_friendly', tag_category: 'amenity', sort_order: tagRows.length });

      const { error: tagErr } = await gcrDb.from('entity_tags').insert(tagRows);
      if (tagErr) console.warn(`    Tags error for ${slug}:`, tagErr.message);
    }

    // --- Create entity_features from boolean flags ---
    const features = [];
    if (biz.happy_hour) features.push({ entity_id: entityId, label: 'Happy Hour', sort_order: 0 });
    if (biz.live_music) features.push({ entity_id: entityId, label: 'Live Music', sort_order: 1 });
    if (biz.waterfront) features.push({ entity_id: entityId, label: 'Waterfront', sort_order: 2 });
    if (biz.pet_friendly) features.push({ entity_id: entityId, label: 'Pet Friendly', sort_order: 3 });
    if (biz.kids_friendly) features.push({ entity_id: entityId, label: 'Kids Friendly', sort_order: 4 });
    if (features.length) {
      const { error: featErr } = await gcrDb.from('entity_features').insert(features);
      if (featErr) console.warn(`    Features error for ${slug}:`, featErr.message);
    }

    // --- Create hours section from old hours object ---
    const oldHours = content.hours;
    if (oldHours && typeof oldHours === 'object' && Object.keys(oldHours).length > 0) {
      const { data: section, error: secErr } = await gcrDb
        .from('entity_sections')
        .insert({ entity_id: entityId, section_key: 'hours', section_label: 'Hours', section_type: 'hours', sort_order: 90 })
        .select('id')
        .single();

      if (!secErr && section) {
        const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const hoursRows = DAYS.map((day, i) => {
          const val = oldHours[day] || oldHours[day.charAt(0).toUpperCase() + day.slice(1)] || null;
          if (!val) return { section_id: section.id, day_of_week: day, is_closed: true, sort_order: i };
          if (typeof val === 'string') {
            // Parse "11:00 AM - 9:00 PM" format
            const parts = val.split(/\s*[-–]\s*/);
            return {
              section_id: section.id,
              day_of_week: day,
              open_time: convertTo24h(parts[0]) || null,
              close_time: convertTo24h(parts[1]) || null,
              is_closed: val.toLowerCase().includes('closed'),
              note_text: val,
              sort_order: i,
            };
          }
          if (typeof val === 'object') {
            return {
              section_id: section.id,
              day_of_week: day,
              open_time: val.open || val.open_time || null,
              close_time: val.close || val.close_time || null,
              is_closed: val.closed === true || val.is_closed === true,
              sort_order: i,
            };
          }
          return { section_id: section.id, day_of_week: day, is_closed: false, sort_order: i };
        });
        const { error: hErr } = await gcrDb.from('section_hours').insert(hoursRows);
        if (hErr) console.warn(`    Hours error for ${slug}:`, hErr.message);
      }
    }

    // --- Create about section from description ---
    const aboutText = content.about_text || content.seo_description || '';
    if (aboutText.trim()) {
      const { data: aboutSec, error: aboutSecErr } = await gcrDb
        .from('entity_sections')
        .insert({ entity_id: entityId, section_key: 'about', section_label: 'About', section_type: 'rich_text', sort_order: 0 })
        .select('id')
        .single();

      if (!aboutSecErr && aboutSec) {
        const { error: rtErr } = await gcrDb
          .from('section_rich_text')
          .insert({ section_id: aboutSec.id, body_text: aboutText });
        if (rtErr) console.warn(`    About error for ${slug}:`, rtErr.message);
      }
    }

    // --- Create happy hour section if HH data exists ---
    const hhData = content.happy_hour;
    if (hhData && typeof hhData === 'object') {
      const { data: hhSec, error: hhSecErr } = await gcrDb
        .from('entity_sections')
        .insert({ entity_id: entityId, section_key: 'happy_hour', section_label: 'Happy Hour', section_type: 'grouped_items', sort_order: 30 })
        .select('id')
        .single();

      if (!hhSecErr && hhSec) {
        // Create a group for the HH deals
        const { data: hhGroup, error: grpErr } = await gcrDb
          .from('section_groups')
          .insert({
            section_id: hhSec.id,
            title: hhData.schedule || hhData.time || 'Happy Hour',
            subtitle: hhData.description || '',
            sort_order: 0,
          })
          .select('id')
          .single();

        if (!grpErr && hhGroup && Array.isArray(hhData.deals)) {
          const items = hhData.deals.map((d, i) => ({
            section_id: hhSec.id,
            group_id: hhGroup.id,
            item_name: d.name || d.item || 'Special',
            price_text: d.price || d.deal || '',
            item_type: 'hh_item',
            sort_order: i,
          }));
          if (items.length) {
            const { error: itmErr } = await gcrDb.from('section_items').insert(items);
            if (itmErr) console.warn(`    HH items error for ${slug}:`, itmErr.message);
          }
        }
      }
    }

    created++;
  }

  console.log(`\n=== Migration complete ===`);
  console.log(`Created: ${created} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`Total entities now: ${existingSlugs.size}`);

  // --- Deduplicate -1 suffix entities ---
  console.log('\n=== Deduplicating -1 suffix entities ===');
  const { data: allEntities } = await gcrDb.from('entity').select('id, slug');
  const slugMap = {};
  (allEntities || []).forEach(e => {
    if (!slugMap[e.slug]) slugMap[e.slug] = [];
    slugMap[e.slug].push(e.id);
  });

  let deduped = 0;
  for (const [slug, ids] of Object.entries(slugMap)) {
    if (!slug.match(/-1$/)) continue;
    const baseSlug = slug.replace(/-1$/, '');
    if (slugMap[baseSlug]) {
      // Both exist — delete the -1 version
      for (const id of ids) {
        // Delete dependent rows first
        await gcrDb.from('entity_tags').delete().eq('entity_id', id);
        await gcrDb.from('entity_features').delete().eq('entity_id', id);
        await gcrDb.from('entity_perfect_for').delete().eq('entity_id', id);
        // Delete sections and their content
        const { data: sections } = await gcrDb.from('entity_sections').select('id').eq('entity_id', id);
        for (const sec of (sections || [])) {
          await gcrDb.from('section_rich_text').delete().eq('section_id', sec.id);
          await gcrDb.from('section_bullets').delete().eq('section_id', sec.id);
          await gcrDb.from('section_groups').delete().eq('section_id', sec.id);
          await gcrDb.from('section_items').delete().eq('section_id', sec.id);
          await gcrDb.from('section_cards').delete().eq('section_id', sec.id);
          await gcrDb.from('section_photos').delete().eq('section_id', sec.id);
          await gcrDb.from('section_reviews').delete().eq('section_id', sec.id);
          await gcrDb.from('section_hours').delete().eq('section_id', sec.id);
          await gcrDb.from('section_location').delete().eq('section_id', sec.id);
        }
        await gcrDb.from('entity_sections').delete().eq('entity_id', id);
        await gcrDb.from('entity').delete().eq('id', id);
        console.log(`  DEDUPED: removed ${slug} (kept ${baseSlug})`);
        deduped++;
      }
    }
  }
  console.log(`Removed ${deduped} duplicate entities`);
}

// Helper: convert "11:00 AM" → "11:00"
function convertTo24h(str) {
  if (!str) return null;
  str = str.trim();
  const match = str.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

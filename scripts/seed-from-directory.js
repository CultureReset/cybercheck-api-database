#!/usr/bin/env node
/**
 * seed-from-directory.js
 *
 * Reads data.json files from gcr-directory-v2 folders and inserts
 * new entities into the GCR entity DB. Skips duplicates by slug.
 *
 * Usage: node scripts/seed-from-directory.js <category-path>
 * Example: node scripts/seed-from-directory.js /Users/owner/build-main/gcr-directory-v2/shopping/shopping
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  const dir = process.argv[2];
  if (!dir) { console.error('Usage: node scripts/seed-from-directory.js <directory>'); process.exit(1); }

  // Find all data.json files
  const folders = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory());
  console.log(`Found ${folders.length} business folders in ${dir}\n`);

  // Get existing slugs
  const { data: existing } = await gcrDb.from('entity').select('slug');
  const existingSlugs = new Set((existing || []).map(e => e.slug));
  console.log(`${existingSlugs.size} entities already in DB\n`);

  let created = 0, skipped = 0, errors = 0;

  for (const folder of folders) {
    const jsonPath = path.join(dir, folder, 'data.json');
    if (!fs.existsSync(jsonPath)) continue;

    let d;
    try { d = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch { continue; }

    const slug = d.slug || folder;
    if (existingSlugs.has(slug)) { skipped++; continue; }

    // Parse address parts
    const rawAddr = typeof d.address === 'string' ? d.address : (d.address?.formatted || '');
    const addrParts = rawAddr.split(',').map(s => s.trim());
    const city = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : '';
    const stateZip = addrParts.length >= 1 ? addrParts[addrParts.length - 1] : '';
    const stateMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/);
    const state = stateMatch ? stateMatch[1] : '';
    const zip = stateMatch ? stateMatch[2] || '' : '';

    // Determine subtype
    const rawType = (d.type || d.category || 'shopping').toLowerCase();
    let subtype = 'shopping';
    if (rawType.includes('boutique')) subtype = 'boutique';
    else if (rawType.includes('souvenir')) subtype = 'souvenir';
    else if (rawType.includes('surf')) subtype = 'surf_shop';
    else if (rawType.includes('gift')) subtype = 'gift_shop';
    else if (rawType.includes('clothing')) subtype = 'clothing';
    else if (rawType.includes('gallery') || rawType.includes('art')) subtype = 'art_gallery';
    else if (rawType.includes('jewelry')) subtype = 'boutique';
    else if (rawType.includes('book')) subtype = 'boutique';

    const entity = {
      slug,
      name: d.name || folder,
      subtitle: d.tagline || '',
      entity_type: 'business',
      entity_subtype: subtype,
      icon: d.emoji || '🛍️',
      phone: d.phone || '',
      rating: d.rating || null,
      review_count: d.review_count || 0,
      address_line_1: rawAddr || '',
      city, state, zip,
      hero_image_url: (d.images && d.images[0]) || null,
      website_url: d.website || '',
      directions_url: '',
      call_url: d.phone ? `tel:${d.phone.replace(/\D/g, '')}` : '',
      is_active: true,
    };

    const { data: inserted, error: insertErr } = await gcrDb
      .from('entity')
      .insert(entity)
      .select('id')
      .single();

    if (insertErr) {
      if (insertErr.message.includes('duplicate')) { skipped++; continue; }
      console.error(`  ERROR ${slug}:`, insertErr.message);
      errors++;
      continue;
    }

    const entityId = inserted.id;
    console.log(`  CREATED: ${slug}`);
    existingSlugs.add(slug);

    // Tags
    const tags = (d.tags || []).map((t, i) => ({
      entity_id: entityId,
      tag: typeof t === 'string' ? t : String(t),
      tag_category: 'search',
      sort_order: i,
    }));
    if (tags.length) {
      try { await gcrDb.from('entity_tags').insert(tags); } catch(_) {}
    }

    // Hours section
    const hours = d.hours;
    if (hours && typeof hours === 'object' && Object.keys(hours).length) {
      const { data: sec } = await gcrDb
        .from('entity_sections')
        .insert({ entity_id: entityId, section_key: 'hours', section_label: 'Hours', section_type: 'hours', sort_order: 90 })
        .select('id').single();

      if (sec) {
        const dayMap = { mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday' };
        const rows = Object.entries(hours).map(([day, val], i) => {
          const dayKey = dayMap[day.toLowerCase().slice(0, 3)] || day.toLowerCase();
          const isClosed = typeof val === 'string' && val.toLowerCase().includes('closed');
          return { section_id: sec.id, day_of_week: dayKey, note_text: val || '', is_closed: isClosed, sort_order: i };
        });
        try { await gcrDb.from('section_hours').insert(rows); } catch(_) {}
      }
    }

    // Reviews section
    const reviews = d.reviews || [];
    if (reviews.length) {
      const { data: sec } = await gcrDb
        .from('entity_sections')
        .insert({ entity_id: entityId, section_key: 'reviews', section_label: 'Reviews', section_type: 'reviews', sort_order: 80 })
        .select('id').single();

      if (sec) {
        const rows = reviews.slice(0, 10).map((r, i) => ({
          section_id: sec.id,
          author_name: r.reviewer || 'Anonymous',
          rating: r.rating || null,
          review_text: (r.text || '').slice(0, 500),
          source: r.source || 'google',
          sort_order: i,
        }));
        try { await gcrDb.from('section_reviews').insert(rows); } catch(_) {}
      }
    }

    created++;
  }

  console.log(`\n=== Done ===`);
  console.log(`Created: ${created} | Skipped: ${skipped} | Errors: ${errors}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

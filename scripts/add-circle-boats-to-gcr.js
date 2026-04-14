#!/usr/bin/env node
// Copy Circle Boats from old DB → GCR DB as a full entity profile
// READ ONLY from old DB. No changes to old DB.

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const CB = '22222222-2222-2222-2222-222222222222';
const SLUG = 'beachside-circle-boats';

async function main() {
  console.log('Loading Circle Boats data from old DB...');

  const [bizRes, contentRes, fleetRes, addonsRes, mediaRes, reviewsRes, faqsRes, pricingRes] = await Promise.all([
    old.from('businesses').select('*').eq('site_id', CB).single(),
    old.from('site_content').select('*').eq('site_id', CB).single(),
    old.from('fleet_types').select('*').eq('site_id', CB).order('sort_order'),
    old.from('rental_addons').select('*').eq('site_id', CB).order('sort_order'),
    old.from('media').select('*').eq('site_id', CB).order('uploaded_at'),
    old.from('reviews').select('*').eq('site_id', CB),
    old.from('faqs').select('*').eq('site_id', CB).order('sort_order'),
    old.from('rental_pricing').select('*, rental_time_slots(name)').eq('site_id', CB),
  ]);

  const b = bizRes.data;
  const c = contentRes.data || {};
  const fleet = fleetRes.data || [];
  const addons = addonsRes.data || [];
  const media = mediaRes.data || [];
  const reviews = reviewsRes.data || [];
  const faqs = faqsRes.data || [];
  const pricing = pricingRes.data || [];

  // ── Check if already exists ───────────────────────────────────────
  const { data: existing } = await gcr.from('entity').select('id').eq('slug', SLUG).single();
  let entityId;

  if (existing) {
    console.log('Entity already exists, updating...');
    entityId = existing.id;
    await gcr.from('entity').update({
      name: b.name,
      subtitle: b.tagline || 'Orange Beach Circle Boat Rentals',
      entity_type: 'business',
      entity_subtype: 'boat_rental',
      icon: '🚤',
      phone: c.contact_phone || '',
      address_line_1: c.address || '25856 Canal Road',
      city: c.city || 'Orange Beach',
      state: c.state || 'AL',
      zip: c.zip || '36561',
      website_url: c.website_url || 'https://beachsidecircleboats.com',
      booking_url: c.website_url || null,
      description: c.about_text || '',
      is_active: true,
      featured: true,
      social_instagram: b.instagram || null,
      social_facebook: b.facebook || null,
      updated_at: new Date().toISOString(),
    }).eq('id', entityId);
  } else {
    console.log('Creating new entity...');
    const { data: ent, error } = await gcr.from('entity').insert({
      slug: SLUG,
      name: b.name,
      subtitle: b.tagline || 'Orange Beach Circle Boat Rentals',
      entity_type: 'business',
      entity_subtype: 'boat_rental',
      icon: '🚤',
      phone: c.contact_phone || '',
      address_line_1: c.address || '25856 Canal Road',
      city: c.city || 'Orange Beach',
      state: c.state || 'AL',
      zip: c.zip || '36561',
      website_url: c.website_url || 'https://beachsidecircleboats.com',
      booking_url: c.website_url || null,
      description: c.about_text || '',
      is_active: true,
      featured: true,
      social_instagram: b.instagram || null,
      social_facebook: b.facebook || null,
    }).select('id').single();
    if (error) { console.error('Entity insert error:', error.message); process.exit(1); }
    entityId = ent.id;
  }
  console.log('Entity ID:', entityId);

  // ── Clear existing child data ─────────────────────────────────────
  await Promise.all([
    gcr.from('entity_photos').delete().eq('entity_id', entityId),
    gcr.from('entity_hours').delete().eq('entity_id', entityId),
    gcr.from('entity_tags').delete().eq('entity_id', entityId),
    gcr.from('entity_features').delete().eq('entity_id', entityId),
    gcr.from('gcr_faqs').delete().eq('entity_id', entityId),
    gcr.from('fleet_items').delete().eq('entity_id', entityId),
    gcr.from('addons').delete().eq('entity_id', entityId),
    gcr.from('pricing_items').delete().eq('entity_id', entityId),
    gcr.from('section_reviews').delete().eq('section_id', entityId),
  ]);

  // ── Photos ────────────────────────────────────────────────────────
  console.log(`Adding ${media.length} photos...`);
  if (media.length) {
    await gcr.from('entity_photos').insert(
      media.map((m, i) => ({
        entity_id: entityId,
        image_url: m.url,
        caption: m.alt_text || m.title || null,
        sort_order: i,
        is_cover: i === 0,
      }))
    );
    // Set hero image to first photo
    await gcr.from('entity').update({ hero_image_url: media[0].url }).eq('id', entityId);
  }

  // ── Hours ─────────────────────────────────────────────────────────
  const hours = c.hours || {};
  const dayMap = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
  const hourRows = [];
  for (const [k, dayName] of Object.entries(dayMap)) {
    const val = hours[k];
    if (!val) continue;
    let open = null, close = null, is_closed = false;
    if (val === 'closed' || val?.closed) { is_closed = true; }
    else if (typeof val === 'string' && val.includes('-')) { const p = val.split('-'); open = p[0]?.trim(); close = p[1]?.trim(); }
    else if (typeof val === 'object') { open = val.open; close = val.close; is_closed = val.closed || false; }
    hourRows.push({ entity_id: entityId, day_of_week: dayName, open_time: open, close_time: close, is_closed });
  }
  if (hourRows.length) {
    console.log(`Adding ${hourRows.length} hours...`);
    await gcr.from('entity_hours').insert(hourRows);
  }

  // ── Tags ──────────────────────────────────────────────────────────
  const tags = [
    { tag: 'boat_rental', tag_category: 'amenity' },
    { tag: 'water_sports', tag_category: 'amenity' },
    { tag: 'family_friendly', tag_category: 'amenity' },
    { tag: 'orange_beach', tag_category: 'location' },
    { tag: 'gulf_shores', tag_category: 'location' },
    { tag: 'circle_boats', tag_category: 'search' },
    { tag: 'pontoon_rental', tag_category: 'search' },
  ];
  if (b.pet_friendly) tags.push({ tag: 'pet_friendly', tag_category: 'amenity' });
  if (b.kids_friendly) tags.push({ tag: 'kids_friendly', tag_category: 'amenity' });
  console.log(`Adding ${tags.length} tags...`);
  await gcr.from('entity_tags').insert(tags.map(t => ({ ...t, entity_id: entityId })));

  // ── Features ──────────────────────────────────────────────────────
  const features = [
    'Easy to Drive — No License Required',
    'Single & Double Seater Options',
    'Life Jackets Included',
    'Orange Beach, AL',
    'On-site Staff',
  ];
  await gcr.from('entity_features').insert(features.map((label, i) => ({ entity_id: entityId, label, sort_order: i })));
  console.log(`Added ${features.length} features`);

  // ── Fleet ─────────────────────────────────────────────────────────
  console.log(`Adding ${fleet.length} fleet items...`);
  if (fleet.length) {
    await gcr.from('fleet_items').insert(
      fleet.map((f, i) => ({
        entity_id: entityId,
        item_name: f.name,
        description: f.description || null,
        capacity: f.capacity || null,
        image_url: f.image_url || null,
        sort_order: i,
      }))
    );
  }

  // ── Add-ons ───────────────────────────────────────────────────────
  console.log(`Adding ${addons.length} add-ons...`);
  if (addons.length) {
    await gcr.from('addons').insert(
      addons.map((a, i) => ({
        entity_id: entityId,
        addon_name: a.name,
        description: a.description || null,
        price: a.price || null,
        image_url: a.image_url || null,
        sort_order: i,
      }))
    );
  }

  // ── Pricing ───────────────────────────────────────────────────────
  console.log(`Adding ${pricing.length} pricing items...`);
  if (pricing.length) {
    await gcr.from('pricing_items').insert(
      pricing.map((p, i) => ({
        entity_id: entityId,
        package_name: `${p.rental_time_slots?.name || 'Rental'} — ${p.fleet_type_name || ''}`.trim(),
        price: p.price || null,
        price_text: p.price ? `$${p.price}` : null,
        sort_order: i,
      }))
    );
  }

  // ── FAQs ──────────────────────────────────────────────────────────
  console.log(`Adding ${faqs.length} FAQs...`);
  if (faqs.length) {
    await gcr.from('gcr_faqs').insert(
      faqs.map((f, i) => ({
        entity_id: entityId,
        question: f.question,
        answer: f.answer,
        sort_order: f.sort_order || i,
      }))
    );
  }

  // ── Reviews ───────────────────────────────────────────────────────
  if (reviews.length) {
    console.log(`Adding ${reviews.length} reviews...`);
    await gcr.from('gcr_reviews').insert(
      reviews.map(r => ({
        entity_id: entityId,
        customer_name: r.customer_name,
        customer_email: r.customer_email || null,
        rating: r.rating,
        review_text: r.text,
        status: r.status || 'approved',
        source: 'migrated',
        created_at: r.created_at,
      }))
    );
  }

  // ── Sections (About, Fleet, Pricing, Add-ons, FAQs, Photos) ──────
  const sections = [
    { section_key: 'about',    section_label: 'About',      section_type: 'rich_text',    sort_order: 1 },
    { section_key: 'fleet',    section_label: 'Our Boats',  section_type: 'cards',        sort_order: 2 },
    { section_key: 'pricing',  section_label: 'Pricing',    section_type: 'grouped_items',sort_order: 3 },
    { section_key: 'addons',   section_label: 'Add-Ons',    section_type: 'grouped_items',sort_order: 4 },
    { section_key: 'gallery',  section_label: 'Photos',     section_type: 'gallery',      sort_order: 5 },
    { section_key: 'faqs',     section_label: 'FAQ',        section_type: 'bullets',      sort_order: 6 },
    { section_key: 'location', section_label: 'Location',   section_type: 'location',     sort_order: 7 },
  ];

  await gcr.from('entity_sections').delete().eq('entity_id', entityId);
  const { data: insertedSecs } = await gcr.from('entity_sections').insert(
    sections.map(s => ({ ...s, entity_id: entityId }))
  ).select('id, section_key');

  // About text
  const aboutSec = insertedSecs?.find(s => s.section_key === 'about');
  if (aboutSec && c.about_text) {
    await gcr.from('section_rich_text').upsert({ section_id: aboutSec.id, body_text: c.about_text }, { onConflict: 'section_id' });
  }

  // Location
  const locSec = insertedSecs?.find(s => s.section_key === 'location');
  if (locSec) {
    await gcr.from('section_location').upsert({
      section_id: locSec.id,
      address_line_1: c.address || '25856 Canal Road',
      city: c.city || 'Orange Beach',
      state: c.state || 'AL',
      zip: c.zip || '36561',
      phone: c.contact_phone || '',
      website_url: c.website_url || '',
    }, { onConflict: 'section_id' });
  }

  // Gallery
  const galSec = insertedSecs?.find(s => s.section_key === 'gallery');
  if (galSec && media.length) {
    await gcr.from('section_photos').insert(
      media.slice(0, 20).map((m, i) => ({
        section_id: galSec.id,
        image_url: m.url,
        caption: m.alt_text || null,
        sort_order: i,
      }))
    );
  }

  console.log('\n✅ Circle Boats added to GCR DB');
  console.log('Profile URL: https://launching-gcr.vercel.app/profile.html?id=' + SLUG);
  console.log('Entity ID:', entityId);
}

main().catch(console.error);

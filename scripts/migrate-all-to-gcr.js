#!/usr/bin/env node
// Full migration: OLD DB → GCR DB — EVERYTHING, no deletes, no skips
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

function safe(v) { return v || null; }
function safeArr(v) { return Array.isArray(v) ? v : []; }

async function upsertSection(entityId, key, label, type, sort) {
  const { data } = await gcr.from('entity_sections')
    .upsert({ entity_id: entityId, section_key: key, section_label: label, section_type: type, sort_order: sort }, { onConflict: 'entity_id,section_key' })
    .select('id').single();
  return data?.id;
}

async function insertBullets(sectionId, items) {
  if (!items?.length) return;
  await gcr.from('section_bullets').insert(items.map((t, i) => ({ section_id: sectionId, bullet_text: String(t), sort_order: i })));
}

async function main() {
  // ── Build site_id → entity_id map ────────────────────────────
  console.log('Building ID map...');
  const { data: entities } = await gcr.from('entity').select('id, slug');
  const bySlug = {};
  entities.forEach(e => { bySlug[e.slug] = e.id; });

  const { data: businesses } = await old.from('businesses').select('*');
  const map = {}; // site_id → entity_id
  let matched = 0;
  for (const b of businesses) {
    const eid = bySlug[b.subdomain];
    if (eid) { map[b.site_id] = eid; matched++; }
  }
  console.log(`Matched ${matched}/${businesses.length} businesses\n`);

  function eid(siteId) { return map[siteId]; }

  // ── 1. AMENITY TAGS from businesses table ────────────────────
  console.log('1. Amenity tags...');
  let n = 0;
  for (const b of businesses) {
    const e = eid(b.site_id); if (!e) continue;
    const flags = { kids_friendly:'kids_friendly', pet_friendly:'pet_friendly', live_music:'live_music',
      outdoor:'outdoor_seating', waterfront:'waterfront', beachfront:'beachfront', dockside:'dockside',
      alcohol:'full_bar', reservations:'reservations', delivery:'delivery', takeout:'takeout',
      gluten_free:'gluten_free', vegan:'vegan_options', vegetarian:'vegetarian_options',
      booking_required:'booking_required' };
    for (const [col, tag] of Object.entries(flags)) {
      if (b[col]) { await gcr.from('entity_tags').upsert({ entity_id:e, tag, tag_category:'amenity' }, { onConflict:'entity_id,tag' }); n++; }
    }
    for (const t of safeArr(b.tags)) {
      if (t) { await gcr.from('entity_tags').upsert({ entity_id:e, tag:String(t), tag_category:'search' }, { onConflict:'entity_id,tag' }); n++; }
    }
  }
  console.log(`   ${n} tags`);

  // ── 2. MENU ITEMS ─────────────────────────────────────────────
  console.log('2. Menu items...');
  const { data: menuItems } = await old.from('menu_items').select('*').order('sort_order');
  const secCache = {};
  n = 0;
  for (const item of menuItems) {
    const e = eid(item.site_id); if (!e) continue;
    const isDrink = (item.item_type||'food') === 'drink';
    const tbl = isDrink ? 'drink_sections' : 'menu_sections';
    const iTbl = isDrink ? 'drink_items' : 'menu_items';
    const fk = isDrink ? 'drink_section_id' : 'menu_section_id';
    const key = `${e}_${tbl}_${item.category||'General'}`;
    if (!secCache[key]) {
      const { data: s } = await gcr.from(tbl).insert({ entity_id:e, section_name:item.category||'General', sort_order:0 }).select('id').single();
      secCache[key] = s?.id;
    }
    if (!secCache[key]) continue;
    await gcr.from(iTbl).insert({ entity_id:e, [fk]:secCache[key], item_name:item.name, description:safe(item.description), price:item.price||null, allergens:Array.isArray(item.allergens)?item.allergens.join(', '):safe(item.allergens), is_available:item.available!==false, image_url:safe(item.image_url), sort_order:item.sort_order||0 });
    n++;
  }
  console.log(`   ${n} menu items`);

  // ── 3. SPECIALS ───────────────────────────────────────────────
  console.log('3. Specials...');
  const { data: specials } = await old.from('specials').select('*');
  n = 0;
  for (const s of specials) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('entity_specials').insert({ entity_id:e, special_name:s.name, description:safe(s.description), special_type:safe(s.type), days:Array.isArray(s.days)?JSON.stringify(s.days):safe(s.days), start_time:safe(s.start_time), end_time:safe(s.end_time), discount_text:safe(s.discount_text||s.discount), image_url:safe(s.image_url), is_active:s.active!==false });
    n++;
  }
  console.log(`   ${n} specials`);

  // ── 4. EVENTS ─────────────────────────────────────────────────
  console.log('4. Events...');
  const { data: events } = await old.from('events').select('*');
  n = 0;
  for (const ev of events) {
    const e = eid(ev.site_id); if (!e) continue;
    await gcr.from('entity_events').insert({ entity_id:e, event_name:ev.name||ev.title, event_type:safe(ev.category), description:safe(ev.description), artist_name:safe(ev.artist_name), day_of_week:safe(ev.recurring_day), event_date:safe(ev.event_date), start_time:safe(ev.start_time||ev.event_time||ev.time), end_time:safe(ev.end_time), recurring:ev.recurring||false, cover_charge:ev.cover_charge?String(ev.cover_charge):null, image_url:safe(ev.image_url||ev.cover), is_active:ev.active!==false });
    n++;
  }
  console.log(`   ${n} events`);

  // ── 5. REVIEWS ────────────────────────────────────────────────
  console.log('5. Reviews...');
  const { data: reviews } = await old.from('reviews').select('*');
  n = 0;
  for (const r of reviews) {
    const e = eid(r.site_id); if (!e) continue;
    await gcr.from('gcr_reviews').insert({ entity_id:e, customer_name:safe(r.customer_name), customer_email:safe(r.customer_email), rating:r.rating, review_text:safe(r.text), review_method:r.review_method||'text', photos:r.photos||[], status:r.status||'approved', source:'migrated', created_at:r.created_at });
    n++;
  }
  console.log(`   ${n} reviews`);

  // ── 6. SERVICES ───────────────────────────────────────────────
  console.log('6. Services...');
  const { data: services } = await old.from('services').select('*');
  const svcSecCache = {};
  n = 0;
  for (const s of services) {
    const e = eid(s.site_id); if (!e) continue;
    if (!svcSecCache[e]) { svcSecCache[e] = await upsertSection(e, 'services', 'Services & Pricing', 'grouped_items', 10); }
    const secId = svcSecCache[e]; if (!secId) continue;
    await gcr.from('section_items').insert({ section_id:secId, item_name:s.name, item_description:safe(s.description), price_numeric:s.price||null, price_text:s.price?`$${s.price}`:null, item_type:'service', sort_order:s.sort_order||0, metadata_json:{ duration_minutes:s.duration_minutes, capacity:s.capacity, min_guests:s.min_guests, max_guests:s.max_guests, kids_friendly:s.kids_friendly, pet_friendly:s.pet_friendly, booking_url:s.booking_url } });
    n++;
  }
  console.log(`   ${n} services`);

  // ── 7. MEDIA ──────────────────────────────────────────────────
  console.log('7. Media/photos...');
  const { data: media } = await old.from('media').select('*');
  n = 0;
  for (const m of media) {
    const e = eid(m.site_id); if (!e) continue;
    await gcr.from('entity_photos').insert({ entity_id:e, image_url:m.url, caption:safe(m.alt_text||m.title), sort_order:0, is_cover:false });
    await gcr.from('business_media').insert({ entity_id:e, url:m.url, caption:safe(m.alt_text||m.title), section:'gallery', sort_order:0 });
    n++;
  }
  console.log(`   ${n} photos`);

  // ── 8. FAQS ───────────────────────────────────────────────────
  console.log('8. FAQs...');
  const { data: faqs } = await old.from('faqs').select('*');
  n = 0;
  for (const f of faqs) {
    const e = eid(f.site_id); if (!e) continue;
    await gcr.from('gcr_faqs').insert({ entity_id:e, question:f.question, answer:f.answer, sort_order:f.sort_order||0 });
    n++;
  }
  console.log(`   ${n} FAQs`);

  // ── 9. SITE CONTENT ───────────────────────────────────────────
  console.log('9. Site content...');
  const { data: contents } = await old.from('site_content').select('*');
  n = 0;
  for (const c of contents) {
    const e = eid(c.site_id); if (!e) continue;
    // Core entity fields
    const upd = {};
    if (c.about_text)              upd.description      = c.about_text;
    if (c.contact_phone)           upd.phone            = c.contact_phone;
    if (c.website_url)             upd.website_url      = c.website_url;
    if (c.address)                 upd.address_line_1   = c.address;
    if (c.city)                    upd.city             = c.city;
    if (c.state)                   upd.state            = c.state;
    if (c.zip)                     upd.zip              = c.zip;
    if (c.social_links?.instagram) upd.social_instagram = c.social_links.instagram;
    if (c.social_links?.facebook)  upd.social_facebook  = c.social_links.facebook;
    if (c.social_links?.tiktok)    upd.social_tiktok    = c.social_links.tiktok;
    if (Object.keys(upd).length)   await gcr.from('entity').update(upd).eq('id', e);

    // Hours
    if (c.hours && typeof c.hours === 'object' && !Array.isArray(c.hours)) {
      for (const day of ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) {
        const h = c.hours[day]; if (!h) continue;
        await gcr.from('entity_hours').upsert({ entity_id:e, day_of_week:day[0].toUpperCase()+day.slice(1), open_time:safe(h.open), close_time:safe(h.close), is_closed:h.closed||false }, { onConflict:'entity_id,day_of_week' });
      }
    }

    // Highlights
    if (safeArr(c.highlights).length) {
      const sid = await upsertSection(e, 'highlights', 'Highlights', 'bullets', 2);
      if (sid) await insertBullets(sid, c.highlights);
    }

    // Perfect For
    for (const [i, label] of safeArr(c.perfect_for).entries()) {
      if (label) await gcr.from('entity_perfect_for').insert({ entity_id:e, label:String(label), sort_order:i });
    }

    // Restrictions
    if (safeArr(c.restrictions).length) {
      const sid = await upsertSection(e, 'restrictions', 'Requirements', 'bullets', 20);
      if (sid) await insertBullets(sid, c.restrictions);
    }

    // What to bring
    if (safeArr(c.what_to_bring).length) {
      const sid = await upsertSection(e, 'what_to_bring', 'What to Bring', 'bullets', 21);
      if (sid) await insertBullets(sid, c.what_to_bring);
    }

    // Schedules
    if (safeArr(c.schedules).length) {
      const sid = await upsertSection(e, 'schedules', 'Schedules', 'grouped_items', 5);
      if (sid) {
        for (const [i, sched] of c.schedules.entries()) {
          const { data: grp } = await gcr.from('section_groups').insert({ section_id:sid, title:safe(sched.name), subtitle:safe(sched.time), sort_order:i }).select('id').single();
          if (grp?.id) {
            for (const [j, t] of safeArr(sched.tickets).entries()) {
              await gcr.from('section_items').insert({ section_id:sid, group_id:grp.id, item_name:t.name||t.label||'Ticket', price_numeric:t.price||null, price_text:t.price?`$${t.price}`:null, item_type:'ticket', sort_order:j });
            }
          }
        }
      }
    }

    // Packages
    if (safeArr(c.packages).length) {
      const sid = await upsertSection(e, 'packages', 'Packages & Pricing', 'cards', 6);
      if (sid) {
        for (const [i, pkg] of c.packages.entries()) {
          await gcr.from('section_cards').insert({ section_id:sid, title:safe(pkg.name||pkg.title), subtitle:safe(pkg.subtitle), description:safe(pkg.description), price_text:pkg.price?`$${pkg.price}`:safe(pkg.price_text), image_url:safe(pkg.image_url), sort_order:i });
        }
      }
    }

    // Happy Hour
    if (c.happy_hour && typeof c.happy_hour === 'object') {
      const hh = c.happy_hour;
      const allItems = [...safeArr(hh.items), ...safeArr(hh.drinks), ...safeArr(hh.food)];
      if (allItems.length) {
        const { data: hhSec } = await gcr.from('happy_hour_sections').insert({ entity_id:e, section_name:'Happy Hour', sort_order:0 }).select('id').single();
        if (hhSec?.id) {
          for (const [i, item] of allItems.entries()) {
            await gcr.from('happy_hour_items').insert({ entity_id:e, hh_section_id:hhSec.id, item_name:item.name||item.title||String(item), description:safe(item.description), regular_price:item.regular_price||null, hh_price:item.price||item.hh_price||null, price_text:safe(item.price_text), sort_order:i });
          }
        }
      }
    }

    // QnA
    for (const [i, q] of safeArr(c.qna).entries()) {
      if (q.question||q.q) await gcr.from('entity_qna').insert({ entity_id:e, question:q.question||q.q, answer:safe(q.answer||q.a), sort_order:i });
    }

    // Policies
    if (c.policies && typeof c.policies === 'object') {
      const entries = Object.entries(c.policies).filter(([,v]) => v);
      if (entries.length) {
        const sid = await upsertSection(e, 'policies', 'Policies', 'bullets', 22);
        if (sid) await insertBullets(sid, entries.map(([k,v]) => `${k}: ${v}`));
      }
    }

    n++;
  }
  console.log(`   ${n} site content blocks`);

  // ── 10. BUSINESS DETAILS ──────────────────────────────────────
  console.log('10. Business details...');
  const { data: details } = await old.from('business_details').select('*');
  n = 0;
  for (const d of (details||[])) {
    const e = eid(d.site_id); if (!e) continue;
    await gcr.from('business_details').upsert({ site_id:e, elevator_pitch:safe(d.elevator_pitch), vibe_description:safe(d.vibe_description), who_its_for:safe(d.who_its_for), what_to_expect:safe(d.what_to_expect), signature_dish:safe(d.signature_dish), signature_drink:safe(d.signature_drink), must_try:d.must_try||[], avoid:d.avoid||[], local_favorite:d.local_favorite||false, insider_tip:safe(d.insider_tip), best_kept_secret:safe(d.best_kept_secret), pro_tip:safe(d.pro_tip), best_time_of_day:safe(d.best_time_of_day), best_days:d.best_days||[], worst_days:d.worst_days||[], avg_wait_time:safe(d.avg_wait_time), avg_visit_duration:safe(d.avg_visit_duration) });
    n++;
  }
  console.log(`   ${n} business details`);

  // ── 11. BUSINESS ATMOSPHERE ───────────────────────────────────
  console.log('11. Business atmosphere...');
  let atmos = [];
  try {
    const result = await old.from('business_atmosphere').select('*');
    atmos = result.data || [];
  } catch(e) {
    console.log('   ⚠️  Skipping (table may not exist)');
  }
  n = 0;
  for (const a of (atmos||[])) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('business_atmosphere').upsert({ site_id:e, noise_level:safe(a.noise_level), lighting:safe(a.lighting), seating_types:a.seating_types||[], dress_code:safe(a.dress_code), avg_age_range:safe(a.avg_age_range), live_music:a.live_music||false, live_music_schedule:safe(a.live_music_schedule), live_music_genre:safe(a.live_music_genre), dance_floor:a.dance_floor||false, sports_tv:a.sports_tv||false, karaoke:a.karaoke||false, trivia_night:safe(a.trivia_night), outdoor_seating:a.outdoor_seating||false, covered_outdoor:a.covered_outdoor||false, fire_pit:a.fire_pit||false, ocean_view:a.ocean_view||false, bay_view:a.bay_view||false, sunset_view:a.sunset_view||false, wifi:a.wifi||false, pool_table:a.pool_table||false });
    n++;
  }
  console.log(`   ${n} atmosphere records`);

  // ── 12. BUSINESS FILTERS ──────────────────────────────────────
  console.log('12. Business filters...');
  let filters = [];
  try {
    const result = await old.from('business_filters').select('*');
    filters = result.data || [];
  } catch(e) {}
  n = 0;
  for (const f of (filters||[])) {
    const e = eid(f.site_id); if (!e) continue;
    await gcr.from('business_filters').upsert({ site_id:e, cuisine:f.cuisine||[], dietary_gluten_free:f.dietary_gluten_free||false, dietary_vegan:f.dietary_vegan||false, dietary_vegetarian:f.dietary_vegetarian||false, kids_menu:f.kids_menu||false, full_bar:f.full_bar||false, craft_beer:f.craft_beer||false, wine_list:f.wine_list||false, has_happy_hour:f.has_happy_hour||false, happy_hour_days:f.happy_hour_days||[], happy_hour_deals:safe(f.happy_hour_deals), has_live_music:f.has_live_music||false, live_music_days:f.live_music_days||[], live_music_genre:f.live_music_genre||[], outdoor_seating:f.outdoor_seating||false, waterfront:f.waterfront||false, rooftop:f.rooftop||false, pet_friendly:f.pet_friendly||false, kid_friendly:f.kid_friendly||false, romantic:f.romantic||false, group_friendly:f.group_friendly||false, sports_tv:f.sports_tv||false, dance_floor:f.dance_floor||false, reservations_required:f.reservations_required||false, parking_free:f.parking_free||false, wheelchair_accessible:f.wheelchair_accessible||false, boat_dock:f.boat_dock||false, price_range:safe(f.price_range), avg_check_min:f.avg_check_min||null, avg_check_max:f.avg_check_max||null, open_late:f.open_late||false, open_early:f.open_early||false, has_fishing:f.has_fishing||false, has_boat_rental:f.has_boat_rental||false, has_water_sports:f.has_water_sports||false, has_tours:f.has_tours||false });
    n++;
  }
  console.log(`   ${n} filter records`);

  // ── 13. BUSINESS LOGISTICS ────────────────────────────────────
  console.log('13. Business logistics...');
  let logistics = [];
  try {
    const result = await old.from('business_logistics').select('*');
    logistics = result.data || [];
  } catch(e) {}
  n = 0;
  for (const l of (logistics||[])) {
    const e = eid(l.site_id); if (!e) continue;
    await gcr.from('business_logistics').upsert({ site_id:e, parking_type:safe(l.parking_type), parking_notes:safe(l.parking_notes), wheelchair_accessible:l.wheelchair_accessible||false, stroller_friendly:l.stroller_friendly||false, waterfront_access:l.waterfront_access||false, boat_accessible:l.boat_accessible||false, dock_available:l.dock_available||false, reservations:safe(l.reservations), reservation_url:safe(l.reservation_url), reservation_phone:safe(l.reservation_phone), directions_note:safe(l.directions_note), landmark:safe(l.landmark), uber_friendly:l.uber_friendly||false, golf_cart_parking:l.golf_cart_parking||false, distance_from_beach:safe(l.distance_from_beach), distance_from_wharf:safe(l.distance_from_wharf) });
    n++;
  }
  console.log(`   ${n} logistics records`);

  // ── 14. BUSINESS HIGHLIGHTS ───────────────────────────────────
  console.log('14. Business highlights...');
  let highlights = [];
  try {
    const result = await old.from('business_highlights').select('*');
    highlights = result.data || [];
  } catch(e) {}
  n = 0;
  for (const h of (highlights||[])) {
    const e = eid(h.site_id); if (!e) continue;
    await gcr.from('business_highlights').upsert({ site_id:e, headline:safe(h.headline), bullets:h.bullets||[], local_tip:safe(h.local_tip), avoid_tip:safe(h.avoid_tip), best_time:safe(h.best_time), signature_item:safe(h.signature_item), fun_fact:safe(h.fun_fact), deal_alert:safe(h.deal_alert) });
    n++;
  }
  console.log(`   ${n} highlights`);

  // ── 15. BUSINESS ATTRIBUTES ───────────────────────────────────
  console.log('15. Business attributes...');
  let attrs = [];
  try {
    const result = await old.from('business_attributes').select('*');
    attrs = result.data || [];
  } catch(e) {}
  n = 0;
  for (const a of (attrs||[])) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('business_attributes').upsert({ site_id:e, dietary_options:a.dietary_options||[], atmosphere:a.atmosphere||[], parking:safe(a.parking), dress_code:safe(a.dress_code), reservations_required:a.reservations_required||false, walk_ins_welcome:a.walk_ins_welcome||false, cash_only:a.cash_only||false, wifi:a.wifi||false, best_for:a.best_for||[], noise_level:safe(a.noise_level), age_range:safe(a.age_range), service_style:safe(a.service_style), avg_check_per_person:safe(a.avg_check_per_person) });
    n++;
  }
  console.log(`   ${n} attributes`);

  // ── 16. AMENITIES ─────────────────────────────────────────────
  console.log('16. Amenities...');
  let amenities = [];
  try {
    const result = await old.from('amenities').select('*');
    amenities = result.data || [];
  } catch(e) {}
  n = 0;
  for (const a of (amenities||[])) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('amenities').upsert({ site_id:e, pool:a.pool||false, pools_count:a.pools_count||null, indoor_pool:a.indoor_pool||false, heated_pool:a.heated_pool||false, lazy_river:a.lazy_river||false, waterslide:a.waterslide||false, hot_tub:a.hot_tub||false, beachfront:a.beachfront||false, beach_access:a.beach_access||false, private_beach:a.private_beach||false, beach_chairs:a.beach_chairs||false, restaurant:a.restaurant||false, bar:a.bar||false, room_service:a.room_service||false, gym:a.gym||false, spa:a.spa||false, sauna:a.sauna||false, concierge:a.concierge||false, kids_club:a.kids_club||false, playground:a.playground||false, wifi:a.wifi||false, wifi_free:a.wifi_free||false, parking:a.parking||false, parking_free:a.parking_free||false, valet:a.valet||false, pet_friendly:a.pet_friendly||false, golf_course:a.golf_course||false, tennis_courts:a.tennis_courts||false, marina:a.marina||false, boat_rentals:a.boat_rentals||false });
    n++;
  }
  console.log(`   ${n} amenity records`);

  // ── 17. ACCOMMODATION DETAILS ─────────────────────────────────
  console.log('17. Accommodation details...');
  let accom = [];
  try {
    const result = await old.from('accommodation_details').select('*');
    accom = result.data || [];
  } catch(e) {}
  n = 0;
  for (const a of (accom||[])) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('accommodation_details').upsert({ site_id:e, star_rating:a.star_rating||null, total_rooms:a.total_rooms||null, floors:a.floors||null, year_built:a.year_built||null, year_renovated:a.year_renovated||null, beachfront:a.beachfront||false, pools:a.pools||null, indoor_pool:a.indoor_pool||false, heated_pool:a.heated_pool||false, lazy_river:a.lazy_river||false, waterslide:a.waterslide||false, restaurant_on_site:a.restaurant_on_site||false, bar_on_site:a.bar_on_site||false, gym:a.gym||false, spa:a.spa||false, resort_fee:a.resort_fee||null, resort_fee_includes:a.resort_fee_includes||[], parking_fee:safe(a.parking_fee), pet_fee:safe(a.pet_fee), check_in_time:safe(a.check_in_time), check_out_time:safe(a.check_out_time), min_age_to_book:a.min_age_to_book||null, pets_allowed:a.pets_allowed||false, pet_size_limit:safe(a.pet_size_limit), smoking_policy:safe(a.smoking_policy) });
    n++;
  }
  console.log(`   ${n} accommodation details`);

  // ── 18. ACTIVITY DETAILS ──────────────────────────────────────
  console.log('18. Activity details...');
  let actDets = [];
  try {
    const result = await old.from('activity_details').select('*');
    actDets = result.data || [];
  } catch(e) {}
  n = 0;
  for (const a of (actDets||[])) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('activity_details').upsert({ site_id:e, activity_type:safe(a.activity_type), difficulty:safe(a.difficulty), min_age:a.min_age||null, max_age:a.max_age||null, min_weight_lbs:a.min_weight_lbs||null, max_weight_lbs:a.max_weight_lbs||null, swimming_required:a.swimming_required||false, experience_required:a.experience_required||false, experience_note:safe(a.experience_note), duration_hours:a.duration_hours||null, departure_location:safe(a.departure_location), departure_lat:a.departure_lat||null, departure_lng:a.departure_lng||null, what_to_bring:a.what_to_bring||[], what_is_provided:a.what_is_provided||[], fish_species:a.fish_species||[], fishing_type:safe(a.fishing_type), trip_types:a.trip_types||[], advance_booking_required:safe(a.advance_booking_required), cancellation_policy:safe(a.cancellation_policy), deposit_required:a.deposit_required||false, deposit_amount:a.deposit_amount||null });
    n++;
  }
  console.log(`   ${n} activity details`);

  // ── 19. ARTISTS ───────────────────────────────────────────────
  console.log('19. Artists...');
  let artists = [];
  try {
    const result = await old.from('artists').select('*');
    artists = result.data || [];
  } catch(e) {}
  n = 0;
  const artistMap = {}; // old id → new id
  for (const a of (artists||[])) {
    const e = a.site_id ? eid(a.site_id) : null;
    const { data: ins } = await gcr.from('artists').insert({ entity_id:e||null, name:a.name, slug:safe(a.slug), genre:safe(a.genre), bio:safe(a.bio), photo_url:safe(a.photo_url), cover_url:safe(a.cover_url), website:safe(a.website), booking_email:safe(a.booking_email), booking_phone:safe(a.booking_phone), social:a.social||{}, tags:a.tags||[], gcr_listed:a.gcr_listed!==false, featured:a.featured||false, home_venue:safe(a.home_venue), sort_order:a.sort_order||0 }).select('id').single();
    if (ins?.id) { artistMap[a.id] = ins.id; n++; }
  }
  console.log(`   ${n} artists`);

  // ── 20. ARTIST SHOWS ──────────────────────────────────────────
  console.log('20. Artist shows...');
  let shows = [];
  try {
    const result = await old.from('artist_shows').select('*');
    shows = result.data || [];
  } catch(e) {}
  n = 0;
  for (const s of (shows||[])) {
    const newArtistId = artistMap[s.artist_id];
    const e = s.site_id ? eid(s.site_id) : null;
    if (!newArtistId) continue;
    await gcr.from('artist_shows').insert({ artist_id:newArtistId, entity_id:e||null, venue_name:safe(s.venue_name), venue_city:safe(s.venue_city), show_date:safe(s.show_date), start_time:safe(s.start_time), end_time:safe(s.end_time), show_type:safe(s.show_type), cover:safe(s.cover), ticket_url:safe(s.ticket_url), notes:safe(s.notes), active:s.active!==false });
    n++;
  }
  console.log(`   ${n} artist shows`);

  // ── 21. AREA GUIDES ───────────────────────────────────────────
  console.log('21. Area guides...');
  let areas = [];
  try {
    const result = await old.from('area_guides').select('*');
    areas = result.data || [];
  } catch(e) {}
  n = 0;
  for (const a of (areas||[])) {
    await gcr.from('area_guides').insert({ name:a.name, area:safe(a.area), slug:safe(a.slug), short_desc:safe(a.short_desc), full_desc:safe(a.full_desc), highlights:a.highlights||[], best_for:a.best_for||[], parking_note:safe(a.parking_note), walkable:a.walkable||false, drive_from_beach:safe(a.drive_from_beach), tip:safe(a.tip), image_url:safe(a.image_url), lat:a.lat||null, lng:a.lng||null, active:a.active!==false });
    n++;
  }
  console.log(`   ${n} area guides`);

  // ── 22. AREA KNOWLEDGE ────────────────────────────────────────
  console.log('22. Area knowledge...');
  let knowledge = [];
  try {
    const result = await old.from('area_knowledge').select('*');
    knowledge = result.data || [];
  } catch(e) {}
  n = 0;
  for (const a of (knowledge||[])) {
    await gcr.from('area_knowledge').insert({ name:a.name, description:safe(a.description), vibe:safe(a.vibe), best_for:a.best_for||[], avoid_if:a.avoid_if||[], distance_from_airport:safe(a.distance_from_airport), insider_note:safe(a.insider_note) });
    n++;
  }
  console.log(`   ${n} area knowledge`);

  // ── 23. BEACHES ───────────────────────────────────────────────
  console.log('23. Beaches...');
  let beaches = [];
  try {
    const result = await old.from('beaches').select('*');
    beaches = result.data || [];
  } catch(e) {}
  n = 0;
  for (const b of (beaches||[])) {
    await gcr.from('beaches').insert({ name:b.name, area:safe(b.area), crowd_level:safe(b.crowd_level), best_for:b.best_for||[], facilities:b.facilities||[], parking:safe(b.parking), parking_fee:safe(b.parking_fee), dog_friendly:b.dog_friendly||false, alcohol_allowed:b.alcohol_allowed||false, lifeguard:b.lifeguard||false, flag_system:b.flag_system||false, insider_tip:safe(b.insider_tip), lat:b.lat||null, lng:b.lng||null });
    n++;
  }
  console.log(`   ${n} beaches`);

  // ── 24. AI VOICE SCRIPTS ──────────────────────────────────────
  console.log('24. AI voice scripts...');
  let scripts = [];
  try {
    const result = await old.from('ai_voice_scripts').select('*');
    scripts = result.data || [];
  } catch(e) {}
  n = 0;
  for (const s of (scripts||[])) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('ai_voice_scripts').upsert({ site_id:e, short_answer:safe(s.short_answer), medium_answer:safe(s.medium_answer), full_answer:safe(s.full_answer), how_to_get_there:safe(s.how_to_get_there), what_to_order:safe(s.what_to_order), reservation_script:safe(s.reservation_script), hours_script:safe(s.hours_script), price_script:safe(s.price_script), kids_script:safe(s.kids_script), pets_script:safe(s.pets_script) });
    n++;
  }
  console.log(`   ${n} AI voice scripts`);

  // ── 25. BUSINESS MEDIA ────────────────────────────────────────
  console.log('25. Business media...');
  let bizMedia = [];
  try {
    const result = await old.from('business_media').select('*');
    bizMedia = result.data || [];
  } catch(e) {}
  n = 0;
  for (const m of (bizMedia||[])) {
    const e = eid(m.site_id); if (!e) continue;
    await gcr.from('business_media').insert({ entity_id:e, url:m.url, caption:safe(m.caption), section:safe(m.section), sort_order:m.sort_order||0 });
    n++;
  }
  console.log(`   ${n} business media`);

  console.log('\n✅ FULL MIGRATION COMPLETE');
}

main().catch(console.error);

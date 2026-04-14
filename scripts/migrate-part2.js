#!/usr/bin/env node
// Migration Part 2: Steps 10-25 (OLD DB → GCR DB)
// Steps 1-9 already completed successfully
require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const old = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const gcr = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

function safe(v) { return v || null; }
function safeArr(v) { return Array.isArray(v) ? v : []; }

async function query(client, table) {
  const { data, error } = await client.from(table).select('*');
  if (error) { console.log(`   ⚠️  ${table}: ${error.message}`); return []; }
  return data || [];
}

async function main() {
  // Build ID map
  console.log('Building ID map...');
  const { data: entities } = await gcr.from('entity').select('id, slug');
  const bySlug = {};
  entities.forEach(e => { bySlug[e.slug] = e.id; });

  const { data: businesses } = await old.from('businesses').select('site_id, subdomain');
  const map = {};
  for (const b of businesses) {
    const eid = bySlug[b.subdomain];
    if (eid) map[b.site_id] = eid;
  }
  console.log(`  ${Object.keys(map).length} businesses matched\n`);

  function eid(siteId) { return map[siteId]; }

  let n = 0;

  // ── 10. BUSINESS DETAILS ─────────────────────────────────────
  console.log('10. Business details...');
  const details = await query(old, 'business_details');
  n = 0;
  for (const d of details) {
    const e = eid(d.site_id); if (!e) continue;
    await gcr.from('business_details').upsert({ site_id:e, elevator_pitch:safe(d.elevator_pitch), vibe_description:safe(d.vibe_description), who_its_for:safe(d.who_its_for), what_to_expect:safe(d.what_to_expect), signature_dish:safe(d.signature_dish), signature_drink:safe(d.signature_drink), must_try:d.must_try||[], avoid:d.avoid||[], local_favorite:d.local_favorite||false, insider_tip:safe(d.insider_tip), best_kept_secret:safe(d.best_kept_secret), pro_tip:safe(d.pro_tip), best_time_of_day:safe(d.best_time_of_day), best_days:d.best_days||[], worst_days:d.worst_days||[], avg_wait_time:safe(d.avg_wait_time), avg_visit_duration:safe(d.avg_visit_duration) });
    n++;
  }
  console.log(`   ${n} business details`);

  // ── 11. BUSINESS ATMOSPHERE ──────────────────────────────────
  console.log('11. Business atmosphere...');
  const atmos = await query(old, 'business_atmosphere');
  n = 0;
  for (const a of atmos) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('business_atmosphere').upsert({ site_id:e, noise_level:safe(a.noise_level), lighting:safe(a.lighting), seating_types:a.seating_types||[], dress_code:safe(a.dress_code), avg_age_range:safe(a.avg_age_range), live_music:a.live_music||false, live_music_schedule:safe(a.live_music_schedule), live_music_genre:safe(a.live_music_genre), dance_floor:a.dance_floor||false, sports_tv:a.sports_tv||false, karaoke:a.karaoke||false, trivia_night:safe(a.trivia_night), outdoor_seating:a.outdoor_seating||false, covered_outdoor:a.covered_outdoor||false, fire_pit:a.fire_pit||false, ocean_view:a.ocean_view||false, bay_view:a.bay_view||false, sunset_view:a.sunset_view||false, wifi:a.wifi||false, pool_table:a.pool_table||false });
    n++;
  }
  console.log(`   ${n} atmosphere records`);

  // ── 12. BUSINESS FILTERS ─────────────────────────────────────
  console.log('12. Business filters...');
  const filters = await query(old, 'business_filters');
  n = 0;
  for (const f of filters) {
    const e = eid(f.site_id); if (!e) continue;
    await gcr.from('business_filters').upsert({ site_id:e, cuisine:f.cuisine||[], dietary_gluten_free:f.dietary_gluten_free||false, dietary_vegan:f.dietary_vegan||false, dietary_vegetarian:f.dietary_vegetarian||false, kids_menu:f.kids_menu||false, full_bar:f.full_bar||false, craft_beer:f.craft_beer||false, wine_list:f.wine_list||false, has_happy_hour:f.has_happy_hour||false, happy_hour_days:f.happy_hour_days||[], happy_hour_deals:safe(f.happy_hour_deals), has_live_music:f.has_live_music||false, live_music_days:f.live_music_days||[], live_music_genre:f.live_music_genre||[], outdoor_seating:f.outdoor_seating||false, waterfront:f.waterfront||false, rooftop:f.rooftop||false, pet_friendly:f.pet_friendly||false, kid_friendly:f.kid_friendly||false, romantic:f.romantic||false, group_friendly:f.group_friendly||false, sports_tv:f.sports_tv||false, dance_floor:f.dance_floor||false, reservations_required:f.reservations_required||false, parking_free:f.parking_free||false, wheelchair_accessible:f.wheelchair_accessible||false, boat_dock:f.boat_dock||false, price_range:safe(f.price_range), avg_check_min:f.avg_check_min||null, avg_check_max:f.avg_check_max||null, open_late:f.open_late||false, open_early:f.open_early||false, has_fishing:f.has_fishing||false, has_boat_rental:f.has_boat_rental||false, has_water_sports:f.has_water_sports||false, has_tours:f.has_tours||false });
    n++;
  }
  console.log(`   ${n} filter records`);

  // ── 13. BUSINESS LOGISTICS ───────────────────────────────────
  console.log('13. Business logistics...');
  const logistics = await query(old, 'business_logistics');
  n = 0;
  for (const l of logistics) {
    const e = eid(l.site_id); if (!e) continue;
    await gcr.from('business_logistics').upsert({ site_id:e, parking_type:safe(l.parking_type), parking_notes:safe(l.parking_notes), wheelchair_accessible:l.wheelchair_accessible||false, stroller_friendly:l.stroller_friendly||false, waterfront_access:l.waterfront_access||false, boat_accessible:l.boat_accessible||false, dock_available:l.dock_available||false, reservations:safe(l.reservations), reservation_url:safe(l.reservation_url), reservation_phone:safe(l.reservation_phone), directions_note:safe(l.directions_note), landmark:safe(l.landmark), uber_friendly:l.uber_friendly||false, golf_cart_parking:l.golf_cart_parking||false, distance_from_beach:safe(l.distance_from_beach), distance_from_wharf:safe(l.distance_from_wharf) });
    n++;
  }
  console.log(`   ${n} logistics records`);

  // ── 14. BUSINESS HIGHLIGHTS ──────────────────────────────────
  console.log('14. Business highlights...');
  const highlights = await query(old, 'business_highlights');
  n = 0;
  for (const h of highlights) {
    const e = eid(h.site_id); if (!e) continue;
    await gcr.from('business_highlights').upsert({ site_id:e, headline:safe(h.headline), bullets:h.bullets||[], local_tip:safe(h.local_tip), avoid_tip:safe(h.avoid_tip), best_time:safe(h.best_time), signature_item:safe(h.signature_item), fun_fact:safe(h.fun_fact), deal_alert:safe(h.deal_alert) });
    n++;
  }
  console.log(`   ${n} highlights`);

  // ── 15. BUSINESS ATTRIBUTES ──────────────────────────────────
  console.log('15. Business attributes...');
  const attrs = await query(old, 'business_attributes');
  n = 0;
  for (const a of attrs) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('business_attributes').upsert({ site_id:e, dietary_options:a.dietary_options||[], atmosphere:a.atmosphere||[], parking:safe(a.parking), dress_code:safe(a.dress_code), reservations_required:a.reservations_required||false, walk_ins_welcome:a.walk_ins_welcome||false, cash_only:a.cash_only||false, wifi:a.wifi||false, best_for:a.best_for||[], noise_level:safe(a.noise_level), age_range:safe(a.age_range), service_style:safe(a.service_style), avg_check_per_person:safe(a.avg_check_per_person) });
    n++;
  }
  console.log(`   ${n} attributes`);

  // ── 16. AMENITIES ────────────────────────────────────────────
  console.log('16. Amenities...');
  const amenities = await query(old, 'amenities');
  n = 0;
  for (const a of amenities) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('amenities').upsert({ site_id:e, pool:a.pool||false, pools_count:a.pools_count||null, indoor_pool:a.indoor_pool||false, heated_pool:a.heated_pool||false, lazy_river:a.lazy_river||false, waterslide:a.waterslide||false, hot_tub:a.hot_tub||false, beachfront:a.beachfront||false, beach_access:a.beach_access||false, private_beach:a.private_beach||false, beach_chairs:a.beach_chairs||false, restaurant:a.restaurant||false, bar:a.bar||false, room_service:a.room_service||false, gym:a.gym||false, spa:a.spa||false, sauna:a.sauna||false, concierge:a.concierge||false, kids_club:a.kids_club||false, playground:a.playground||false, wifi:a.wifi||false, wifi_free:a.wifi_free||false, parking:a.parking||false, parking_free:a.parking_free||false, valet:a.valet||false, pet_friendly:a.pet_friendly||false, golf_course:a.golf_course||false, tennis_courts:a.tennis_courts||false, marina:a.marina||false, boat_rentals:a.boat_rentals||false });
    n++;
  }
  console.log(`   ${n} amenity records`);

  // ── 17. ACCOMMODATION DETAILS ────────────────────────────────
  console.log('17. Accommodation details...');
  const accom = await query(old, 'accommodation_details');
  n = 0;
  for (const a of accom) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('accommodation_details').upsert({ site_id:e, star_rating:a.star_rating||null, total_rooms:a.total_rooms||null, floors:a.floors||null, year_built:a.year_built||null, year_renovated:a.year_renovated||null, beachfront:a.beachfront||false, pools:a.pools||null, indoor_pool:a.indoor_pool||false, heated_pool:a.heated_pool||false, lazy_river:a.lazy_river||false, waterslide:a.waterslide||false, restaurant_on_site:a.restaurant_on_site||false, bar_on_site:a.bar_on_site||false, gym:a.gym||false, spa:a.spa||false, resort_fee:a.resort_fee||null, resort_fee_includes:a.resort_fee_includes||[], parking_fee:safe(a.parking_fee), pet_fee:safe(a.pet_fee), check_in_time:safe(a.check_in_time), check_out_time:safe(a.check_out_time), min_age_to_book:a.min_age_to_book||null, pets_allowed:a.pets_allowed||false, pet_size_limit:safe(a.pet_size_limit), smoking_policy:safe(a.smoking_policy) });
    n++;
  }
  console.log(`   ${n} accommodation details`);

  // ── 18. ACTIVITY DETAILS ─────────────────────────────────────
  console.log('18. Activity details...');
  const actDets = await query(old, 'activity_details');
  n = 0;
  for (const a of actDets) {
    const e = eid(a.site_id); if (!e) continue;
    await gcr.from('activity_details').upsert({ site_id:e, activity_type:safe(a.activity_type), difficulty:safe(a.difficulty), min_age:a.min_age||null, max_age:a.max_age||null, min_weight_lbs:a.min_weight_lbs||null, max_weight_lbs:a.max_weight_lbs||null, swimming_required:a.swimming_required||false, experience_required:a.experience_required||false, experience_note:safe(a.experience_note), duration_hours:a.duration_hours||null, departure_location:safe(a.departure_location), departure_lat:a.departure_lat||null, departure_lng:a.departure_lng||null, what_to_bring:a.what_to_bring||[], what_is_provided:a.what_is_provided||[], fish_species:a.fish_species||[], fishing_type:safe(a.fishing_type), trip_types:a.trip_types||[], advance_booking_required:safe(a.advance_booking_required), cancellation_policy:safe(a.cancellation_policy), deposit_required:a.deposit_required||false, deposit_amount:a.deposit_amount||null });
    n++;
  }
  console.log(`   ${n} activity details`);

  // ── 19. ARTISTS ──────────────────────────────────────────────
  console.log('19. Artists...');
  const artists = await query(old, 'artists');
  n = 0;
  const artistMap = {};
  for (const a of artists) {
    const e = a.site_id ? eid(a.site_id) : null;
    const { data: ins } = await gcr.from('artists').insert({ entity_id:e||null, name:a.name, slug:safe(a.slug), genre:safe(a.genre), bio:safe(a.bio), photo_url:safe(a.photo_url), cover_url:safe(a.cover_url), website:safe(a.website), booking_email:safe(a.booking_email), booking_phone:safe(a.booking_phone), social:a.social||{}, tags:a.tags||[], gcr_listed:a.gcr_listed!==false, featured:a.featured||false, home_venue:safe(a.home_venue), sort_order:a.sort_order||0 }).select('id').single();
    if (ins?.id) { artistMap[a.id] = ins.id; n++; }
  }
  console.log(`   ${n} artists`);

  // ── 20. ARTIST SHOWS ─────────────────────────────────────────
  console.log('20. Artist shows...');
  const shows = await query(old, 'artist_shows');
  n = 0;
  for (const s of shows) {
    const newArtistId = artistMap[s.artist_id];
    const e = s.site_id ? eid(s.site_id) : null;
    if (!newArtistId) continue;
    await gcr.from('artist_shows').insert({ artist_id:newArtistId, entity_id:e||null, venue_name:safe(s.venue_name), venue_city:safe(s.venue_city), show_date:safe(s.show_date), start_time:safe(s.start_time), end_time:safe(s.end_time), show_type:safe(s.show_type), cover:safe(s.cover), ticket_url:safe(s.ticket_url), notes:safe(s.notes), active:s.active!==false });
    n++;
  }
  console.log(`   ${n} artist shows`);

  // ── 21. AREA GUIDES ──────────────────────────────────────────
  console.log('21. Area guides...');
  const areas = await query(old, 'area_guides');
  n = 0;
  for (const a of areas) {
    await gcr.from('area_guides').insert({ name:a.name, area:safe(a.area), slug:safe(a.slug), short_desc:safe(a.short_desc), full_desc:safe(a.full_desc), highlights:a.highlights||[], best_for:a.best_for||[], parking_note:safe(a.parking_note), walkable:a.walkable||false, drive_from_beach:safe(a.drive_from_beach), tip:safe(a.tip), image_url:safe(a.image_url), lat:a.lat||null, lng:a.lng||null, active:a.active!==false });
    n++;
  }
  console.log(`   ${n} area guides`);

  // ── 22. AREA KNOWLEDGE ───────────────────────────────────────
  console.log('22. Area knowledge...');
  const knowledge = await query(old, 'area_knowledge');
  n = 0;
  for (const a of knowledge) {
    await gcr.from('area_knowledge').insert({ name:a.name, description:safe(a.description), vibe:safe(a.vibe), best_for:a.best_for||[], avoid_if:a.avoid_if||[], distance_from_airport:safe(a.distance_from_airport), insider_note:safe(a.insider_note) });
    n++;
  }
  console.log(`   ${n} area knowledge`);

  // ── 23. BEACHES ──────────────────────────────────────────────
  console.log('23. Beaches...');
  const beaches = await query(old, 'beaches');
  n = 0;
  for (const b of beaches) {
    await gcr.from('beaches').insert({ name:b.name, area:safe(b.area), crowd_level:safe(b.crowd_level), best_for:b.best_for||[], facilities:b.facilities||[], parking:safe(b.parking), parking_fee:safe(b.parking_fee), dog_friendly:b.dog_friendly||false, alcohol_allowed:b.alcohol_allowed||false, lifeguard:b.lifeguard||false, flag_system:b.flag_system||false, insider_tip:safe(b.insider_tip), lat:b.lat||null, lng:b.lng||null });
    n++;
  }
  console.log(`   ${n} beaches`);

  // ── 24. AI VOICE SCRIPTS ─────────────────────────────────────
  console.log('24. AI voice scripts...');
  const scripts = await query(old, 'ai_voice_scripts');
  n = 0;
  for (const s of scripts) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('ai_voice_scripts').upsert({ site_id:e, short_answer:safe(s.short_answer), medium_answer:safe(s.medium_answer), full_answer:safe(s.full_answer), how_to_get_there:safe(s.how_to_get_there), what_to_order:safe(s.what_to_order), reservation_script:safe(s.reservation_script), hours_script:safe(s.hours_script), price_script:safe(s.price_script), kids_script:safe(s.kids_script), pets_script:safe(s.pets_script) });
    n++;
  }
  console.log(`   ${n} AI voice scripts`);

  // ── 25. BUSINESS MEDIA ───────────────────────────────────────
  console.log('25. Business media...');
  const bizMedia = await query(old, 'business_media');
  n = 0;
  for (const m of bizMedia) {
    const e = eid(m.site_id); if (!e) continue;
    await gcr.from('business_media').insert({ entity_id:e, url:m.url, caption:safe(m.caption), section:safe(m.section), sort_order:m.sort_order||0 });
    n++;
  }
  console.log(`   ${n} business media`);

  // ── 26. CUSTOMERS ────────────────────────────────────────────
  console.log('26. Customers...');
  const customers = await query(old, 'customers');
  n = 0;
  for (const c of customers) {
    const e = eid(c.site_id); if (!e) continue;
    await gcr.from('customers').insert({ entity_id:e, name:safe(c.name), phone:safe(c.phone), email:safe(c.email), notes:safe(c.notes), tier:c.tier||'standard', total_orders:c.total_orders||0, total_bookings:c.total_bookings||0, total_spent:c.total_spent||0, last_visit:safe(c.last_visit), tags:c.tags||[], created_at:c.created_at });
    n++;
  }
  console.log(`   ${n} customers`);

  // ── 27. COUPONS ──────────────────────────────────────────────
  console.log('27. Coupons...');
  const coupons = await query(old, 'coupons');
  n = 0;
  for (const c of coupons) {
    const e = eid(c.site_id); if (!e) continue;
    await gcr.from('coupons').insert({ entity_id:e, code:c.code, type:safe(c.type), amount:c.amount||0, min_order:c.min_order||0, max_uses:c.max_uses||null, uses_count:c.uses_count||0, expires_at:safe(c.expires_at), description:safe(c.description), active:c.active!==false });
    n++;
  }
  console.log(`   ${n} coupons`);

  // ── 28. LOCATIONS ────────────────────────────────────────────
  console.log('28. Locations...');
  const locations = await query(old, 'locations');
  n = 0;
  for (const l of locations) {
    const e = eid(l.site_id); if (!e) continue;
    await gcr.from('locations').insert({ entity_id:e, name:safe(l.name), address:safe(l.address), city:safe(l.city), state:safe(l.state), zip:safe(l.zip), lat:l.lat||null, lng:l.lng||null, phone:safe(l.phone), notes:safe(l.notes), is_primary:l.is_primary||false, active:l.active!==false, sort_order:l.sort_order||0 });
    n++;
  }
  console.log(`   ${n} locations`);

  // ── 29. STAFF ────────────────────────────────────────────────
  console.log('29. Staff...');
  const staff = await query(old, 'staff');
  n = 0;
  for (const s of staff) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('staff').insert({ entity_id:e, name:s.name, role:safe(s.role), bio:safe(s.bio), photo_url:safe(s.photo_url), phone:safe(s.phone), email:safe(s.email), active:s.active!==false });
    n++;
  }
  console.log(`   ${n} staff`);

  // ── 30. PACKAGES ─────────────────────────────────────────────
  console.log('30. Packages...');
  const packages = await query(old, 'packages');
  n = 0;
  for (const p of packages) {
    const e = eid(p.site_id); if (!e) continue;
    await gcr.from('packages').insert({ entity_id:e, name:p.name, description:safe(p.description), price:p.price||null, price_label:safe(p.price_label), duration_minutes:p.duration_minutes||null, whats_included:p.whats_included||[], min_guests:p.min_guests||null, max_guests:p.max_guests||null, booking_url:safe(p.booking_url), advance_hours:p.advance_hours||0, active:p.active!==false, sort_order:p.sort_order||0 });
    n++;
  }
  console.log(`   ${n} packages`);

  // ── 31. ROOM TYPES ───────────────────────────────────────────
  console.log('31. Room types...');
  const rooms = await query(old, 'room_types');
  n = 0;
  for (const r of rooms) {
    const e = eid(r.site_id); if (!e) continue;
    await gcr.from('room_types').insert({ entity_id:e, name:r.name, description:safe(r.description), price_per_night:r.price_per_night||null, price_weekend:r.price_weekend||null, price_peak:r.price_peak||null, max_guests:r.max_guests||null, beds:safe(r.beds), sqft:r.sqft||null, floor:safe(r.floor), view:safe(r.view), amenities:r.amenities||[], image_url:safe(r.image_url), booking_url:safe(r.booking_url), active:r.active!==false, sort_order:r.sort_order||0 });
    n++;
  }
  console.log(`   ${n} room types`);

  // ── 32. QA PAIRS ─────────────────────────────────────────────
  console.log('32. QA pairs...');
  const qaPairs = await query(old, 'qa_pairs');
  n = 0;
  for (const q of qaPairs) {
    const e = eid(q.site_id); if (!e) continue;
    await gcr.from('qa_pairs').insert({ entity_id:e, question:q.question, answer:safe(q.answer), category:safe(q.category), confidence:q.confidence||1.0, active:q.active!==false });
    n++;
  }
  console.log(`   ${n} QA pairs`);

  // ── 33. REVIEW QUESTIONS ─────────────────────────────────────
  console.log('33. Review questions...');
  const reviewQs = await query(old, 'review_questions');
  n = 0;
  const reviewQMap = {};
  for (const q of reviewQs) {
    const e = eid(q.site_id); if (!e) continue;
    const { data: ins } = await gcr.from('review_questions').insert({ entity_id:e, question_text:q.question_text, question_type:q.question_type||'stars', display_order:q.display_order||0, enabled:q.enabled!==false }).select('id').single();
    if (ins?.id) reviewQMap[q.id] = ins.id;
    n++;
  }
  console.log(`   ${n} review questions`);

  // ── 34. NOTIFICATIONS ────────────────────────────────────────
  console.log('34. Notifications...');
  const notifs = await query(old, 'notifications');
  n = 0;
  for (const no of notifs) {
    const e = eid(no.site_id); if (!e) continue;
    await gcr.from('notifications').insert({ entity_id:e, type:safe(no.type), title:safe(no.title), body:safe(no.body), metadata:no.metadata||{}, read:no.read||false, created_at:no.created_at });
    n++;
  }
  console.log(`   ${n} notifications`);

  // ── 35. SMS LOG ──────────────────────────────────────────────
  console.log('35. SMS log...');
  const smsLog = await query(old, 'sms_log');
  n = 0;
  for (const s of smsLog) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('sms_log').insert({ entity_id:e, to_phone:safe(s.to_phone), message:safe(s.message), type:safe(s.type), status:s.status||'sent', metadata:s.metadata||{}, created_at:s.created_at });
    n++;
  }
  console.log(`   ${n} SMS log entries`);

  // ── 36. SMS CAMPAIGNS ────────────────────────────────────────
  console.log('36. SMS campaigns...');
  const smsCampaigns = await query(old, 'sms_campaigns');
  n = 0;
  for (const s of smsCampaigns) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('sms_campaigns').insert({ entity_id:e, audience:safe(s.audience), message:safe(s.message), coupon_code:safe(s.coupon_code), recipient_count:s.recipient_count||0, sent_count:s.sent_count||0, failed_count:s.failed_count||0, status:s.status||'draft', created_at:s.created_at });
    n++;
  }
  console.log(`   ${n} SMS campaigns`);

  // ── 37. MESSAGING SETTINGS ───────────────────────────────────
  console.log('37. Messaging settings...');
  const msgSettings = await query(old, 'messaging_settings');
  n = 0;
  for (const m of msgSettings) {
    const e = eid(m.site_id); if (!e) continue;
    await gcr.from('messaging_settings').upsert({ entity_id:e, owner_phone:safe(m.owner_phone), customer_phone:safe(m.customer_phone), notification_phone:safe(m.notification_phone), customer_booking_template:safe(m.customer_booking_template), owner_booking_template:safe(m.owner_booking_template), photo_gallery_enabled:m.photo_gallery_enabled||false, voice_ai_enabled:m.voice_ai_enabled||false, voice_greeting:safe(m.voice_greeting), notify_customer_on_booking:m.notify_customer_on_booking!==false, notify_owner_on_booking:m.notify_owner_on_booking!==false, notification_email:safe(m.notification_email) });
    n++;
  }
  console.log(`   ${n} messaging settings`);

  // ── 38. SOCIAL MEDIA ACCOUNTS ────────────────────────────────
  console.log('38. Social media accounts...');
  const socialAccts = await query(old, 'social_media_accounts');
  n = 0;
  for (const s of socialAccts) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('social_media_accounts').upsert({ entity_id:e, platform:s.platform, account_name:safe(s.account_name), account_id:safe(s.account_id), account_url:safe(s.account_url), access_token:safe(s.access_token), refresh_token:safe(s.refresh_token), token_expires_at:safe(s.token_expires_at), page_id:safe(s.page_id), page_access_token:safe(s.page_access_token), is_connected:s.is_connected||false, last_sync_at:safe(s.last_sync_at), metadata:s.metadata||{} }, { onConflict:'entity_id,platform' });
    n++;
  }
  console.log(`   ${n} social media accounts`);

  // ── 39. SOCIAL MEDIA POSTS ───────────────────────────────────
  console.log('39. Social media posts...');
  const socialPosts = await query(old, 'social_media_posts');
  n = 0;
  for (const s of socialPosts) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('social_media_posts').insert({ entity_id:e, post_text:safe(s.post_text), media_urls:s.media_urls||[], platforms:s.platforms||[], status:s.status||'draft', scheduled_for:safe(s.scheduled_for), published_at:safe(s.published_at), post_ids:s.post_ids||{}, engagement_stats:s.engagement_stats||{}, created_at:s.created_at });
    n++;
  }
  console.log(`   ${n} social media posts`);

  // ── 40. PAGE VIEWS ───────────────────────────────────────────
  console.log('40. Page views...');
  const pageViews = await query(old, 'page_views');
  n = 0;
  for (const p of pageViews) {
    const e = eid(p.site_id); if (!e) continue;
    await gcr.from('page_views').insert({ entity_id:e, page_path:safe(p.page_path), page_title:safe(p.page_title), referrer:safe(p.referrer), utm_source:safe(p.utm_source), utm_medium:safe(p.utm_medium), utm_campaign:safe(p.utm_campaign), device_type:safe(p.device_type), browser:safe(p.browser), country:safe(p.country), city:safe(p.city), session_id:safe(p.session_id), duration_seconds:p.duration_seconds||null, created_at:p.created_at });
    n++;
  }
  console.log(`   ${n} page views`);

  // ── 41. HIDDEN GEMS ──────────────────────────────────────────
  console.log('41. Hidden gems...');
  const gems = await query(old, 'hidden_gems');
  n = 0;
  for (const g of gems) {
    const e = eid(g.site_id); if (!e) continue;
    await gcr.from('hidden_gems').insert({ entity_id:e, why_hidden:safe(g.why_hidden), how_to_find:safe(g.how_to_find), best_kept_secret:safe(g.best_kept_secret), verified_local:g.verified_local||false });
    n++;
  }
  console.log(`   ${n} hidden gems`);

  // ── 42. HOURS EXCEPTIONS ─────────────────────────────────────
  console.log('42. Hours exceptions...');
  const hoursExc = await query(old, 'hours_exceptions');
  n = 0;
  for (const h of hoursExc) {
    const e = eid(h.site_id); if (!e) continue;
    await gcr.from('hours_exceptions').insert({ entity_id:e, date:safe(h.date), closed:h.closed||false, open_time:safe(h.open_time), close_time:safe(h.close_time), note:safe(h.note) });
    n++;
  }
  console.log(`   ${n} hours exceptions`);

  // ── 43. SEASONAL INFO ────────────────────────────────────────
  console.log('43. Seasonal info...');
  const seasonal = await query(old, 'seasonal_info');
  n = 0;
  for (const s of seasonal) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('seasonal_info').insert({ entity_id:e, season:safe(s.season), note:safe(s.note), best_months:s.best_months||[], crowd_level:safe(s.crowd_level), price_level:safe(s.price_level), special_hours:safe(s.special_hours) });
    n++;
  }
  console.log(`   ${n} seasonal info`);

  // ── 44. SEO KEYWORDS ─────────────────────────────────────────
  console.log('44. SEO keywords...');
  const seoKw = await query(old, 'seo_keywords');
  n = 0;
  for (const s of seoKw) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('seo_keywords').insert({ entity_id:e, keyword:safe(s.keyword), search_volume:s.search_volume||null, difficulty_score:s.difficulty_score||null, current_ranking:s.current_ranking||null, target_url:safe(s.target_url), ranking_history:s.ranking_history||{} });
    n++;
  }
  console.log(`   ${n} SEO keywords`);

  // ── 45. SEO META TAGS ────────────────────────────────────────
  console.log('45. SEO meta tags...');
  const seoMeta = await query(old, 'seo_meta_tags');
  n = 0;
  for (const s of seoMeta) {
    const e = eid(s.site_id); if (!e) continue;
    await gcr.from('seo_meta_tags').insert({ entity_id:e, page_slug:safe(s.page_slug), page_title:safe(s.page_title), meta_description:safe(s.meta_description), meta_keywords:safe(s.meta_keywords), og_title:safe(s.og_title), og_description:safe(s.og_description), og_image:safe(s.og_image), og_type:safe(s.og_type), canonical_url:safe(s.canonical_url), robots:safe(s.robots), schema_json:s.schema_json||{} });
    n++;
  }
  console.log(`   ${n} SEO meta tags`);

  // ── 46. SITE PAGES ───────────────────────────────────────────
  console.log('46. Site pages...');
  const sitePages = await query(old, 'site_pages');
  n = 0;
  for (const p of sitePages) {
    const e = eid(p.site_id); if (!e) continue;
    await gcr.from('site_pages').insert({ entity_id:e, slug:safe(p.slug), title:safe(p.title), html_content:safe(p.html_content), page_type:safe(p.page_type), visible:p.visible!==false, sort_order:p.sort_order||0 });
    n++;
  }
  console.log(`   ${n} site pages`);

  // ── 47. MENU CATEGORIES ──────────────────────────────────────
  console.log('47. Menu categories...');
  const menuCats = await query(old, 'menu_categories');
  n = 0;
  const menuCatMap = {};
  for (const c of menuCats) {
    const e = eid(c.site_id); if (!e) continue;
    const { data: ins } = await gcr.from('menu_categories').insert({ entity_id:e, name:c.name, description:safe(c.description), time_start:safe(c.time_start), time_end:safe(c.time_end), image_url:safe(c.image_url), sort_order:c.sort_order||0, active:c.active!==false }).select('id').single();
    if (ins?.id) menuCatMap[c.id] = ins.id;
    n++;
  }
  console.log(`   ${n} menu categories`);

  // ── 48. MENU SUBCATEGORIES ───────────────────────────────────
  console.log('48. Menu subcategories...');
  const menuSubCats = await query(old, 'menu_subcategories');
  n = 0;
  for (const s of menuSubCats) {
    const e = eid(s.site_id); if (!e) continue;
    const newCatId = menuCatMap[s.category_id];
    await gcr.from('menu_subcategories').insert({ entity_id:e, category_id:newCatId||null, name:s.name, description:safe(s.description), sort_order:s.sort_order||0, active:s.active!==false });
    n++;
  }
  console.log(`   ${n} menu subcategories`);

  // ── 49. MENU DETAILS ─────────────────────────────────────────
  console.log('49. Menu details...');
  const menuDetails = await query(old, 'menu_details');
  n = 0;
  for (const m of menuDetails) {
    const e = eid(m.site_id); if (!e) continue;
    await gcr.from('menu_details').upsert({ entity_id:e, cuisine_types:m.cuisine_types||[], cooking_styles:m.cooking_styles||[], sourcing_note:safe(m.sourcing_note), vegetarian_options:m.vegetarian_options||false, vegan_options:m.vegan_options||false, gluten_free_options:m.gluten_free_options||false, gluten_free_menu:m.gluten_free_menu||false, dairy_free_options:m.dairy_free_options||false, nut_allergy_friendly:m.nut_allergy_friendly||false, kids_menu:m.kids_menu||false, kids_eat_free:safe(m.kids_eat_free), full_bar:m.full_bar||false, craft_beer:m.craft_beer||false, local_beer:m.local_beer||false, wine_list:m.wine_list||false, signature_cocktails:m.signature_cocktails||false, byob:m.byob||false, corkage_fee:safe(m.corkage_fee), happy_hour:m.happy_hour||false, happy_hour_schedule:safe(m.happy_hour_schedule), happy_hour_deals:safe(m.happy_hour_deals), service_style:safe(m.service_style), avg_check_per_person:safe(m.avg_check_per_person), takeout:m.takeout||false, delivery:m.delivery||false, delivery_apps:m.delivery_apps||[], catering:m.catering||false });
    n++;
  }
  console.log(`   ${n} menu details`);

  // ── 50. PHOTOS ───────────────────────────────────────────────
  console.log('50. Photos...');
  const photos = await query(old, 'photos');
  n = 0;
  for (const p of photos) {
    const e = eid(p.site_id); if (!e) continue;
    await gcr.from('photos').insert({ entity_id:e, url:safe(p.url), caption:safe(p.caption), category:safe(p.category), featured:p.featured||false, sort_order:p.sort_order||0, uploaded_by:safe(p.uploaded_by) });
    n++;
  }
  console.log(`   ${n} photos`);

  // ── 51. PRICE GUIDE ──────────────────────────────────────────
  console.log('51. Price guide...');
  const priceGuide = await query(old, 'price_guide');
  n = 0;
  for (const p of priceGuide) {
    const e = eid(p.site_id); if (!e) continue;
    await gcr.from('price_guide').insert({ entity_id:e, item_name:safe(p.item_name), price:p.price||null, price_label:safe(p.price_label), category:safe(p.category), note:safe(p.note), active:p.active!==false });
    n++;
  }
  console.log(`   ${n} price guide items`);

  // ── 52. MONEY SAVING TIPS ────────────────────────────────────
  console.log('52. Money saving tips...');
  const moneyTips = await query(old, 'money_saving_tips');
  n = 0;
  for (const m of moneyTips) {
    const e = m.site_id ? eid(m.site_id) : null;
    await gcr.from('money_saving_tips').insert({ entity_id:e||null, area:safe(m.area), tip:safe(m.tip), saves_amount:safe(m.saves_amount), valid_days:m.valid_days||[], valid_times:safe(m.valid_times), active:m.active!==false });
    n++;
  }
  console.log(`   ${n} money saving tips`);

  // ── 53. LOCAL TIPS ───────────────────────────────────────────
  console.log('53. Local tips...');
  const localTips = await query(old, 'local_tips');
  n = 0;
  for (const t of localTips) {
    await gcr.from('local_tips').insert({ category:safe(t.category), tip:safe(t.tip), source:safe(t.source), area:safe(t.area), seasonal:t.seasonal||false, season:safe(t.season), active:t.active!==false, upvotes:t.upvotes||0 });
    n++;
  }
  console.log(`   ${n} local tips`);

  // ── 54. NEIGHBORHOODS ────────────────────────────────────────
  console.log('54. Neighborhoods...');
  const hoods = await query(old, 'neighborhoods');
  n = 0;
  for (const h of hoods) {
    await gcr.from('neighborhoods').insert({ name:safe(h.name), area:safe(h.area), description:safe(h.description), walkable:h.walkable||false, best_for:h.best_for||[], parking_note:safe(h.parking_note), lat:h.lat||null, lng:h.lng||null, radius_miles:h.radius_miles||null });
    n++;
  }
  console.log(`   ${n} neighborhoods`);

  // ── 55. LIVE CONDITIONS ──────────────────────────────────────
  console.log('55. Live conditions...');
  const conditions = await query(old, 'live_conditions');
  n = 0;
  for (const c of conditions) {
    await gcr.from('live_conditions').insert({ area:safe(c.area), crowd_level:safe(c.crowd_level), traffic_note:safe(c.traffic_note), weather_advisory:safe(c.weather_advisory), beach_flag:safe(c.beach_flag), water_temp_f:c.water_temp_f||null, wave_height:safe(c.wave_height), jellyfish_warning:c.jellyfish_warning||false, special_note:safe(c.special_note) });
    n++;
  }
  console.log(`   ${n} live conditions`);

  // ── 56. EMERGENCY INFO ───────────────────────────────────────
  console.log('56. Emergency info...');
  const emergency = await query(old, 'emergency_info');
  n = 0;
  for (const e of emergency) {
    await gcr.from('emergency_info').insert({ category:safe(e.category), name:safe(e.name), address:safe(e.address), phone:safe(e.phone), hours:safe(e.hours), distance_note:safe(e.distance_note), lat:e.lat||null, lng:e.lng||null });
    n++;
  }
  console.log(`   ${n} emergency info`);

  // ── 57. TRANSPORTATION ───────────────────────────────────────
  console.log('57. Transportation...');
  const transport = await query(old, 'transportation');
  n = 0;
  for (const t of transport) {
    await gcr.from('transportation').insert({ type:safe(t.type), name:safe(t.name), description:safe(t.description), coverage_area:safe(t.coverage_area), price_estimate:safe(t.price_estimate), contact:safe(t.contact), website:safe(t.website), tip:safe(t.tip), active:t.active!==false });
    n++;
  }
  console.log(`   ${n} transportation`);

  // ── 58. GROCERY AND SUPPLIES ─────────────────────────────────
  console.log('58. Grocery and supplies...');
  const grocery = await query(old, 'grocery_and_supplies');
  n = 0;
  for (const g of grocery) {
    await gcr.from('grocery_and_supplies').insert({ name:safe(g.name), type:safe(g.type), area:safe(g.area), address:safe(g.address), hours:safe(g.hours), note:safe(g.note), lat:g.lat||null, lng:g.lng||null });
    n++;
  }
  console.log(`   ${n} grocery and supplies`);

  // ── 59. LEADS ────────────────────────────────────────────────
  console.log('59. Leads...');
  const leads = await query(old, 'leads');
  n = 0;
  for (const l of leads) {
    await gcr.from('leads').insert({ name:safe(l.name), business_name:safe(l.business_name), email:safe(l.email), phone:safe(l.phone), business_type:safe(l.business_type), interest:safe(l.interest), source:safe(l.source), status:l.status||'new', notes:safe(l.notes), created_at:l.created_at });
    n++;
  }
  console.log(`   ${n} leads`);

  // ── 60. GCR CLAIMS ───────────────────────────────────────────
  console.log('60. GCR claims...');
  const claims = await query(old, 'gcr_claims');
  n = 0;
  for (const c of claims) {
    const e = c.site_id ? eid(c.site_id) : null;
    await gcr.from('gcr_claims').insert({ entity_id:e||null, business_name:safe(c.business_name), claimant_name:safe(c.claimant_name), claimant_email:safe(c.claimant_email), claimant_phone:safe(c.claimant_phone), business_role:safe(c.business_role), notes:safe(c.notes), claim_type:safe(c.claim_type), status:c.status||'pending', admin_notes:safe(c.admin_notes), created_at:c.created_at });
    n++;
  }
  console.log(`   ${n} GCR claims`);

  // ── 61. GCR FEED POSTS ───────────────────────────────────────
  console.log('61. GCR feed posts...');
  const feedPosts = await query(old, 'gcr_feed_posts');
  n = 0;
  for (const p of feedPosts) {
    const e = p.site_id ? eid(p.site_id) : null;
    await gcr.from('gcr_feed_posts').insert({ entity_id:e||null, type:safe(p.type), text:safe(p.text), image_url:safe(p.image_url), link_url:safe(p.link_url), link_text:safe(p.link_text), emoji:safe(p.emoji), pinned:p.pinned||false, active:p.active!==false, expires_at:safe(p.expires_at), business_name:safe(p.business_name), business_logo:safe(p.business_logo), created_at:p.created_at });
    n++;
  }
  console.log(`   ${n} feed posts`);

  // ── 62. TOURISTS ─────────────────────────────────────────────
  console.log('62. Tourists...');
  const tourists = await query(old, 'tourists');
  n = 0;
  const touristMap = {};
  for (const t of tourists) {
    const { data: ins } = await gcr.from('tourists').upsert({ phone:safe(t.phone), first_name:safe(t.first_name), last_name:safe(t.last_name), email:safe(t.email), arrival_date:safe(t.arrival_date), checkout_date:safe(t.checkout_date), trip_active:t.trip_active!==false, hotel_name:safe(t.hotel_name), hotel_area:safe(t.hotel_area), signup_source:safe(t.signup_source), agent_active:t.agent_active!==false, last_active_at:safe(t.last_active_at), total_conversations:t.total_conversations||0, created_at:t.created_at }, { onConflict:'phone' }).select('id').single();
    if (ins?.id) { touristMap[t.id] = ins.id; n++; }
  }
  console.log(`   ${n} tourists`);

  // ── 63. TOURIST MEMORY ───────────────────────────────────────
  console.log('63. Tourist memory...');
  const touristMem = await query(old, 'tourist_memory');
  n = 0;
  for (const m of touristMem) {
    const newTId = touristMap[m.tourist_id]; if (!newTId) continue;
    await gcr.from('tourist_memory').upsert({ tourist_id:newTId, party_size:m.party_size||null, adults:m.adults||null, children:m.children||null, children_ages:m.children_ages||[], has_pets:m.has_pets||false, pet_details:safe(m.pet_details), budget_level:safe(m.budget_level), daily_spend_estimate:m.daily_spend_estimate||null, dietary_restrictions:m.dietary_restrictions||[], food_preferences:m.food_preferences||[], food_dislikes:m.food_dislikes||[], drinks_alcohol:m.drinks_alcohol!==false, primary_interests:m.primary_interests||[], activity_level:safe(m.activity_level), mobility_needs:safe(m.mobility_needs), wheelchair:m.wheelchair||false, stroller:m.stroller||false, prefers_outdoor:m.prefers_outdoor||false, prefers_waterfront:m.prefers_waterfront||false, prefers_quiet:m.prefers_quiet||false, prefers_lively:m.prefers_lively||false, loved_vibes:m.loved_vibes||[], hated_vibes:m.hated_vibes||[], has_car:m.has_car!==false, car_count:m.car_count||1, uses_rideshare:m.uses_rideshare||false, max_drive_minutes:m.max_drive_minutes||20 });
    n++;
  }
  console.log(`   ${n} tourist memories`);

  // ── 64. TOURIST PREFERENCES ──────────────────────────────────
  console.log('64. Tourist preferences...');
  const touristPrefs = await query(old, 'tourist_preferences');
  n = 0;
  for (const p of touristPrefs) {
    const newTId = touristMap[p.tourist_id]; if (!newTId) continue;
    await gcr.from('tourist_preferences').upsert({ tourist_id:newTId, dietary:p.dietary||[], budget:safe(p.budget), party_size:p.party_size||null, has_kids:p.has_kids||false, kids_ages:p.kids_ages||[], has_pets:p.has_pets||false, interests:p.interests||[], max_drive_minutes:p.max_drive_minutes||20, wants_outdoor:p.wants_outdoor||false, wants_waterfront:p.wants_waterfront||false, wants_live_music:p.wants_live_music||false, wants_quiet:p.wants_quiet||false });
    n++;
  }
  console.log(`   ${n} tourist preferences`);

  // ── 65. TOURIST SAVED PLACES ─────────────────────────────────
  console.log('65. Tourist saved places...');
  const savedPlaces = await query(old, 'tourist_saved_places');
  n = 0;
  for (const p of savedPlaces) {
    const newTId = touristMap[p.tourist_id]; if (!newTId) continue;
    const e = p.site_id ? eid(p.site_id) : null; if (!e) continue;
    await gcr.from('tourist_saved_places').insert({ tourist_id:newTId, entity_id:e, saved_reason:safe(p.saved_reason), priority:p.priority||'normal', planned_for_date:safe(p.planned_for_date), planned_for_time:safe(p.planned_for_time), notes:safe(p.notes), visited:p.visited||false });
    n++;
  }
  console.log(`   ${n} saved places`);

  // ── 66. TOURIST VISITS ───────────────────────────────────────
  console.log('66. Tourist visits...');
  const visits = await query(old, 'tourist_visits');
  n = 0;
  for (const v of visits) {
    const newTId = touristMap[v.tourist_id]; if (!newTId) continue;
    const e = v.site_id ? eid(v.site_id) : null;
    await gcr.from('tourist_visits').insert({ tourist_id:newTId, entity_id:e||null, visit_date:safe(v.visit_date), meal_type:safe(v.meal_type), rating:v.rating||null, liked:v.liked||[], disliked:v.disliked||[], would_return:v.would_return||false, recommend_to_others:v.recommend_to_others||false, tourist_quote:safe(v.tourist_quote), recommended_by:safe(v.recommended_by) });
    n++;
  }
  console.log(`   ${n} tourist visits`);

  // ── 67. LOYALTY SIGNUPS ──────────────────────────────────────
  console.log('67. Loyalty signups...');
  const loyalty = await query(old, 'loyalty_signups');
  n = 0;
  for (const l of loyalty) {
    await gcr.from('loyalty_signups').insert({ name:safe(l.name), email:safe(l.email), phone:safe(l.phone), visitor_type:safe(l.visitor_type), interests:l.interests||[], checkin:safe(l.checkin), checkout:safe(l.checkout), source:safe(l.source), sms_sent:l.sms_sent||false, created_at:l.created_at });
    n++;
  }
  console.log(`   ${n} loyalty signups`);

  // ── 68. MEDIA LIBRARY ────────────────────────────────────────
  console.log('68. Media library...');
  const mediaLib = await query(old, 'media_library');
  n = 0;
  for (const m of mediaLib) {
    const e = eid(m.site_id); if (!e) continue;
    await gcr.from('media_library').insert({ entity_id:e, url:safe(m.url), caption:safe(m.caption), type:safe(m.type), sort_order:m.sort_order||0, created_at:m.created_at });
    n++;
  }
  console.log(`   ${n} media library items`);

  // ── 69. WAITLIST ─────────────────────────────────────────────
  console.log('69. Waitlist...');
  const waitlist = await query(old, 'waitlist');
  n = 0;
  for (const w of waitlist) {
    const e = eid(w.site_id); if (!e) continue;
    await gcr.from('waitlist').insert({ entity_id:e, customer_name:safe(w.customer_name), customer_email:safe(w.customer_email), customer_phone:safe(w.customer_phone), preferred_date:safe(w.preferred_date), preferred_slot:safe(w.preferred_slot), party_size:w.party_size||1, status:w.status||'waiting', notified_at:safe(w.notified_at), notes:safe(w.notes), created_at:w.created_at });
    n++;
  }
  console.log(`   ${n} waitlist entries`);

  // ── 70. ORDERS ───────────────────────────────────────────────
  console.log('70. Orders...');
  const orders = await query(old, 'orders');
  n = 0;
  for (const o of orders) {
    const e = eid(o.site_id); if (!e) continue;
    await gcr.from('orders').insert({ entity_id:e, items:o.items||[], subtotal:o.subtotal||0, tax:o.tax||0, total:o.total||0, status:o.status||'pending', payment_id:safe(o.payment_id), payment_provider:safe(o.payment_provider), pickup_time:safe(o.pickup_time), order_type:safe(o.order_type), notes:safe(o.notes), customer_name:safe(o.customer_name), customer_phone:safe(o.customer_phone), customer_email:safe(o.customer_email), created_at:o.created_at });
    n++;
  }
  console.log(`   ${n} orders`);

  console.log('\n✅ MIGRATION PART 2 COMPLETE — Steps 10-70 done');
}

main().catch(console.error);

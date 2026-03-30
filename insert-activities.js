require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const ACTIVITIES_DIR = '/Users/owner/activities';

/* ── TripShock's own phone (NOT a business phone — skip it) ── */
const TRIPSHOCK_PHONE = '850-424-5125';

/* ── Category → GCR subcategory + tags ── */
const CATEGORY_MAP = {
  'Dolphin Cruises & Tours':             { sub: 'dolphin-cruises',   tags: ['dolphin', 'cruise', 'family', 'water'] },
  'Helicopter & Airplane Tours':         { sub: 'helicopter-tours',  tags: ['helicopter', 'aerial', 'scenic'] },
  'Jet Ski Rentals & Tours':             { sub: 'jet-ski',           tags: ['jet-ski', 'water-sports', 'thrill'] },
  'Parasailing':                         { sub: 'parasailing',       tags: ['parasail', 'water-sports', 'thrill'] },
  'Boat Rentals':                        { sub: 'boat-rentals',      tags: ['boat-rental', 'pontoon', 'water'] },
  'Boat Tours':                          { sub: 'boat-tours',        tags: ['boat-tour', 'charter', 'scenic'] },
  'Canoe, Kayak & Paddleboard Rentals':  { sub: 'kayak-paddleboard', tags: ['kayak', 'paddleboard', 'water-sports', 'nature'] },
  'Car Rentals & Transportation':        { sub: 'rentals',           tags: ['rental', 'transportation'] },
  'Fishing':                             { sub: 'fishing',           tags: ['fishing', 'charter', 'outdoor'] },
  'Water Sports':                        { sub: 'water-sports',      tags: ['water-sports', 'thrill'] },
  'Sailing':                             { sub: 'sailing',           tags: ['sailing', 'cruise', 'scenic'] },
  'Snorkeling':                          { sub: 'snorkeling',        tags: ['snorkeling', 'water', 'nature'] },
  'Nature & Wildlife Tours':             { sub: 'nature-tours',      tags: ['nature', 'wildlife', 'eco'] },
};

/* ── Price range ── */
function priceRange(p) {
  if (!p) return '';
  if (p < 50)  return '$';
  if (p < 150) return '$$';
  if (p < 300) return '$$$';
  return '$$$$';
}

/* ── Slugify with activity ID suffix for uniqueness ── */
function slugify(str, id) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 55) + '-' + id;
}

/* ── Parse address from meeting_point string ── */
function parseAddress(meetingPoint) {
  if (!meetingPoint) return { address: '', city: '', state: 'AL', zip: '' };
  const parts = meetingPoint.replace(', USA', '').split(',').map(s => s.trim());
  const address = parts[0] || '';
  const city    = parts[1] || '';
  const stateZip = parts[2] || '';
  const m = stateZip.match(/([A-Z]{2})\s*(\d{5})?/);
  return {
    address,
    city,
    state: m ? m[1] : 'AL',
    zip:   m && m[2] ? m[2] : '',
  };
}

/* ── Kids-friendly check ── */
function isFamilyFriendly(data) {
  const text = [
    ...(data.highlights || []),
    ...(data.restrictions || []),
    data.title || '',
  ].join(' ').toLowerCase();
  return text.includes('family') || text.includes('kids') ||
    text.includes('children') || text.includes('ages 4') ||
    text.includes('ages 3') || text.includes('all ages');
}

/* ── Build Q&A from restrictions ── */
function buildQnA(data) {
  const qna = [];

  if (data.duration) {
    qna.push({ q: 'How long does this activity take?', a: `Duration is approximately ${data.duration}.` });
  }
  if (data.meeting_point) {
    qna.push({ q: 'Where do we meet?', a: `Meeting point: ${data.meeting_point}` });
  }

  const seen = new Set();
  for (const r of (data.restrictions || [])) {
    const rl = r.toLowerCase();
    let q = null;
    if ((rl.includes('weight') || rl.includes('lbs')) && !seen.has('weight')) {
      q = 'Are there weight restrictions?'; seen.add('weight');
    } else if ((rl.includes('age') || rl.includes('years old')) && !seen.has('age')) {
      q = 'Are there age requirements?'; seen.add('age');
    } else if ((rl.includes('cancel') || rl.includes('reschedul')) && !seen.has('cancel')) {
      q = 'What is the cancellation policy?'; seen.add('cancel');
    } else if ((rl.includes('smoke') || rl.includes('vap')) && !seen.has('smoke')) {
      q = 'Is smoking or vaping allowed?'; seen.add('smoke');
    } else if ((rl.includes('capacity') || rl.includes('maximum')) && !seen.has('capacity')) {
      q = 'What is the maximum group size?'; seen.add('capacity');
    } else if ((rl.includes('handicap') || rl.includes('wheelchair') || rl.includes('accessible')) && !seen.has('access')) {
      q = 'Is this activity accessible?'; seen.add('access');
    } else if (rl.includes('glass') && !seen.has('glass')) {
      q = 'Can I bring glass items?'; seen.add('glass');
    } else if ((rl.includes('minimum') || rl.includes('passengers required')) && !seen.has('minimum')) {
      q = 'Is there a minimum group size?'; seen.add('minimum');
    }
    if (q) qna.push({ q, a: r });
  }

  if (data.what_to_bring && data.what_to_bring.length) {
    qna.push({ q: 'What should I bring?', a: data.what_to_bring.join('; ') });
  }

  return qna.slice(0, 10);
}

/* ── Build features (quick stats strip on profile page) ── */
function buildFeatures(data) {
  const features = [];
  if (data.duration)   features.push({ label: 'Duration', value: data.duration, icon: '⏱️' });
  if (data.price_from) features.push({ label: 'Starting From', value: `$${data.price_from} per person`, icon: '💰' });
  if (data.rating && data.review_count) {
    features.push({ label: 'Rating', value: `★ ${parseFloat(data.rating).toFixed(1)} (${data.review_count} reviews)`, icon: '⭐' });
  }
  const { city } = parseAddress(data.meeting_point);
  if (city) features.push({ label: 'Location', value: city, icon: '📍' });
  if (data.category) features.push({ label: 'Activity Type', value: data.category, icon: '🎯' });
  return features;
}

/* ── Build schedule notes for features (available times) ── */
function buildScheduleTimes(schedules) {
  if (!schedules || !schedules.length) return null;
  const times = [...new Set(schedules.map(s => s.time).filter(Boolean))];
  if (!times.length) return null;
  return times.join(' · ');
}

/* ══════════════════════════════════════════════════════ */

async function insertActivities() {
  const folders = fs.readdirSync(ACTIVITIES_DIR).filter(f =>
    fs.existsSync(path.join(ACTIVITIES_DIR, f, 'data.json'))
  );

  console.log(`\nFound ${folders.length} activity folders\n${'═'.repeat(60)}`);

  let inserted = 0, updated = 0, errors = 0;

  for (const folder of folders) {
    const dataPath = path.join(ACTIVITIES_DIR, folder, 'data.json');
    let data;
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch(e) {
      console.error(`✗ Parse fail: ${folder} — ${e.message}`);
      errors++;
      continue;
    }

    const id      = data.activity_id;
    const slug    = slugify(data.title || folder, id);
    const catInfo = CATEGORY_MAP[data.category] || { sub: 'things-to-do', tags: ['outdoor'] };
    const loc     = parseAddress(data.meeting_point);

    /* Extra tags from title */
    const t = (data.title || '').toLowerCase();
    const extraTags = [];
    ['sunset','private','dolphin','family','fishing','pontoon','tritoon',
     'sailing','snorkeling','kayak','parasail','helicopter','jet ski',
     'banana boat','golf cart','slingshot'].forEach(kw => {
      if (t.includes(kw)) extraTags.push(kw.replace(' ', '-'));
    });
    const tags = [...new Set([...catInfo.tags, ...extraTags])];

    const ratingVal   = data.rating ? parseFloat(parseFloat(data.rating).toFixed(2)) : null;
    const reviewCount = data.review_count ? parseInt(data.review_count) : 0;
    const isFeatured  = ratingVal >= 4.9 && reviewCount >= 500;

    console.log(`\n[${id}] ${data.title}`);
    console.log(`  slug: ${slug} | sub: ${catInfo.sub} | featured: ${isFeatured}`);

    /* ── 1. Upsert businesses ── */
    const { data: existing } = await sb
      .from('businesses')
      .select('site_id')
      .eq('subdomain', slug)
      .single();

    let siteId;

    const bizRow = {
      name:         data.title,
      type:         'things-to-do',
      status:       'active',
      gcr_listed:   true,
      featured:     isFeatured,
      rating:       ratingVal,
      review_count: reviewCount,
      price_range:  priceRange(data.price_from),
      tags,
      subcategory:  catInfo.sub,
      kids_friendly: isFamilyFriendly(data),
      cover_url:    data.main_image || (data.images && data.images[0]) || null,
      logo_url:     data.main_image || null,
      /* No TripShock URL, no TripShock phone */
    };

    if (existing) {
      siteId = existing.site_id;
      await sb.from('businesses').update(bizRow).eq('site_id', siteId);
      console.log(`  ↺ Updated: ${siteId}`);
      updated++;
    } else {
      const { data: biz, error } = await sb
        .from('businesses')
        .insert({ ...bizRow, subdomain: slug, plan: 'free' })
        .select()
        .single();
      if (error) {
        console.error(`  ✗ Insert error: ${error.message}`);
        errors++;
        continue;
      }
      siteId = biz.site_id;
      console.log(`  ✓ Created: ${siteId}`);
      inserted++;
    }

    /* ── 2. Upsert site_content ── */
    const gallery = (data.images || []).slice(0, 12);
    const qna     = buildQnA(data);
    const features = buildFeatures(data);

    /* Add schedule times to features if available */
    const scheduleTimes = buildScheduleTimes(data.schedules);
    if (scheduleTimes) {
      features.push({ label: 'Available Times', value: scheduleTimes, icon: '🕐' });
    }

    const { error: contentErr } = await sb.from('site_content').upsert({
      site_id:         siteId,
      /* ── Hero section ── */
      hero_text:       data.title,
      hero_subtext:    (data.description || '').substring(0, 200),
      /* ── About section ── */
      about_text:      data.description || '',
      seo_description: (data.description || data.title || '').substring(0, 160),
      /* ── Location section ── */
      address:         loc.address,
      city:            loc.city,
      state:           loc.state,
      zip:             loc.zip,
      /* ── Gallery section ── */
      gallery,
      /* ── Highlights / What's Included section ── */
      whats_included:  data.highlights || [],
      /* ── Quick stats / Features strip ── */
      features,
      /* ── Q&A section (from restrictions + details) ── */
      qna,
      /* No contact_phone — TripShock's phone is not the business's */
      /* No website_url — TripShock URL is not the business's */
    }, { onConflict: 'site_id' });

    if (contentErr) console.error(`  ✗ site_content: ${contentErr.message}`);
    else console.log(`  ✓ site_content (gallery:${gallery.length}, qna:${qna.length}, highlights:${(data.highlights||[]).length})`);

    /* ── 3. Packages from ticket_prices ── */
    const tickets = Object.entries(data.ticket_prices || {});
    if (tickets.length) {
      await sb.from('menu_items').delete().eq('site_id', siteId);
      const packages = tickets.map(([name, price], i) => ({
        site_id:     siteId,
        name,
        description: `${name} — ${data.title}`,
        price:       parseFloat(price) || null,   // numeric column
        category:    'Packages',
        available:   true,
        sort_order:  i,
      }));
      const { error: pkgErr } = await sb.from('menu_items').insert(packages);
      if (pkgErr) console.warn(`  ⚠ Packages: ${pkgErr.message}`);
      else        console.log(`  ✓ ${packages.length} packages`);
    }

    /* ── 4. Reviews (top 5, status=approved) ── */
    const reviews = (data.reviews || []).slice(0, 5).filter(r => r.text);
    if (reviews.length) {
      await sb.from('reviews').delete().eq('site_id', siteId);
      const reviewRows = reviews.map(r => ({
        site_id:       siteId,
        customer_name: r.author,
        rating:        parseInt(r.rating) || 5,
        text:          r.text,
        status:        'approved',
        published_to_site: true,
      }));
      const { error: revErr } = await sb.from('reviews').insert(reviewRows);
      if (revErr) console.warn(`  ⚠ Reviews: ${revErr.message}`);
      else        console.log(`  ✓ ${reviewRows.length} reviews`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Complete!`);
  console.log(`   Inserted: ${inserted} new`);
  console.log(`   Updated:  ${updated} existing`);
  console.log(`   Errors:   ${errors}`);
  console.log(`   Total:    ${inserted + updated} / ${folders.length}`);
  console.log(`\n🌐 https://gcr-rosy.vercel.app/things-to-do.html`);
}

insertActivities().catch(console.error);

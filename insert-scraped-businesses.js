require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCRAPED_DIR = '/Users/owner/cybercheck-api-database/scraped-menus';

/* ── Target locations ── */
const TARGET_CITIES = ['gulf shores', 'orange beach', 'fort morgan'];

/* ── GCR category → subcategory map ── */
const SUBCATEGORY_MAP = {
  // restaurants
  'seafood':      { type: 'restaurant', sub: 'seafood',    tags: ['seafood', 'fresh', 'gulf-coast'] },
  'southern':     { type: 'restaurant', sub: 'southern',   tags: ['southern', 'comfort-food'] },
  'mexican':      { type: 'restaurant', sub: 'mexican',    tags: ['mexican', 'tacos', 'margaritas'] },
  'american':     { type: 'restaurant', sub: 'american',   tags: ['american', 'burgers', 'casual'] },
  'sushi':        { type: 'restaurant', sub: 'sushi',      tags: ['sushi', 'japanese', 'asian'] },
  'italian':      { type: 'restaurant', sub: 'italian',    tags: ['italian', 'pasta', 'pizza'] },
  'breakfast':    { type: 'restaurant', sub: 'breakfast',  tags: ['breakfast', 'brunch'] },
  'waterfront':   { type: 'restaurant', sub: 'waterfront', tags: ['waterfront', 'scenic', 'fresh-catch'] },
  'bar-grill':    { type: 'restaurant', sub: 'bar-grill',  tags: ['bar', 'grill', 'casual'] },
  'fine-dining':  { type: 'restaurant', sub: 'fine-dining',tags: ['fine-dining', 'upscale'] },
  'casual':       { type: 'restaurant', sub: 'casual',     tags: ['casual', 'family-friendly'] },
  // coffee-sweets
  'coffee':       { type: 'coffee-sweets', sub: 'coffee',   tags: ['coffee', 'espresso', 'cafe'] },
  'bakery':       { type: 'coffee-sweets', sub: 'bakery',   tags: ['bakery', 'pastries', 'baked-goods'] },
  'ice-cream':    { type: 'coffee-sweets', sub: 'ice-cream',tags: ['ice-cream', 'dessert', 'sweet'] },
  'dessert':      { type: 'coffee-sweets', sub: 'dessert',  tags: ['dessert', 'sweet', 'treats'] },
  'tea-shop':     { type: 'coffee-sweets', sub: 'tea-shop', tags: ['tea', 'boba', 'drinks'] },
};

/* ── Slugify ── */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

/* ── Format hours object → human-readable string ── */
function formatHours(hours) {
  if (!hours) return null;
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const short = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu',
                  friday:'Fri', saturday:'Sat', sunday:'Sun' };
  const lines = [];
  for (const d of days) {
    const h = hours[d];
    if (h) lines.push(`${short[d]}: ${h}`);
  }
  return lines.join(' · ');
}

/* ── Build features strip ── */
function buildFeatures(data, catInfo) {
  const features = [];
  const contact = data.contact || {};
  if (data.price_range)
    features.push({ label: 'Price Range', value: data.price_range, icon: '💰' });
  if (contact.city)
    features.push({ label: 'Location', value: `${contact.city}, AL`, icon: '📍' });
  if (catInfo)
    features.push({ label: 'Category', value: catInfo.sub.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()), icon: '🍽️' });
  const hoursStr = formatHours(data.hours);
  if (hoursStr)
    features.push({ label: 'Hours', value: hoursStr, icon: '🕐' });
  const feats = data.features || [];
  if (feats.length)
    features.push({ label: 'Features', value: feats.slice(0,4).join(', '), icon: '✨' });
  return features;
}

/* ── Build Q&A ── */
function buildQnA(data) {
  const qna = [];
  const about = data.about || {};
  if (about.insider_tip)
    qna.push({ q: "Any insider tips?", a: about.insider_tip });
  if (about.best_for && about.best_for.length)
    qna.push({ q: "Who is this best for?", a: `Best for: ${about.best_for.join(', ')}.` });
  if (about.vibe)
    qna.push({ q: "What's the vibe like?", a: about.vibe });
  if (about.parking)
    qna.push({ q: "Is parking available?", a: about.parking });
  if (about.reservations)
    qna.push({ q: "Do I need a reservation?", a: about.reservations });
  if (about.dress_code)
    qna.push({ q: "Is there a dress code?", a: about.dress_code });
  if (about.accessibility)
    qna.push({ q: "Is it accessible?", a: about.accessibility });
  return qna.slice(0, 8);
}

/* ── Build menu items from data.json menu ── */
function buildMenuItems(siteId, menuData) {
  if (!menuData || !menuData.categories) return [];
  const items = [];
  for (const cat of menuData.categories) {
    const catItems = cat.items || [];
    for (const item of catItems.slice(0, 20)) {
      if (!item.name) continue;
      items.push({
        site_id:    siteId,
        name:       item.name,
        description: item.description || null,
        price:      typeof item.price === 'number' ? item.price : null,
        category:   cat.name || 'Menu',
        available:  true,
        sort_order: items.length,
      });
    }
    if (items.length >= 60) break; // cap at 60 items
  }
  return items;
}

/* ══════════════════════════════════════════════════════ */
/* ── Haiku classification ──────────────────────────── */
/* ══════════════════════════════════════════════════════ */
async function classifyBusiness(data) {
  const contact = data.contact || {};
  const prompt = `Classify this Gulf Coast business for a local directory.

Business: ${data.business_name}
Type: ${data.type || 'unknown'}
Tags: ${(data.tags || []).slice(0, 10).join(', ')}
Description: ${(data.about || {}).elevator_pitch || (data.about || {}).description || 'none'}
City: ${contact.city || 'unknown'}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "gcr_type": "restaurant" | "coffee-sweets" | "skip",
  "subcategory": one of: seafood|southern|mexican|american|sushi|italian|breakfast|waterfront|bar-grill|fine-dining|casual|coffee|bakery|ice-cream|dessert|tea-shop,
  "kids_friendly": true | false,
  "tagline": "One catchy sentence (max 12 words) about what makes this place special"
}

Rules:
- restaurant = any sit-down or casual dining food establishment
- coffee-sweets = coffee shop, cafe, bakery, ice cream, dessert place
- skip = anything that is NOT food/drink (hotels, condos, charters, zoos, retail, etc.)
- Only return "restaurant" or "coffee-sweets" if the primary purpose is food/drink service`;

  const resp = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  let text = resp.content[0].text.trim();
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Haiku parse fail: ${text.substring(0, 100)}`);
  }
}

/* ══════════════════════════════════════════════════════ */
/* ── Main ─────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════ */
async function insertScrapedBusinesses() {
  const folders = fs.readdirSync(SCRAPED_DIR).filter(f => {
    const p = path.join(SCRAPED_DIR, f, 'data.json');
    return fs.existsSync(p) && !f.startsWith('_');
  });

  console.log(`\nFound ${folders.length} scraped folders\n${'═'.repeat(60)}`);

  /* ── Filter to target cities first ── */
  const candidates = [];
  for (const folder of folders) {
    const dataPath = path.join(SCRAPED_DIR, folder, 'data.json');
    let data;
    try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
    catch { continue; }

    const city = ((data.contact || {}).city || '').toLowerCase().trim();
    const inTarget = TARGET_CITIES.some(c => city.includes(c));

    if (inTarget) candidates.push({ folder, data });
  }

  console.log(`→ ${candidates.length} businesses in target cities (Gulf Shores, Orange Beach, Fort Morgan)\n`);

  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const { folder, data } of candidates) {
    const name = data.business_name || folder;
    process.stdout.write(`\n[${folder}] ${name}\n`);

    /* ── Classify with Haiku ── */
    let classification;
    try {
      classification = await classifyBusiness(data);
    } catch (e) {
      console.error(`  ✗ Haiku error: ${e.message}`);
      errors++;
      continue;
    }

    const { gcr_type, subcategory, kids_friendly, tagline } = classification;
    console.log(`  🤖 type=${gcr_type} sub=${subcategory} kids=${kids_friendly}`);

    if (gcr_type === 'skip') {
      console.log(`  ⏭  Skipped (not restaurant/coffee)`);
      skipped++;
      continue;
    }

    const catInfo = SUBCATEGORY_MAP[subcategory] ||
      (gcr_type === 'restaurant'
        ? { type: 'restaurant', sub: 'casual', tags: ['casual', 'dining'] }
        : { type: 'coffee-sweets', sub: 'coffee', tags: ['coffee', 'cafe'] });

    const contact = data.contact || {};
    const about = data.about || {};

    /* ── Build slug ── */
    const slug = slugify(name);

    /* ── Tags ── */
    const rawTags = data.tags || [];
    const tags = [...new Set([...catInfo.tags, ...rawTags.slice(0, 8).map(t => t.toLowerCase().replace(/\s+/g, '-'))])];

    /* ── Check existing ── */
    const { data: existing } = await sb
      .from('businesses')
      .select('site_id')
      .eq('subdomain', slug)
      .single();

    let siteId;

    const bizRow = {
      name,
      type:          catInfo.type,
      status:        'active',
      gcr_listed:    true,
      featured:      false,
      rating:        null,
      review_count:  0,
      price_range:   data.price_range || '',
      tags,
      subcategory:   catInfo.sub,
      kids_friendly: kids_friendly || false,
      cover_url:     (data.gallery && data.gallery[0]) || null,
      logo_url:      null,
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

    /* ── site_content ── */
    const description = about.description || about.elevator_pitch || tagline || '';
    const gallery = (data.gallery || []).slice(0, 12);
    const features = buildFeatures(data, catInfo);
    const qna = buildQnA(data);

    const hoursStr = formatHours(data.hours);
    const hoursNotes = (data.hours || {}).notes;

    const { error: contentErr } = await sb.from('site_content').upsert({
      site_id:         siteId,
      hero_text:       name,
      hero_subtext:    tagline || about.elevator_pitch || description.substring(0, 120),
      about_text:      description,
      seo_description: (description).substring(0, 160),
      address:         contact.address || '',
      city:            contact.city || '',
      state:           contact.state || 'AL',
      zip:             contact.zip || '',
      contact_phone:   contact.phone || null,
      gallery,
      features,
      qna,
      hours:           hoursStr ? hoursStr + (hoursNotes ? ' · ' + hoursNotes : '') : null,
    }, { onConflict: 'site_id' });

    if (contentErr) console.error(`  ✗ site_content: ${contentErr.message}`);
    else console.log(`  ✓ site_content (gallery:${gallery.length}, qna:${qna.length})`);

    /* ── Menu items ── */
    const menuData = data.menu;
    if (menuData && menuData.categories && menuData.categories.length) {
      await sb.from('menu_items').delete().eq('site_id', siteId);
      const menuItems = buildMenuItems(siteId, menuData);
      if (menuItems.length) {
        const { error: menuErr } = await sb.from('menu_items').insert(menuItems);
        if (menuErr) console.warn(`  ⚠ menu_items: ${menuErr.message}`);
        else         console.log(`  ✓ ${menuItems.length} menu items`);
      }
    }

    /* ── Specials ── */
    const specials = data.specials || [];
    if (specials.length) {
      await sb.from('specials').delete().eq('site_id', siteId);
      const specialRows = specials.slice(0, 10).map((s) => ({
        site_id:     siteId,
        title:       s.title || s.name || 'Special',
        description: s.description || s.details || '',
        valid_until: s.end_date || null,
        active:      true,
      }));
      const { error: specErr } = await sb.from('specials').insert(specialRows);
      if (specErr) console.warn(`  ⚠ specials: ${specErr.message}`);
      else         console.log(`  ✓ ${specialRows.length} specials`);
    }

    /* Small delay to avoid Haiku rate limiting */
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Complete!`);
  console.log(`   Inserted: ${inserted} new`);
  console.log(`   Updated:  ${updated} existing`);
  console.log(`   Skipped:  ${skipped} (not food/drink)`);
  console.log(`   Errors:   ${errors}`);
  console.log(`   Total:    ${inserted + updated} / ${candidates.length} candidates`);
  console.log(`\n🌐 https://gcr-rosy.vercel.app/restaurants.html`);
  console.log(`🌐 https://gcr-rosy.vercel.app/coffee-sweets.html`);
}

insertScrapedBusinesses().catch(console.error);

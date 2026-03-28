#!/usr/bin/env node
/**
 * build-rag-index.js
 *
 * Indexes all GCR businesses into business_embeddings table for RAG.
 * Uses OpenAI text-embedding-3-small (1536 dims) by default.
 *
 * Usage:
 *   node agents/build-rag-index.js              # index all businesses
 *   node agents/build-rag-index.js cobalt-the-restaurant  # single business
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   OPENAI_API_KEY (or EMBED_API_KEY)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const EMBED_API_KEY   = process.env.OPENAI_API_KEY || process.env.EMBED_API_KEY;
const EMBED_MODEL     = process.env.EMBED_MODEL || 'text-embedding-3-small';
const EMBED_BASE_URL  = 'https://api.openai.com/v1';
const BATCH_SIZE      = 5; // businesses per batch (avoid rate limits)
const SLEEP_MS        = 500;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function embed(text) {
  if (!EMBED_API_KEY) throw new Error('No embedding API key set (OPENAI_API_KEY or EMBED_API_KEY)');
  const res = await fetch(`${EMBED_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EMBED_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

// ── Text chunk builders ───────────────────────────────────────────────────────

function chunkProfile(b, c) {
  const features = (c.features || []).map(f =>
    typeof f === 'string' ? f : [f.label, f.value].filter(Boolean).join(': ')
  ).join(', ');
  const perfectFor = (c.perfect_for || []).join(', ');
  const tags = (b.tags || []).join(', ');
  return [
    `BUSINESS: ${b.name}`,
    `Type: ${b.type} | Location: ${[c.address, c.city, c.state].filter(Boolean).join(', ')}`,
    b.tagline ? `Tagline: ${b.tagline}` : '',
    c.about_text ? `Description: ${c.about_text}` : '',
    features ? `Features: ${features}` : '',
    perfectFor ? `Perfect for: ${perfectFor}` : '',
    tags ? `Tags: ${tags}` : '',
    b.price_range ? `Price range: ${b.price_range}` : '',
    b.happy_hour ? `Happy Hour: Yes` : '',
    b.live_music ? `Live Music: Yes` : '',
    b.waterfront ? `Waterfront: Yes` : '',
    b.kids_friendly ? `Kids Friendly: Yes` : '',
    b.pet_friendly ? `Pet Friendly: Yes` : '',
  ].filter(Boolean).join('\n');
}

function chunkHours(name, hours, hoursNote) {
  if (!hours || typeof hours !== 'object' || !Object.keys(hours).length) return null;
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const lines = days.map(day => {
    const v = hours[day] || hours[day.toLowerCase()];
    if (!v) return null;
    return `  ${day}: ${typeof v === 'object' ? `${v.open || ''} – ${v.close || ''}` : v}`;
  }).filter(Boolean);
  if (!lines.length) return null;
  return [`HOURS for ${name}:`, ...lines, hoursNote ? `Note: ${hoursNote}` : ''].filter(Boolean).join('\n');
}

function chunkMenu(name, menuItems) {
  if (!menuItems || !menuItems.length) return null;
  // menuItems is the flat rows from menu_items table
  const byCategory = {};
  menuItems.forEach(item => {
    const cat = item.category || 'Menu';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });
  const lines = [`MENU for ${name}:`];
  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`${cat}:`);
    items.forEach(i => {
      const price = i.price ? ` — $${i.price}` : '';
      const desc = i.description ? ` — ${i.description}` : '';
      lines.push(`  - ${i.name}${price}${desc}`);
    });
  }
  return lines.join('\n');
}

function chunkHappyHour(name, hh) {
  if (!hh) return null;
  if (typeof hh === 'string') return `HAPPY HOUR at ${name}: ${hh}`;
  const lines = [`HAPPY HOUR at ${name}:`];
  if (hh.schedule) lines.push(`Schedule: ${hh.schedule}`);
  if (Array.isArray(hh.deals)) {
    lines.push('Deals:');
    hh.deals.forEach(d => {
      const price = d.price ? ` — ${d.price}` : '';
      const desc = d.desc || d.description ? ` (${d.desc || d.description})` : '';
      lines.push(`  - ${d.name}${desc}${price}`);
    });
  }
  return lines.join('\n');
}

function chunkSpecials(name, specials) {
  if (!specials || !specials.length) return null;
  const lines = [`SPECIALS at ${name}:`];
  specials.forEach(s => {
    const days = Array.isArray(s.days) ? s.days.join(', ') : '';
    const time = s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : '';
    const when = [days, time].filter(Boolean).join(', ');
    const price = s.discount_text ? ` — ${s.discount_text}` : '';
    lines.push(`  - ${s.name}${price}${when ? ` (${when})` : ''}: ${s.description || ''}`);
  });
  return lines.join('\n');
}

function chunkEvents(name, events) {
  if (!events || !events.length) return null;
  const lines = [`EVENTS at ${name}:`];
  events.forEach(e => {
    const when = [e.event_date, e.event_time].filter(Boolean).join(' at ');
    lines.push(`  - ${e.title || e.name}${when ? ` on ${when}` : ''}: ${e.description || ''}`);
  });
  return lines.join('\n');
}

function chunkFleet(name, fleet) {
  if (!fleet || !fleet.length) return null;
  const lines = [`FLEET/BOATS at ${name}:`];
  fleet.forEach(f => {
    const cap = f.capacity ? ` | Capacity: ${f.capacity}` : '';
    const price = f.price_per_hour ? ` | $${f.price_per_hour}/hr` : '';
    lines.push(`  - ${f.name}${cap}${price}: ${f.description || ''}`);
  });
  return lines.join('\n');
}

function chunkPricing(name, pricing, groupRates) {
  const slots = {};
  (pricing || []).forEach(p => {
    const slot = p.slot_label || 'General';
    if (!slots[slot]) slots[slot] = [];
    slots[slot].push(`${p.name || 'Ticket'}: $${p.price}${p.description ? ' — ' + p.description : ''}`);
  });
  const lines = [];
  if (Object.keys(slots).length) {
    lines.push(`PRICING/TICKETS at ${name}:`);
    for (const [slot, items] of Object.entries(slots)) {
      lines.push(`${slot}:`);
      items.forEach(i => lines.push(`  - ${i}`));
    }
  }
  if (groupRates && groupRates.length) {
    lines.push(`Group Rates at ${name}:`);
    groupRates.forEach(r => lines.push(`  - ${r.name || r.group_size}: $${r.price}`));
  }
  return lines.length ? lines.join('\n') : null;
}

function chunkHighlights(name, highlights, restrictions, whatToBring) {
  const lines = [];
  if (highlights && highlights.length) {
    lines.push(`HIGHLIGHTS at ${name}:`);
    highlights.forEach(h => lines.push(`  - ${h}`));
  }
  if (restrictions && restrictions.length) {
    lines.push(`Guest Info / Restrictions at ${name}:`);
    restrictions.forEach(r => lines.push(`  - ${typeof r === 'object' ? r.q || JSON.stringify(r) : r}`));
  }
  if (whatToBring && whatToBring.length) {
    lines.push(`What to Bring to ${name}:`);
    whatToBring.forEach(w => lines.push(`  - ${w}`));
  }
  return lines.length ? lines.join('\n') : null;
}

function chunkReviews(name, reviews) {
  if (!reviews || !reviews.length) return null;
  const top5 = reviews.slice(0, 5);
  const lines = [`REVIEWS for ${name}:`];
  top5.forEach(r => {
    const stars = '★'.repeat(r.rating || 5);
    lines.push(`  ${stars} ${r.customer_name || r.author || 'Guest'}: "${r.text || r.body || ''}"`);
  });
  return lines.join('\n');
}

// ── Core indexer ─────────────────────────────────────────────────────────────

async function indexBusiness(business) {
  const siteId = business.site_id;
  const slug   = business.subdomain;
  const name   = business.name;

  console.log(`  → Fetching data for: ${name} (${slug})`);

  const [content, fleet, pricing, groupRates, reviews, specials, events, menuItems, addons] = await Promise.all([
    supabase.from('site_content').select('*').eq('site_id', siteId).single(),
    supabase.from('fleet_types').select('*').eq('site_id', siteId).eq('active', true),
    supabase.from('rental_pricing').select('*, rental_time_slots(name)').eq('site_id', siteId).eq('active', true),
    supabase.from('rental_group_rates').select('*').eq('site_id', siteId).eq('active', true),
    supabase.from('reviews').select('*').eq('site_id', siteId).eq('active', true).order('created_at', { ascending: false }).limit(10),
    supabase.from('specials').select('*').eq('site_id', siteId).eq('active', true),
    supabase.from('events').select('*').eq('site_id', siteId).eq('active', true).order('event_date', { ascending: true }).limit(20),
    supabase.from('menu_items').select('name, description, price, category, tags').eq('site_id', siteId).eq('available', true).order('sort_order'),
    supabase.from('rental_addons').select('*').eq('site_id', siteId).eq('active', true),
  ]);

  const c = content.data || {};

  // Map pricing slots
  const pricingData = (pricing.data || []).map(p => ({
    ...p,
    slot_label: p.slot_label || (p.rental_time_slots && p.rental_time_slots.name) || null,
  }));

  // Build all text chunks
  const rawChunks = [
    { type: 'profile',    text: chunkProfile(business, c) },
    { type: 'hours',      text: chunkHours(name, c.hours, c.hours_note) },
    { type: 'menu',       text: chunkMenu(name, menuItems.data) },
    { type: 'happy_hour', text: chunkHappyHour(name, c.happy_hour) },
    { type: 'specials',   text: chunkSpecials(name, specials.data) },
    { type: 'events',     text: chunkEvents(name, events.data) },
    { type: 'fleet',      text: chunkFleet(name, fleet.data) },
    { type: 'pricing',    text: chunkPricing(name, pricingData, groupRates.data) },
    { type: 'highlights', text: chunkHighlights(name, c.highlights || c.whats_included, c.restrictions, c.what_to_bring) },
    { type: 'reviews',    text: chunkReviews(name, reviews.data) },
  ].filter(ch => ch.text && ch.text.trim().length > 20);

  if (!rawChunks.length) {
    console.log(`    ⚠  No content chunks for ${name}, skipping`);
    return 0;
  }

  // Delete old embeddings for this business
  await supabase.from('business_embeddings').delete().eq('site_id', siteId);

  let count = 0;
  for (const chunk of rawChunks) {
    try {
      const vector = await embed(chunk.text);
      const { error } = await supabase.from('business_embeddings').insert({
        site_id:       siteId,
        slug:          slug,
        business_name: name,
        chunk_type:    chunk.type,
        content:       chunk.text,
        embedding:     JSON.stringify(vector),
        updated_at:    new Date().toISOString(),
      });
      if (error) throw error;
      count++;
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n    ✗ Failed to embed ${chunk.type} for ${name}: ${err.message}`);
    }
    await sleep(100); // 100ms between embedding calls
  }
  process.stdout.write('\n');
  console.log(`    ✓ ${count}/${rawChunks.length} chunks indexed for ${name}`);
  return count;
}

async function main() {
  const targetSlug = process.argv[2];

  console.log('═══════════════════════════════════════════');
  console.log(' GCR RAG Indexer');
  console.log('═══════════════════════════════════════════');

  if (!EMBED_API_KEY) {
    console.error('✗ No embedding API key found.');
    console.error('  Set OPENAI_API_KEY or EMBED_API_KEY in your .env file.');
    process.exit(1);
  }

  // Fetch businesses to index
  let query = supabase
    .from('businesses')
    .select('site_id, name, type, subdomain, tagline, tags, price_range, happy_hour, live_music, waterfront, kids_friendly, pet_friendly')
    .eq('status', 'active')
    .eq('gcr_listed', true);

  if (targetSlug) {
    query = query.eq('subdomain', targetSlug);
    console.log(`Mode: Single business — ${targetSlug}`);
  } else {
    console.log('Mode: Full index — all active GCR businesses');
  }

  const { data: businesses, error } = await query;
  if (error) { console.error('✗ Failed to fetch businesses:', error.message); process.exit(1); }
  if (!businesses || !businesses.length) { console.log('No businesses found.'); process.exit(0); }

  console.log(`Found ${businesses.length} businesses to index\n`);

  let totalChunks = 0;
  let batchNum = 0;

  for (let i = 0; i < businesses.length; i += BATCH_SIZE) {
    const batch = businesses.slice(i, i + BATCH_SIZE);
    batchNum++;
    console.log(`Batch ${batchNum}: ${batch.map(b => b.name).join(', ')}`);

    for (const biz of batch) {
      const count = await indexBusiness(biz);
      totalChunks += count;
    }

    if (i + BATCH_SIZE < businesses.length) {
      console.log(`  Waiting ${SLEEP_MS}ms before next batch...\n`);
      await sleep(SLEEP_MS);
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(` Done. ${totalChunks} total chunks indexed across ${businesses.length} businesses.`);
  console.log('═══════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

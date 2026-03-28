#!/usr/bin/env node
/**
 * GCR Cusym Page Builder Agent
 * Reads a raw business JSON and generates the BUSINESS_DATA .js file.
 * The HTML template is reusable (scroll-profile-BLANK.html) — just swap the <script src> line.
 *
 * Usage:
 *   Build a page:
 *     node agents/build-cusym-page.js circle-boats-raw.json
 *
 *   Approve a completed page (saves it as a memory example for future runs):
 *     node agents/build-cusym-page.js --approve beachside-circle-boats
 *
 *   List approved examples in memory:
 *     node agents/build-cusym-page.js --memory
 *
 * Output:
 *   /Users/owner/build-main/data/<slug>.js
 *
 * Memory (approved examples):
 *   /Users/owner/build-main/agent-memory/<slug>.js
 *
 * Requires: ANTHROPIC_API_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs        = require('fs');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const DATA_DIR   = '/Users/owner/build-main/data';
const MEMORY_DIR = '/Users/owner/build-main/agent-memory';

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────
// --memory: list approved examples
// ─────────────────────────────────────────────
if (process.argv[2] === '--memory') {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.js'));
  if (!files.length) {
    console.log('\n📭 No approved examples in memory yet.');
    console.log('   Run: node agents/build-cusym-page.js --approve <slug>\n');
  } else {
    console.log(`\n📚 ${files.length} approved example(s) in memory:`);
    files.forEach(f => console.log(`   ✅ ${f.replace('.js','')}`));
    console.log('');
  }
  process.exit(0);
}

// ─────────────────────────────────────────────
// --approve <slug>: save data file to memory
// ─────────────────────────────────────────────
if (process.argv[2] === '--approve') {
  const slug = process.argv[3];
  if (!slug) {
    console.error('Usage: node agents/build-cusym-page.js --approve <slug>');
    process.exit(1);
  }
  const src = path.join(DATA_DIR, `${slug}.js`);
  if (!fs.existsSync(src)) {
    console.error(`Data file not found: ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const dest = path.join(MEMORY_DIR, `${slug}.js`);
  fs.copyFileSync(src, dest);
  console.log(`\n✅ Approved and saved to memory: ${dest}`);
  console.log(`   Future builds will use this as a reference example.\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────
// BUILD
// ─────────────────────────────────────────────
const rawArg = process.argv[2];
if (!rawArg) {
  console.error('Usage:');
  console.error('  node agents/build-cusym-page.js <raw-json-file>');
  console.error('  node agents/build-cusym-page.js --approve <slug>');
  console.error('  node agents/build-cusym-page.js --memory');
  process.exit(1);
}

const rawFile = path.resolve(rawArg);
if (!fs.existsSync(rawFile)) {
  console.error('File not found:', rawFile);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));

// ─────────────────────────────────────────────
// Load approved examples from memory
// ─────────────────────────────────────────────
function loadMemoryExamples() {
  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.js'));
  if (!files.length) return '';

  let block = `\n\nAPPROVED EXAMPLES FROM MEMORY (replicate this exact structure and quality):\n`;
  files.forEach(f => {
    const slug = f.replace('.js', '');
    const content = fs.readFileSync(path.join(MEMORY_DIR, f), 'utf8');
    block += `\n--- EXAMPLE: ${slug} ---\n${content}\n--- END EXAMPLE ---\n`;
  });
  return block;
}

// ─────────────────────────────────────────────
// Full reference — data structure + what the template renders for each section ID
// ─────────────────────────────────────────────
const REFERENCE_STRUCTURE = `
BUSINESS_DATA FULL REFERENCE STRUCTURE
======================================

window.BUSINESS_DATA = {

  // ── Core Info (REQUIRED for all businesses) ──
  name, slug, tagline, category, emoji,
  phone (digits only), phoneDisplay,
  address, city, state, zip,
  website, googleMaps, instagram, facebook,
  rating, reviewCount,

  // ── Supabase (only if CyberCheck booking) ──
  supabase: { url, key, siteId },

  // ── Images ──
  coverImages: [ "url", ... ],            // slideshow at top of page
  gallery: [ { url, caption }, ... ],     // opens in popup modal

  // ── Reviews ──
  reviews: [ { author, rating, date, text }, ... ],   // opens in popup modal

  // ── About ──
  about: { description, features[], perfectFor[], included[] },

  // ── Hours ──
  hours: [ { day, open, close } ],   // Mon–Sun, today highlighted in accent color

  // ── RESTAURANT sections ──
  foodMenu: [ { category, meal?, note?, items: [ { name, desc?, price? } ] } ],
  // meal field on foodMenu category = used for split tabs (e.g. meal:"lunch" maps to sec id "lunch")
  // items without price+desc render as chip pills; items with price/desc render as cards

  barMenu: [ { category, note?, items: [ { name, desc?, price? } ] } ],
  // barCat on a section (e.g. { id:'spirits', barCat:'Spirits' }) renders just that one barMenu category

  happyHour: { schedule, deals: [ { name, desc, price } ] },
  specials:  [ { badge, name, desc } ],   // badge = day label e.g. "MON", "FRI"

  // ── GOLF / ACTIVITY sections ──
  packages:  [ { badge, name, price, duration, desc } ],
  bookABay:  { name, price, capacity, desc },
  league:    { price, schedule, format, desc, perks[] },
  events:    [ { badge, name, desc, note? } ],
  games:     [ { category, items: [ { name, desc? } ] } ],

  // ── BOAT RENTAL sections ──
  fleet:     [ { id, name, badge, description, image, halfDay, allDay, qty } ],
  timeSlots: [ { id, name, start, end, hours } ],
  docks:     [ { name, specs, desc, halfDay, allDay } ],
  addons:    [ { id, name, icon, price, perUnit, desc, image } ],

  // ── ACTIVITY / TOUR sections ──
  // Use for dolphin cruises, tours, experiences, attractions
  schedules:    [ { time, name, tickets: [ { name, price } ] } ],  // departure times + ticket price table
  highlights:   [ "bullet point 1", "bullet point 2" ],            // key selling points
  included:     [ "Guided cruise", "Life vests" ],                  // what's included — checklist
  whatToBring:  [ "Sunscreen", "Camera" ],                          // what to bring — checklist
  restrictions: [ "Must be 21+ for alcohol", "No glass items" ],   // rules/policies — bulleted list

  // ── Sections (sticky nav tabs) ──
  // ONLY include section IDs that have matching data. Be smart — if the raw data has
  // highlights, include them. If it has schedules/tickets, use schedules. If it has
  // restrictions, include guest info. Extract everything valuable from the raw data.
  // Template renders these section IDs:
  //   'about'        → description, features chips, perfectFor chips
  //   'food'         → all foodMenu categories as cards
  //   'bar'          → all barMenu categories
  //   'happy-hour'   → schedule + deals list
  //   'specials'     → special cards with day badge
  //   'games'        → game categories
  //   'packages'     → package pricing cards (3-col grid)
  //   'league'       → league pricing + perks
  //   'book-a-bay'   → single bay card
  //   'events'       → event list
  //   'schedules'    → departure times with ticket price tables
  //   'highlights'   → bulleted activity highlights
  //   'included'     → checklist of what's included
  //   'whatToBring'  → checklist of what to bring
  //   'restrictions' → bulleted rules/policies
  //   'gallery'      → button that opens gallery popup
  //   'reviews'      → button that opens reviews popup
  //   'hours'        → hours list, today highlighted
  //   'location'     → address + directions/call/website buttons
  sections: [ { id, label, icon, scrollTo?, barCat? } ],

};
`;

async function main() {
  const client  = new Anthropic();
  const slug    = raw.business?.subdomain || raw.slug || toSlug(raw.business?.name || raw.title || 'business');
  const name    = raw.business?.name || raw.title || 'Business';
  const memory  = loadMemoryExamples();
  const memNote = memory ? `\n📚 Loaded ${fs.readdirSync(MEMORY_DIR).filter(f=>f.endsWith('.js')).length} approved example(s) from memory.` : '\n📭 No memory examples yet — will use reference structure only.';

  console.log(`\n🚀 Building data file for: ${name}`);
  console.log(`   Slug: ${slug}${memNote}`);

  const prompt = `You are building a BUSINESS_DATA JavaScript file for a Gulf Coast Radar cusym profile page.
The HTML template renders itself from this data object — you only need to produce the JS data file.

REFERENCE — all possible fields:
${REFERENCE_STRUCTURE}
${memory}

RAW BUSINESS DATA TO CONVERT:
${JSON.stringify(raw, null, 2)}

RULES:
- Only include sections and fields that apply to this business. Skip unused ones.
- Do NOT invent prices, menu items, or hours not present in the raw data.
- For sections array, only include tabs that have real data to show.
- Fix any garbled emoji/icon characters from encoding issues.
- slug must be exactly: "${slug}"
- If approved memory examples exist above, match their formatting and quality exactly.

Output ONLY the JavaScript. No markdown, no explanation.
First line: window.BUSINESS_DATA = {
Last line: };`;

  const res = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  let js = res.content[0].text.trim();
  js = js.replace(/^```javascript\n?/, '').replace(/^```js\n?/, '').replace(/\n?```$/, '');

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, `${slug}.js`);
  fs.writeFileSync(outPath, js);

  console.log(`\n✅ Data file saved: ${outPath}`);
  console.log(`\nReview it, then:`);
  console.log(`  1. Copy scroll-profile-BLANK.html → templates/${slug}.html`);
  console.log(`  2. Change <script src> to: ../data/${slug}.js`);
  console.log(`  3. Open in browser and verify.`);
  console.log(`  4. When happy: node agents/build-cusym-page.js --approve ${slug}\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

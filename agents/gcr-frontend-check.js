#!/usr/bin/env node
// ============================================================
// gcr-frontend-check.js — launching-GCR Frontend Auditor (Haiku)
// Reads every HTML file in launching-GCR and checks:
//   ✓ Page exists vs missing (linked in nav but no file)
//   ✓ Required scripts loaded (gcr-api.js, gcr-listings.js, gcr-config.js)
//   ✓ Correct data-category on #listingsGrid
//   ✓ Hardcoded/fake data that should come from API
//   ✓ Nav links that point to missing pages
//   ✓ Admin dashboard (cybercheck-login) page list vs actual API coverage
// Uses Haiku to give a prioritized fix list.
//
// Usage:
//   node agents/gcr-frontend-check.js
//   node agents/gcr-frontend-check.js --dir /Users/owner/launching-GCR
//   node agents/gcr-frontend-check.js --admin /Users/owner/cybercheck-login
// ============================================================

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const SITE_DIR  = process.argv.find(a => a.startsWith('--dir='))?.split('=')[1]
  || process.env.GCR_SITE_DIR
  || path.join(__dirname, '..', '..', 'launching-GCR');

const ADMIN_DIR = process.argv.find(a => a.startsWith('--admin='))?.split('=')[1]
  || process.env.GCR_ADMIN_DIR
  || path.join(__dirname, '..', '..', 'cybercheck-login');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const results = [];
const issues  = [];

function ok(msg)    { console.log(`  ${G}✓${X} ${msg}`); }
function fail(msg)  { console.log(`  ${R}✗${X} ${msg}`); issues.push(msg); }
function warn(msg)  { console.log(`  ${Y}⚠${X} ${msg}`); }
function section(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0, 54-t.length))}${X}`); }

// ── Page definitions (every page the site should have) ───

const PAGES = [
  // category listing pages — need gcr-listings.js + data-category
  { file: 'index3.html',        label: 'Home',           category: null,            listing: false, nav: false },
  { file: 'restaurants.html',   label: 'Restaurants',    category: 'restaurants',   listing: true,  nav: true  },
  { file: 'happy-hours.html',   label: 'Happy Hours',    category: 'happy-hours',   listing: true,  nav: true  },
  { file: 'events.html',        label: 'Events',         category: 'events',        listing: true,  nav: true  },
  { file: 'specials.html',      label: 'Specials',       category: 'specials',      listing: true,  nav: true  },
  { file: 'things-to-do.html',  label: 'Things To Do',   category: 'things-to-do',  listing: true,  nav: true  },
  { file: 'nightlife.html',     label: 'Nightlife',      category: 'nightlife',     listing: true,  nav: true  },
  { file: 'coffee-sweets.html', label: 'Coffee & Sweets',category: 'coffee-sweets', listing: true,  nav: true  },
  { file: 'shopping.html',      label: 'Shopping',       category: 'shopping',      listing: true,  nav: true  },
  { file: 'services.html',      label: 'Services',       category: 'services',      listing: true,  nav: true  },
  { file: 'deals.html',         label: 'Deals',          category: 'deals',         listing: true,  nav: false },
  { file: 'artists.html',       label: 'Artists',        category: 'artists',       listing: true,  nav: true  },
  { file: 'public-spots.html',  label: 'Public Spots',   category: 'public-spots',  listing: true,  nav: true  },
  // special pages
  { file: 'profile.html',       label: 'Entity Profile', category: null,            listing: false, nav: false },
  { file: 'search.html',        label: 'Search',         category: null,            listing: false, nav: false },
  { file: 'feed.html',          label: 'Live Feed',      category: null,            listing: false, nav: true  },
  { file: 'the-wharf.html',     label: 'The Wharf',      category: null,            listing: false, nav: false },
  { file: 'claim.html',         label: 'Claim Listing',  category: null,            listing: false, nav: false },
  { file: 'loyalty.html',       label: 'Loyalty',        category: null,            listing: false, nav: false },
  { file: 'concierge.html',     label: 'AI Concierge',   category: null,            listing: false, nav: false },
  { file: 'circle-boats.html',  label: 'Circle Boats',   category: null,            listing: false, nav: false },
];

// Nav links that appear in the header on every page
const NAV_FILES = [
  'restaurants.html','coffee-sweets.html','happy-hours.html','specials.html',
  'events.html','things-to-do.html','services.html','nightlife.html',
  'artists.html','shopping.html','public-spots.html','feed.html',
];

// Patterns that flag hardcoded/fake data
const HARDCODED = [
  { re: /Terry Cove/g,             label: 'hardcoded business "Terry Cove"' },
  { re: /Tacky Jack/g,             label: 'hardcoded business "Tacky Jacks"' },
  { re: /Acoustic Sunset/g,        label: 'hardcoded event "Acoustic Sunset"' },
  { re: /Weekly Trivia Night/g,    label: 'hardcoded "Weekly Trivia Night"' },
  { re: /HH Specials/g,            label: 'hardcoded deal "HH Specials"' },
  { re: /24 events today/g,        label: 'hardcoded "24 events today"' },
  { re: /Lorem ipsum/gi,           label: 'Lorem ipsum placeholder text' },
  { re: /unsplash\.com\/photos\//g,label: 'Unsplash placeholder image' },
];

// API routes the admin dashboard calls — cross-check for coverage
const ADMIN_CALLS = [
  // Platform
  { path: '/api/admin/stats',                     label: 'Platform stats',            tab: 'Overview' },
  { path: '/api/admin/businesses',                label: 'CyberCheck businesses',     tab: 'Businesses' },
  { path: '/api/admin/users',                     label: 'Users list',                tab: 'Businesses' },
  { path: '/api/admin/bookings',                  label: 'Bookings',                  tab: 'Businesses' },
  { path: '/api/admin/system/health',             label: 'System health',             tab: 'Settings' },
  { path: '/api/admin/ai-settings',               label: 'AI settings',               tab: 'AI/RAG' },
  { path: '/api/admin/rag-status',                label: 'RAG status',                tab: 'AI/RAG' },
  // GCR entities
  { path: '/api/admin/gcr/entities',              label: 'GCR entities list',         tab: 'Entity Editor' },
  { path: '/api/admin/gcr/businesses',            label: 'GCR businesses',            tab: 'GCR Businesses' },
  { path: '/api/admin/gcr/events',                label: 'GCR events',                tab: 'Events' },
  { path: '/api/admin/gcr/specials',              label: 'GCR specials',              tab: 'Specials' },
  { path: '/api/admin/gcr/reviews',               label: 'Reviews',                   tab: 'Reviews' },
  { path: '/api/admin/gcr/customers',             label: 'Customers',                 tab: 'Customers' },
  { path: '/api/admin/gcr/coupons',               label: 'Coupons',                   tab: 'Coupons' },
  { path: '/api/admin/gcr/analytics',             label: 'Analytics',                 tab: 'Analytics' },
  // Site editor
  { path: '/api/admin/gcr/site-config',           label: 'Site hero/config',          tab: 'Site Editor → Home Hero' },
  { path: '/api/admin/gcr/category-cards',        label: 'Category cards',            tab: 'Site Editor → Category Cards' },
  { path: '/api/admin/gcr/category-page-config/restaurants', label: 'Page config: restaurants', tab: 'Site Editor → Page Headers' },
  { path: '/api/admin/gcr/page-assignments/restaurants',     label: 'Page assignments',          tab: 'Site Editor → Page Assignments' },
  { path: '/api/admin/gcr/entity-pages/test',                label: 'Entity pages',              tab: 'Site Editor → Entity Pages' },
  // Import
  { path: '/api/admin/gcr/import-csv',            label: 'Import CSV',                tab: 'Bulk Upload' },
  { path: '/api/admin/gcr/import-menu',           label: 'Import menu',               tab: 'Bulk Upload' },
  { path: '/api/admin/gcr/import-events',         label: 'Import events',             tab: 'Bulk Upload' },
];

// ── Check a single HTML file ──────────────────────────────

function checkFile(page) {
  const filePath = path.join(SITE_DIR, page.file);
  const r = { ...page, exists: false, fileIssues: [], fileWarns: [] };

  if (!fs.existsSync(filePath)) { r.fileIssues.push('FILE MISSING'); return r; }
  r.exists = true;
  const html = fs.readFileSync(filePath, 'utf8');

  // Required scripts
  if (!html.includes('gcr-api.js'))       r.fileIssues.push('missing gcr-api.js');
  if (page.listing && !html.includes('gcr-listings.js')) r.fileIssues.push('missing gcr-listings.js');

  // data-category on #listingsGrid
  if (page.listing) {
    if (!html.includes('id="listingsGrid"')) {
      r.fileIssues.push('missing #listingsGrid element');
    } else if (page.category && !html.includes(`data-category="${page.category}"`)) {
      r.fileIssues.push(`#listingsGrid missing data-category="${page.category}"`);
    }
  }

  // gcr-config.js for category pages (loads page title/hero from admin)
  if (page.category) {
    if (!html.includes('gcr-config.js')) {
      r.fileWarns.push('missing gcr-config.js (admin can\'t set hero/title for this page)');
    }
  }

  // Hardcoded data
  for (const h of HARDCODED) {
    if (h.re.test(html)) r.fileIssues.push(`contains ${h.label}`);
  }

  // Pages linked but might not exist
  if (html.includes('claim.html') && !fs.existsSync(path.join(SITE_DIR, 'claim.html'))) {
    r.fileWarns.push('links to claim.html but file missing');
  }

  return r;
}

// ── Audit admin dashboard JS for API calls ────────────────

function auditAdminDashboard() {
  section('REPO 2 — cybercheck-login: Admin Dashboard');

  if (!fs.existsSync(ADMIN_DIR)) {
    warn(`Admin dir not found: ${ADMIN_DIR}`);
    warn('Pass --admin=/path/to/cybercheck-login to test admin dashboard');
    return [];
  }

  const adminFile = path.join(ADMIN_DIR, 'admin.html');
  if (!fs.existsSync(adminFile)) { fail('admin.html not found in admin dir'); return []; }

  const html = fs.readFileSync(adminFile, 'utf8');
  ok('admin.html found');

  // Count how many API calls exist
  const fetchMatches = html.match(/fetch\(API_BASE \+ ['"`]\/api\//g) || [];
  ok(`admin.html makes ${fetchMatches.length} API calls`);

  // Check sidebar nav pages
  const navPages = ['overview','businesses','gcr-businesses','gcr-entity-editor','gcr-site-editor','gcr-events','gcr-specials','bulk-upload','bulk-events','ai-tools','reviews','customers','coupons','analytics','messaging','settings'];
  const foundPages = navPages.filter(p => html.includes(`data-page="${p}"`));
  const missing    = navPages.filter(p => !html.includes(`data-page="${p}"`));

  ok(`Admin sidebar has ${foundPages.length}/${navPages.length} expected nav pages`);
  if (missing.length > 0) warn(`Missing nav pages: ${missing.join(', ')}`);

  // Check API calls per section
  const apiCallResults = [];
  for (const call of ADMIN_CALLS) {
    const inHtml = html.includes(call.path);
    apiCallResults.push({ ...call, inAdminHtml: inHtml });
    if (!inHtml) warn(`[${call.tab}] API call to ${call.path} NOT found in admin.html`);
  }

  const found   = apiCallResults.filter(c => c.inAdminHtml).length;
  const missing2 = apiCallResults.filter(c => !c.inAdminHtml).length;
  ok(`${found}/${ADMIN_CALLS.length} expected API calls found in admin.html`);
  if (missing2 > 0) fail(`${missing2} expected admin API calls not in admin.html`);

  return apiCallResults;
}

// ── Run all checks ─────────────────────────────────────────

async function run() {
  console.log(`\n${B}GCR Frontend Check${X}  ${D}(Claude Haiku)${X}`);
  console.log(`${D}Frontend: ${SITE_DIR}${X}`);
  console.log(`${D}Admin:    ${ADMIN_DIR}${X}`);
  console.log(`${D}Time: ${new Date().toLocaleString()}${X}`);

  if (!fs.existsSync(SITE_DIR)) {
    console.log(`\n${R}✗ Frontend dir not found: ${SITE_DIR}${X}`);
    console.log(`  Pass --dir=/path/to/launching-GCR`);
    process.exit(1);
  }

  // ── Frontend pages ──
  section('REPO 1 — launching-GCR: Page Check');

  let clean = 0, broken = 0, missing = 0, warned = 0;

  for (const page of PAGES) {
    const r = checkFile(page);
    results.push(r);

    if (!r.exists) {
      fail(`${page.file} — FILE MISSING`);
      missing++;
    } else if (r.fileIssues.length > 0) {
      console.log(`  ${R}✗${X} ${page.label} ${D}(${page.file})${X}`);
      r.fileIssues.forEach(i => { console.log(`    ${D}→ ${i}${X}`); issues.push(`${page.file}: ${i}`); });
      broken++;
    } else if (r.fileWarns.length > 0) {
      console.log(`  ${Y}⚠${X} ${page.label} ${D}(${page.file})${X}`);
      r.fileWarns.forEach(w => console.log(`    ${D}→ ${w}${X}`));
      warned++;
    } else {
      ok(`${page.label}`);
      clean++;
    }
  }

  section('launching-GCR: Nav Link Validation');
  for (const link of NAV_FILES) {
    const exists = fs.existsSync(path.join(SITE_DIR, link));
    if (!exists) { fail(`Nav link "${link}" → file MISSING`); }
    else         { ok(link); }
  }

  section('launching-GCR: Key linked pages');
  const keyPages = ['claim.html', 'profile.html', 'search.html', 'concierge.html'];
  for (const p of keyPages) {
    const exists = fs.existsSync(path.join(SITE_DIR, p));
    if (!exists) fail(`${p} is linked from other pages but MISSING`);
    else         ok(p);
  }

  // ── JS scripts ──
  section('launching-GCR: JS Scripts Present');
  const scripts = ['gcr-api.js','gcr-listings.js','gcr-config.js','app.js','claim-modal.js'];
  for (const s of scripts) {
    const exists = fs.existsSync(path.join(SITE_DIR, 'js', s));
    if (!exists) fail(`js/${s} MISSING`);
    else         ok(`js/${s}`);
  }

  // ── Admin dashboard ──
  const adminCalls = auditAdminDashboard();

  // Summary
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}Pages: ${G}${clean} clean${X}  ${Y}${warned} warnings${X}  ${R}${broken} broken${X}  ${R}${missing} missing${X}  ${D}/ ${PAGES.length} checked${X}`);

  // ── Haiku analysis ──
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`\n${Y}⚠  ANTHROPIC_API_KEY not set — skipping Haiku analysis.${X}`);
    if (issues.length > 0) { console.log(`\n${R}Issues:${X}`); issues.forEach(i => console.log(`  ✗ ${i}`)); }
    console.log();
    return;
  }

  section('Claude Haiku — Frontend Analysis');
  console.log(`${D}Analyzing with Claude Haiku...${X}\n`);

  const pageData = results.map(r => ({
    file: r.file, label: r.label, exists: r.exists,
    issues: r.fileIssues, warnings: r.fileWarns,
    isListingPage: r.listing, category: r.category, inNav: r.nav,
  }));

  const adminGaps = adminCalls.filter(c => !c.inAdminHtml).map(c => `${c.tab}: ${c.path}`);

  const prompt = `Auditing Gulf Coast Radar (GCR) — 3-repo local discovery platform.

REPO 1 — launching-GCR (public frontend): ${PAGES.length} pages checked
ALL ISSUES FOUND:
${issues.length > 0 ? issues.map(i => '• ' + i).join('\n') : '(none)'}

PAGE DETAIL:
${JSON.stringify(pageData, null, 2)}

REPO 2 — cybercheck-login (admin dashboard):
Expected admin API calls not found: ${adminGaps.length > 0 ? adminGaps.join(', ') : '(all found)'}

Tell me:
1. Which public pages are broken/missing that visitors will hit?
2. Which category listing pages won't load real data (wrong/missing data-category or scripts)?
3. Any pages missing gcr-config.js meaning admin can't set their hero from Site Editor?
4. Any hardcoded/fake data still showing?
5. Are there nav links pointing to missing pages?
6. What are the top 3 frontend fixes for launch readiness?

Be specific and direct. Format as:
🔴 BROKEN (visitors can't use these)
🟡 DATA ISSUES (pages exist but won't load API data)
🟠 ADMIN GAPS (admin can't manage these pages)
🧹 CLEANUP NEEDED
🔧 TOP 3 FRONTEND FIXES`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    console.log(msg.content[0].text);
  } catch (e) {
    console.log(`${R}Haiku failed: ${e.message}${X}`);
    if (issues.length > 0) { console.log(`\n${R}Issues:${X}`); issues.forEach(i => console.log(`  ✗ ${i}`)); }
  }

  console.log();
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });

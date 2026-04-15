#!/usr/bin/env node
// gcr-card-rendering.js — Tests card rendering consistency across all listing pages
// Verifies: .gcr-card classes present, no duplicate old CSS classes, cards render consistently
// Usage: node agents/gcr-card-rendering.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const GCR_DIR = process.env.GCR_DIR || '/Users/owner/launching-GCR';

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}━━ ${t} ${'━'.repeat(Math.max(0,52-t.length))}${X}`);}
function log(m){console.log(`  ${D}${m}${X}`);}

const pages = [
  'restaurants.html',
  'coffee-sweets.html',
  'shopping.html',
  'things-to-do.html',
  'nightlife.html',
  'artists.html',
  'public-spots.html'
];

const oldCssClasses = [
  '.restaurant-card',
  '.restaurant-image',
  '.restaurant-body',
  '.cafe-card',
  '.cafe-image',
  '.cafe-body',
  '.activity-card',
  '.biz-card'
];

async function run() {
  console.log(`\n${B}GCR Card Rendering Test${X}`);
  console.log(`${D}Target: ${GCR_DIR}${X}`);
  console.log(`${D}Time:   ${new Date().toLocaleString()}${X}\n`);

  // ── CHECK EACH PAGE ───────────────────────────────────────────────────────
  sec('Check Listing Pages');

  pages.forEach(pageFile => {
    const filePath = path.join(GCR_DIR, pageFile);

    if (!fs.existsSync(filePath)) {
      warn(`${pageFile} not found`);
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Check for listingsGrid container
    if (content.includes('id="listingsGrid"')) {
      ok(`${pageFile} has listingsGrid container`);
    } else {
      fail(`${pageFile} missing listingsGrid container`);
    }

    // Check for gcr-listings.js inclusion
    if (content.includes('gcr-listings.js')) {
      ok(`${pageFile} includes gcr-listings.js`);
    } else {
      warn(`${pageFile} missing gcr-listings.js script`);
    }

    // Check for old CSS class definitions (should NOT be present)
    let foundOldCss = [];
    oldCssClasses.forEach(cssClass => {
      const pattern = cssClass.replace('.', '\\.');
      if (new RegExp(`${pattern}\\s*{|${pattern}\\s*,`).test(content)) {
        foundOldCss.push(cssClass);
      }
    });

    if (foundOldCss.length === 0) {
      ok(`${pageFile} has no conflicting old CSS classes`);
    } else {
      fail(`${pageFile} has old CSS: ${foundOldCss.join(', ')}`);
    }

    // Check for data-category attribute
    const categoryMatch = content.match(/data-category="([^"]+)"/);
    if (categoryMatch) {
      log(`  Category: ${categoryMatch[1]}`);
    }
  });

  // ── CHECK gcr-listings.js ─────────────────────────────────────────────────
  sec('Check gcr-listings.js');

  const jsPath = path.join(GCR_DIR, 'js', 'gcr-listings.js');
  if (!fs.existsSync(jsPath)) {
    fail('gcr-listings.js not found');
  } else {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    ok('gcr-listings.js exists');

    // Check for required functions
    const functions = [
      'buildCard',
      'buildHHCard',
      'buildSpecialsCard',
      'buildHHSpecialsCard',
      'getEntitiesForCategory',
      'renderEntities'
    ];

    functions.forEach(fn => {
      if (jsContent.includes(`function ${fn}`) || jsContent.includes(`${fn}(`) || jsContent.includes(`const ${fn}`)) {
        ok(`${fn} function defined`);
      } else {
        fail(`${fn} function missing`);
      }
    });

    // Check for .gcr-card CSS injection
    if (jsContent.includes('.gcr-card')) {
      ok('gcr-card CSS classes present in JS');
    } else {
      fail('gcr-card CSS classes missing');
    }

    // Check for proper cardFn selection logic
    if (jsContent.includes('buildHHCard') && jsContent.includes('buildSpecialsCard')) {
      ok('Card function selection logic present');
    } else {
      fail('Card function selection logic incomplete');
    }
  }

  // ── VERIFY CSS CONSISTENCY ────────────────────────────────────────────────
  sec('CSS Class Consistency');

  if (fs.existsSync(jsPath)) {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const cssClasses = [
      '.gcr-card',
      '.gcr-card-img',
      '.gcr-card-body',
      '.gcr-card-name',
      '.gcr-card-badge',
      '.gcr-card-rating',
      '.gcr-chips',
      '.gcr-btn'
    ];

    cssClasses.forEach(cssClass => {
      if (jsContent.includes(cssClass)) {
        ok(`${cssClass} used in JS`);
      } else {
        warn(`${cssClass} might not be used`);
      }
    });
  }

  // ── CHECK PROFILE AND MENU EDITORS ────────────────────────────────────────
  sec('Related Pages');

  const relatedPages = [
    'profile.html',
    'qr-menu.html'
  ];

  relatedPages.forEach(pageFile => {
    const filePath = path.join(GCR_DIR, pageFile);
    if (fs.existsSync(filePath)) {
      ok(`${pageFile} exists`);
    } else {
      warn(`${pageFile} not found`);
    }
  });

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  sec('Summary');
  console.log(`  ${G}Passed${X}: ${passed.length}`);
  console.log(`  ${R}Failed${X}: ${failed.length}`);
  console.log(`  ${Y}Warned${X}: ${warned.length}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });

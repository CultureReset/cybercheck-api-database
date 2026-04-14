#!/usr/bin/env node
// ============================================================
// uiux-reviewer.js — UI/UX Expert Page Reviewer
// Screenshots every admin dashboard page, sends each to
// Claude Haiku with a UI/UX expert prompt, writes a full
// markdown report with notes and recommendations
//
// Usage:
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/uiux-reviewer.js
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/uiux-reviewer.js --page gcr-businesses
// Output: uiux-report.md in project root
// ============================================================

const { chromium } = require('playwright');
const Anthropic    = require('@anthropic-ai/sdk');
const fs           = require('fs');
const path         = require('path');

const EMAIL    = process.env.ADMIN_EMAIL;
const PASS     = process.env.ADMIN_PASS;
const API_BASE = process.env.API_BASE  || 'http://localhost:3000';
const DASH_URL = process.env.DASH_URL  || 'http://127.0.0.1:5500/admin.html';
const ONLY_PAGE = process.argv.find(a => a.startsWith('--page='))?.split('=')[1];
const SS_DIR   = path.join(__dirname, '..', 'test-screenshots', 'uiux');
const REPORT   = path.join(__dirname, '..', 'uiux-report.md');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';

const PAGES = [
  { id: 'overview',          label: 'Admin Overview' },
  { id: 'gcr-businesses',    label: 'GCR Businesses List' },
  { id: 'gcr-entity-editor', label: 'Entity Editor' },
  { id: 'gcr-events',        label: 'Events' },
  { id: 'gcr-specials',      label: 'Specials' },
  { id: 'bulk-upload',       label: 'Bulk Upload' },
  { id: 'ai-organize',       label: 'AI Data Organizer' },
  { id: 'rag-index',         label: 'AI Index / RAG' },
  { id: 'gcr-analytics',     label: 'Analytics' },
  { id: 'gcr-reviews',       label: 'Reviews' },
  { id: 'gcr-customers',     label: 'Customers' },
  { id: 'gcr-messaging',     label: 'SMS / Messaging' },
  { id: 'gcr-coupons',       label: 'Coupons' },
  { id: 'gcr-seo',           label: 'SEO' },
];

const UX_PROMPT = `You are a senior UI/UX designer reviewing an admin dashboard for a Gulf Coast tourism directory platform called Gulf Coast Radar (GCR).

Look at this screenshot of the "${label}" page and provide a concise professional review covering:

1. **What's working well** — layout, clarity, usability
2. **Issues found** — broken elements, missing data, confusing UI, loading states, empty states
3. **Priority fixes** — top 3 specific things to change, in order of importance
4. **Quick wins** — small tweaks that would improve usability immediately

Be specific. Reference actual elements you see. Keep total response under 300 words.`;

async function reviewPage(client, pageId, label, screenshotPath) {
  const imageData = fs.readFileSync(screenshotPath).toString('base64');

  const prompt = `You are a senior UI/UX designer reviewing an admin dashboard for Gulf Coast Radar (GCR), a Gulf Coast tourism directory platform.

Look at this screenshot of the "${label}" page and provide a concise professional review covering:

1. **What's working well** — layout, clarity, usability
2. **Issues found** — broken elements, missing data, confusing UI, stuck loading states, empty states that need better copy
3. **Priority fixes** — top 3 specific things to change, in order of importance
4. **Quick wins** — small tweaks that would improve usability immediately

Be specific. Reference actual elements you see. Keep total response under 300 words.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageData } },
        { type: 'text', text: prompt }
      ]
    }]
  });

  return response.content[0].text;
}

async function run() {
  if (!EMAIL || !PASS) {
    console.log(`${R}Set ADMIN_EMAIL and ADMIN_PASS env vars${X}`); process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`${R}Set ANTHROPIC_API_KEY env var${X}`); process.exit(1);
  }

  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

  const client  = new Anthropic();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await context.newPage();

  await page.addInitScript(base => { window.CC_API_BASE = base; }, API_BASE);

  console.log(`\n${B}UI/UX Reviewer${X}`);
  console.log(`${D}Dashboard: ${DASH_URL}${X}`);

  try {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log(`${R}✗ Could not load dashboard: ${e.message}${X}`);
    console.log(`Serve it first:  cd /Users/owner/cybercheck-login && python3 -m http.server 5500`);
    await browser.close(); process.exit(1);
  }

  // Auth
  const tokenRes = await page.evaluate(async ({ base, email, pass }) => {
    const res = await fetch(base + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass })
    });
    return res.ok ? await res.json() : null;
  }, { base: API_BASE, email: EMAIL, pass: PASS });

  if (!tokenRes?.token) {
    console.log(`${R}✗ Login failed${X}`); await browser.close(); process.exit(1);
  }
  await page.evaluate(t => {
    localStorage.setItem('cc_admin_token', t);
    localStorage.setItem('cc_user_role', 'admin');
  }, tokenRes.token);
  console.log(`${G}✓ Logged in${X}`);

  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const pagesToReview = ONLY_PAGE ? PAGES.filter(p => p.id === ONLY_PAGE) : PAGES;
  const reviews = [];

  for (const p of pagesToReview) {
    console.log(`\n${C}Reviewing: ${p.label}...${X}`);

    // Navigate to page
    await page.evaluate(id => { if (typeof showPage === 'function') showPage(id); }, p.id);
    await page.waitForTimeout(2000);

    // Screenshot
    const ssPath = path.join(SS_DIR, `${p.id}.png`);
    await page.screenshot({ path: ssPath, fullPage: false });
    console.log(`  ${D}Screenshot saved${X}`);

    // Review with Haiku
    try {
      console.log(`  ${D}Analyzing with Claude Haiku...${X}`);
      const review = await reviewPage(client, p.id, p.label, ssPath);
      console.log(`  ${G}✓ Done${X}`);
      reviews.push({ pageId: p.id, label: p.label, ssPath, review });
    } catch (e) {
      console.log(`  ${R}✗ Analysis failed: ${e.message}${X}`);
      reviews.push({ pageId: p.id, label: p.label, ssPath, review: `Error: ${e.message}` });
    }
  }

  await browser.close();

  // Write markdown report
  const now = new Date().toLocaleString();
  let md = `# GCR Admin Dashboard — UI/UX Review\n\n`;
  md += `**Generated:** ${now}  \n`;
  md += `**Pages reviewed:** ${reviews.length}  \n`;
  md += `**Tool:** Claude Haiku (claude-haiku-4-5)  \n\n`;
  md += `---\n\n`;

  for (const r of reviews) {
    md += `## ${r.label}\n\n`;
    md += `*Page ID: \`${r.pageId}\`*  \n`;
    md += `*Screenshot: \`test-screenshots/uiux/${r.pageId}.png\`*\n\n`;
    md += r.review + '\n\n';
    md += `---\n\n`;
  }

  fs.writeFileSync(REPORT, md);
  console.log(`\n${B}${G}✓ Report saved: uiux-report.md${X}`);
  console.log(`${D}Screenshots: test-screenshots/uiux/${X}\n`);
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });

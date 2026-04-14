#!/usr/bin/env node
// gcr-price-format-audit.js — Checks menu item prices are valid numbers and formatted correctly
// Usage: node agents/gcr-price-format-audit.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

async function run() {
  console.log(`\n${B}GCR Price Format Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  const r = await fetch(BASE + '/api/gcr/entities?limit=500');
  const data = await r.json();
  const entities = data.entities || data.businesses || [];

  let totalItems = 0, noPrice = 0, zeroPrices = 0, badFormat = 0, goodFormat = 0, marketPrice = 0;
  const issues = [];
  const sample = entities.slice(0, 30);

  console.log(`${B}${C}── Checking menu items for ${sample.length} entities ${'─'.repeat(13)}${X}`);

  for (const e of sample) {
    const pr = await fetch(BASE + `/api/gcr/entity/${e.slug}`);
    if (!pr.ok) continue;
    const pd = await pr.json();

    const menuItems = pd.menu?.items || [];
    const drinkItems = pd.drinks?.items || [];
    const hhItems = pd.happy_hour?.items || [];
    const allItems = [...menuItems, ...drinkItems, ...hhItems];

    for (const item of allItems) {
      totalItems++;
      const hasNumeric = item.price !== null && item.price !== undefined;
      const hasText = !!(item.price_text || item.price_label);
      const isMP = (item.price_text||'').toUpperCase() === 'MP' || (item.price_label||'').toUpperCase() === 'MP';

      if (isMP) { marketPrice++; continue; }

      if (!hasNumeric && !hasText) {
        noPrice++;
        issues.push({ entity: e.name, item: item.item_name || item.name, issue: 'no price at all' });
        continue;
      }

      if (hasNumeric && (item.price === 0 || item.price === '0')) {
        zeroPrices++;
        issues.push({ entity: e.name, item: item.item_name || item.name, issue: 'price is $0.00' });
        continue;
      }

      if (hasText) {
        const txt = String(item.price_text || item.price_label || '');
        // Should start with $ or be a number
        if (!txt.match(/^\$[\d,]+(\.\d{2})?$/) && !txt.match(/^[\d,]+(\.\d{2})?$/) && txt.toUpperCase() !== 'MP') {
          badFormat++;
          issues.push({ entity: e.name, item: item.item_name || item.name, issue: `bad price_text format: "${txt}"` });
        } else {
          goodFormat++;
        }
      } else {
        goodFormat++;
      }
    }
  }

  console.log(`  Total items checked: ${totalItems}`);
  console.log(`  ${G}✓${X} Good format: ${goodFormat}`);
  console.log(`  ${D}Market price (MP): ${marketPrice}${X}`);
  if (noPrice > 0) console.log(`  ${R}✗${X} No price: ${noPrice}`);
  if (zeroPrices > 0) console.log(`  ${Y}⚠${X} Price is $0: ${zeroPrices} (should these be MP or have real price?)`);
  if (badFormat > 0) console.log(`  ${Y}⚠${X} Bad price_text format: ${badFormat}`);

  if (issues.length > 0) {
    console.log(`\n${B}${C}── Price Issues ${'─'.repeat(41)}${X}`);
    issues.slice(0, 20).forEach(i => {
      const color = i.issue.includes('no price') ? R : Y;
      console.log(`  ${color}⚠${X} ${i.entity} — "${i.item}": ${i.issue}`);
    });
    if (issues.length > 20) console.log(`  ${D}...and ${issues.length-20} more${X}`);
  } else {
    console.log(`\n  ${G}✓${X} No price format issues found`);
  }

  // Check HH pricing specifically
  console.log(`\n${B}${C}── Happy Hour Price Comparison (hh_price vs regular_price) ${'─'.repeat(0)}${X}`);
  let hhGood = 0, hhBad = 0;
  for (const e of sample) {
    const pr = await fetch(BASE + `/api/gcr/entity/${e.slug}`);
    if (!pr.ok) continue;
    const pd = await pr.json();
    (pd.happy_hour?.items || []).forEach(item => {
      if (item.hh_price && item.regular_price) {
        if (parseFloat(item.hh_price) < parseFloat(item.regular_price)) hhGood++;
        else hhBad++;
      }
    });
  }
  if (hhGood > 0) console.log(`  ${G}✓${X} ${hhGood} HH items have valid hh_price < regular_price`);
  if (hhBad > 0) console.log(`  ${Y}⚠${X} ${hhBad} HH items where hh_price >= regular_price (check data)`);

  const qualityScore = totalItems > 0 ? Math.round(goodFormat / totalItems * 100) : 0;
  console.log(`\n${B}Price data quality: ${qualityScore}%${X}`);

  if (process.env.ANTHROPIC_API_KEY && issues.length > 0) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR price format audit: ${totalItems} menu items checked.
Good: ${goodFormat}, No price: ${noPrice}, $0 prices: ${zeroPrices}, Bad format: ${badFormat}, Market price: ${marketPrice}.
Issues: ${issues.slice(0,8).map(i=>`${i.entity}:"${i.item}"(${i.issue})`).join(' | ')}
Recommendations for cleaning up price data?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });

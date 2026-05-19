#!/usr/bin/env node
/**
 * Extract ALL raw text from a restaurant's scraped data
 * No AI processing — just get everything as text
 *
 * Usage:
 *   node agents/get-raw-text.js cobalt-the-restaurant
 *   node agents/get-raw-text.js flora-bama > cobalt-all-text.txt
 */

const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node agents/get-raw-text.js <slug>');
  console.error('Example: node agents/get-raw-text.js cobalt-the-restaurant');
  process.exit(1);
}

const rawFile = path.join(__dirname, '../scraped-menus', slug, 'raw.json');

if (!fs.existsSync(rawFile)) {
  console.error(`❌ File not found: ${rawFile}`);
  console.log('\nAvailable restaurants:');
  const dirs = fs.readdirSync(path.join(__dirname, '../scraped-menus'))
    .filter(d => !d.startsWith('.'))
    .filter(d => fs.existsSync(path.join(__dirname, '../scraped-menus', d, 'raw.json')))
    .slice(0, 10);
  dirs.forEach(d => console.log(`  • ${d}`));
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));

console.error(`\n📄 ${raw.business_name || slug}`);
console.error(`🔗 ${raw.url}`);
console.error(`📊 Pages: ${raw.pages?.length || 0}`);
console.error(`📕 PDFs: ${raw.pdfUrls?.length || 0}`);
console.error(`🖼️  Images: ${raw.imageUrls?.length || 0}`);
console.error('');

// Combine all text
const allText = [];

// Add page text
if (raw.pages && raw.pages.length > 0) {
  raw.pages.forEach((page, i) => {
    allText.push(`═══════════════════════════════════════════════════════════`);
    allText.push(`PAGE ${i + 1}: ${page.url}`);
    allText.push(`═══════════════════════════════════════════════════════════`);
    allText.push(page.text || '');
    allText.push('');
  });
}

// Add PDF text
if (raw.pdfTexts && raw.pdfTexts.length > 0) {
  allText.push(`\n\n${'═'.repeat(60)}`);
  allText.push(`PDF CONTENT`);
  allText.push(`${'═'.repeat(60)}`);
  raw.pdfTexts.forEach((pdfText, i) => {
    allText.push(`\n--- PDF ${i + 1} ---`);
    allText.push(pdfText);
  });
}

// Output to stdout (can redirect with >)
const fullText = allText.join('\n');
console.log(fullText);

// Stats to stderr
console.error(`\n📈 STATS:`);
console.error(`Total characters: ${fullText.length.toLocaleString()}`);
console.error(`Total words: ${fullText.split(/\s+/).length.toLocaleString()}`);
console.error(`Total lines: ${fullText.split('\n').length.toLocaleString()}`);

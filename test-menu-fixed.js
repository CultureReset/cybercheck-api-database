#!/usr/bin/env node
const { chromium } = require('playwright');

async function test() {
  let browser;
  console.log('\n' + '='.repeat(60));
  console.log('🍽️  TESTING FIXED MENU PAGE');
  console.log('='.repeat(60) + '\n');

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const url = 'https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cobalt-the-restaurant-Bx1gX8';
    console.log('Testing URL: ' + url + '\n');

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const content = await page.content();
    
    // Check for menu items
    const hasShrimp = content.includes('Shrimp') || content.includes('shrimp');
    const hasDip = content.includes('Dip') || content.includes('dip');
    const hasCatfish = content.includes('Catfish') || content.includes('catfish');
    const hasAppetizers = content.includes('Appetizers') || content.includes('appetizers');
    
    console.log('✓ Page loaded\n');
    
    if (hasAppetizers) console.log('✓ Appetizers section found');
    if (hasShrimp) console.log('✓ Shrimp item found');
    if (hasDip) console.log('✓ Dip item found');
    if (hasCatfish) console.log('✓ Catfish item found');
    
    if (hasAppetizers && hasShrimp && hasDip) {
      console.log('\n✅ MENU DISPLAY WORKING!\n');
      console.log('Menu items are rendering correctly.');
    } else {
      console.log('\n⚠️ Menu items missing. Checking page text...\n');
      const text = await page.innerText('body');
      const menuCheck = text.substring(0, 500);
      console.log('Page content preview:');
      console.log(menuCheck);
    }

    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test();

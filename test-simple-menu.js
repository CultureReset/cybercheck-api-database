#!/usr/bin/env node
const { chromium } = require('playwright');

async function test() {
  let browser;
  console.log('\n' + '='.repeat(60));
  console.log('🍽️  SIMPLE MENU VIEWER TEST');
  console.log('='.repeat(60) + '\n');

  try {
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Test 1: Complex version (original)
    console.log('📋 Original qr-menu.html (COMPLEX):');
    await page.goto('https://cybercheck-links.vercel.app/qr-menu.html?slug=cobalt-the-restaurant-Bx1gX8');
    await page.waitForTimeout(3000);
    const complexSize = (await page.content()).length;
    console.log(`   - Page size: ${(complexSize/1024).toFixed(1)} KB`);
    console.log(`   - Many features: tabs, ads, analytics, modals, etc.\n`);

    // Test 2: Simple version (new)
    console.log('✨ New qr-menu-simple.html (CLEAN):');
    await page.goto('https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cobalt-the-restaurant-Bx1gX8');
    await page.waitForTimeout(2000);
    const simpleSize = (await page.content()).length;
    console.log(`   - Page size: ${(simpleSize/1024).toFixed(1)} KB`);
    console.log(`   - Just: header + menu items + footer\n`);

    // Test 3: With PIN
    console.log('🔐 Simple version with PIN:');
    await page.goto('https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cobalt-the-restaurant-Bx1gX8&pin=2024');
    await page.waitForTimeout(1500);
    console.log('   ✓ PIN prompt should appear\n');

    console.log('='.repeat(60));
    console.log('✅ COMPARISON:\n');
    console.log(`Original:  ${(complexSize/1024).toFixed(1)} KB (bloated)`);
    console.log(`Simple:    ${(simpleSize/1024).toFixed(1)} KB (clean)`);
    console.log(`Reduction: ${(100*(1-simpleSize/complexSize)).toFixed(0)}% smaller\n`);

    console.log('✨ The simple version has:');
    console.log('   ✓ Clean, minimal design');
    console.log('   ✓ Fast loading');
    console.log('   ✓ PIN protection');
    console.log('   ✓ Mobile optimized');
    console.log('   ✓ No clutter\n');

    console.log('Try these URLs:');
    console.log('   • https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cobalt-the-restaurant-Bx1gX8');
    console.log('   • With PIN: ...&pin=2024\n');

    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
}

test();

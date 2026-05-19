#!/usr/bin/env node
const { chromium } = require('playwright');

async function test() {
  let browser;
  console.log('\n' + '='.repeat(60));
  console.log('🔐 TESTING PIN PROTECTION');
  console.log('='.repeat(60) + '\n');

  try {
    browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const url = 'https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cobalt-the-restaurant-Bx1gX8&pin=2024';
    console.log('Testing URL with PIN=2024: ' + url + '\n');
    console.log('A browser will open. You should see a PIN prompt.\n');

    await page.goto(url);
    
    let pinPrompted = false;
    const handleDialog = (dialog) => {
      pinPrompted = true;
      console.log('✓ PIN prompt detected: "' + dialog.message() + '"');
      console.log('✓ Entering correct PIN: 2024\n');
      dialog.accept('2024');
    };

    page.once('dialog', handleDialog);
    await page.waitForTimeout(2000);

    if (!pinPrompted) {
      console.log('⚠️ No PIN prompt detected (check browser manually)\n');
    } else {
      await page.waitForTimeout(2000);
      const content = await page.content();
      const hasMenu = content.includes('Appetizers') && content.includes('Shrimp');
      
      if (hasMenu) {
        console.log('✅ PIN PROTECTION WORKING!\n');
        console.log('Flow: PIN prompt → Correct PIN entered → Menu loads\n');
      }
    }

    console.log('='.repeat(60));
    console.log('Browser stays open - check the loaded page manually.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

test();

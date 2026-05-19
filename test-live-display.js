const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://cybercheck-links.vercel.app/qr-menu-simple.html?slug=cosmos-restaurant-and-bar-orange-beach');
  await page.waitForTimeout(2000);
  
  const text = await page.innerText('body');
  const sections = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/g);
  
  console.log('Page shows:');
  console.log(text.substring(0, 2000));
  
  // Check if descriptions are visible
  if (text.includes('Tempura') || text.includes('Pineapple rum')) {
    console.log('\n✅ DESCRIPTIONS ARE SHOWING');
  } else {
    console.log('\n❌ DESCRIPTIONS NOT SHOWING');
  }
  
  await browser.close();
})();

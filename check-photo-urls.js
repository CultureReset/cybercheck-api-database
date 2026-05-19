require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  const { data } = await db.from('entity').select('hero_image_url').eq('is_active', true).limit(1000);
  
  const urls = (data || []).filter(e => e.hero_image_url);
  console.log(`\nSample hero_image_urls (${urls.length} total with photos):\n`);
  
  // Group by domain
  const domains = {};
  urls.slice(0, 50).forEach(e => {
    const url = e.hero_image_url;
    try {
      const domain = new URL(url).hostname;
      domains[domain] = (domains[domain] || 0) + 1;
    } catch {
      domains['INVALID'] = (domains['INVALID'] || 0) + 1;
    }
  });
  
  console.log('URL sources:');
  Object.entries(domains).forEach(([d, c]) => console.log(`  ${d}: ${c} URLs`));
  
  console.log('\nFirst 5 URLs:');
  urls.slice(0, 5).forEach(e => console.log(`  ${e.hero_image_url.substring(0, 80)}`));
}

main().catch(e => console.error('Error:', e.message));

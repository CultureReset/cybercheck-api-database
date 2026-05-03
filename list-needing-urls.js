require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

function isTestSlug(slug) {
    const s = (slug || '').toLowerCase();
    return s.startsWith('gcr-upload-test-') || s.startsWith('gcr-sections-test-') ||
           s.startsWith('gcr-toggle-test-') || s.startsWith('gcr-section-flow-test-') ||
           s.startsWith('gcr-items-test-') || s.startsWith('gcr-events-test-') ||
           s.startsWith('gcr-tags-test-') || s.startsWith('gcr-verify-') ||
           (s.startsWith('gcr-') && s.includes('-test-'));
}

// Already covered in curated list
const COVERED = new Set([
    'cobalt-the-restaurant','zekes-restaurant','cosmos-restaurant-and-bar',
    'gts-on-the-bay','coastal-orange-beach','flora-bama-yacht-club',
    'voyagers','docs-seafood-shack','lunas-eat-and-drink',
    'tacky-jacks-seafood-restaurant-and-tavern'
]);

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('name, slug, website_url')
        .eq('is_active', true)
        .eq('entity_subtype', 'restaurant')
        .order('name');
    
    const real = data.filter(e => !isTestSlug(e.slug));
    const remaining = real.filter(e => !COVERED.has(e.slug));
    
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`Still needing menu URLs: ${remaining.length} of ${real.length} restaurants`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);
    
    // Write a JSON list for the scraper script
    const fs = require('fs');
    fs.writeFileSync('/tmp/restaurants-needing-urls.json', JSON.stringify(remaining, null, 2));
    console.log(`Saved full list to /tmp/restaurants-needing-urls.json`);
    console.log(`\nFirst 30:`);
    remaining.slice(0, 30).forEach((e, i) => {
        console.log(`${String(i+1).padStart(3)}. ${e.name.padEnd(50)} ${e.website_url || '(no website)'}`);
    });
    if (remaining.length > 30) console.log(`  ...and ${remaining.length - 30} more in /tmp/restaurants-needing-urls.json`);
}

run();

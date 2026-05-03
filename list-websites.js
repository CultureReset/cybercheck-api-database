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

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('name, slug, website_url, order_url, reservation_url, phone')
        .eq('is_active', true)
        .eq('entity_subtype', 'restaurant')
        .order('name');
    
    const real = data.filter(e => !isTestSlug(e.slug));
    
    console.log(`🍽️  ${real.length} RESTAURANTS — WEBSITES\n`);
    const withSite = [];
    const noSite = [];
    
    real.forEach(e => {
        if (e.website_url) withSite.push(e);
        else noSite.push(e);
    });
    
    console.log(`✅ WITH WEBSITE (${withSite.length}):\n`);
    withSite.forEach((e, i) => {
        console.log(`${String(i+1).padStart(3)}. ${e.name}`);
        console.log(`     ${e.website_url}`);
        if (e.order_url && e.order_url !== e.website_url) console.log(`     Order: ${e.order_url}`);
        if (e.reservation_url && e.reservation_url !== e.website_url) console.log(`     Reserve: ${e.reservation_url}`);
    });
    
    console.log(`\n❌ NO WEBSITE (${noSite.length}):\n`);
    noSite.forEach(e => console.log(`  • ${e.name}${e.phone ? ' — ' + e.phone : ''}`));
}

run();

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

// Curated URL list. Edit/add freely.
// type: 'menu' | 'happy_hour' | 'drinks' | 'specials' | 'info'
// Use format: pdf|html (defaults to html)
const CURATED = [
    { slug: 'cobalt-the-restaurant', name: 'Cobalt', type: 'menu', url: 'https://cobaltrestaurant.net/menu/' },
    { slug: 'zekes-restaurant', name: "Zeke's Restaurant", type: 'info', url: 'https://www.zekeslanding.com/restaurant/' },
    { slug: 'zekes-restaurant', name: "Zeke's Restaurant", type: 'menu', url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/03/dinner.pdf', format: 'pdf' },
    { slug: 'cosmos-restaurant-and-bar', name: "Cosmo's Restaurant & Bar", type: 'menu', url: 'https://www.cosmosrestaurantandbar.com/menu' },
    { slug: 'cosmos-restaurant-and-bar', name: "Cosmo's Restaurant & Bar", type: 'info', url: 'https://www.cosmosrestaurantandbar.com/' },
    { slug: 'gts-on-the-bay', name: 'GTs On The Bay', type: 'menu', url: 'https://gtsonthebay.com/menu/' },
    { slug: 'gts-on-the-bay', name: 'GTs On The Bay', type: 'info', url: 'https://gtsonthebay.com/' },
    { slug: 'gts-on-the-bay', name: 'GTs On The Bay', type: 'happy_hour', url: 'https://gtsonthebay.com/happy-hour/' },
    { slug: 'gts-on-the-bay', name: 'GTs On The Bay', type: 'info', url: 'https://gtsonthebay.com/live-music-events/' },
    { slug: 'coastal-orange-beach', name: 'COASTAL Orange Beach', type: 'info', url: 'https://www.coastalorangebeach.com/Menus' },
    { slug: 'coastal-orange-beach', name: 'COASTAL Orange Beach', type: 'menu', url: 'https://www.coastalorangebeach.com/coastal-restaurant-menu', section: 'Restaurant' },
    { slug: 'coastal-orange-beach', name: 'COASTAL Orange Beach', type: 'menu', url: 'https://www.coastalorangebeach.com/coastal-breakfast-menu', section: 'Breakfast' },
    { slug: 'coastal-orange-beach', name: 'COASTAL Orange Beach', type: 'menu', url: 'https://www.coastalorangebeach.com/beachside-bar-menu', section: 'Beach Bar' },
    { slug: 'flora-bama-yacht-club', name: 'Flora-Bama Yacht Club', type: 'info', url: 'https://www.florabamayachtclub.com/' },
    { slug: 'flora-bama-yacht-club', name: 'Flora-Bama Yacht Club', type: 'menu', url: 'https://www.florabamayachtclub.com/menu' },
    { slug: 'voyagers', name: 'Voyagers', type: 'info', url: 'https://voyagersrestaurant.com/' },
    { slug: 'voyagers', name: 'Voyagers', type: 'menu', url: 'https://voyagersrestaurant.com/menu' },
    { slug: 'voyagers', name: 'Voyagers', type: 'menu', url: 'https://voyagersrestaurant.com/admin/fm/source/5635_VoyagersPerdido/Voyagers-Dinner-Menu-March-2025-Website.pdf', format: 'pdf', section: 'Dinner' },
    { slug: 'docs-seafood-shack', name: "Doc's Seafood Shack", type: 'info', url: 'https://www.docsseafoodshack.com/' },
    { slug: 'docs-seafood-shack', name: "Doc's Seafood Shack", type: 'menu', url: 'https://www.docsseafoodshack.com/seafood-menu/' },
    { slug: 'docs-seafood-shack', name: "Doc's Seafood Shack", type: 'menu', url: 'https://www.toasttab.com/local/order/doc-s-seafood-shack-and-oyster-bar' },
    { slug: 'docs-seafood-shack', name: "Doc's Seafood Shack", type: 'menu', url: 'https://www.docsseafoodshack.com/wp-content/uploads/2019/07/Docs-Seafood-Shack-and-Oyster-Bar-Menu.pdf', format: 'pdf' },
    { slug: 'lunas-eat-and-drink', name: "Luna's Eat & Drink", type: 'info', url: 'https://www.lunaseatanddrink.com/' },
    { slug: 'lunas-eat-and-drink', name: "Luna's Eat & Drink", type: 'menu', url: 'https://www.lunaseatanddrink.com/menu' },
    { slug: 'tacky-jacks-seafood-restaurant-and-tavern', name: 'Tacky Jacks', type: 'info', url: 'https://www.tackyjacks.com/' },
    { slug: 'tacky-jacks-seafood-restaurant-and-tavern', name: 'Tacky Jacks', type: 'menu', url: 'https://www.tackyjacks.com/download-menus' },
    { slug: 'tacky-jacks-seafood-restaurant-and-tavern', name: 'Tacky Jacks Orange Beach', type: 'info', url: 'https://www.tackyjacks.com/locations-ob' },
    { slug: 'sunliner-diner', name: 'Sunliner Diner', type: 'specials', url: 'https://sunlinerdiner.com/happy-days-special/' }
];

async function updateUrls(slug, updates) {
    const { data: entity } = await supabase
        .from('entity')
        .select('id, name, website_url, order_url, reservation_url, hh_description')
        .eq('slug', slug)
        .maybeSingle();

    if (!entity) return { status: 'not-found', slug };

    const patch = {};
    // Set primary website if not already set (use info URL)
    const infoUrl = updates.find(u => u.type === 'info')?.url;
    if (infoUrl && !entity.website_url) patch.website_url = infoUrl;

    // Set a primary menu URL as order_url if missing
    const menuUrl = updates.find(u => u.type === 'menu')?.url;
    if (menuUrl && !entity.order_url) patch.order_url = menuUrl;

    if (Object.keys(patch).length === 0) {
        return { status: 'no-change', slug, name: entity.name, types: updates.map(u => u.type) };
    }

    if (!DRY_RUN) {
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from('entity').update(patch).eq('id', entity.id);
        if (error) return { status: 'error', slug, reason: error.message };
    }

    return { status: DRY_RUN ? 'preview' : 'updated', slug, name: entity.name, patch, types: updates.map(u => u.type) };
}

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING ===\n');
    console.log(`Curated URL entries: ${CURATED.length}\n`);

    // Group by slug
    const bySlug = {};
    for (const c of CURATED) {
        if (!bySlug[c.slug]) bySlug[c.slug] = [];
        bySlug[c.slug].push(c);
    }

    console.log('═'.repeat(72));
    console.log('CURATED MENU URL INDEX (grouped by business)');
    console.log('═'.repeat(72));

    const results = [];
    for (const [slug, list] of Object.entries(bySlug)) {
        console.log(`\n📍 ${list[0].name} (${slug})`);
        list.forEach(u => {
            const tag = `[${u.type}${u.format === 'pdf' ? '/pdf' : ''}${u.section ? ' · ' + u.section : ''}]`;
            console.log(`   ${tag}`);
            console.log(`   ${u.url}`);
        });
        const r = await updateUrls(slug, list);
        results.push(r);
        const note = r.status === 'not-found' ? '   ⚠️ ENTITY NOT FOUND IN DB' :
                     r.status === 'no-change' ? '   = no URL changes needed' :
                     r.status === 'error' ? '   ❌ ' + r.reason :
                     r.status === 'preview' ? '   📋 WOULD UPDATE: ' + Object.keys(r.patch).join(', ') :
                     '   ✅ UPDATED: ' + Object.keys(r.patch).join(', ');
        console.log(note);
    }

    const notFound = results.filter(r => r.status === 'not-found');
    const updated = results.filter(r => r.status === 'updated' || r.status === 'preview');

    console.log('\n' + '═'.repeat(72));
    console.log('SUMMARY');
    console.log('═'.repeat(72));
    console.log(`  Businesses with curated URLs: ${Object.keys(bySlug).length}`);
    console.log(`  Total URLs: ${CURATED.length}`);
    console.log(`  Entities ${DRY_RUN ? 'to update' : 'updated'}: ${updated.length}`);
    console.log(`  Entities not found in DB: ${notFound.length}`);
    if (notFound.length) {
        console.log(`\n  Not-found slugs (check spelling):`);
        notFound.forEach(n => console.log(`    • ${n.slug}`));
    }
}

run();

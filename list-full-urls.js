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

async function fetchAll(table, cols) {
    const all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
    }
    return all;
}

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('id, name, slug, website_url, order_url, reservation_url, hh_days, hh_start, hh_end, hh_description, phone')
        .eq('is_active', true)
        .eq('entity_subtype', 'restaurant')
        .order('name');
    
    const real = data.filter(e => !isTestSlug(e.slug));
    const ids = real.map(e => e.id);
    
    const menuItems = await fetchAll('menu_items', 'entity_id');
    const drinkItems = await fetchAll('drink_items', 'entity_id');
    const hhItems = await fetchAll('happy_hour_items', 'entity_id');
    
    const menuSections = await fetchAll('menu_sections', 'entity_id');
    const drinkSections = await fetchAll('drink_sections', 'entity_id');
    const hhSections = await fetchAll('happy_hour_sections', 'entity_id');
    
    // Build specials too (entity column or item_type)
    const { data: specials } = await supabase.from('special').select('entity_id, title').or(ids.map(i => `entity_id.eq.${i}`).slice(0, 100).join(','));
    
    const counts = {};
    for (const id of ids) counts[id] = { menu: 0, drinks: 0, hh: 0, menuSec: 0, drinkSec: 0, hhSec: 0, specials: 0 };
    menuItems.forEach(i => counts[i.entity_id] && counts[i.entity_id].menu++);
    drinkItems.forEach(i => counts[i.entity_id] && counts[i.entity_id].drinks++);
    hhItems.forEach(i => counts[i.entity_id] && counts[i.entity_id].hh++);
    menuSections.forEach(s => counts[s.entity_id] && counts[s.entity_id].menuSec++);
    drinkSections.forEach(s => counts[s.entity_id] && counts[s.entity_id].drinkSec++);
    hhSections.forEach(s => counts[s.entity_id] && counts[s.entity_id].hhSec++);
    (specials || []).forEach(s => counts[s.entity_id] && counts[s.entity_id].specials++);
    
    console.log(`🍽️  ${real.length} RESTAURANTS — WEBSITES + MENU/DRINKS/HAPPY HOUR\n`);
    
    real.forEach((e, i) => {
        const c = counts[e.id];
        console.log(`${String(i+1).padStart(3)}. ${e.name}`);
        console.log(`     Website: ${e.website_url || '—'}`);
        if (e.order_url && e.order_url !== e.website_url) console.log(`     Order:   ${e.order_url}`);
        if (e.reservation_url && e.reservation_url !== e.website_url) console.log(`     Reserve: ${e.reservation_url}`);
        const hh = [e.hh_days, (e.hh_start && e.hh_end) ? `${e.hh_start}-${e.hh_end}` : '', e.hh_description].filter(Boolean).join(' · ');
        console.log(`     📋 Menu: ${c.menu} items (${c.menuSec} sections) | 🥃 Drinks: ${c.drinks} items (${c.drinkSec} sections) | 🍻 HH: ${c.hh} items (${c.hhSec} sections)${c.specials ? ' | ⭐ Specials: ' + c.specials : ''}`);
        if (hh) console.log(`     🍺 Happy Hour: ${hh}`);
        console.log('');
    });
    
    const totals = Object.values(counts).reduce((s, c) => ({
        menu: s.menu + c.menu, drinks: s.drinks + c.drinks, hh: s.hh + c.hh,
        specials: s.specials + c.specials
    }), { menu: 0, drinks: 0, hh: 0, specials: 0 });
    
    console.log(`\n════════════════════════════════════════════════════════════════════`);
    console.log(`TOTALS`);
    console.log(`════════════════════════════════════════════════════════════════════`);
    console.log(`  Menu items:       ${totals.menu}`);
    console.log(`  Drink items:      ${totals.drinks}`);
    console.log(`  Happy Hour items: ${totals.hh}`);
    console.log(`  Specials:         ${totals.specials}`);
    
    const withHH = real.filter(e => e.hh_days || e.hh_start);
    console.log(`\n  Restaurants with Happy Hour info: ${withHH.length}`);
    const withDrinks = real.filter(e => counts[e.id].drinks > 0);
    console.log(`  Restaurants with drinks menu:     ${withDrinks.length}`);
    const withHHItems = real.filter(e => counts[e.id].hh > 0);
    console.log(`  Restaurants with HH menu items:   ${withHHItems.length}`);
}

run();

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    const { data: entity } = await supabase
        .from('entity')
        .select('id, name')
        .eq('slug', 'cobalt-the-restaurant')
        .single();
    
    console.log(`Entity: ${entity.name} (${entity.id})\n`);
    
    // Count duplicates
    const { data: items } = await supabase
        .from('menu_items')
        .select('id, item_name, description, price, price_text, menu_section_id')
        .eq('entity_id', entity.id);
    
    console.log(`Total menu_items: ${items.length}`);
    
    // Find duplicates by name+price
    const byKey = {};
    items.forEach(i => {
        const k = `${(i.item_name||'').trim()}|${i.price||''}|${i.price_text||''}`;
        if (!byKey[k]) byKey[k] = [];
        byKey[k].push(i);
    });
    
    const dupes = Object.entries(byKey).filter(([_,a]) => a.length > 1);
    console.log(`Duplicate groups (same name+price): ${dupes.length}`);
    console.log(`Total duplicate rows: ${dupes.reduce((s,[_,a]) => s + a.length, 0)}`);
    console.log(`Unique items: ${Object.keys(byKey).length}\n`);
    
    // Top 10 most duplicated
    console.log('Top 10 most duplicated items:');
    dupes.sort((a,b) => b[1].length - a[1].length).slice(0, 10).forEach(([k, arr]) => {
        console.log(`  ${arr.length}x | "${arr[0].item_name}" @ ${arr[0].price_text || '$'+arr[0].price}`);
    });
    
    // Check sections
    const { data: sections } = await supabase
        .from('menu_sections')
        .select('id, section_name')
        .eq('entity_id', entity.id);
    console.log(`\nMenu sections: ${sections.length}`);
    
    const bySection = {};
    sections.forEach(s => bySection[s.id] = s.section_name);
    
    const sectionCounts = {};
    items.forEach(i => {
        const name = bySection[i.menu_section_id] || '(none)';
        sectionCounts[name] = (sectionCounts[name] || 0) + 1;
    });
    console.log('\nItems per section:');
    Object.entries(sectionCounts).sort((a,b) => b[1] - a[1]).forEach(([n, c]) => {
        console.log(`  ${c.toString().padStart(4)} — ${n}`);
    });
}

run();

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING ===\n');

    const { data: entity } = await supabase
        .from('entity')
        .select('id, name')
        .eq('slug', 'cobalt-the-restaurant')
        .single();

    if (!entity) { console.log('Cobalt not found'); return; }
    console.log(`Entity: ${entity.name}\n`);

    // Load all sections and items
    const { data: sections } = await supabase
        .from('menu_sections')
        .select('id, section_name, sort_order')
        .eq('entity_id', entity.id);

    const { data: items } = await supabase
        .from('menu_items')
        .select('id, item_name, description, price, price_text, menu_section_id, sort_order')
        .eq('entity_id', entity.id);

    console.log(`Before: ${sections.length} sections, ${items.length} items\n`);

    // STEP 1: Merge duplicate sections (case-insensitive name)
    // Keep the first one (by sort_order), point all items from dupes at the keeper
    const sectionsByNameLower = {};
    for (const s of sections) {
        const k = (s.section_name || '').trim().toLowerCase();
        if (!sectionsByNameLower[k]) sectionsByNameLower[k] = [];
        sectionsByNameLower[k].push(s);
    }

    const sectionsToDelete = [];
    const sectionRemap = {}; // old_id → keeper_id
    for (const [name, group] of Object.entries(sectionsByNameLower)) {
        if (group.length < 2) continue;
        // Keeper: the one with lowest sort_order (or first)
        group.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        const keeper = group[0];
        for (const dup of group.slice(1)) {
            sectionRemap[dup.id] = keeper.id;
            sectionsToDelete.push(dup);
        }
    }
    console.log(`Step 1: Duplicate sections to merge: ${sectionsToDelete.length}`);

    // Remap item section_ids
    for (const item of items) {
        if (sectionRemap[item.menu_section_id]) {
            item.menu_section_id = sectionRemap[item.menu_section_id];
        }
    }

    // STEP 2: Remove duplicate items (same name + price + section)
    const seen = new Map();
    const itemsToDelete = [];
    for (const item of items) {
        const key = `${(item.item_name || '').trim().toLowerCase()}|${item.price || ''}|${item.price_text || ''}|${item.menu_section_id || ''}`;
        if (seen.has(key)) {
            itemsToDelete.push(item);
        } else {
            seen.set(key, item.id);
        }
    }
    console.log(`Step 2: Duplicate items to delete: ${itemsToDelete.length}`);
    console.log(`   After cleanup: ${sections.length - sectionsToDelete.length} sections, ${items.length - itemsToDelete.length} items\n`);

    if (DRY_RUN) {
        console.log('Run with --apply to commit.');
        return;
    }

    // APPLY: update section remaps first
    let remapOk = 0, remapFail = 0;
    for (const [oldId, newId] of Object.entries(sectionRemap)) {
        const { error } = await supabase
            .from('menu_items')
            .update({ menu_section_id: newId })
            .eq('entity_id', entity.id)
            .eq('menu_section_id', oldId);
        if (error) { remapFail++; console.log(`  Remap FAIL: ${error.message}`); }
        else remapOk++;
    }
    console.log(`Section remaps: ${remapOk} OK / ${remapFail} failed`);

    // Delete duplicate items (batch by 100)
    let delItemOk = 0, delItemFail = 0;
    for (let i = 0; i < itemsToDelete.length; i += 100) {
        const batch = itemsToDelete.slice(i, i + 100);
        const ids = batch.map(x => x.id);
        const { error } = await supabase.from('menu_items').delete().in('id', ids);
        if (error) { delItemFail += batch.length; console.log(`  Item batch FAIL: ${error.message}`); }
        else delItemOk += batch.length;
    }
    console.log(`Items deleted: ${delItemOk} OK / ${delItemFail} failed`);

    // Delete empty sections
    let delSecOk = 0, delSecFail = 0;
    for (const s of sectionsToDelete) {
        const { error } = await supabase.from('menu_sections').delete().eq('id', s.id);
        if (error) { delSecFail++; console.log(`  Section FAIL: ${error.message}`); }
        else delSecOk++;
    }
    console.log(`Sections deleted: ${delSecOk} OK / ${delSecFail} failed`);

    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log('Cobalt cleanup complete.');
    console.log('══════════════════════════════════════════════════════════════════════');
}

run();

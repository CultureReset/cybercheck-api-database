require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

const ENTITY_ID = '7e25082f-e90e-4c89-9f9c-10471c12b628'; // The Sloop
const APPLY = process.argv.includes('--apply');

async function run() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (use --apply to commit) ===\n');

  // ── 1. DEDUPE SECTIONS ──────────────────────────────────────
  const { data: sections } = await supabase
    .from('menu_sections')
    .select('id, section_name, sort_order')
    .eq('entity_id', ENTITY_ID)
    .order('sort_order', { ascending: true });

  console.log(`Total sections: ${sections.length}`);

  // Normalize section names for comparison (lowercase, strip punctuation)
  function normSection(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const sectionGroups = {};
  sections.forEach(s => {
    const k = normSection(s.section_name);
    if (!sectionGroups[k]) sectionGroups[k] = [];
    sectionGroups[k].push(s);
  });

  const sectionRemap = {};      // old_section_id → keeper_id
  const sectionsToDelete = [];

  Object.values(sectionGroups).forEach(group => {
    if (group.length < 2) return;
    // Keep the first one (lowest sort_order)
    const keeper = group[0];
    group.slice(1).forEach(dup => {
      sectionRemap[dup.id] = keeper.id;
      sectionsToDelete.push(dup);
    });
  });

  console.log(`  unique sections: ${Object.keys(sectionGroups).length}`);
  console.log(`  duplicate sections to delete: ${sectionsToDelete.length}`);

  // ── 2. DEDUPE ITEMS (per section, after section remap) ────
  const { data: items } = await supabase
    .from('menu_items')
    .select('id, item_name, description, price, menu_section_id, tags, modifiers, photo_url, allergens')
    .eq('entity_id', ENTITY_ID);

  console.log(`\nTotal items: ${items.length}`);

  // Apply remap to get effective section_id
  items.forEach(it => {
    if (sectionRemap[it.menu_section_id]) {
      it._effectiveSectionId = sectionRemap[it.menu_section_id];
    } else {
      it._effectiveSectionId = it.menu_section_id;
    }
  });

  // Group items by (effective section + lowercase item name)
  const itemGroups = {};
  items.forEach(it => {
    const k = it._effectiveSectionId + '|' + (it.item_name || '').toLowerCase().trim();
    if (!itemGroups[k]) itemGroups[k] = [];
    itemGroups[k].push(it);
  });

  // For each group, keep the one with longest description
  const itemsToDelete = [];
  const itemsToKeep = [];

  Object.values(itemGroups).forEach(group => {
    if (group.length === 1) {
      itemsToKeep.push(group[0]);
      return;
    }
    // Sort by description length DESC, then by having tags/photos/modifiers
    const ranked = [...group].sort((a, b) => {
      const aLen = (a.description || '').length;
      const bLen = (b.description || '').length;
      if (aLen !== bLen) return bLen - aLen;
      const aRich = ((a.tags?.length || 0) + (a.modifiers?.length || 0) + (a.photo_url ? 1 : 0));
      const bRich = ((b.tags?.length || 0) + (b.modifiers?.length || 0) + (b.photo_url ? 1 : 0));
      return bRich - aRich;
    });
    itemsToKeep.push(ranked[0]);
    ranked.slice(1).forEach(dup => itemsToDelete.push(dup));
  });

  console.log(`  unique items: ${itemsToKeep.length}`);
  console.log(`  duplicate items to delete: ${itemsToDelete.length}`);
  console.log(`\nFinal menu after dedupe: ${Object.keys(sectionGroups).length} sections, ${itemsToKeep.length} items`);

  if (!APPLY) {
    console.log('\nRun with --apply to commit deletions.');
    return;
  }

  // ── APPLY ──────────────────────────────────────────────────
  // Step 1: Remap items in duplicate sections to point at keeper section
  let remapOk = 0, remapFail = 0;
  for (const [oldId, newId] of Object.entries(sectionRemap)) {
    const { error } = await supabase
      .from('menu_items')
      .update({ menu_section_id: newId })
      .eq('entity_id', ENTITY_ID)
      .eq('menu_section_id', oldId);
    if (error) { remapFail++; console.log(`  ❌ Section remap failed: ${error.message}`); }
    else remapOk++;
  }
  console.log(`\n✅ Section remaps: ${remapOk} ok / ${remapFail} failed`);

  // Step 2: Delete duplicate items (in batches of 100)
  let delItems = 0;
  for (let i = 0; i < itemsToDelete.length; i += 100) {
    const ids = itemsToDelete.slice(i, i + 100).map(x => x.id);
    const { error } = await supabase.from('menu_items').delete().in('id', ids);
    if (error) console.log(`  ❌ Item delete batch failed: ${error.message}`);
    else delItems += ids.length;
  }
  console.log(`✅ Items deleted: ${delItems}`);

  // Step 3: Delete now-empty duplicate sections
  let delSecs = 0;
  for (const s of sectionsToDelete) {
    const { error } = await supabase.from('menu_sections').delete().eq('id', s.id);
    if (error) console.log(`  ❌ Section delete failed: ${error.message}`);
    else delSecs++;
  }
  console.log(`✅ Sections deleted: ${delSecs}`);

  console.log(`\n✅ DONE — The Sloop now has ${Object.keys(sectionGroups).length} sections, ${itemsToKeep.length} items`);
}

run().catch(e => { console.error(e); process.exit(1); });

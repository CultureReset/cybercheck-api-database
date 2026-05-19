require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');
const path = require('path');

async function matchRestaurants() {
  try {
    const db = getGcrDb();

    console.log('🔍 Fetching entities from GCR database...\n');

    // Get all entities
    const { data: entities, error } = await db
      .from('entity')
      .select('id, name, slug, address_line_1, city')
      .eq('is_active', true);

    if (error) throw error;

    console.log(`✓ Found ${entities.length} ACTIVE entities in database\n`);

    // Load extracted restaurants index
    const indexPath = './extracted-restaurants/INDEX.json';
    const extracted = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    console.log(`✓ Found ${extracted.length} extracted restaurants\n`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Create lookup maps
    const entitiesByName = {};
    const entitiesBySlug = {};

    entities.forEach(e => {
      const nameLower = (e.name || '').toLowerCase().trim();
      const slugLower = (e.slug || '').toLowerCase().trim();

      if (nameLower) entitiesByName[nameLower] = e;
      if (slugLower) entitiesBySlug[slugLower] = e;
    });

    // Match extracted to entities
    const matched = [];
    const unmatched = [];
    const partialMatches = [];

    extracted.forEach(rest => {
      const restNameLower = rest.name.toLowerCase().trim();
      const folderLower = rest.folder.toLowerCase().trim();

      // Exact name match
      if (entitiesByName[restNameLower]) {
        matched.push({
          extracted: rest,
          entity: entitiesByName[restNameLower],
          matchType: 'exact_name'
        });
        return;
      }

      // Slug match
      if (entitiesBySlug[folderLower]) {
        matched.push({
          extracted: rest,
          entity: entitiesBySlug[folderLower],
          matchType: 'slug'
        });
        return;
      }

      // Partial name match (first 3+ words)
      const words = restNameLower.split(' ').filter(w => w.length > 2);
      let found = false;

      for (const [entityName, entity] of Object.entries(entitiesByName)) {
        const entityWords = entityName.split(' ').filter(w => w.length > 2);
        const matches = words.filter(w => entityWords.includes(w)).length;

        if (matches >= Math.min(2, words.length) && matches >= 2) {
          partialMatches.push({
            extracted: rest,
            entity: entity,
            matchType: 'partial',
            similarity: matches
          });
          found = true;
          break;
        }
      }

      if (!found) {
        unmatched.push(rest);
      }
    });

    // Display results
    console.log(`✅ EXACT MATCHES: ${matched.length} restaurants\n`);

    if (matched.length > 0) {
      matched.slice(0, 15).forEach(m => {
        console.log(`  ${m.extracted.name}`);
        console.log(`     ID: ${m.entity.id}`);
        console.log(`     Menu items: ${m.extracted.menu_items}`);
        console.log();
      });
      if (matched.length > 15) {
        console.log(`  ... and ${matched.length - 15} more\n`);
      }
    }

    console.log(`\n⚠️  PARTIAL MATCHES: ${partialMatches.length} restaurants\n`);

    if (partialMatches.length > 0) {
      partialMatches.slice(0, 10).forEach(m => {
        console.log(`  ${m.extracted.name} ~> ${m.entity.name}`);
        console.log(`     Extracted: ${m.extracted.menu_items} menu items`);
        console.log();
      });
      if (partialMatches.length > 10) {
        console.log(`  ... and ${partialMatches.length - 10} more\n`);
      }
    }

    console.log(`\n❌ NO MATCH: ${unmatched.length} restaurants\n`);

    if (unmatched.length > 0) {
      unmatched.slice(0, 15).forEach(u => {
        console.log(`  ${u.name} (${u.menu_items} items)`);
      });
      if (unmatched.length > 15) {
        console.log(`  ... and ${unmatched.length - 15} more\n`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('📊 MATCH SUMMARY\n');
    console.log(`Exact matches:     ${matched.length}`);
    console.log(`Partial matches:   ${partialMatches.length} (need review)`);
    console.log(`No match:          ${unmatched.length} (need to create)`);
    console.log(`\nTotal matches:     ${matched.length + partialMatches.length} / ${extracted.length} (${Math.round((matched.length + partialMatches.length) / extracted.length * 100)}%)`);

    // Data available for import
    const matchedMenuItems = matched.reduce((sum, m) => sum + m.extracted.menu_items, 0);
    const partialMenuItems = partialMatches.reduce((sum, m) => sum + m.extracted.menu_items, 0);
    const unmatchedMenuItems = unmatched.reduce((sum, u) => sum + u.menu_items, 0);

    console.log(`\n💾 IMPORT READY\n`);
    console.log(`Menu items ready to import (exact matches):   ${matchedMenuItems}`);
    console.log(`Menu items in partial matches (review):       ${partialMenuItems}`);
    console.log(`Menu items in unmatched restaurants:          ${unmatchedMenuItems}`);

    // Save results to JSON for reference
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        exact_matches: matched.length,
        partial_matches: partialMatches.length,
        unmatched: unmatched.length,
        total_extracted: extracted.length,
        total_entities: entities.length
      },
      exact_matches: matched.map(m => ({
        entity_id: m.entity.id,
        entity_name: m.entity.name,
        extracted_name: m.extracted.name,
        menu_items: m.extracted.menu_items,
        specials: m.extracted.specials,
        folder: m.extracted.folder
      })),
      partial_matches: partialMatches.map(m => ({
        entity_id: m.entity.id,
        entity_name: m.entity.name,
        extracted_name: m.extracted.name,
        menu_items: m.extracted.menu_items,
        folder: m.extracted.folder
      }))
    };

    fs.writeFileSync('./match-results.json', JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to match-results.json\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

matchRestaurants();

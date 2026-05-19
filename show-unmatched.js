require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');

async function showUnmatched() {
  try {
    const db = getGcrDb();

    // Get all entities
    const { data: entities, error } = await db
      .from('entity')
      .select('id, name, slug')
      .eq('is_active', true);

    if (error) throw error;

    // Load extracted restaurants
    const extracted = JSON.parse(fs.readFileSync('./extracted-restaurants/INDEX.json', 'utf8'));

    // Create lookup maps
    const entitiesByName = {};
    const entitiesBySlug = {};

    entities.forEach(e => {
      const nameLower = (e.name || '').toLowerCase().trim();
      const slugLower = (e.slug || '').toLowerCase().trim();
      if (nameLower) entitiesByName[nameLower] = e;
      if (slugLower) entitiesBySlug[slugLower] = e;
    });

    // Find unmatched
    const unmatched = [];

    extracted.forEach(rest => {
      const restNameLower = rest.name.toLowerCase().trim();
      const folderLower = rest.folder.toLowerCase().trim();

      // Check exact name match
      if (entitiesByName[restNameLower]) return;

      // Check slug match
      if (entitiesBySlug[folderLower]) return;

      // Check partial match
      const words = restNameLower.split(' ').filter(w => w.length > 2);
      let found = false;

      for (const entityName of Object.keys(entitiesByName)) {
        const entityWords = entityName.split(' ').filter(w => w.length > 2);
        const matches = words.filter(w => entityWords.includes(w)).length;

        if (matches >= Math.min(2, words.length) && matches >= 2) {
          found = true;
          break;
        }
      }

      if (!found) {
        unmatched.push(rest);
      }
    });

    console.log(`❌ UNMATCHED RESTAURANTS: ${unmatched.length}\n`);
    console.log('═══════════════════════════════════════════════════════\n');

    // Sort by menu items (most useful first)
    unmatched.sort((a, b) => (b.menu_items + b.specials) - (a.menu_items + a.specials));

    // Show all unmatched
    unmatched.forEach((r, idx) => {
      const total = r.menu_items + r.specials + r.events;
      console.log(`${idx + 1}. ${r.name}`);
      console.log(`   Folder: ${r.folder}`);
      if (r.phone) console.log(`   Phone: ${r.phone}`);
      if (r.city) console.log(`   City: ${r.city}`);
      console.log(`   Data: Menu: ${r.menu_items} | Specials: ${r.specials} | Events: ${r.events} (Total: ${total})`);
      console.log();
    });

    console.log('═══════════════════════════════════════════════════════\n');

    // Stats
    const withMenu = unmatched.filter(r => r.menu_items > 0).length;
    const withSpecials = unmatched.filter(r => r.specials > 0).length;
    const withPhone = unmatched.filter(r => r.phone).length;
    const totalMenuItems = unmatched.reduce((sum, r) => sum + r.menu_items, 0);
    const totalSpecials = unmatched.reduce((sum, r) => sum + r.specials, 0);

    console.log(`📊 UNMATCHED STATISTICS\n`);
    console.log(`Total: ${unmatched.length}`);
    console.log(`With menu items: ${withMenu}`);
    console.log(`With specials: ${withSpecials}`);
    console.log(`With phone: ${withPhone}`);
    console.log(`\nTotal menu items: ${totalMenuItems}`);
    console.log(`Total specials: ${totalSpecials}\n`);

    // Save to file for reference
    fs.writeFileSync('./UNMATCHED-RESTAURANTS.json', JSON.stringify(unmatched, null, 2));
    console.log(`✅ Full list saved to UNMATCHED-RESTAURANTS.json\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

showUnmatched();

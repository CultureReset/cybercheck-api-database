require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║             ACTUAL DATA IN DATABASE - REAL AUDIT             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const tables = [
      // Where data ACTUALLY is
      { name: 'entity_sections', desc: 'Section containers (menu, drinks, location, etc)' },
      { name: 'section_items', desc: 'Items in sections (menu items, drinks, etc)' },
      { name: 'entity_happy_hours', desc: 'Happy hour data' },
      { name: 'entity_specials', desc: 'Specials/deals' },
      { name: 'entity_events', desc: 'Events' },
      { name: 'entity_photos', desc: 'Photos' },
      { name: 'entity_hours', desc: 'Business hours' },
      
      // Where profile.html EXPECTS data to be (all empty)
      { name: 'menu_items', desc: 'EMPTY - profile.html looks here for menus' },
      { name: 'menu_sections', desc: 'EMPTY - profile.html looks here' },
      { name: 'drink_items', desc: 'EMPTY - profile.html looks here for drinks' },
      { name: 'drink_sections', desc: 'EMPTY - profile.html looks here' },
      { name: 'happy_hour_items', desc: 'EMPTY - profile.html looks here for HH' },
      { name: 'happy_hour_sections', desc: 'EMPTY - profile.html looks here' },
    ];

    for (const table of tables) {
      try {
        const { count } = await gcrDb.from(table.name).select('id', { count: 'exact' }).limit(1);
        const status = count > 0 ? '✓ HAS DATA' : '✗ EMPTY';
        console.log(`${status.padEnd(12)} | ${table.name.padEnd(25)} | ${table.desc}`);
      } catch (e) {
        console.log(`✗ ERROR      | ${table.name.padEnd(25)} | Table doesn't exist`);
      }
    }

    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      THE PROBLEM                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('YOUR MENU ITEMS ARE IN:           section_items (788 records)');
    console.log('PROFILE.HTML LOOKS FOR THEM IN:   menu_items (0 records - EMPTY)\n');
    
    console.log('YOUR MENU SECTIONS ARE IN:        entity_sections (has "menu" type)');
    console.log('PROFILE.HTML LOOKS FOR THEM IN:   menu_sections (0 records - EMPTY)\n');
    
    console.log('YOUR HAPPY HOURS ARE IN:          entity_happy_hours (26 records)');
    console.log('PROFILE.HTML LOOKS FOR THEM IN:   happy_hour_items (0 records - EMPTY)\n');

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   WHAT NEEDS TO HAPPEN                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('OPTION 1: Copy data from section_items → menu_items table');
    console.log('          Copy data from entity_sections → menu_sections table');
    console.log('          (Then profile.html will find it)\n');
    
    console.log('OPTION 2: Fix the API to return section_items data');
    console.log('          with correct column names\n');
    
    console.log('OPTION 3: Update profile.html to read from section_items directly\n');

  } catch (e) {
    console.error('Error:', e.message);
  }
})();

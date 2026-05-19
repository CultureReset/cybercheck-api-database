require('dotenv').config();
const fs = require('fs');
const XLSX = require('xlsx');
const getGcrDb = require('../gcr-db');

async function exportWithMenus() {
  try {
    console.log('Loading scraped menu data...');
    const menuData = JSON.parse(fs.readFileSync('menus-matched.json', 'utf8'));
    console.log(`✓ Loaded ${menuData.length} restaurants with scraped menus\n`);

    // Build menu lookup
    const menusByEntity = {};
    let totalMenuItems = 0;
    
    menuData.forEach(item => {
      menusByEntity[item.entity_id] = {
        name: item.entity_name,
        slug: item.slug,
        url: item.restaurant_url,
        sections: item.menu_data.menu_sections || [],
        total_items: item.menu_data.total_items_found || 0,
        screenshots: item.screenshots_analyzed || 0
      };
      totalMenuItems += item.menu_data.total_items_found || 0;
    });

    console.log(`✓ Total menu items scraped: ${totalMenuItems}\n`);

    // Get active entities
    const db = getGcrDb();
    const { data: entities } = await db
      .from('entity')
      .select('*')
      .eq('is_active', true)
      .order('name');

    console.log(`✓ Active entities: ${entities.length}`);

    // Build data
    const csvData = [];

    for (const entity of entities) {
      const menu = menusByEntity[entity.id];

      if (menu) {
        // For each menu section, create a row
        for (const section of menu.sections) {
          for (const item of section.items) {
            csvData.push({
              'Status': 'ACTIVE',
              'Restaurant': menu.name,
              'Entity ID': entity.id,
              'City': entity.city || '',
              'Phone': entity.phone || '',
              'Website': entity.website_url || '',
              'Menu Section': section.section_name || 'Unknown',
              'Item Name': item.name || '',
              'Price': item.price || '',
              'Description': (item.description || '').substring(0, 100),
              'Dietary Tags': (item.dietary_tags || []).join('; '),
              'Vegetarian': item.dietary_tags?.includes('vegetarian') ? 'YES' : '',
              'Vegan': item.dietary_tags?.includes('vegan') ? 'YES' : '',
              'Gluten Free': item.dietary_tags?.includes('gluten-free') ? 'YES' : '',
              'Dairy Free': item.dietary_tags?.includes('dairy-free') ? 'YES' : '',
              'Size Options': (item.size_options || []).join('; '),
              'Spicy Level': item.spicy_level || '',
              'Notes': item.notes || '',
              'Screenshots Analyzed': menu.screenshots,
              'Total Items in Restaurant': menu.total_items,
              'Restaurant URL': menu.url || ''
            });
          }
        }
      } else {
        // Entity with no menu - show as summary row
        csvData.push({
          'Status': 'NO MENU',
          'Restaurant': entity.name || '',
          'Entity ID': entity.id,
          'City': entity.city || '',
          'Phone': entity.phone || '',
          'Website': entity.website_url || '',
          'Menu Section': '❌ NO MENU SCRAPED',
          'Item Name': '',
          'Price': '',
          'Description': '',
          'Dietary Tags': '',
          'Screenshots Analyzed': 0,
          'Total Items in Restaurant': 0,
          'Restaurant URL': ''
        });
      }
    }

    // Write to Excel
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Menus + Items');

    const outputPath = '/Users/owner/cybercheck-api-database/MENUS-WITH-ITEMS.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Menu export created!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Restaurants with menus: ${Object.keys(menusByEntity).length}`);
    console.log(`   Total menu items: ${totalMenuItems}`);
    console.log(`   Restaurants without menus: ${entities.length - Object.keys(menusByEntity).length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportWithMenus();

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const getGcrDb = require('../gcr-db');

async function exportMasterComplete() {
  try {
    console.log('⏳ Building MASTER EXPORT with everything...\n');

    // Load menu data
    const menuData = JSON.parse(fs.readFileSync('menus-matched.json', 'utf8'));
    const menusByEntity = {};
    menuData.forEach(item => {
      if (item.entity_id) {
        menusByEntity[item.entity_id] = {
          name: item.entity_name,
          items_count: item.menu_data?.total_items_found || 0,
          sections: item.menu_data?.menu_sections || []
        };
      }
    });

    console.log(`✓ Loaded ${Object.keys(menusByEntity).length} restaurants with menus\n`);

    // Get screenshots
    const screenshotDir = './screenshots';
    const screenshots = fs.readdirSync(screenshotDir).filter(f => !f.startsWith('.'));
    console.log(`✓ Found ${screenshots.length} screenshot directories\n`);

    // Get active entities
    const db = getGcrDb();
    const { data: entities } = await db
      .from('entity')
      .select('*')
      .eq('is_active', true)
      .order('name');

    console.log(`✓ Active entities: ${entities.length}\n`);

    // Sheet 1: Summary - All entities with counts
    const summaryData = entities.map(e => {
      const menu = menusByEntity[e.id];
      const hasScreenshots = screenshots.includes(e.slug);
      const screenshotCount = hasScreenshots 
        ? fs.readdirSync(path.join(screenshotDir, e.slug)).length 
        : 0;

      return {
        'Restaurant': e.name || '',
        'City': e.city || '',
        'Type': e.entity_type || '',
        'Phone': e.phone || '',
        'Website': e.website_url || '',
        'Menu Items': menu?.items_count || 0,
        'Menu Sections': menu?.sections?.length || 0,
        'Has Screenshots': hasScreenshots ? `YES (${screenshotCount})` : 'NO',
        'Entity ID': e.id
      };
    });

    // Sheet 2: Full entity details
    const fullDetailsData = entities.map(e => {
      const menu = menusByEntity[e.id];
      const hasScreenshots = screenshots.includes(e.slug);
      const screenshotCount = hasScreenshots 
        ? fs.readdirSync(path.join(screenshotDir, e.slug)).length 
        : 0;

      return {
        'ID': e.id,
        'Name': e.name || '',
        'Type': e.entity_type || '',
        'Subtype': e.entity_subtype || '',
        'Description': (e.description || '').substring(0, 150),
        'Address': e.address_line_1 || '',
        'City': e.city || '',
        'State': e.state || '',
        'Zip': e.zip || '',
        'Phone': e.phone || '',
        'Website': e.website_url || '',
        'Instagram': e.social_instagram || '',
        'Facebook': e.social_facebook || '',
        'Hours': e.hours_text || '',
        'Rating': e.rating || '',
        'Reviews': e.review_count || 0,
        'Menu Status': menu ? '✓ HAS MENU' : '❌ NO MENU',
        'Menu Items Count': menu?.items_count || 0,
        'Menu Sections': menu?.sections?.length || 0,
        'Screenshots': hasScreenshots ? `✓ YES - ${screenshotCount} files` : '❌ NO',
        'Screenshot Path': hasScreenshots ? `./screenshots/${e.slug}/` : '',
        'Slug': e.slug || '',
        'Created': e.created_at?.split('T')[0] || '',
        'Updated': e.updated_at?.split('T')[0] || ''
      };
    });

    // Sheet 3: All menu items detail
    const menuItemsData = [];
    entities.forEach(e => {
      const menu = menusByEntity[e.id];
      if (menu && menu.sections) {
        menu.sections.forEach(section => {
          section.items?.forEach(item => {
            menuItemsData.push({
              'Restaurant': e.name || '',
              'Entity ID': e.id,
              'City': e.city || '',
              'Phone': e.phone || '',
              'Menu Section': section.section_name || '',
              'Item Name': item.name || '',
              'Price': item.price || '',
              'Description': (item.description || '').substring(0, 80),
              'Vegetarian': item.dietary_tags?.includes('vegetarian') ? 'YES' : '',
              'Vegan': item.dietary_tags?.includes('vegan') ? 'YES' : '',
              'Gluten Free': item.dietary_tags?.includes('gluten-free') ? 'YES' : ''
            });
          });
        });
      }
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fullDetailsData), 'Full Details');
    if (menuItemsData.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(menuItemsData), 'Menu Items');
    }

    const outputPath = '/Users/owner/cybercheck-api-database/MASTER-COMPLETE-AUDIT.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`✅ MASTER EXPORT CREATED!`);
    console.log(`📁 File: ${outputPath}`);
    console.log(`\n📊 Contents:`);
    console.log(`   Sheet 1: Summary - Quick overview of all ${entities.length} entities`);
    console.log(`   Sheet 2: Full Details - Complete entity information`);
    if (menuItemsData.length > 0) {
      console.log(`   Sheet 3: Menu Items - All ${menuItemsData.length} menu items`);
    }
    console.log(`\n📈 Statistics:`);
    console.log(`   Total entities: ${entities.length}`);
    console.log(`   With menus: ${Object.keys(menusByEntity).length}`);
    console.log(`   With screenshots: ${screenshots.length}`);
    console.log(`   Total menu items: ${menuItemsData.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportMasterComplete();

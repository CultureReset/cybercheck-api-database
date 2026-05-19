require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const getGcrDb = require('../gcr-db');

async function exportUltimateMaster() {
  try {
    console.log('⏳ Building ULTIMATE MASTER EXPORT...\n');

    // Load all scraped data
    const gcrBackup = JSON.parse(fs.readFileSync('gulf-coast-radar-all-data.json', 'utf8'));
    const profilesBackup = JSON.parse(fs.readFileSync('profiles-all-data.json', 'utf8'));
    const menuMatched = JSON.parse(fs.readFileSync('menus-matched.json', 'utf8'));
    const featuredPartners = JSON.parse(fs.readFileSync('featured-partners-scraped.json', 'utf8'));

    console.log(`✓ GCR Backup: ${gcrBackup.summary.menu_items} menu items`);
    console.log(`✓ Profiles Backup: ${profilesBackup.summary.menu_items} menu items`);
    console.log(`✓ Web Scraped Menus: ${menuMatched.reduce((sum, m) => sum + (m.menu_data?.total_items_found || 0), 0)} items`);
    console.log(`✓ Featured Partners: ${featuredPartners.length} businesses\n`);

    // Get current DB entities
    const db = getGcrDb();
    const { data: entities } = await db
      .from('entity')
      .select('*')
      .eq('is_active', true)
      .order('name');

    console.log(`✓ Active entities in DB: ${entities.length}\n`);

    // Get screenshots
    const screenshotDir = './screenshots';
    const screenshots = fs.readdirSync(screenshotDir).filter(f => !f.startsWith('.'));
    
    console.log(`✓ Screenshots: ${screenshots.length} directories\n`);

    // Build web-scraped menu lookup
    const webScrapedMenus = {};
    menuMatched.forEach(m => {
      if (m.entity_id) {
        webScrapedMenus[m.entity_id] = {
          source: 'web-scraped',
          items_count: m.menu_data?.total_items_found || 0,
          sections: m.menu_data?.menu_sections?.length || 0,
          url: m.restaurant_url,
          screenshots_analyzed: m.screenshots_analyzed
        };
      }
    });

    // Build backup menu lookup from GCR data
    const backupMenus = {};
    if (gcrBackup.data?.menu_items) {
      gcrBackup.data.menu_items.forEach(item => {
        if (item.site_id) {
          if (!backupMenus[item.site_id]) {
            backupMenus[item.site_id] = { source: 'gcr-backup', items: [], total: 0 };
          }
          backupMenus[item.site_id].items.push(item);
          backupMenus[item.site_id].total++;
        }
      });
    }

    // Build featured partners lookup
    const partnerLookup = {};
    featuredPartners.forEach(p => {
      if (p.place_id) {
        partnerLookup[p.place_id] = {
          name: p.name,
          address: p.formatted_address,
          phone: p.formatted_phone_number,
          rating: p.rating,
          reviews: p.user_ratings_total,
          types: p.types,
          website: p.website,
          photos_count: p.photos?.length || 0
        };
      }
    });

    // Build comprehensive entity data
    const entityData = entities.map(e => {
      const webMenu = webScrapedMenus[e.id];
      const backupMenu = backupMenus[e.id];
      const hasScreenshots = screenshots.includes(e.slug);
      const partner = partnerLookup[e.place_id];
      const screenshotCount = hasScreenshots 
        ? fs.readdirSync(path.join(screenshotDir, e.slug)).length 
        : 0;

      return {
        'Restaurant': e.name || '',
        'Entity ID': e.id,
        'Slug': e.slug || '',
        'City': e.city || '',
        'Phone': e.phone || '',
        'Website': e.website_url || '',
        'Type': e.entity_type || '',
        
        // Web Scraped Data
        'Web Scraped Items': webMenu?.items_count || 0,
        'Web Scraped Sections': webMenu?.sections || 0,
        'Web Scraped URL': webMenu?.url || '',
        
        // Backup Data
        'Backup Menu Items': backupMenu?.total || 0,
        
        // Featured Partner Data
        'Partner Rating': partner?.rating || '',
        'Partner Reviews': partner?.reviews || 0,
        'Partner Photos': partner?.photos_count || 0,
        
        // Screenshots
        'Has Screenshots': hasScreenshots ? `YES (${screenshotCount})` : 'NO',
        'Screenshot Path': hasScreenshots ? `./screenshots/${e.slug}/` : '',
        
        // Status
        'Data Status': webMenu ? '✓ Web Menu' : (backupMenu ? '✓ Backup Menu' : '❌ No Menu'),
        'Total Available Menu Items': (webMenu?.items_count || 0) + (backupMenu?.total || 0)
      };
    });

    // Web scraped menu items sheet
    const webMenuItems = [];
    menuMatched.forEach(m => {
      if (m.menu_data?.menu_sections) {
        m.menu_data.menu_sections.forEach(section => {
          section.items?.forEach(item => {
            webMenuItems.push({
              'Source': 'WEB-SCRAPED',
              'Restaurant': m.entity_name,
              'Entity ID': m.entity_id,
              'Menu Section': section.section_name,
              'Item': item.name,
              'Price': item.price || '',
              'Description': (item.description || '').substring(0, 60),
              'Vegetarian': item.dietary_tags?.includes('vegetarian') ? '✓' : '',
              'Vegan': item.dietary_tags?.includes('vegan') ? '✓' : '',
              'Gluten Free': item.dietary_tags?.includes('gluten-free') ? '✓' : ''
            });
          });
        });
      }
    });

    // Backup menu items sheet (sample from GCR)
    const backupMenuItems = [];
    if (gcrBackup.data?.menu_items) {
      gcrBackup.data.menu_items.slice(0, 1000).forEach(item => {
        backupMenuItems.push({
          'Source': 'GCR-BACKUP',
          'Site ID': item.site_id,
          'Section': item.menu_section_id || '',
          'Item': item.name,
          'Price': item.price || '',
          'Description': (item.description || '').substring(0, 60),
          'Available': item.available ? '✓' : '',
          'Modified': item.modified_at ? 'YES' : ''
        });
      });
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entityData), 'Entities Overview');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(webMenuItems), 'Web Scraped Items');
    if (backupMenuItems.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(backupMenuItems), 'Backup Items (Sample)');
    }

    const outputPath = '/Users/owner/cybercheck-api-database/ULTIMATE-MASTER-ALL-DATA.xlsx';
    XLSX.writeFile(wb, outputPath);

    console.log(`✅ ULTIMATE MASTER CREATED!`);
    console.log(`📁 File: ${outputPath}\n`);
    console.log(`📊 3 Sheets:`);
    console.log(`   1. Entities Overview (921 rows)`);
    console.log(`   2. Web Scraped Items (${webMenuItems.length} rows)`);
    console.log(`   3. Backup Items Sample (${backupMenuItems.length} rows)`);
    console.log(`\n📈 TOTALS:`);
    console.log(`   Entities with ANY menu data: ${entities.filter(e => webScrapedMenus[e.id] || backupMenus[e.id]).length}`);
    console.log(`   Web scraped menu items: ${webMenuItems.length}`);
    console.log(`   Backup menu items: ${gcrBackup.summary.menu_items}`);
    console.log(`   With screenshots: ${screenshots.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

exportUltimateMaster();

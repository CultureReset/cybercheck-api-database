#!/usr/bin/env node
/**
 * UPLOAD EXTRACTED MENUS TO DATABASE
 * Matches extracted menu data to businesses by website URL
 * Uploads to menu_items table
 *
 * Usage:
 *   node upload-menus-to-db.js                    — upload all
 *   node upload-menus-to-db.js --dry-run          — preview without uploading
 *   node upload-menus-to-db.js --force            — force re-upload
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SHOTS_DIR = '/Users/owner/cybercheck-api-database/screenshots';

function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function normalizeUrl(url) {
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

async function findBusinessByUrl(restaurantUrl) {
  if (!restaurantUrl) return null;

  const normalizedUrl = normalizeUrl(restaurantUrl);
  const domain = extractDomain(restaurantUrl);

  if (!normalizedUrl && !domain) return null;

  // Try exact URL match first
  if (normalizedUrl) {
    const { data, error } = await supabase
      .from('site_content')
      .select('site_id')
      .eq('website_url', normalizedUrl)
      .single();

    if (data) return data.site_id;
  }

  // Try domain match
  if (domain) {
    const { data, error } = await supabase
      .from('site_content')
      .select('site_id')
      .ilike('website_url', `%${domain}%`)
      .single();

    if (data) return data.site_id;
  }

  return null;
}

async function uploadMenuItems(folder, options = {}) {
  const menuPath = path.join(SHOTS_DIR, folder, 'menu-detailed.json');

  if (!fs.existsSync(menuPath)) {
    return { folder, status: 'skipped', reason: 'no_menu_data' };
  }

  const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

  // Find business by URL
  const siteId = await findBusinessByUrl(menuData.url);
  if (!siteId) {
    return { folder, status: 'failed', reason: 'no_matching_business' };
  }

  // Transform menu items
  const itemsToInsert = [];
  for (const section of menuData.menu_data.menu_sections || []) {
    for (const item of section.items || []) {
      itemsToInsert.push({
        site_id: siteId,
        name: item.name,
        description: item.description || null,
        price: item.price ? parseFloat(item.price.replace(/[$,]/g, '')) : null,
        category: section.section_name,
        tags: [
          ...(item.dietary_tags || []),
          ...(item.size_options || []),
          item.spicy_level ? `spicy_${item.spicy_level}` : null,
        ].filter(Boolean),
        allergens: [], // Could enhance this to extract from description
        available: true,
      });
    }
  }

  if (itemsToInsert.length === 0) {
    return { folder, status: 'failed', reason: 'no_items' };
  }

  if (options.dryRun) {
    return {
      folder,
      status: 'preview',
      site_id: siteId,
      items_count: itemsToInsert.length,
      sample: itemsToInsert.slice(0, 2),
    };
  }

  try {
    // Delete existing items for this restaurant (if --force)
    if (options.force) {
      await supabase.from('menu_items').delete().eq('site_id', siteId);
    }

    // Insert new items
    const { data, error } = await supabase
      .from('menu_items')
      .insert(itemsToInsert)
      .select('id');

    if (error) {
      return {
        folder,
        status: 'failed',
        reason: error.message,
      };
    }

    return {
      folder,
      status: 'success',
      site_id: siteId,
      items_uploaded: data.length,
    };
  } catch (error) {
    return {
      folder,
      status: 'failed',
      reason: error.message,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  };

  // Get all restaurants with menu data
  const folders = fs
    .readdirSync(SHOTS_DIR)
    .filter(f => {
      const menuPath = path.join(SHOTS_DIR, f, 'menu-detailed.json');
      return fs.existsSync(menuPath);
    })
    .sort();

  console.log(`\n📤 MENU UPLOAD TO DATABASE`);
  console.log(`===========================`);
  console.log(`Restaurants with menu data: ${folders.length}`);
  if (opts.dryRun) console.log(`Mode: DRY RUN (no upload)`);
  if (opts.force) console.log(`Mode: FORCE RE-UPLOAD\n`);

  const results = [];
  let successCount = 0;
  let totalItems = 0;

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const progress = `[${String(i + 1).padStart(3)}/${folders.length}]`;

    process.stdout.write(`${progress} ${folder.padEnd(45)} `);

    const result = await uploadMenuItems(folder, opts);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
      totalItems += result.items_uploaded;
      console.log(`✓ (${result.items_uploaded} items)`);
    } else if (result.status === 'preview') {
      console.log(`👁️ preview (${result.items_count} items)`);
    } else if (result.status === 'skipped') {
      console.log(`⊘ ${result.reason}`);
    } else {
      console.log(`✗ ${result.reason}`);
    }

    // Rate limiting
    if (i < folders.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Summary
  const summary = {
    generated_at: new Date().toISOString(),
    mode: opts.dryRun ? 'dry_run' : 'upload',
    total_processed: folders.length,
    successful: successCount,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    total_items_uploaded: totalItems,
    results,
  };

  fs.writeFileSync(
    path.join(SHOTS_DIR, '..', 'menu-upload-results.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n\n${opts.dryRun ? '👁️' : '✓'} COMPLETE`);
  console.log(`${opts.dryRun ? '====' : '====='}`);
  console.log(`Processed: ${folders.length}`);
  if (successCount > 0) console.log(`Uploaded: ${totalItems} items`);
  console.log(`Results: menu-upload-results.json`);
}

main().catch(console.error);

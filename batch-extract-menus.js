#!/usr/bin/env node
/**
 * BATCH EXTRACT MENUS - DETAILED
 * Extracts menu items with full details: name, price, description, dietary info
 *
 * Usage:
 *   node batch-extract-menus.js                — extract all
 *   node batch-extract-menus.js --force        — redo existing
 */

require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();
const SHOTS_DIR = "/Users/owner/cybercheck-api-database/screenshots";

async function extractMenus(folder, options = {}) {
  const indexPath = path.join(SHOTS_DIR, folder, "index.json");
  const menuPath = path.join(SHOTS_DIR, folder, "menu-detailed.json");

  // Skip if already done (unless --force)
  if (fs.existsSync(menuPath) && !options.force) {
    return { folder, status: "skipped" };
  }

  // Read index
  if (!fs.existsSync(indexPath)) {
    return { folder, status: "failed", reason: "no_index.json" };
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const screenshotsDir = path.join(SHOTS_DIR, folder);

  // Find menu pages
  const menuPages = [];
  const menuKeywords = ["menu", "food", "drink", "entree", "appetizer", "dessert", "lunch", "dinner"];

  for (const page of index.pages) {
    const urlLower = page.url.toLowerCase();
    if (menuKeywords.some(kw => urlLower.includes(kw))) {
      menuPages.push({
        url: page.url,
        files: page.files.slice(0, 3),
      });
    }
    if (menuPages.length >= 5) break;
  }

  if (menuPages.length === 0) {
    return { folder, status: "failed", reason: "no_menu_pages" };
  }

  // Build image content
  const imageContent = [];
  let imageCount = 0;

  for (const page of menuPages) {
    for (const file of page.files) {
      const imagePath = path.join(screenshotsDir, file);
      if (!fs.existsSync(imagePath)) continue;

      const imageData = fs.readFileSync(imagePath);
      const base64 = imageData.toString("base64");

      imageContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64,
        },
      });
      imageCount++;

      if (imageCount >= 10) break;
    }
    if (imageCount >= 10) break;
  }

  if (imageCount === 0) {
    return { folder, status: "failed", reason: "image_read_failed" };
  }

  // Detailed menu extraction prompt
  imageContent.push({
    type: "text",
    text: `Extract ALL menu items from these screenshots with complete details. Return ONLY valid JSON:
{
  "restaurant": string,
  "menu_sections": [
    {
      "section_name": string (e.g., "Appetizers", "Main Courses", "Desserts"),
      "items": [
        {
          "name": string,
          "price": string (with $ if shown),
          "description": string (full description if available),
          "dietary_tags": [string] (e.g., ["vegan", "gluten-free", "vegetarian", "dairy-free", "nut-free"]),
          "size_options": [string] (if applicable, e.g., ["small", "medium", "large"]),
          "spicy_level": string or null (e.g., "mild", "medium", "hot" if indicated),
          "notes": string or null (any additional info like "seasonal" or "limited")
        }
      ]
    }
  ],
  "total_items_found": number,
  "dietary_summary": {
    "vegan_items": number,
    "vegetarian_items": number,
    "gluten_free_items": number,
    "dairy_free_items": number
  }
}

IMPORTANT:
- Extract EVERY menu item visible, don't miss any
- Include full price and description for each
- Mark dietary restrictions even if implied (e.g., salad = vegetarian)
- Include section names (Appetizers, Mains, etc)
- Be comprehensive and thorough`,
  });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: imageContent,
        },
      ],
    });

    let extracted;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      return { folder, status: "failed", reason: "json_parse_error" };
    }

    // Save menu data
    const output = {
      restaurant: index.source_url ? index.source_url.split("/")[2] : folder,
      url: index.source_url,
      scraped_at: index.scraped_at,
      menu_extracted_at: new Date().toISOString(),
      menu_data: extracted,
      screenshots_analyzed: imageCount,
    };

    fs.writeFileSync(menuPath, JSON.stringify(output, null, 2));

    return {
      folder,
      status: "success",
      items_found: extracted.total_items_found || 0,
      screenshots: imageCount,
    };
  } catch (error) {
    return {
      folder,
      status: "failed",
      reason: error.message.substring(0, 50),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { force: args.includes("--force") };

  // Get all restaurants
  const folders = fs
    .readdirSync(SHOTS_DIR)
    .filter(f => fs.statSync(path.join(SHOTS_DIR, f)).isDirectory())
    .sort();

  console.log(`\n🍽️  DETAILED MENU EXTRACTION`);
  console.log(`============================`);
  console.log(`Total restaurants: ${folders.length}`);
  console.log(`Estimated cost: $${(folders.length * 0.04).toFixed(2)}\n`);

  const results = [];
  let successCount = 0;
  let totalItems = 0;

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const progress = `[${String(i + 1).padStart(3)}/${folders.length}]`;

    process.stdout.write(`${progress} ${folder.padEnd(45)} `);

    const result = await extractMenus(folder, opts);
    results.push(result);

    if (result.status === "success") {
      successCount++;
      totalItems += result.items_found || 0;
      console.log(`✓ (${result.items_found} items)`);
    } else if (result.status === "skipped") {
      console.log(`⊘ already done`);
    } else {
      console.log(`✗ ${result.reason}`);
    }

    // Rate limiting
    if (i < folders.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Save summary
  const summary = {
    generated_at: new Date().toISOString(),
    total_restaurants: folders.length,
    successful: successCount,
    failed: results.filter(r => r.status === "failed").length,
    skipped: results.filter(r => r.status === "skipped").length,
    total_menu_items_extracted: totalItems,
    estimated_cost: `$${(folders.length * 0.04).toFixed(2)}`,
  };

  fs.writeFileSync(
    path.join(SHOTS_DIR, "..", "menu-extraction-results.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n\n✓ COMPLETE`);
  console.log(`===========`);
  console.log(`Successful: ${successCount}/${folders.length}`);
  console.log(`Menu items extracted: ${totalItems}`);
  console.log(`Cost: ~${summary.estimated_cost}`);
  console.log(`Results: menu-extraction-results.json`);
  console.log(`Menus saved: /screenshots/<restaurant>/menu-detailed.json`);
}

main().catch(console.error);

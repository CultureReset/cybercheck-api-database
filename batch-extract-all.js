#!/usr/bin/env node
/**
 * BATCH EXTRACT ALL RESTAURANTS
 * Uses Claude Haiku to extract menus, hours, events, etc from screenshots
 * Costs ~$2 total for all restaurants
 *
 * Usage:
 *   node batch-extract-all.js                    — extract all
 *   node batch-extract-all.js --start 10         — start at #10
 *   node batch-extract-all.js --count 5          — extract only 5
 *   node batch-extract-all.js --force            — redo ones already done
 */

require('dotenv').config();
const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();
const SHOTS_DIR = "/Users/owner/cybercheck-api-database/screenshots";

async function extractRestaurant(folder, options = {}) {
  const indexPath = path.join(SHOTS_DIR, folder, "index.json");
  const extractedPath = path.join(SHOTS_DIR, folder, "extracted-data.json");

  // Skip if already done (unless --force)
  if (fs.existsSync(extractedPath) && !options.force) {
    return { folder, status: "skipped", reason: "already_extracted" };
  }

  // Read index
  if (!fs.existsSync(indexPath)) {
    return { folder, status: "failed", reason: "no_index.json" };
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const screenshotsDir = path.join(SHOTS_DIR, folder);

  // Select key pages to analyze (first page of menu/hours/contact)
  const pagesToAnalyze = [];
  const menuKeywords = ["menu", "food", "drink"];
  const hoursKeywords = ["hours", "contact", "about"];

  for (const page of index.pages) {
    const urlLower = page.url.toLowerCase();
    const hasMenu = menuKeywords.some(kw => urlLower.includes(kw));
    const hasHours = hoursKeywords.some(kw => urlLower.includes(kw));

    if ((hasMenu || hasHours) && pagesToAnalyze.length < 4) {
      pagesToAnalyze.push({
        url: page.url,
        files: page.files.slice(0, 2), // First 2 screenshots per page
      });
    }
  }

  // If no menu found, just use first few pages
  if (pagesToAnalyze.length === 0 && index.pages.length > 0) {
    pagesToAnalyze.push({
      url: index.pages[0].url,
      files: index.pages[0].files.slice(0, 3),
    });
  }

  if (pagesToAnalyze.length === 0) {
    return { folder, status: "failed", reason: "no_screenshots" };
  }

  // Build image content for Claude
  const imageContent = [];
  let imageCount = 0;

  for (const page of pagesToAnalyze) {
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

      if (imageCount >= 6) break; // Max 6 images per extraction
    }
    if (imageCount >= 6) break;
  }

  if (imageCount === 0) {
    return { folder, status: "failed", reason: "image_read_failed" };
  }

  // Add extraction prompt
  imageContent.push({
    type: "text",
    text: `Extract structured data from these restaurant screenshots. Return ONLY valid JSON:
{
  "restaurant_name": string,
  "menu": {
    "categories": [{"name": string, "items": [{"name": string, "price": string, "description": string}]}]
  },
  "hours": {
    "monday": string,
    "tuesday": string,
    "wednesday": string,
    "thursday": string,
    "friday": string,
    "saturday": string,
    "sunday": string
  },
  "contact": {
    "phone": string,
    "address": string,
    "email": string
  },
  "amenities": [string],
  "special_offers": [string],
  "notes": string
}

Be thorough and extract ALL visible information. If a field is not visible, omit it.`,
  });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
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
      return {
        folder,
        status: "failed",
        reason: "json_parse_error",
        error: e.message,
      };
    }

    // Save extracted data
    const output = {
      restaurant: index.source_url ? index.source_url.split("/")[2] : folder,
      url: index.source_url,
      scraped_at: index.scraped_at,
      extracted_at: new Date().toISOString(),
      extracted: extracted,
      screenshots_analyzed: imageCount,
    };

    fs.writeFileSync(
      extractedPath,
      JSON.stringify(output, null, 2)
    );

    return {
      folder,
      status: "success",
      extracted_keys: Object.keys(extracted),
      screenshots: imageCount,
    };
  } catch (error) {
    return {
      folder,
      status: "failed",
      reason: error.message,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opts = {
    force: args.includes("--force"),
    start: parseInt(args.find(a => a.startsWith("--start"))?.split(" ")[1] || "0"),
    count: parseInt(args.find(a => a.startsWith("--count"))?.split(" ")[1] || "999"),
  };

  // Get all restaurants
  const folders = fs
    .readdirSync(SHOTS_DIR)
    .filter(f => fs.statSync(path.join(SHOTS_DIR, f)).isDirectory())
    .sort();

  const toProcess = folders.slice(opts.start, opts.start + opts.count);

  console.log(`\n🚀 BATCH EXTRACTION (Haiku)`);
  console.log(`==========================`);
  console.log(`Total restaurants: ${folders.length}`);
  console.log(`Processing: ${toProcess.length}`);
  console.log(`Estimated cost: $${(toProcess.length * 0.02).toFixed(2)}\n`);

  const results = [];
  let successCount = 0;
  let startTime = Date.now();

  for (let i = 0; i < toProcess.length; i++) {
    const folder = toProcess[i];
    const progress = `[${i + 1}/${toProcess.length}]`;

    process.stdout.write(`${progress} ${folder.padEnd(45)} `);

    const result = await extractRestaurant(folder, opts);
    results.push(result);

    if (result.status === "success") {
      successCount++;
      console.log(`✓ (${result.screenshots} images)`);
    } else if (result.status === "skipped") {
      console.log(`⊘ already done`);
    } else {
      console.log(`✗ ${result.reason}`);
    }

    // Rate limiting
    if (i < toProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save summary
  const summary = {
    generated_at: new Date().toISOString(),
    total_processed: toProcess.length,
    successful: successCount,
    failed: results.filter(r => r.status === "failed").length,
    skipped: results.filter(r => r.status === "skipped").length,
    elapsed_seconds: elapsed,
    estimated_cost: `$${(toProcess.length * 0.02).toFixed(2)}`,
    results,
  };

  fs.writeFileSync(
    path.join(SHOTS_DIR, "..", "extraction-results.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n\n✓ COMPLETE`);
  console.log(`===========`);
  console.log(`Successful: ${successCount}/${toProcess.length}`);
  console.log(`Time: ${elapsed}s`);
  console.log(`Cost: ~$${(toProcess.length * 0.02).toFixed(2)}`);
  console.log(`Results: extraction-results.json`);
}

main().catch(console.error);

const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();

async function extractRestaurantData() {
  const baseDir = "/Users/owner/cybercheck-api-database/screenshots/hammered-crab";

  // Read index.json to get page mappings
  const indexPath = path.join(baseDir, "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  // Group pages by URL
  const pagesByUrl = {};
  index.pages.forEach((page) => {
    const key = page.url;
    if (!pagesByUrl[key]) {
      pagesByUrl[key] = [];
    }
    pagesByUrl[key].push(...page.files);
  });

  const extractedData = {
    restaurant: "Hammered Crab",
    url: index.source_url,
    scraped_at: index.scraped_at,
    sections: {},
  };

  // Process key pages with specific purposes
  const sections = [
    {
      name: "menu",
      urlPattern: "food-menu",
      purpose:
        "Extract all food/drink items with prices, descriptions, and categories",
    },
    {
      name: "hours_and_contact",
      urlPattern: "thehammeredcrab.com",
      purpose:
        "Extract hours of operation, phone number, address, location information",
    },
    {
      name: "happy_hour_specials",
      urlPattern: "happy-hours-specials",
      purpose: "Extract happy hour times, drink specials, and food deals",
    },
    {
      name: "events",
      urlPattern: "events",
      purpose: "Extract upcoming events with dates and descriptions",
    },
    {
      name: "catering",
      urlPattern: "catering",
      purpose: "Extract catering options, packages, and pricing",
    },
  ];

  for (const section of sections) {
    console.log(`\nExtracting ${section.name}...`);

    // Find pages matching this section
    const matchingPages = [];
    for (const [url, files] of Object.entries(pagesByUrl)) {
      if (url.includes(section.urlPattern)) {
        matchingPages.push(...files);
        break;
      }
    }

    if (matchingPages.length === 0) {
      console.log(`  No pages found for ${section.name}`);
      continue;
    }

    // Get image content for first 3 pages of this section
    const imagesToProcess = matchingPages.slice(0, 3);
    const imageContents = [];

    for (const file of imagesToProcess) {
      const imagePath = path.join(baseDir, file);
      const imageData = fs.readFileSync(imagePath);
      const base64 = imageData.toString("base64");
      imageContents.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64,
        },
      });
    }

    // Add text instruction
    imageContents.push({
      type: "text",
      text: `You are extracting restaurant data. Looking at these ${imagesToProcess.length} images, ${section.purpose}

Please extract and return ONLY valid JSON (no markdown, no extra text):
{
  "found": boolean,
  "data": <extracted data as objects/arrays/strings>
}

Be thorough and extract everything visible.`,
    });

    try {
      const response = await client.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: imageContents,
          },
        ],
      });

      const responseText = response.content[0].text;

      // Parse JSON response
      let extracted;
      try {
        extracted = JSON.parse(responseText);
      } catch (e) {
        // Try to extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extracted = JSON.parse(jsonMatch[0]);
        } else {
          console.log(`  Failed to parse response for ${section.name}`);
          extracted = { found: false, data: responseText };
        }
      }

      if (extracted.found) {
        extractedData.sections[section.name] = extracted.data;
        console.log(`  ✓ Extracted ${section.name}`);
      } else {
        console.log(`  ⚠ No data found for ${section.name}`);
      }
    } catch (error) {
      console.error(`  Error extracting ${section.name}:`, error.message);
    }
  }

  // Save extracted data
  const outputPath = path.join(baseDir, "extracted-data.json");
  fs.writeFileSync(outputPath, JSON.stringify(extractedData, null, 2));
  console.log(`\n✓ Saved to ${outputPath}`);

  return extractedData;
}

extractRestaurantData().catch(console.error);

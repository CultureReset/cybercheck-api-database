const Anthropic = require("@anthropic-ai/sdk");
const fs = require("fs");
const path = require("path");

const client = new Anthropic();

async function extractHours() {
  const baseDir = "/Users/owner/cybercheck-api-database/screenshots/hammered-crab";
  
  // Try page-002.jpg and page-003.jpg which might have contact info
  const imagePaths = [
    path.join(baseDir, "page-002.jpg"),
    path.join(baseDir, "page-003.jpg"),
  ];

  const imageContents = [];
  for (const imagePath of imagePaths) {
    if (fs.existsSync(imagePath)) {
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
  }

  imageContents.push({
    type: "text",
    text: `Looking at these homepage images, extract all contact and hours information visible.
    
Extract and return ONLY the content inside {}: 
{
  "phone": string or null,
  "address": string or null,
  "city_state": string or null,
  "hours_monday_friday": string or null,
  "hours_saturday_sunday": string or null,
  "social_media": [list of platforms],
  "other_contact": string or null
}`,
  });

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: imageContents,
      },
    ],
  });

  try {
    let text = response.content[0].text;
    // Extract JSON from markdown if needed
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }
    const extracted = JSON.parse(text);
    console.log(JSON.stringify(extracted, null, 2));
    
    // Append to extracted data
    const dataPath = path.join(baseDir, "extracted-data.json");
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    data.sections.hours_and_contact = extracted;
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log("\n✓ Updated extracted-data.json");
  } catch (e) {
    console.error("Parse error:", e.message);
    console.log("Response:", response.content[0].text);
  }
}

extractHours().catch(console.error);

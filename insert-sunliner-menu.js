require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const menu = fs.readFileSync('/Users/owner/cybercheck-api-database/sunliner-menu-raw.txt', 'utf8');

function parseMenu(text) {
  // Split into sections by blank line + section header
  const parts = text.split(/\n\n+/);
  const sections = [];

  let currentSection = null;

  for (const part of parts) {
    const lines = part.split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;

    // Check if this is a section header (single line, title case)
    if (lines.length === 1 && /^[A-Z][a-z]/.test(lines[0])) {
      currentSection = { name: lines[0].replace(/\*/, ''), items: [] };
      sections.push(currentSection);
    } else if (currentSection && lines.length >= 2) {
      // Parse items from this section
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const priceMatch = line.match(/\$([\d.]+)/);

        if (priceMatch) {
          // This might be: "Name$Price Description"
          const beforePrice = line.substring(0, line.indexOf('$')).trim();
          const afterPrice = line.substring(line.indexOf('$') + priceMatch[0].length).trim();

          if (beforePrice) {
            currentSection.items.push({
              name: beforePrice,
              price: parseFloat(priceMatch[1]),
              description: afterPrice || null
            });
          }
        } else if (/^[A-Z]/.test(line) && !priceMatch) {
          // Possible item name, check next line for price
          if (i + 1 < lines.length && lines[i + 1].match(/\$([\d.]+)/)) {
            const nameMatch = lines[i + 1].match(/\$([\d.]+)/);
            const description = lines[i + 1].substring(nameMatch[0].length).trim();
            currentSection.items.push({
              name: line,
              price: parseFloat(nameMatch[1]),
              description: description || null
            });
            i++; // Skip the price line
          }
        }
        i++;
      }
    }
  }

  return sections.filter(s => s.items.length > 0);
}

async function insertMenu() {
  const { data: entity } = await supabase
    .from('entity')
    .select('id')
    .eq('slug', 'sunliner-diner')
    .single();

  if (!entity) {
    console.log('❌ Sunliner Diner not found');
    return;
  }

  const sections = parseMenu(menu);
  const totalItems = sections.reduce((s, c) => s + c.items.length, 0);
  console.log(`📋 Found ${sections.length} sections with ${totalItems} items`);

  let sectionsCreated = 0;
  let itemsInserted = 0;

  for (const section of sections) {
    const { data: sec, error: secErr } = await supabase
      .from('menu_sections')
      .insert({
        entity_id: entity.id,
        section_name: section.name,
        sort_order: sectionsCreated
      })
      .select('id')
      .single();

    if (secErr) {
      console.log(`  ❌ Section "${section.name}" failed: ${secErr.message}`);
      continue;
    }
    sectionsCreated++;

    const rows = section.items.map((item, idx) => ({
      entity_id: entity.id,
      menu_section_id: sec.id,
      item_name: item.name,
      description: item.description && item.description.length > 0 ? item.description : null,
      price: item.price,
      price_text: `$${item.price.toFixed(2)}`,
      sort_order: idx,
      is_available: true
    }));

    if (rows.length > 0) {
      const { error } = await supabase.from('menu_items').insert(rows);
      if (error) {
        console.log(`  ❌ ${section.name} insert failed: ${error.message}`);
      } else {
        itemsInserted += rows.length;
        console.log(`  ✅ ${section.name}: ${rows.length} items`);
      }
    }
  }

  console.log(`\n✅ Sunliner Diner: ${sectionsCreated} sections, ${itemsInserted} items`);
}

insertMenu().catch(e => console.error(e));

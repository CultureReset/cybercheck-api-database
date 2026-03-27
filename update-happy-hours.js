#!/usr/bin/env node
require('dotenv').config();
const supabase = require('./db');
const fs = require('fs');
const path = require('path');

const restaurantsWithHH = require('./restaurants-with-specials.json');

async function updateHappyHours() {
  let updated = 0, inserted = 0, skipped = 0, warnings = 0;

  for (const resto of restaurantsWithHH) {
    try {
      const name = resto.name.trim();

      // Try to find existing restaurant by name similarity
      const { data: existing } = await supabase
        .from('businesses')
        .select('site_id, name, happy_hour, updated_at')
        .ilike('name', `%${name}%`)
        .limit(5);

      let matched = null;
      if (existing && existing.length > 0) {
        // Exact match first
        matched = existing.find(e => e.name.toLowerCase() === name.toLowerCase());
        // Close match (e.g. "GT's" vs "GTs")
        if (!matched) {
          matched = existing.find(e =>
            e.name.toLowerCase().replace(/['']/g, '') === name.toLowerCase().replace(/['']/g, '')
          );
        }
        // Single result fallback
        if (!matched && existing.length === 1) {
          matched = existing[0];
        }
      }

      if (matched) {
        console.log(`✓ Found: ${matched.name}`);

        // Merge tags
        const newTags = resto.tags || [];
        const updateObj = {
          happy_hour: true,
          tags: newTags,
          updated_at: new Date().toISOString()
        };

        // Update happy_hour flag and tags
        const { error: updateErr } = await supabase
          .from('businesses')
          .update(updateObj)
          .eq('site_id', matched.site_id);

        if (updateErr) {
          console.error(`  ✗ Error updating: ${updateErr.message}`);
          warnings++;
        } else {
          console.log(`  → Updated happy_hour=true`);
          console.log(`  → Added ${newTags.length} tags`);
          updated++;

          // Add specials if provided
          if (resto.happyHourDeals && Array.isArray(resto.happyHourDeals)) {
            const dealsText = Array.isArray(resto.happyHourDeals)
              ? resto.happyHourDeals.join(' | ')
              : resto.happyHourDeals;

            // Try insert first, ignore if already exists
            await supabase
              .from('specials')
              .insert({
                site_id: matched.site_id,
                name: 'Happy Hour',
                description: dealsText,
                discount: resto.happyHour || 'Daily',
                active: true,
                created_at: new Date().toISOString()
              });

            console.log(`    → Added happy hour specials`);
          }
        }
      } else {
        console.log(`⚠ Not found in DB: "${name}"`);
        console.log(`  → Location: ${resto.location}`);
        console.log(`  → Phone: ${resto.phone}`);
        warnings++;
      }
    } catch (err) {
      console.error(`✗ Error processing ${resto.name}: ${err.message}`);
      warnings++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Updated: ${updated} | Inserted: ${inserted} | Skipped: ${skipped} | Warnings: ${warnings}`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the ${warnings} warnings above`);
  console.log(`2. Restaurants not found may be new — manually add if needed`);
  console.log(`3. Check https://gcr-rosy.vercel.app/happy-hours.html for updates`);
}

updateHappyHours().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

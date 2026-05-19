#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('GCR SMART DEDUPLICATION - Keep best version');
console.log('='.repeat(80) + '\n');

const gcr = JSON.parse(fs.readFileSync('./gulf-coast-radar-full-export.json'));

// Score data completeness
function scoreEntity(e) {
  let score = 0;
  if (e.name) score += 10;
  if (e.phone) score += 15;
  if (e.address_line_1) score += 15;
  if (e.website_url) score += 10;
  if (e.description) score += 20;
  if (e.review_count > 0) score += (e.review_count > 100 ? 40 : 20);
  if (e.hero_image_url) score += 10;
  if (e.latitude && e.longitude) score += 10;
  if (e.is_active) score += 5;
  return score;
}

// Find duplicates by name
const byName = {};
gcr.data.entity.forEach(e => {
  const key = (e.name || '').toLowerCase().trim();
  if (!byName[key]) byName[key] = [];
  byName[key].push(e);
});

const duplicates = Object.entries(byName).filter(([name, entities]) => entities.length > 1);

console.log(`Found ${duplicates.length} groups of duplicates\n`);

let totalDups = 0;
const toDelete = [];
const toKeep = [];
const results = [];

duplicates.forEach(([name, entities]) => {
  // Score each version
  const scored = entities.map(e => ({
    entity: e,
    score: scoreEntity(e),
    reviews: e.review_count || 0,
    dataPoints: Object.values(e).filter(v => v && v !== '' && v !== false).length
  }));

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  const keeper = scored[0];
  const dupsOfThis = scored.slice(1);

  toKeep.push({
    id: keeper.entity.id,
    name: keeper.entity.name,
    score: keeper.score,
    reviews: keeper.reviews
  });

  dupsOfThis.forEach(dup => {
    toDelete.push({
      id: dup.entity.id,
      name: dup.entity.name,
      score: dup.score,
      reviews: dup.reviews,
      keepId: keeper.entity.id,
      reason: `Duplicate of: ${keeper.entity.name} (score: ${keeper.score} vs ${dup.score})`
    });
    totalDups++;
  });

  if (dupsOfThis.length > 0) {
    results.push({
      name,
      count: entities.length,
      keeper: {
        id: keeper.entity.id,
        score: keeper.score,
        reviews: keeper.reviews,
        active: keeper.entity.is_active
      },
      deleting: dupsOfThis.map(d => ({
        id: d.entity.id,
        score: d.score,
        reviews: d.reviews,
        active: d.entity.is_active
      }))
    });
  }
});

// Summary
console.log('='.repeat(80));
console.log('DEDUPLICATION PLAN');
console.log('='.repeat(80));
console.log(`Total duplicate entries to DELETE: ${totalDups}`);
console.log(`Total unique businesses to KEEP: ${toKeep.length}`);
console.log(`Net reduction: ${totalDups} entries removed\n`);

// Show some examples
console.log('Sample deletions:\n');
results.slice(0, 5).forEach(r => {
  console.log(`📍 "${r.name}" (${r.count} entries)`);
  console.log(`   KEEP: ${r.keeper.id} (score: ${r.keeper.score}, reviews: ${r.keeper.reviews})`);
  r.deleting.forEach((d, i) => {
    console.log(`   DELETE #${i+1}: ${d.id} (score: ${d.score}, reviews: ${d.reviews})`);
  });
  console.log('');
});

// Save mapping
const deduplicationMap = {
  summary: {
    total_duplicates_found: totalDups,
    total_unique_kept: toKeep.length,
    total_entities_after_dedup: toKeep.length,
    reduction_percent: Math.round((totalDups / (totalDups + toKeep.length)) * 100)
  },
  to_keep: toKeep,
  to_delete: toDelete.slice(0, 100), // First 100
  all_deletions: toDelete
};

fs.writeFileSync('./consolidation/GCR-DEDUP-MAP.json', JSON.stringify(deduplicationMap, null, 2));
console.log('✓ Deduplication map saved to consolidation/GCR-DEDUP-MAP.json\n');

// Generate SQL to delete duplicates
const deleteSql = toDelete.map(d => `DELETE FROM entity WHERE id = '${d.id}'; -- ${d.name}`).join('\n');
fs.writeFileSync('./consolidation/GCR-DELETE-DUPLICATES.sql', deleteSql);
console.log('✓ SQL delete script saved to consolidation/GCR-DELETE-DUPLICATES.sql\n');

console.log('Next steps:');
console.log('1. Review consolidation/GCR-DEDUP-MAP.json');
console.log('2. If plan looks good, import GCR into new DB');
console.log('3. Then run consolidation/GCR-DELETE-DUPLICATES.sql');

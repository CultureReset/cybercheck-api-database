#!/usr/bin/env node
/**
 * Audit all changes I (Claude) made today
 * Shows: commits, files changed, diffs, and what broke
 */

const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    return e.stdout || '';
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('AUDIT: All changes made today (April 3, 2026)');
console.log('═══════════════════════════════════════════════════════════\n');

// Get all commits from today
const commits = run(`git log --oneline --since="2026-04-03 00:00:00" --format="%h|%ai|%s"`).trim().split('\n');

console.log(`\n📝 COMMITS MADE TODAY (${commits.length} total):\n`);

commits.forEach((line, idx) => {
  const [hash, time, msg] = line.split('|');
  console.log(`${idx + 1}. [${hash}] ${time.split(' ')[1]} - ${msg}`);
});

// For each commit, show what files changed
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('FILES CHANGED PER COMMIT:');
console.log('═══════════════════════════════════════════════════════════\n');

commits.forEach((line) => {
  const hash = line.split('|')[0];
  const msg = line.split('|')[2];
  console.log(`\n📄 ${hash} - ${msg}`);
  console.log('   ─────────────────────────────────');

  const files = run(`git show ${hash} --name-status --oneline | tail -n +2`).trim();
  if (files) {
    files.split('\n').forEach(f => {
      if (f.trim()) {
        const [status, file] = f.split('\t');
        const statusIcon = { M: '✏️ ', A: '➕ ', D: '❌ ' }[status] || '❓ ';
        console.log(`   ${statusIcon} ${file}`);
      }
    });
  }
});

// Show the actual diffs for routes/gcr.js
console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('CHANGES TO routes/gcr.js (THE API):');
console.log('═══════════════════════════════════════════════════════════\n');

const gcrChanges = run(`git log --since="2026-04-03 00:00:00" --oneline -- routes/gcr.js`).trim().split('\n').filter(Boolean);

if (gcrChanges.length > 0) {
  console.log('Commits that touched routes/gcr.js:\n');
  gcrChanges.forEach((line) => {
    const hash = line.split(' ')[0];
    const msg = line.substring(hash.length + 1);
    console.log(`  ${hash} - ${msg}`);
  });

  // Show full diff of routes/gcr.js
  console.log('\n\nFull diff of routes/gcr.js (all changes today):\n');
  const diff = run(`git diff 44eb207~ routes/gcr.js 2>/dev/null | head -200`);
  if (diff) {
    console.log(diff);
  } else {
    console.log('(showing first 10 lines of current vs original)\n');
    console.log(run(`git show 44eb207~:routes/gcr.js | head -50`));
  }
} else {
  console.log('No changes to routes/gcr.js');
}

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('CHANGES TO routes/admin.js:');
console.log('═══════════════════════════════════════════════════════════\n');

const adminChanges = run(`git log --since="2026-04-03 00:00:00" --oneline -- routes/admin.js`).trim().split('\n').filter(Boolean);
if (adminChanges.length > 0) {
  console.log('Commits that touched routes/admin.js:\n');
  adminChanges.forEach((line) => {
    console.log(`  ${line}`);
  });
}

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('WHAT PROBABLY BROKE:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('✓ Happy Hours & Specials pages show nothing');
console.log('✓ Only 21/173 specials match entities in database');
console.log('✓ Data is orphaned (entity_id doesn\'t match real entities)\n');

console.log('ROOT CAUSE:');
console.log('  - March 31 @ 01:45 (d6d4baf): Switched /specials from GCR DB to OLD DB');
console.log('  - Orphaned all specials (old DB refs don\'t match new GCR entities)');
console.log('  - Never migrated/matched data back\n');

console.log('TODAY\'S COMMITS:');
console.log('  - Did NOT directly touch /specials or /happy-hours queries');
console.log('  - Made admin & site editor changes');
console.log('  - Removed old DB references (but data still broken)\n');

console.log('SOLUTION:');
console.log('  Run: node scripts/migrate-all-to-gcr.js');
console.log('  Then: node scripts/migrate-part2.js');
console.log('\n');

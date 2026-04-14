#!/usr/bin/env node
// run-all.js — Runs all GCR audit agents sequentially and prints a final summary
// Usage: node agents/run-all.js
// Skip agents: node agents/run-all.js --skip gcr-image-audit,gcr-performance-audit
// Run only: node agents/run-all.js --only gcr-deployment-check,gcr-category-pages-audit

const { execSync } = require('child_process');
const path = require('path');

// Always load .env from the project root, regardless of cwd
const projectRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

// Parse flags
const args = process.argv.slice(2);
const skipIdx = args.indexOf('--skip');
const onlyIdx = args.indexOf('--only');
const skipList = skipIdx >= 0 ? args[skipIdx+1].split(',') : [];
const onlyList = onlyIdx >= 0 ? args[onlyIdx+1].split(',') : [];

// All agents in logical run order
const ALL_AGENTS = [
  // 1. Deployment first — if this fails, nothing else matters
  { name: 'gcr-deployment-check', label: 'Deployment Check', group: 'Infrastructure' },
  { name: 'gcr-performance-audit', label: 'Performance Audit', group: 'Infrastructure' },
  { name: 'gcr-mobile-audit', label: 'Mobile / Responsive Audit', group: 'Infrastructure' },

  // 2. API health — all 3 repos depend on this
  { name: 'test-api-health', label: 'API Endpoint Health (all routes)', group: 'API' },

  // 3. Data integrity
  { name: 'gcr-entity-completeness', label: 'Entity Completeness (A-F grades)', group: 'Data Quality' },
  { name: 'gcr-subtype-routing', label: 'Subtype → Category Routing', group: 'Data Quality' },
  { name: 'gcr-hours-audit', label: 'Hours Data Audit', group: 'Data Quality' },
  { name: 'gcr-image-audit', label: 'Image URL Audit', group: 'Data Quality' },
  { name: 'gcr-price-format-audit', label: 'Price Format Audit', group: 'Data Quality' },
  { name: 'gcr-duplicate-detect', label: 'Duplicate Detection', group: 'Data Quality' },
  { name: 'gcr-db-inventory', label: 'Supabase Table Inventory', group: 'Data Quality' },

  // 4. Upload flows
  { name: 'gcr-upload-flow', label: 'Menu Upload Flow', group: 'Upload Tests' },
  { name: 'gcr-drinks-upload-flow', label: 'Drinks Upload Flow', group: 'Upload Tests' },
  { name: 'gcr-bulk-events-upload', label: 'Events Bulk Upload', group: 'Upload Tests' },
  { name: 'gcr-bulk-specials-upload', label: 'Specials Bulk Upload', group: 'Upload Tests' },
  { name: 'gcr-section-based-upload', label: 'Section-Based Upload', group: 'Upload Tests' },
  { name: 'gcr-gcr-items-upload', label: 'GCR Items Bulk Upload', group: 'Upload Tests' },
  { name: 'gcr-tags-features-upload', label: 'Tags & Features Upload', group: 'Upload Tests' },
  { name: 'gcr-photos-upload', label: 'Photos Upload', group: 'Upload Tests' },
  { name: 'gcr-csv-errors', label: 'CSV Error Handling', group: 'Upload Tests' },

  // 5. Admin dashboard — cybercheck-login
  { name: 'test-dashboard-pages', label: 'Dashboard Pages Load (admin.html)', group: 'Admin Dashboard' },
  { name: 'test-buttons', label: 'All Clickable Buttons', group: 'Admin Dashboard' },
  { name: 'gcr-entity-editor-save', label: 'Entity Editor Full Save', group: 'Admin Dashboard' },
  { name: 'gcr-active-toggle', label: 'Active/Inactive Toggle', group: 'Admin Dashboard' },
  { name: 'gcr-ai-organizer-audit', label: 'AI Menu Organizer', group: 'Admin Dashboard' },
  { name: 'uiux-reviewer', label: 'UI/UX Review', group: 'Admin Dashboard' },

  // 6. Public site — launching-GCR
  { name: 'test-public-site', label: 'All Public Pages Load', group: 'Public Site' },
  { name: 'gcr-section-editor-flow', label: 'Section Editor → Profile Tabs', group: 'Public Site' },
  { name: 'gcr-category-pages-audit', label: 'Category Pages Coverage', group: 'Public Site' },
  { name: 'gcr-search-audit', label: 'Search Functionality', group: 'Public Site' },
  { name: 'gcr-featured-audit', label: 'Featured Entities', group: 'Public Site' },
  { name: 'gcr-homepage-render', label: 'Homepage Render Data', group: 'Public Site' },
  { name: 'gcr-profile-by-type', label: 'Profile Pages by Entity Type', group: 'Public Site' },

  // 7. Full pipeline: admin → API → public site display
  { name: 'gcr-data-flow', label: 'Full Data Flow (Admin → API → Public)', group: 'Pipeline' },
  { name: 'gcr-frontend-check', label: 'Frontend HTML/Script Audit', group: 'Pipeline' },
  { name: 'gcr-full-verify', label: 'Full System Verification', group: 'Pipeline' },
  { name: 'gcr-system-audit', label: 'System-Wide Audit', group: 'Pipeline' },
  { name: 'pre-launch', label: 'Pre-Launch Checklist', group: 'Pipeline' },

  // 8. Coverage gaps
  { name: 'gcr-activity-cards', label: 'Activity Card Fields', group: 'Coverage Gaps' },
  { name: 'gcr-e2e-flow', label: 'End-to-End: Add → Public → Toggle', group: 'Coverage Gaps' },
  { name: 'gcr-404-handling', label: '404 & Error Handling', group: 'Coverage Gaps' },
  { name: 'gcr-search-queries', label: 'Real Search Queries', group: 'Coverage Gaps' },
];

const agentsDir = path.join(__dirname);

// Filter agents
let agents = ALL_AGENTS;
if (onlyList.length > 0) agents = agents.filter(a => onlyList.some(n => a.name.includes(n)));
else if (skipList.length > 0) agents = agents.filter(a => !skipList.some(n => a.name.includes(n)));

const results = [];
let currentGroup = null;

console.log(`\n${B}${'═'.repeat(60)}${X}`);
console.log(`${B}  GCR FULL AUDIT — ${agents.length} agents${X}`);
console.log(`${B}${'═'.repeat(60)}${X}\n`);
console.log(`${D}Starting at ${new Date().toLocaleTimeString()}${X}\n`);

for (const agent of agents) {
  if (agent.group !== currentGroup) {
    currentGroup = agent.group;
    console.log(`\n${B}${C}━━ ${currentGroup} ${'━'.repeat(55 - currentGroup.length)}${X}`);
  }

  const agentPath = path.join(agentsDir, agent.name + '.js');
  const start = Date.now();

  process.stdout.write(`  ${D}Running: ${agent.label}...${X}`);

  try {
    const output = execSync(`node "${agentPath}"`, {
      timeout: 180000,  // 3 min timeout per agent (Anthropic analysis can take ~90s)
      env: { ...process.env },
      cwd: projectRoot,  // run each agent from project root so dotenv finds .env
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const ms = Date.now() - start;

    // Parse pass/warn/fail counts from output
    const passMatch = output.match(/(\d+) passed/);
    const warnMatch = output.match(/(\d+) warnings/);
    const failMatch = output.match(/(\d+) failed/);
    const passed = passMatch ? parseInt(passMatch[1]) : null;
    const warned = warnMatch ? parseInt(warnMatch[1]) : null;
    const failed = failMatch ? parseInt(failMatch[1]) : null;

    const hasIssues = (failed !== null && failed > 0);
    const hasWarns = (warned !== null && warned > 0);
    const statusColor = hasIssues ? R : hasWarns ? Y : G;
    const statusIcon = hasIssues ? '✗' : hasWarns ? '⚠' : '✓';

    // Clear the "Running..." line and print result
    process.stdout.write('\r');
    let statusLine = `  ${statusColor}${statusIcon}${X} ${agent.label.padEnd(40)} ${statusColor}`;
    if (passed !== null) statusLine += `${passed}p`;
    if (warned !== null && warned > 0) statusLine += ` ${warned}w`;
    if (failed !== null && failed > 0) statusLine += ` ${failed}f`;
    statusLine += `${X} ${D}${ms}ms${X}`;
    console.log(statusLine);

    results.push({ agent, passed, warned, failed, ms, error: null, output });

  } catch(e) {
    const ms = Date.now() - start;
    process.stdout.write('\r');

    if (e.code === 'ETIMEDOUT') {
      console.log(`  ${R}✗${X} ${agent.label.padEnd(40)} ${R}TIMEOUT${X} ${D}${ms}ms${X}`);
      results.push({ agent, passed: 0, warned: 0, failed: 1, ms, error: 'timeout', output: '' });
    } else {
      const errLine = (e.stderr || e.message || '').split('\n')[0].substring(0, 60);
      console.log(`  ${R}✗${X} ${agent.label.padEnd(40)} ${R}CRASH${X} ${D}${errLine}${X}`);
      results.push({ agent, passed: 0, warned: 0, failed: 1, ms, error: errLine, output: e.stdout || '' });
    }
  }
}

// ── Final Summary ──────────────────────────────────────────────────────────────
console.log(`\n\n${B}${'═'.repeat(60)}${X}`);
console.log(`${B}  AUDIT SUMMARY${X}`);
console.log(`${B}${'═'.repeat(60)}${X}\n`);

const totalPassed = results.reduce((s, r) => s + (r.passed || 0), 0);
const totalWarned = results.reduce((s, r) => s + (r.warned || 0), 0);
const totalFailed = results.reduce((s, r) => s + (r.failed || 0), 0);
const agentsPassed = results.filter(r => !r.error && (r.failed || 0) === 0 && (r.warned || 0) === 0).length;
const agentsWarned = results.filter(r => !r.error && (r.failed || 0) === 0 && (r.warned || 0) > 0).length;
const agentsFailed = results.filter(r => r.error || (r.failed || 0) > 0).length;

console.log(`  Agents run:     ${results.length}`);
console.log(`  ${G}All clear:${X}      ${agentsPassed}`);
console.log(`  ${Y}With warnings:${X}  ${agentsWarned}`);
console.log(`  ${R}With failures:${X}  ${agentsFailed}`);
console.log(`\n  ${G}Total checks passed:${X}  ${totalPassed}`);
console.log(`  ${Y}Total warnings:${X}       ${totalWarned}`);
console.log(`  ${R}Total failures:${X}       ${totalFailed}`);

// Failures
const failedAgents = results.filter(r => r.error || (r.failed || 0) > 0);
if (failedAgents.length > 0) {
  console.log(`\n${B}${R}── Agents with failures:${X}`);
  for (const r of failedAgents) {
    console.log(`  ${R}✗${X} ${r.agent.label}`);
    if (r.error) console.log(`      ${D}Error: ${r.error}${X}`);
    // Print last few lines of output for context
    if (r.output) {
      const lines = r.output.trim().split('\n').slice(-5);
      lines.forEach(l => console.log(`    ${D}${l}${X}`));
    }
  }
}

// Warnings
const warnedAgents = results.filter(r => !r.error && (r.failed || 0) === 0 && (r.warned || 0) > 0);
if (warnedAgents.length > 0) {
  console.log(`\n${B}${Y}── Agents with warnings:${X}`);
  warnedAgents.forEach(r => console.log(`  ${Y}⚠${X} ${r.agent.label} (${r.warned} warnings)`));
}

// Score
const score = Math.round(totalPassed / Math.max(totalPassed + totalFailed, 1) * 100);
const scoreColor = score >= 90 ? G : score >= 70 ? Y : R;
console.log(`\n${B}Overall score: ${scoreColor}${score}%${X}`);
console.log(`${D}Completed at ${new Date().toLocaleTimeString()}${X}\n`);

process.exit(agentsFailed > 0 ? 1 : 0);

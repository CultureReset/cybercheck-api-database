#!/usr/bin/env node
/**
 * CyberCheck FULL PLATFORM Check Agent
 * Scans ALL route files to find every table + RPC used, then checks live DB.
 * Uses Claude Haiku to generate missing SQL fixes.
 *
 * Run: node agents/check-platform.js
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// STEP 1: Scan all route files for .from() and .rpc() usage
// ============================================

function scanRoutesForTables() {
    const routesDir = path.join(__dirname, '../routes');
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

    const tables = new Set();
    const rpcs = new Set();

    for (const file of files) {
        const code = fs.readFileSync(path.join(routesDir, file), 'utf8');

        // Match .from('table_name') or .from("table_name")
        const fromMatches = [...code.matchAll(/\.from\(['"]([a-z_]+)['"]\)/g)];
        for (const m of fromMatches) tables.add(m[1]);

        // Match .rpc('function_name') or .rpc("function_name")
        const rpcMatches = [...code.matchAll(/\.rpc\(['"]([a-z_]+)['"]/g)];
        for (const m of rpcMatches) rpcs.add(m[1]);
    }

    // Remove known Supabase meta tables
    tables.delete('information_schema');

    return { tables: [...tables].sort(), rpcs: [...rpcs].sort(), files };
}

// ============================================
// STEP 2: Check what exists in live DB
// ============================================

async function probeTable(table) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (!error) return 'exists';
    const msg = error.message || '';
    if (msg.includes('does not exist') || error.code === '42P01') return 'missing';
    if (msg.includes('permission') || msg.includes('policy')) return 'exists_no_access';
    return 'exists'; // other errors = table probably exists
}

async function probeFunction(fn) {
    const { error } = await supabase.rpc(fn, {});
    if (!error) return 'exists';
    const msg = error.message || '';
    if (msg.includes('does not exist') || msg.includes('Could not find')) return 'missing';
    return 'exists';
}

async function getExistingColumns(table) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error || !data) return null;
    if (data.length > 0) return Object.keys(data[0]);

    // Empty table — try to read column list via select with dummy column
    return null;
}

// ============================================
// STEP 3: Get env vars check
// ============================================

function checkEnvVars() {
    const required = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'SUPABASE_ANON_KEY',
        'JWT_SECRET',
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_KEY_ENCRYPTION_KEY',
        'ANTHROPIC_API_KEY',
    ];

    const optional = [
        'STRIPE_CLIENT_ID',  // for Stripe Connect
        'XAI_API_KEY',       // for Grok/xAI
    ];

    const missing = required.filter(k => !process.env[k]);
    const missingOptional = optional.filter(k => !process.env[k]);
    const present = required.filter(k => !!process.env[k]);

    return { missing, missingOptional, present };
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('\n🤖 CyberCheck FULL PLATFORM Agent');
    console.log('━'.repeat(55));
    console.log(`📡 DB: ${process.env.SUPABASE_URL || '❌ SUPABASE_URL not set'}`);
    console.log('━'.repeat(55) + '\n');

    // ── ENV CHECK ──
    console.log('🔑 Checking environment variables...');
    const env = checkEnvVars();
    env.present.forEach(k => console.log(`  ✅ ${k}`));
    env.missing.forEach(k => console.log(`  ❌ ${k} — MISSING (required)`));
    env.missingOptional.forEach(k => console.log(`  🟡 ${k} — not set (optional)`));

    if (env.missing.length > 0) {
        console.log(`\n⚠️  Add missing vars to .env AND Vercel environment variables`);
    }

    // ── SCAN ROUTES ──
    console.log('\n🔍 Scanning route files for table/RPC usage...');
    const { tables, rpcs, files } = scanRoutesForTables();
    console.log(`  Found ${tables.length} tables used across ${files.length} route files`);
    console.log(`  Found ${rpcs.length} RPC functions used`);
    console.log(`  Routes scanned: ${files.join(', ')}`);

    // ── PROBE TABLES ──
    console.log('\n🔍 Checking live database tables...');
    const tableResults = {};
    const missingTables = [];
    const existingTables = [];

    for (const table of tables) {
        const status = await probeTable(table);
        tableResults[table] = status;
        if (status === 'missing') {
            missingTables.push(table);
            console.log(`  ❌ ${table} — MISSING`);
        } else if (status === 'exists_no_access') {
            existingTables.push(table);
            console.log(`  🟡 ${table} — exists but check RLS policies`);
        } else {
            existingTables.push(table);
            console.log(`  ✅ ${table}`);
        }
    }

    // ── PROBE FUNCTIONS ──
    console.log('\n🔍 Checking RPC functions...');
    const missingFunctions = [];

    for (const fn of rpcs) {
        const status = await probeFunction(fn);
        if (status === 'missing') {
            missingFunctions.push(fn);
            console.log(`  ❌ ${fn}() — MISSING`);
        } else {
            console.log(`  ✅ ${fn}()`);
        }
    }

    // ── COLUMN SPOT-CHECK on critical tables ──
    console.log('\n🔍 Spot-checking critical columns...');
    const criticalChecks = {
        bookings: ['waiver_signed', 'fleet_type_id', 'time_slot_id', 'qty'],
        customers: ['total_bookings', 'total_spent', 'last_visit'],
        users: ['password_hash', 'reset_token', 'reset_expires'],
        site_content: ['messaging_settings', 'lat', 'lng'],
        sms_log: ['metadata'],
    };

    const missingColumns = {};
    for (const [table, cols] of Object.entries(criticalChecks)) {
        if (!existingTables.includes(table)) continue;
        const { data, error } = await supabase.from(table).select(cols.join(',')).limit(0);
        if (error && error.message) {
            // Try each column individually
            for (const col of cols) {
                const { error: ce } = await supabase.from(table).select(col).limit(0);
                if (ce && ce.message?.includes(col)) {
                    if (!missingColumns[table]) missingColumns[table] = [];
                    missingColumns[table].push(col);
                }
            }
        }
        if (missingColumns[table]) {
            console.log(`  ⚠️  ${table}: missing → ${missingColumns[table].join(', ')}`);
        } else {
            console.log(`  ✅ ${table}: all checked columns present`);
        }
    }

    // ── CHECK STRIPE CONNECT setup ──
    console.log('\n🔍 Checking Stripe Connect requirements...');
    const stripeConnectNeeds = [
        { key: 'STRIPE_CLIENT_ID', desc: 'Stripe Connect Client ID (ca_xxx) — get from Stripe Dashboard → Connect → Settings' },
        { key: 'STRIPE_KEY_ENCRYPTION_KEY', desc: '32-byte hex key for AES-256-GCM. Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"' },
        { key: 'STRIPE_SECRET_KEY', desc: 'Your Stripe secret key (sk_live_xxx or sk_test_xxx)' },
    ];
    for (const item of stripeConnectNeeds) {
        if (process.env[item.key]) {
            console.log(`  ✅ ${item.key}`);
        } else {
            console.log(`  ❌ ${item.key} — ${item.desc}`);
        }
    }

    // ── SUMMARY ──
    const totalIssues = env.missing.length + missingTables.length + missingFunctions.length + Object.keys(missingColumns).length;

    console.log('\n' + '━'.repeat(55));
    console.log('📊 PLATFORM CHECK SUMMARY');
    console.log('━'.repeat(55));
    console.log(`  ENV vars missing:      ${env.missing.length}`);
    console.log(`  DB tables missing:     ${missingTables.length}`);
    console.log(`  RPC functions missing: ${missingFunctions.length}`);
    console.log(`  Missing columns:       ${Object.keys(missingColumns).length} tables affected`);
    console.log(`  Total issues:          ${totalIssues}`);

    if (totalIssues === 0) {
        console.log('\n✅ Platform check PASSED — all systems go!\n');
        return;
    }

    // ── GENERATE FIX SQL via Claude Haiku ──
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

    if (missingTables.length > 0 || missingFunctions.length > 0 || Object.keys(missingColumns).length > 0) {
        console.log('\n🔧 Generating fix SQL...');
        await generateFixSQL({ missingTables, missingFunctions, missingColumns }, hasAnthropicKey);
    }

    // ── ENV FIX GUIDE ──
    if (env.missing.length > 0) {
        console.log('\n📋 MISSING ENV VARS — Add to .env AND Vercel:');
        for (const k of env.missing) {
            console.log(`  ${k}=your_value_here`);
        }
        console.log('\n  For STRIPE_KEY_ENCRYPTION_KEY run:');
        console.log('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
}

// ============================================
// CLAUDE HAIKU: Generate Fix SQL
// ============================================

async function generateFixSQL(report, hasKey) {
    if (!hasKey) {
        console.log('\n⚠️  Set ANTHROPIC_API_KEY to auto-generate fix SQL');
        console.log('For now, run these SQL files in Supabase SQL Editor:');
        console.log('  1. schema.sql');
        console.log('  2. schema-additions.sql');
        console.log('  3. agents/gcr-schema.sql');
        return;
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `Generate PostgreSQL/Supabase SQL to fix these missing database items.
Use CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
All tables use site_id UUID referencing businesses(site_id). Enable RLS on new tables. Add public_read SELECT policies and owners_all policies using site_id = auth.site_id().

MISSING TABLES: ${JSON.stringify(report.missingTables)}
MISSING FUNCTIONS: ${JSON.stringify(report.missingFunctions)}
MISSING COLUMNS (table→columns): ${JSON.stringify(report.missingColumns)}

Output ONLY valid SQL. No markdown, no explanation.`
            }]
        })
    });

    if (!res.ok) {
        console.log('⚠️  Claude API error:', res.status);
        return;
    }

    const data = await res.json();
    const sql = data.content?.[0]?.text || '';

    const fixFile = path.join(__dirname, '../fix-missing-schema.sql');
    fs.writeFileSync(fixFile, sql);
    console.log('\n' + sql.substring(0, 500) + (sql.length > 500 ? '\n... (truncated)' : ''));
    console.log(`\n✅ Full fix SQL saved → fix-missing-schema.sql`);
    console.log('📋 Paste into Supabase SQL Editor to fix all issues.\n');
}

main().catch(e => {
    console.error('\n💥 Platform agent crashed:', e.message);
    console.error(e.stack);
    process.exit(1);
});

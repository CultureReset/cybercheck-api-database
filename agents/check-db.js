#!/usr/bin/env node
/**
 * CyberCheck DB Schema Check Agent
 * Run: node agents/check-db.js
 * Uses Claude Haiku to analyze results and generate fix SQL
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// EXPECTED SCHEMA (from schema.sql + schema-additions.sql)
// ============================================

const EXPECTED_TABLES = [
    // Core
    'businesses', 'users',
    // Site
    'site_content', 'site_pages',
    // Apps
    'apps', 'site_apps',
    // OAuth
    'connections',
    // CRM
    'customers',
    // Menu / Products
    'menu_items', 'specials', 'events',
    // Services / Booking
    'services', 'availability',
    // Rental
    'fleet_types', 'fleet_items', 'rental_time_slots',
    'rental_pricing', 'rental_group_rates', 'rental_addons',
    // Transactions
    'bookings', 'orders',
    // Extras
    'waivers', 'staff', 'media', 'sms_log',
    // Additions
    'reviews', 'faqs', 'coupons', 'notifications',
    'activity_log', 'audit_log', 'templates', 'support_tickets',
    'sms_opt_outs', 'sms_campaigns', 'booking_holds',
];

const EXPECTED_COLUMNS = {
    businesses: ['site_id', 'domain', 'subdomain', 'name', 'type', 'logo_url', 'cover_url', 'plan', 'status', 'created_at', 'updated_at'],
    users: ['id', 'auth_id', 'site_id', 'email', 'name', 'role', 'avatar_url', 'created_at', 'password_hash', 'reset_token', 'reset_expires'],
    site_content: ['site_id', 'hero_text', 'hero_subtext', 'hero_video_url', 'about_text', 'contact_phone', 'contact_email', 'address', 'city', 'state', 'zip', 'lat', 'lng', 'hours', 'gallery', 'social_links', 'logo_url', 'cover_url', 'theme_color', 'theme_font', 'custom_css', 'seo_title', 'seo_description', 'updated_at', 'messaging_settings'],
    bookings: ['id', 'site_id', 'customer_id', 'service_id', 'fleet_type_id', 'time_slot_id', 'booking_date', 'booking_time', 'end_time', 'duration_minutes', 'qty', 'party_size', 'addons', 'subtotal', 'tax', 'total', 'deposit', 'payment_id', 'payment_provider', 'payment_status', 'status', 'notes', 'waiver_signed', 'customer_name', 'customer_phone', 'customer_email', 'created_at', 'updated_at'],
    customers: ['id', 'site_id', 'name', 'phone', 'email', 'notes', 'total_orders', 'total_bookings', 'total_spent', 'last_visit', 'tags', 'created_at', 'updated_at'],
    fleet_types: ['id', 'site_id', 'name', 'description', 'specs', 'image_url', 'sort_order', 'available', 'created_at', 'updated_at'],
    booking_holds: ['id', 'site_id', 'fleet_type_id', 'time_slot_id', 'booking_date', 'qty', 'session_id', 'expires_at', 'created_at'],
    reviews: ['id', 'site_id', 'customer_name', 'customer_email', 'rating', 'text', 'photos', 'booking_id', 'status', 'created_at'],
    connections: ['id', 'site_id', 'provider', 'access_token', 'refresh_token', 'token_expires_at', 'account_id', 'account_name', 'status', 'metadata', 'connected_at', 'updated_at'],
    sms_log: ['id', 'site_id', 'to_phone', 'message', 'type', 'status', 'related_id', 'created_at', 'metadata'],
};

const EXPECTED_FUNCTIONS = [
    'create_booking_if_available',
    'create_booking_hold',
    'increment_customer_bookings',
    'increment_customer_orders',
];

// Tables that also need AI/GCR features (used in routes/gcr.js and routes/public.js)
const GCR_TABLES = [
    'business_details',      // elevator_pitch, vibe, age_restriction, etc.
    'business_logistics',    // parking, accessibility, directions
    'business_atmosphere',   // dress_code, music, indoor_outdoor
    'qa_pairs',              // pre-trained Q&A for AI
    'ai_chunks',             // vector embeddings for semantic search
    'loyalty_members',       // GCR Trip Pass loyalty members
    'loyalty_transactions',  // points earned/redeemed
];

// ============================================
// CHECK FUNCTIONS
// ============================================

async function checkTables(expectedTables) {
    const { data, error } = await supabase.rpc('check_tables_exist', {}).catch(() => ({ data: null, error: 'no_rpc' }));

    // Fallback: use information_schema directly
    const { data: rows, error: err } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_type', ['BASE TABLE']);

    if (err) {
        // Try via raw SQL through a known working table
        const results = [];
        for (const table of expectedTables) {
            const { error: e } = await supabase.from(table).select('*').limit(0);
            results.push({ table, exists: !e || e.code !== '42P01', error: e?.message });
        }
        return results;
    }

    const existing = new Set((rows || []).map(r => r.table_name));
    return expectedTables.map(table => ({
        table,
        exists: existing.has(table),
        error: null
    }));
}

async function probeTable(table) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (!error) return { exists: true };
    if (error.code === '42P01' || error.message?.includes('does not exist')) return { exists: false };
    if (error.message?.includes('permission')) return { exists: true, permission_error: true };
    return { exists: true }; // other errors mean table exists but something else is wrong
}

async function checkColumns(table, expectedCols) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) return { checked: false, error: error.message };

    if (!data || data.length === 0) {
        // Table is empty — try to detect columns via insert with empty object
        const { error: e2 } = await supabase.from(table).select(expectedCols.join(',')).limit(0);
        if (e2) {
            // Parse missing column from error
            const missing = [];
            for (const col of expectedCols) {
                const { error: ce } = await supabase.from(table).select(col).limit(0);
                if (ce && ce.message?.includes(col)) missing.push(col);
            }
            return { checked: true, missing };
        }
        return { checked: true, missing: [] };
    }

    const existingCols = new Set(Object.keys(data[0]));
    const missing = expectedCols.filter(c => !existingCols.has(c));
    return { checked: true, missing };
}

async function checkFunction(fnName) {
    // Call the function with obviously wrong args — if we get "wrong number of arguments" it exists
    // If we get "function does not exist" it's missing
    const { error } = await supabase.rpc(fnName, {});
    if (!error) return true;
    if (error.message?.includes('does not exist') || error.message?.includes('Could not find')) return false;
    return true; // other errors = function exists
}

// ============================================
// MAIN AGENT
// ============================================

async function main() {
    console.log('\n🤖 CyberCheck DB Schema Agent');
    console.log('━'.repeat(50));
    console.log(`📡 Checking: ${process.env.SUPABASE_URL}`);
    console.log('━'.repeat(50) + '\n');

    const report = {
        missingTables: [],
        missingColumns: {},
        missingFunctions: [],
        missingGcrTables: [],
        existingTables: [],
    };

    // ── 1. Check all required tables ──
    console.log('🔍 Checking tables...');
    const allTables = [...EXPECTED_TABLES, ...GCR_TABLES];

    for (const table of allTables) {
        const { exists } = await probeTable(table);
        const isGcr = GCR_TABLES.includes(table);
        if (exists) {
            report.existingTables.push(table);
            process.stdout.write(`  ✅ ${table}\n`);
        } else {
            if (isGcr) {
                report.missingGcrTables.push(table);
                process.stdout.write(`  🟡 ${table} (GCR/AI feature — missing)\n`);
            } else {
                report.missingTables.push(table);
                process.stdout.write(`  ❌ ${table} (MISSING)\n`);
            }
        }
    }

    // ── 2. Check critical columns ──
    console.log('\n🔍 Checking critical columns...');
    for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
        if (!report.existingTables.includes(table)) continue;
        const result = await checkColumns(table, cols);
        if (result.missing && result.missing.length > 0) {
            report.missingColumns[table] = result.missing;
            console.log(`  ⚠️  ${table}: missing columns → ${result.missing.join(', ')}`);
        } else {
            console.log(`  ✅ ${table}: all columns OK`);
        }
    }

    // ── 3. Check RPC functions ──
    console.log('\n🔍 Checking RPC functions...');
    for (const fn of EXPECTED_FUNCTIONS) {
        const exists = await checkFunction(fn);
        if (exists) {
            console.log(`  ✅ ${fn}()`);
        } else {
            report.missingFunctions.push(fn);
            console.log(`  ❌ ${fn}() — MISSING`);
        }
    }

    // ── 4. Check seed data ──
    console.log('\n🔍 Checking seed data...');
    const { data: appCount } = await supabase.from('apps').select('app_id', { count: 'exact', head: true });
    const { count: aC } = await supabase.from('apps').select('*', { count: 'exact', head: true });
    const { count: bC } = await supabase.from('businesses').select('*', { count: 'exact', head: true });
    console.log(`  apps: ${aC ?? '?'} rows ${aC > 0 ? '✅' : '❌ (seed data missing)'}`);
    console.log(`  businesses: ${bC ?? '?'} rows ${bC > 0 ? '✅' : '⚠️  no businesses yet'}`);

    // ── 5. Summary & Fix SQL ──
    const totalMissing = report.missingTables.length + Object.keys(report.missingColumns).length + report.missingFunctions.length;

    console.log('\n' + '━'.repeat(50));
    console.log('📊 SUMMARY');
    console.log('━'.repeat(50));

    if (totalMissing === 0 && report.missingGcrTables.length === 0) {
        console.log('✅ All schema checks passed! Database is complete.\n');
        return;
    }

    if (report.missingTables.length > 0) {
        console.log(`\n❌ Missing core tables (${report.missingTables.length}):`);
        report.missingTables.forEach(t => console.log(`   - ${t}`));
    }

    if (Object.keys(report.missingColumns).length > 0) {
        console.log(`\n⚠️  Tables with missing columns:`);
        for (const [t, cols] of Object.entries(report.missingColumns)) {
            console.log(`   - ${t}: ${cols.join(', ')}`);
        }
    }

    if (report.missingFunctions.length > 0) {
        console.log(`\n❌ Missing RPC functions (${report.missingFunctions.length}):`);
        report.missingFunctions.forEach(f => console.log(`   - ${f}()`));
    }

    if (report.missingGcrTables.length > 0) {
        console.log(`\n🟡 Missing GCR/AI tables (${report.missingGcrTables.length}) — needed for AI concierge:`);
        report.missingGcrTables.forEach(t => console.log(`   - ${t}`));
    }

    // ── 6. Generate fix SQL ──
    console.log('\n' + '━'.repeat(50));
    console.log('🔧 GENERATING FIX SQL via Claude Haiku...');
    console.log('━'.repeat(50));

    await generateFixSQL(report);
}

// ============================================
// CLAUDE HAIKU: Generate Fix SQL
// ============================================

async function generateFixSQL(report) {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.log('\n⚠️  No ANTHROPIC_API_KEY found — skipping AI fix generation');
        console.log('Add ANTHROPIC_API_KEY to your .env to get AI-generated fix SQL\n');
        printManualFixes(report);
        return;
    }

    const prompt = buildFixPrompt(report);

    try {
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
                    content: prompt
                }]
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.log('⚠️  Claude API error:', err);
            printManualFixes(report);
            return;
        }

        const data = await res.json();
        const sql = data.content?.[0]?.text;
        console.log('\n' + sql);

        // Save to file
        const fs = require('fs');
        const fixPath = require('path').join(__dirname, '../fix-missing-schema.sql');
        fs.writeFileSync(fixPath, sql);
        console.log(`\n✅ Fix SQL saved to: fix-missing-schema.sql`);
        console.log('📋 Copy and paste into Supabase SQL Editor to fix all issues.\n');

    } catch (e) {
        console.log('⚠️  Error calling Claude:', e.message);
        printManualFixes(report);
    }
}

function buildFixPrompt(report) {
    return `You are a PostgreSQL/Supabase database expert.

A CyberCheck multi-tenant platform database is missing the following items. Generate clean "CREATE TABLE IF NOT EXISTS" and "ALTER TABLE ADD COLUMN IF NOT EXISTS" SQL to fix every issue. Also include CREATE OR REPLACE FUNCTION for any missing functions.

PLATFORM CONTEXT:
- Multi-tenant SaaS: all tables use site_id UUID foreign key → businesses(site_id)
- Uses Supabase with RLS enabled
- Service role bypasses RLS (API uses service key)

MISSING CORE TABLES: ${JSON.stringify(report.missingTables)}

MISSING COLUMNS (table → columns): ${JSON.stringify(report.missingColumns)}

MISSING FUNCTIONS: ${JSON.stringify(report.missingFunctions)}

MISSING GCR/AI TABLES: ${JSON.stringify(report.missingGcrTables)}

For the GCR/AI tables, here is what each needs:

business_details (site_id, elevator_pitch TEXT, vibe TEXT, age_restriction TEXT, dress_code TEXT, insider_tip TEXT, best_for TEXT, keywords JSONB DEFAULT '[]', updated_at TIMESTAMPTZ DEFAULT NOW())

business_logistics (site_id, parking TEXT, accessibility TEXT, directions TEXT, public_transit TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())

business_atmosphere (site_id, music_type TEXT, noise_level TEXT, indoor_outdoor TEXT, seating TEXT, reservation_required BOOLEAN DEFAULT false, updated_at TIMESTAMPTZ DEFAULT NOW())

qa_pairs (id UUID, site_id UUID, question TEXT, answer TEXT, category VARCHAR(50), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())

ai_chunks (id UUID, site_id UUID, content TEXT, chunk_type VARCHAR(50), embedding vector(1536), metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW())

loyalty_members (id UUID, site_id UUID NULLABLE, phone VARCHAR(20) UNIQUE NOT NULL, email VARCHAR(255), name VARCHAR(255), points INT DEFAULT 0, tier VARCHAR(20) DEFAULT 'bronze', interests JSONB DEFAULT '[]', member_type VARCHAR(20) DEFAULT 'tourist', zip VARCHAR(10), sms_opt_in BOOLEAN DEFAULT true, personal_code VARCHAR(20) UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())

loyalty_transactions (id UUID, member_id UUID REFERENCES loyalty_members(id), site_id UUID, type VARCHAR(20), points INT, description TEXT, booking_id UUID, created_at TIMESTAMPTZ DEFAULT NOW())

For missing functions, generate the full CREATE OR REPLACE FUNCTION with proper PL/pgSQL.

For any missing RLS policies, add them with CREATE POLICY IF NOT EXISTS pattern (or use DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$).

Output ONLY the SQL, no explanations. Make it safe to run multiple times (IF NOT EXISTS everywhere).`;
}

function printManualFixes(report) {
    console.log('\n📋 MANUAL FIX GUIDE:');
    console.log('Run schema.sql then schema-additions.sql in Supabase SQL Editor.');

    if (report.missingGcrTables.length > 0) {
        console.log('\nFor GCR/AI tables, run agents/gcr-schema.sql in Supabase SQL Editor.');
    }

    if (report.missingColumns && Object.keys(report.missingColumns).length > 0) {
        console.log('\nMissing columns — run these ALTER statements:');
        for (const [table, cols] of Object.entries(report.missingColumns)) {
            for (const col of cols) {
                console.log(`  ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} TEXT;`);
            }
        }
    }
}

main().catch(e => {
    console.error('\n💥 Agent crashed:', e.message);
    process.exit(1);
});

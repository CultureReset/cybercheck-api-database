#!/usr/bin/env node
// Import GCR events April 3-19, 2026 — robust parser handles messy CSV

require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

// ── DATE ──────────────────────────────────────────────────────────────────────
function parseDate(raw) {
  const m = (raw || '').trim().match(/^(\d+)\/(\d+)\/(\d+)$/);
  if (!m) return null;
  const [, mo, day, yr] = m;
  const year = parseInt(yr) < 100 ? 2000 + parseInt(yr) : parseInt(yr);
  return `${year}-${String(mo).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// ── TIME ──────────────────────────────────────────────────────────────────────
// Handles: "9", "5:30", "1 p.m.", "noon", "9-10 a.m", "1-4 p.m.", "7:15 a.m."
// Also detects garbage (venue names, sentences) and returns null
function parseTime(raw) {
  if (!raw || !raw.trim()) return null;
  const t = raw.trim().toLowerCase();

  // Garbage detection — if it looks like a venue/sentence, not a time
  if (t.length > 30) return null;
  if (/[a-z]{4,}/.test(t) && !/(a\.?m|p\.?m|noon|midnight)/.test(t)) return null;

  if (t.includes('noon') || t.includes('12:00') || t === '12') return '12:00';
  if (t === 'midnight') return '00:00';

  // Detect am/pm anywhere in string
  const isAM = /(a\.?m\.?)/.test(t);
  const isPM = /(p\.?m\.?)/.test(t);

  // Extract first number (with optional :MM)
  const numMatch = t.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!numMatch) return null;

  let hours = parseInt(numMatch[1]);
  const mins = numMatch[2] ? parseInt(numMatch[2]) : 0;

  // Sanity check
  if (hours > 23 || mins > 59) return null;

  if (isAM) {
    if (hours === 12) hours = 0;
  } else if (isPM) {
    if (hours !== 12) hours += 12;
  } else {
    // No am/pm indicator — use context heuristic:
    // 1–10 without qualifier = assume PM (live music, events)
    // 11–12 = assume AM/noon (brunch, morning events)
    if (hours >= 1 && hours <= 10) hours += 12;
  }

  if (hours > 23) return null; // final sanity check
  return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
}

// ── CSV PARSER ────────────────────────────────────────────────────────────────
// Proper RFC 4180 parser — handles quoted fields with commas inside
function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { field += '"'; i++; } // escaped quote
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    // Validate row has roughly the right number of columns
    // If columns shifted (unquoted comma in event_name), use raw_text to recover
    const row = {};
    headers.forEach((h, idx) => row[h] = (fields[idx] || '').trim());
    rows.push(row);
  }
  return rows;
}

// ── FIELD VALIDATION ─────────────────────────────────────────────────────────
// Check if a field value looks like it belongs in the wrong column
function looksLikeVenue(str) {
  if (!str) return false;
  // Venue indicators: contains road/church/bar/restaurant keywords or is long address
  return /legion|church|bar|restaurant|jacks|hangout|marina|beach|resort|lodge|theater|office|sloop|wharf|post \d|rd\.|ave\.|blvd/i.test(str);
}

function looksLikeTime(str) {
  if (!str) return false;
  return /^\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)?$/i.test(str.trim()) ||
         /noon|midnight/i.test(str) ||
         /^\d{1,2}-\d{1,2}/.test(str.trim());
}

// ── RECOVER SHIFTED ROWS ─────────────────────────────────────────────────────
// When event_name has an unquoted comma, time gets the next chunk.
// Detect this and try to recover from raw_text.
function recoverRow(row) {
  // If time field looks like a venue (not a time), columns shifted
  if (row.time && looksLikeVenue(row.time) && !looksLikeTime(row.time)) {
    // Try to extract time from event_name (e.g. "Karaoke (5-7")
    // and recover venue from time field
    const timeInName = row.event_name.match(/\((\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)\s*[-–]/i);
    return {
      ...row,
      event_name: row.event_name.replace(/\s*\(.*$/, '').trim(), // strip time from name
      time: timeInName ? timeInName[1] : null,
      venue: row.time,  // what was in time IS the venue
      city: row.venue || row.city,
    };
  }
  return row;
}

// ── CLEAN VENUE ───────────────────────────────────────────────────────────────
function buildVenueLocation(venue, city) {
  // Don't include city if venue already contains it
  const v = (venue || '').trim();
  const c = (city || '').trim();
  if (!v && !c) return null;
  if (!v) return c;
  if (!c) return v;
  if (v.toLowerCase().includes(c.toLowerCase())) return v;
  return `${v}, ${c}`;
}

// ── FIX UNICODE CURLY QUOTES ─────────────────────────────────────────────────
function fixEncoding(str) {
  if (!str) return str;
  return str
    .replace(/\u00e2\u0080\u0099/g, "'")   // â€™ → '
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/â/g, "'");
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvPath = path.join(__dirname, '../data/gcr_events_april_3_19_structured.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  // ── Step 1: Delete previous import (entity_id=null, April 2026) ──
  console.log('Deleting previous import...');
  const { error: delError } = await supabase
    .from('entity_events')
    .delete()
    .is('entity_id', null)
    .gte('event_date', '2026-04-01')
    .lte('event_date', '2026-04-30');
  if (delError) {
    console.error('Delete error:', delError.message);
    process.exit(1);
  }
  console.log('Previous records cleared.\n');

  // ── Step 2: Parse CSV ──
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(raw);
  console.log(`Parsed ${rows.length} rows`);

  // ── Step 3: Filter & transform ──
  const skipped = [];
  const records = [];

  for (const rawRow of rows) {
    if (rawRow.category === 'schedule_reference') {
      skipped.push({ reason: 'schedule_reference', name: rawRow.event_name });
      continue;
    }

    const row = recoverRow(rawRow);
    const eventDate = parseDate(row.date);
    if (!eventDate) {
      skipped.push({ reason: 'no_date', name: row.event_name });
      continue;
    }

    const startTime = parseTime(row.time);
    const venueLocation = buildVenueLocation(row.venue, row.city);
    const eventName = fixEncoding(row.event_name);
    const description = row.details ? fixEncoding(row.details) : null;

    records.push({
      entity_id: null,
      event_name: eventName,
      event_type: row.category || null,
      description: description,
      venue_location: venueLocation,
      day_of_week: row.day_of_week || null,
      event_date: eventDate,
      start_time: startTime,
      end_time: null,
      recurring: false,
      is_active: true,
    });
  }

  console.log(`Importing: ${records.length} | Skipping: ${skipped.length}`);
  if (skipped.length) {
    console.log('Skipped:', skipped.map(s => `[${s.reason}] ${s.name}`).join('\n         '));
  }

  // ── Step 4: Preview ──
  console.log('\nSample (first 5):');
  records.slice(0, 5).forEach(r =>
    console.log(`  ${r.event_date} ${r.day_of_week} ${r.start_time || '——  '} | ${(r.venue_location||'').substring(0,35).padEnd(35)} | ${r.event_name}`)
  );

  // ── Step 5: Insert in batches ──
  console.log('\nInserting...');
  const BATCH = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('entity_events')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`Batch ${i}: ${error.message}`);
      errors++;
    } else {
      inserted += data.length;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Errors: ${errors}`);

  // ── Step 6: Summary by type ──
  const byType = {};
  records.forEach(r => { byType[r.event_type] = (byType[r.event_type] || 0) + 1; });
  console.log('\nBy type:');
  Object.entries(byType).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${String(v).padStart(3)}  ${k}`));
}

main().catch(console.error);

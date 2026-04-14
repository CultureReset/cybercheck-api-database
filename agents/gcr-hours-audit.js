#!/usr/bin/env node
// gcr-hours-audit.js — Checks hours data is saved correctly and Open/Closed badge works
// Usage: node agents/gcr-hours-audit.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

let token = null;

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data, ok: res.status < 400 };
  } catch(e) { return { status: 0, data: null, ok: false }; }
}

// Parse time string to minutes (same logic as gcr-listings.js)
function parseTimeMins(t) {
  if (!t) return null;
  const s = String(t).trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2]||'0', 10);
  const ap = m[3];
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

function canComputeStatus(hours) {
  if (!hours || !Array.isArray(hours) || hours.length === 0) return false;
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const todayName = days[new Date().getDay()];
  const todayHours = hours.find(h => h.day_of_week && h.day_of_week.toLowerCase() === todayName);
  if (!todayHours) return false;
  if (todayHours.is_closed) return true;
  return !!(todayHours.open_time && todayHours.close_time);
}

async function run() {
  console.log(`\n${B}GCR Hours Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Hours Data in entity_hours Table');
  const entitiesRes = await api('GET', '/api/gcr/entities?limit=500');
  const entities = entitiesRes.data?.entities || entitiesRes.data?.businesses || [];
  ok(`Fetched ${entities.length} active entities`);

  // Sample 20 entities and check their profile for hours
  const sample = entities.slice(0, 20);
  let withHours = 0, withoutHours = 0, badFormat = 0, statusWorks = 0;
  const noHoursList = [];

  for (const e of sample) {
    const r = await api('GET', `/api/gcr/entity/${e.slug}`);
    if (!r.ok) { warn(`Could not fetch profile for ${e.name}`); continue; }
    const hours = r.data?.hours || [];

    if (hours.length > 0) {
      withHours++;
      // Check if Open/Closed can be computed
      if (canComputeStatus(hours)) statusWorks++;
      else warn(`${e.name}: has hours but Open/Closed cannot be computed — check time format`);
    } else {
      // Check entity table for hours_mon etc
      const ent = r.data?.entity || {};
      const hasEntityHours = Object.keys(ent).some(k => k.startsWith('hours_'));
      if (hasEntityHours) {
        warn(`${e.name}: hours on entity table but NOT in entity_hours table — admin form may not be saving to correct table`);
        badFormat++;
      } else {
        withoutHours++;
        noHoursList.push(e.name);
      }
    }
  }

  if (withHours > 0) ok(`${withHours}/${sample.length} sampled entities have hours in entity_hours table`);
  if (withoutHours > 0) warn(`${withoutHours}/${sample.length} sampled entities have NO hours data at all`);
  if (badFormat > 0) fail(`${badFormat} entities have hours on entity table but not entity_hours — data saved to wrong place`);
  if (statusWorks > 0) ok(`${statusWorks} entities can show Open/Closed badge correctly`);

  if (noHoursList.length) {
    console.log(`\n  ${Y}Entities without hours:${X}`);
    noHoursList.forEach(n => console.log(`    ${Y}⚠${X} ${n}`));
  }

  sec('Hours Format Validation');
  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  // Test that a profile with hours returns correct structure
  const withHoursEntity = entities.find(e => e.slug);
  if (withHoursEntity) {
    const r = await api('GET', `/api/gcr/entity/${withHoursEntity.slug}`);
    const hours = r.data?.hours || [];
    if (hours.length > 0) {
      const h = hours[0];
      const fields = ['day_of_week', 'open_time', 'close_time'];
      const hasAll = fields.every(f => f in h);
      if (hasAll) ok(`Hours row has correct fields: day_of_week, open_time, close_time`);
      else fail(`Hours row missing fields — has: ${Object.keys(h).join(', ')}`);
      const validDay = DAYS.includes(h.day_of_week);
      if (validDay) ok(`day_of_week format correct: "${h.day_of_week}"`);
      else warn(`day_of_week may have wrong format: "${h.day_of_week}" — should be "Monday" etc.`);
    }
  }

  sec('HH Schedule Fields on Entity');
  let hhWithDays = 0, hhWithoutDays = 0;
  for (const e of entities.slice(0, 50)) {
    if (e.hh_days) hhWithDays++;
    else hhWithoutDays++;
  }
  ok(`${hhWithDays}/50 sampled entities have hh_days set`);
  if (hhWithoutDays === 50) warn(`${hhWithoutDays}/50 sampled entities have no hh_days set — fill in for happy hour businesses`);
  else if (hhWithoutDays > 0) warn(`${hhWithoutDays}/50 entities missing hh_days`);

  // Overall
  const overallScore = Math.round((withHours + statusWorks) / (sample.length * 2) * 100);
  console.log(`\n${B}Hours data quality: ${overallScore}%${X}`);

  if (process.env.ANTHROPIC_API_KEY) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `GCR hours audit results:
${withHours}/${sample.length} entities have hours in entity_hours table.
${withoutHours} have no hours at all. ${badFormat} have hours on entity table but not entity_hours (wrong table).
${statusWorks} can show Open/Closed badge. ${hhWithDays}/50 have hh_days field.

What does this mean for the site? The Open/Closed badge on category listing cards requires hours in entity_hours. The HH page requires hh_days. Give specific fixes.` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}\n`);
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * Backfill site_content for GCR-listed businesses.
 * - Creates missing site_content rows
 * - Fills empty fields from scraped-menus data.json files
 */
require('dotenv').config();
const supabase = require('./db');
const fs = require('fs');
const path = require('path');

const SCRAPED = '/Users/owner/cybercheck-api-database/scraped-menus';

function formatHours(hours) {
  if (!hours || typeof hours !== 'object') return null;
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const parts = [];
  for (const day of days) {
    const val = hours[day];
    if (val && typeof val === 'string' && val.toLowerCase() !== 'null') {
      const label = day.charAt(0).toUpperCase() + day.slice(1, 3);
      parts.push(`${label}: ${val}`);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

async function backfill() {
  // Load all GCR businesses
  const { data: businesses } = await supabase
    .from('businesses')
    .select('site_id, name, subdomain')
    .eq('gcr_listed', true)
    .order('name');

  // Load existing site_content rows
  const { data: existingContent } = await supabase
    .from('site_content')
    .select('site_id, about_text, hours, contact_phone, website_url, gallery, features, qna')
    .in('site_id', businesses.map(b => b.site_id));

  const contentMap = Object.fromEntries((existingContent || []).map(c => [c.site_id, c]));

  // Build scraped data index by business name
  const scrapedIndex = {};
  const dirs = fs.readdirSync(SCRAPED).filter(d => {
    try { return fs.statSync(path.join(SCRAPED, d)).isDirectory(); } catch { return false; }
  });

  for (const dir of dirs) {
    const file = path.join(SCRAPED, dir, 'data.json');
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const name = (data.business_name || '').toLowerCase().trim();
      if (name) scrapedIndex[name] = data;
    } catch {}
  }

  let created = 0, updated = 0, skipped = 0;

  for (const biz of businesses) {
    const content = contentMap[biz.site_id];
    const scraped = scrapedIndex[biz.name.toLowerCase().trim()];

    const needsCreate = !content;
    const needsUpdate = content && (
      (!content.about_text && scraped?.about?.description) ||
      (!content.hours && scraped?.hours) ||
      (!content.website_url && scraped?.url) ||
      (!content.gallery?.length && scraped?.gallery?.length) ||
      (!content.qna?.length && scraped?.about?.qna?.length)
    );

    if (!needsCreate && !needsUpdate) {
      skipped++;
      continue;
    }

    // Build patch from scraped data
    const patch = {};

    if (scraped) {
      if (!content?.about_text && scraped.about?.description) {
        patch.about_text = scraped.about.description;
        patch.seo_description = scraped.about.elevator_pitch || scraped.about.description.slice(0, 160);
      }
      if (!content?.hours && scraped.hours) {
        patch.hours = formatHours(scraped.hours);
      }
      if (!content?.website_url && scraped.url) {
        patch.website_url = scraped.url;
      }
      if (!content?.contact_phone && scraped.contact?.phone) {
        patch.contact_phone = scraped.contact.phone;
      }
      if (!content?.gallery?.length && scraped.gallery?.length) {
        patch.gallery = scraped.gallery.filter(url => url && url.startsWith('http')).slice(0, 12);
      }
      if (!content?.qna?.length && scraped.about?.qna?.length) {
        patch.qna = scraped.about.qna.map(item => ({ q: item.question, a: item.answer }));
      }
      if (!content?.features?.length && scraped.about) {
        const features = [];
        if (scraped.about.best_for) features.push({ icon: '⭐', label: 'Best For', value: scraped.about.best_for });
        if (scraped.about.vibe) features.push({ icon: '✨', label: 'Vibe', value: scraped.about.vibe });
        if (scraped.about.insider_tip) features.push({ icon: '💡', label: 'Insider Tip', value: scraped.about.insider_tip });
        if (features.length) patch.features = features;
      }
      if (!content?.address && scraped.contact?.address) {
        patch.address = scraped.contact.address;
        patch.city = scraped.contact.city;
        patch.state = scraped.contact.state;
        patch.zip = scraped.contact.zip;
      }
    }

    if (Object.keys(patch).length === 0 && !needsCreate) {
      skipped++;
      continue;
    }

    if (needsCreate) {
      const { error } = await supabase.from('site_content').insert({ site_id: biz.site_id, ...patch });
      if (error) {
        console.error(`✗ CREATE ${biz.name}: ${error.message}`);
      } else {
        console.log(`✓ CREATED ${biz.name} (${Object.keys(patch).join(', ') || 'empty row'})`);
        created++;
      }
    } else {
      const { error } = await supabase.from('site_content').update(patch).eq('site_id', biz.site_id);
      if (error) {
        console.error(`✗ UPDATE ${biz.name}: ${error.message}`);
      } else {
        console.log(`✓ UPDATED ${biz.name} (${Object.keys(patch).join(', ')})`);
        updated++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Created: ${created} | Updated: ${updated} | Skipped: ${skipped}`);
}

backfill().catch(err => { console.error('Fatal:', err); process.exit(1); });

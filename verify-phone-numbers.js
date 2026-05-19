require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');

async function verifyPhones() {
  try {
    const db = getGcrDb();

    console.log('🔍 Loading match results...\n');

    const matchResults = JSON.parse(fs.readFileSync('./match-results.json', 'utf8'));
    const exactMatches = matchResults.exact_matches;
    const partialMatches = matchResults.partial_matches;

    console.log(`Checking ${exactMatches.length} exact matches and ${partialMatches.length} partial matches...\n`);

    // Get all entities with phone numbers
    const { data: entities, error } = await db
      .from('entity')
      .select('id, name, phone')
      .not('phone', 'is', null);

    if (error) throw error;

    // Create phone lookup map (normalized)
    const normalize = (phone) => {
      if (!phone) return '';
      return phone.replace(/\D/g, '');
    };

    const entitiesByPhone = {};
    entities.forEach(e => {
      const normalized = normalize(e.phone);
      if (normalized) entitiesByPhone[normalized] = e;
    });

    // Check exact matches
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('✅ EXACT MATCHES - Phone Verification\n');

    let exactPhoneMatch = 0;
    let exactPhoneMismatch = 0;
    const exactPhoneIssues = [];

    exactMatches.forEach(m => {
      const extractedPhone = normalize(m.extracted_phone || '');
      const dbPhone = m.phone || '';
      const dbPhoneNorm = normalize(dbPhone);

      if (!extractedPhone) {
        // No phone in extracted data
        return;
      }

      if (extractedPhone === dbPhoneNorm) {
        exactPhoneMatch++;
      } else {
        exactPhoneMismatch++;
        exactPhoneIssues.push({
          name: m.extracted_name,
          extractedPhone: m.extracted_phone,
          dbPhone: dbPhone,
          entityId: m.entity_id,
          menuItems: m.menu_items
        });
      }
    });

    console.log(`Match:    ${exactPhoneMatch} restaurants`);
    console.log(`Mismatch: ${exactPhoneMismatch} restaurants\n`);

    if (exactPhoneIssues.length > 0) {
      console.log('⚠️  PHONE MISMATCHES (Exact Matches):\n');
      exactPhoneIssues.slice(0, 10).forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue.name}`);
        console.log(`   Extracted: ${issue.extractedPhone}`);
        console.log(`   Database:  ${issue.dbPhone}`);
        console.log(`   Menu items: ${issue.menuItems}\n`);
      });
      if (exactPhoneIssues.length > 10) {
        console.log(`... and ${exactPhoneIssues.length - 10} more\n`);
      }
    }

    // Check partial matches
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('⚠️  PARTIAL MATCHES - Phone Verification\n');

    let partialPhoneMatch = 0;
    let partialPhoneMismatch = 0;
    let partialNoPhone = 0;
    const partialPhoneIssues = [];

    partialMatches.forEach(m => {
      const extractedPhone = normalize(m.extracted_phone || '');
      const dbPhone = m.phone || '';
      const dbPhoneNorm = normalize(dbPhone);

      if (!extractedPhone) {
        partialNoPhone++;
        return;
      }

      if (extractedPhone === dbPhoneNorm) {
        partialPhoneMatch++;
      } else {
        partialPhoneMismatch++;
        partialPhoneIssues.push({
          extractedName: m.extracted_name,
          dbName: m.entity_name,
          extractedPhone: m.extracted_phone,
          dbPhone: dbPhone,
          entityId: m.entity_id,
          menuItems: m.menu_items
        });
      }
    });

    console.log(`Match:    ${partialPhoneMatch} restaurants`);
    console.log(`Mismatch: ${partialPhoneMismatch} restaurants`);
    console.log(`No phone: ${partialNoPhone} restaurants\n`);

    if (partialPhoneIssues.length > 0) {
      console.log('⚠️  PHONE MISMATCHES (Partial Matches - IMPORTANT):\n');
      partialPhoneIssues.slice(0, 15).forEach((issue, idx) => {
        console.log(`${idx + 1}. "${issue.extractedName}" ~> "${issue.dbName}"`);
        console.log(`   Extracted: ${issue.extractedPhone}`);
        console.log(`   Database:  ${issue.dbPhone}`);
        console.log(`   Menu items: ${issue.menuItems}`);
        console.log(`   ⚠️  VERIFY THIS MATCH!\n`);
      });
      if (partialPhoneIssues.length > 15) {
        console.log(`... and ${partialPhoneIssues.length - 15} more\n`);
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('📊 PHONE NUMBER VERIFICATION SUMMARY\n');

    const totalExtractedWithPhone = exactMatches.filter(m => m.extracted_phone).length +
                                    partialMatches.filter(m => m.extracted_phone).length;
    const totalPhoneMatches = exactPhoneMatch + partialPhoneMatch;
    const totalPhoneMismatches = exactPhoneMismatch + partialPhoneMismatch;

    console.log(`Exact matches with phone:           ${exactMatches.filter(m => m.extracted_phone).length}`);
    console.log(`  ✅ Phones match DB:                ${exactPhoneMatch}`);
    console.log(`  ⚠️  Phones differ:                 ${exactPhoneMismatch}\n`);

    console.log(`Partial matches with phone:         ${partialMatches.filter(m => m.extracted_phone).length}`);
    console.log(`  ✅ Phones match DB:                ${partialPhoneMatch}`);
    console.log(`  ⚠️  Phones differ:                 ${partialPhoneMismatch}\n`);

    console.log(`OVERALL:\n`);
    console.log(`Total matches with phone data:      ${totalExtractedWithPhone}`);
    console.log(`✅ Phone numbers verified:          ${totalPhoneMatches} (${Math.round(totalPhoneMatches/totalExtractedWithPhone*100)}%)`);
    console.log(`⚠️  Phone numbers mismatch:         ${totalPhoneMismatches} (${Math.round(totalPhoneMismatches/totalExtractedWithPhone*100)}%)`);

    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('💡 RECOMMENDATION:\n');

    if (totalPhoneMatches / totalExtractedWithPhone > 0.9) {
      console.log('✅ Phone numbers are WELL ALIGNED - matches are reliable');
      console.log('   Safe to import extracted menu data to these entities\n');
    } else if (totalPhoneMatches / totalExtractedWithPhone > 0.7) {
      console.log('⚠️  Phone numbers are PARTIALLY ALIGNED - review mismatches');
      console.log('   Check partial matches before importing\n');
    } else {
      console.log('❌ Phone numbers are NOT well aligned - needs investigation');
      console.log('   Verify matches are correct before importing\n');
    }

    // Save results
    fs.writeFileSync('./PHONE-VERIFICATION.json', JSON.stringify({
      summary: {
        exact_matches: {
          with_phone: exactMatches.filter(m => m.extracted_phone).length,
          phone_match: exactPhoneMatch,
          phone_mismatch: exactPhoneMismatch
        },
        partial_matches: {
          with_phone: partialMatches.filter(m => m.extracted_phone).length,
          phone_match: partialPhoneMatch,
          phone_mismatch: partialPhoneMismatch,
          no_phone: partialNoPhone
        }
      },
      exact_phone_issues: exactPhoneIssues,
      partial_phone_issues: partialPhoneIssues
    }, null, 2));

    console.log(`✅ Full results saved to PHONE-VERIFICATION.json\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyPhones();

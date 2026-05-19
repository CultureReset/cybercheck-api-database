require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');
const path = require('path');

async function verifyPhones() {
  try {
    const db = getGcrDb();

    console.log('🔍 Verifying phone numbers for matched restaurants...\n');

    const matchResults = JSON.parse(fs.readFileSync('./match-results.json', 'utf8'));
    const exactMatches = matchResults.exact_matches;

    // Get entity phones from database
    const { data: entities, error } = await db
      .from('entity')
      .select('id, name, phone');

    if (error) throw error;

    const entitiesById = {};
    entities.forEach(e => entitiesById[e.id] = e);

    const normalize = (phone) => {
      if (!phone) return '';
      if (typeof phone !== 'string') return '';
      return phone.replace(/\D/g, '');
    };

    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`✅ EXACT MATCHES (${exactMatches.length})\n`);

    let phoneMatch = 0;
    let phoneMismatch = 0;
    let extractedHasPhone = 0;
    let dbHasPhone = 0;
    const mismatches = [];

    exactMatches.forEach(m => {
      const extractedPath = `./extracted-restaurants/${m.folder}.json`;

      if (!fs.existsSync(extractedPath)) {
        return;
      }

      const extracted = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
      const extractedPhone = extracted.contact?.phone || '';
      const dbEntity = entitiesById[m.entity_id];
      const dbPhone = dbEntity?.phone || '';

      if (extractedPhone) extractedHasPhone++;
      if (dbPhone) dbHasPhone++;

      if (!extractedPhone || !dbPhone) {
        return;
      }

      const extractedNorm = normalize(extractedPhone);
      const dbNorm = normalize(dbPhone);

      if (extractedNorm === dbNorm) {
        phoneMatch++;
      } else {
        phoneMismatch++;
        mismatches.push({
          name: m.entity_name,
          extractedPhone,
          dbPhone,
          menuItems: m.menu_items
        });
      }
    });

    console.log(`Extracted data with phone:  ${extractedHasPhone}`);
    console.log(`Database with phone:        ${dbHasPhone}`);
    console.log(`Both have phone data:       ${Math.min(extractedHasPhone, dbHasPhone)}\n`);

    console.log(`✅ Phone numbers MATCH:     ${phoneMatch}`);
    console.log(`⚠️  Phone numbers DIFFER:   ${phoneMismatch}\n`);

    if (phoneMatch + phoneMismatch > 0) {
      console.log(`Match rate: ${Math.round(phoneMatch / (phoneMatch + phoneMismatch) * 100)}%\n`);
    }

    if (mismatches.length > 0) {
      console.log('⚠️  MISMATCHES:\n');
      mismatches.slice(0, 10).forEach((m, idx) => {
        console.log(`${idx + 1}. ${m.name}`);
        console.log(`   Extracted: ${m.extractedPhone}`);
        console.log(`   Database:  ${m.dbPhone}`);
        console.log(`   Menu items: ${m.menuItems}\n`);
      });
      if (mismatches.length > 10) {
        console.log(`... and ${mismatches.length - 10} more\n`);
      }
    }

    // Check partial matches too
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log(`⚠️  PARTIAL MATCHES (${matchResults.partial_matches.length})\n`);

    let partialMatch = 0;
    let partialMismatch = 0;
    const partialMismatches = [];

    matchResults.partial_matches.forEach(m => {
      const extractedPath = `./extracted-restaurants/${m.folder}.json`;

      if (!fs.existsSync(extractedPath)) {
        return;
      }

      const extracted = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
      const extractedPhone = extracted.contact?.phone || '';
      const dbEntity = entitiesById[m.entity_id];
      const dbPhone = dbEntity?.phone || '';

      if (!extractedPhone || !dbPhone) {
        return;
      }

      const extractedNorm = normalize(extractedPhone);
      const dbNorm = normalize(dbPhone);

      if (extractedNorm === dbNorm) {
        partialMatch++;
      } else {
        partialMismatch++;
        partialMismatches.push({
          extractedName: m.extracted_name,
          dbName: m.entity_name,
          extractedPhone,
          dbPhone,
          menuItems: m.menu_items
        });
      }
    });

    console.log(`✅ Phone numbers MATCH:     ${partialMatch}`);
    console.log(`⚠️  Phone numbers DIFFER:   ${partialMismatch}\n`);

    if (partialMismatch > 0) {
      console.log('⚠️  MISMATCHES (Partial matches - review these!):\n');
      partialMismatches.forEach((m, idx) => {
        console.log(`${idx + 1}. "${m.extractedName}" matched to "${m.dbName}"`);
        console.log(`   Extracted: ${m.extractedPhone}`);
        console.log(`   Database:  ${m.dbPhone}`);
        console.log(`   ❌ PHONE DIFFERS - verify match is correct!\n`);
      });
    } else if (partialMismatch === 0 && partialMatch > 0) {
      console.log('✅ All partial match phones are CORRECT!\n');
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════\n');
    console.log('📊 OVERALL PHONE VERIFICATION\n');

    const totalMatched = phoneMatch + partialMatch;
    const totalMismatched = phoneMismatch + partialMismatch;
    const total = totalMatched + totalMismatched;

    if (total > 0) {
      console.log(`Total restaurants verified: ${total}`);
      console.log(`✅ Phone match:             ${totalMatched} (${Math.round(totalMatched / total * 100)}%)`);
      console.log(`⚠️  Phone mismatch:         ${totalMismatched} (${Math.round(totalMismatched / total * 100)}%)`);

      console.log('\n💡 ASSESSMENT:\n');
      if (totalMatched / total > 0.95) {
        console.log('✅ EXCELLENT - Phone numbers are well aligned');
        console.log('   Safe to import data to these entities\n');
      } else if (totalMatched / total > 0.8) {
        console.log('⚠️  GOOD - Most phone numbers match');
        console.log('   Check the mismatches, but mostly safe to import\n');
      } else {
        console.log('❌ POOR - Many phone number mismatches');
        console.log('   Verify matches are correct before importing!\n');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyPhones();

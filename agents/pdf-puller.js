#!/usr/bin/env node
/**
 * PDF Puller — finds and extracts text from PDFs linked in scraped raw.json files
 * Zero API cost — just downloads and reads PDFs directly.
 *
 * Usage:
 *   node agents/pdf-puller.js           — process all with pending PDFs
 *   node agents/pdf-puller.js --all     — re-process even if already done
 *   node agents/pdf-puller.js --only teak-house,ginny-lane-bar-and-grill
 */

const fs   = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../scraped-menus');

async function run() {
    const args    = process.argv.slice(2);
    const allFlag = args.includes('--all');
    const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

    // Load pdf-parse
    let PDFParse;
    try {
        PDFParse = require('pdf-parse').PDFParse;
        if (!PDFParse) throw new Error('no PDFParse export');
    } catch {
        console.error('pdf-parse not installed. Run: npm install pdf-parse');
        process.exit(1);
    }

    // Find all business dirs
    const dirs = [];
    for (const d of fs.readdirSync(BASE_DIR)) {
        const f = path.join(BASE_DIR, d, 'raw.json');
        if (fs.existsSync(f)) dirs.push({ slug: d, file: f });
    }

    // Filter to slugs we care about
    let targets = dirs;
    if (onlyArg) {
        const only = onlyArg.split(',').map(s => s.trim());
        targets = dirs.filter(d => only.includes(d.slug));
    } else if (!allFlag) {
        // Skip ones that already have pdfTexts
        targets = dirs.filter(({ file }) => {
            const raw = JSON.parse(fs.readFileSync(file));
            return (raw.pdfUrls || []).length > 0 && !(raw.pdfTexts || []).length;
        });
    } else {
        // --all: only process ones that have pdfUrls
        targets = dirs.filter(({ file }) => {
            const raw = JSON.parse(fs.readFileSync(file));
            return (raw.pdfUrls || []).length > 0;
        });
    }

    console.log('\nPDF Puller');
    console.log('Businesses with pending PDFs: ' + targets.length + '\n');

    let updated = 0, failed = 0;

    for (const { slug, file } of targets) {
        const raw = JSON.parse(fs.readFileSync(file));
        if (!(raw.pdfUrls || []).length) continue;

        console.log(slug + ' (' + raw.pdfUrls.length + ' PDFs)');

        const texts = [];
        for (const url of raw.pdfUrls) {
            const name = url.split('/').pop().substring(0, 50);
            try {
                const parser = new PDFParse({ url });
                const data   = await parser.getText();
                if (data.text?.trim().length > 50) {
                    texts.push('[PDF: ' + url + ']\n' + data.text.trim());
                    console.log('  OK  ' + data.text.length.toLocaleString() + ' chars — ' + name);
                } else {
                    console.log('  EMPTY (image-based PDF?) — ' + name);
                }
            } catch (e) {
                console.log('  FAIL ' + name + ': ' + e.message.substring(0, 60));
                failed++;
            }
        }

        if (texts.length) {
            raw.pdfTexts = texts;
            fs.writeFileSync(file, JSON.stringify(raw, null, 2));
            console.log('  Saved ' + texts.length + ' PDF(s) to raw.json\n');
            updated++;
        } else {
            console.log('  No text extracted\n');
        }
    }

    console.log('Done. Updated: ' + updated + ' | Failed: ' + failed);
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });

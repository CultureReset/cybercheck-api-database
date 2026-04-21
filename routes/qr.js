// ============================================
// QR Code Tracking — Universal scan intelligence
// Numbered sticker rolls, business cards, ads, tables, anywhere
// ============================================

const express = require('express');
const crypto  = require('crypto');
const { authRequired } = require('../middleware/auth');
const supabase = require('../db');

const router = express.Router();

const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous 0/O/1/I/l

function makeCode(len = 8) {
    const bytes = crypto.randomBytes(len);
    return Array.from(bytes).map(b => CHARS[b % CHARS.length]).join('');
}

async function uniqueCode() {
    for (let i = 0; i < 20; i++) {
        const code = makeCode();
        const { data } = await supabase.from('qr_codes').select('id').eq('code', code).maybeSingle();
        if (!data) return code;
    }
    throw new Error('Could not generate unique code');
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Dashboard — authenticated
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/qr  — list all codes (admin sees all; business sees theirs)
router.get('/', authRequired, async (req, res) => {
    let query = supabase
        .from('qr_codes')
        .select('*')
        .order('seq_number', { ascending: false });

    // Non-admin scoped to their site
    if (req.role !== 'admin') query = query.eq('site_id', req.siteId);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// POST /api/qr/batch  — generate a numbered batch (admin only)
router.post('/batch', authRequired, async (req, res) => {
    if (req.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { count = 10, site_id, label_prefix = 'Sticker', type = 'general', destination_url } = req.body;
    if (count < 1 || count > 500) return res.status(400).json({ error: 'count must be 1–500' });

    // Get next seq number
    const { data: last } = await supabase
        .from('qr_codes')
        .select('seq_number')
        .order('seq_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    const startSeq = (last?.seq_number || 0) + 1;
    const rows = [];

    for (let i = 0; i < count; i++) {
        const seq = startSeq + i;
        const code = await uniqueCode();
        rows.push({
            code,
            seq_number: seq,
            type,
            site_id: site_id || null,
            label: `${label_prefix} #${seq}`,
            destination_url: destination_url || null,
            scan_url: `https://cybercheck-links.vercel.app/q.html?c=${code}`,
            scan_count: 0,
            active: true,
        });
    }

    const { data, error } = await supabase.from('qr_codes').insert(rows).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ created: data.length, start_seq: startSeq, end_seq: startSeq + count - 1, codes: data });
});

// POST /api/qr  — generate a single code
router.post('/', authRequired, async (req, res) => {
    const { type, label, destination_url, metadata, site_id, notes, location, placement } = req.body;
    if (!label) return res.status(400).json({ error: 'label required' });

    // Get next seq number
    const { data: last } = await supabase
        .from('qr_codes')
        .select('seq_number')
        .order('seq_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    const seq = (last?.seq_number || 0) + 1;
    const code = await uniqueCode();
    const assignedSiteId = req.role === 'admin' ? (site_id || req.siteId) : req.siteId;

    const { data, error } = await supabase
        .from('qr_codes')
        .insert({
            code,
            seq_number: seq,
            type: type || 'general',
            site_id: assignedSiteId,
            label,
            destination_url: destination_url || null,
            scan_url: `https://cybercheck-links.vercel.app/q.html?c=${code}`,
            metadata: metadata || {},
            notes: notes || null,
            location: location || null,
            placement: placement || 'fixed',
            scan_count: 0,
            active: true,
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// PATCH /api/qr/:id  — update label, destination, active
router.patch('/:id', authRequired, async (req, res) => {
    const allowed = ['label', 'destination_url', 'active', 'metadata', 'type', 'notes', 'location', 'placement'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    let query = supabase.from('qr_codes').update(updates).eq('id', req.params.id);
    if (req.role !== 'admin') query = query.eq('site_id', req.siteId);

    const { data, error } = await query.select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// DELETE /api/qr/:id
router.delete('/:id', authRequired, async (req, res) => {
    let query = supabase.from('qr_codes').delete().eq('id', req.params.id);
    if (req.role !== 'admin') query = query.eq('site_id', req.siteId);
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// GET /api/qr/:id/scans  — scan history for one code
router.get('/:id/scans', authRequired, async (req, res) => {
    let qrQuery = supabase.from('qr_codes').select('id').eq('id', req.params.id);
    if (req.role !== 'admin') qrQuery = qrQuery.eq('site_id', req.siteId);
    const { data: qr } = await qrQuery.maybeSingle();
    if (!qr) return res.status(404).json({ error: 'Not found' });

    const { data, error } = await supabase
        .from('qr_scans')
        .select('*')
        .eq('qr_code_id', req.params.id)
        .order('scanned_at', { ascending: false })
        .limit(500);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// GET /api/qr/stats/summary — scan totals across all codes (admin)
router.get('/stats/summary', authRequired, async (req, res) => {
    let query = supabase.from('qr_codes').select('id, label, seq_number, type, scan_count, active, created_at');
    if (req.role !== 'admin') query = query.eq('site_id', req.siteId);
    const { data, error } = await query.order('scan_count', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Public — no auth (scan tracking + phone capture)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/qr/scan/:code  — log scan, return destination
router.post('/scan/:code', async (req, res) => {
    const { data: qr, error } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('code', req.params.code)
        .eq('active', true)
        .maybeSingle();

    if (error || !qr) return res.status(404).json({ error: 'QR code not found' });

    const ua  = req.headers['user-agent'] || '';
    const ip  = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const mob = /mobile|android|iphone|ipad/i.test(ua);

    // Log scan + increment counter (non-blocking)
    supabase.from('qr_scans').insert({
        qr_code_id:  qr.id,
        device_type: mob ? 'mobile' : 'desktop',
        ip_address:  ip,
        user_agent:  ua,
        scanned_at:  new Date().toISOString(),
    }).then(() => {});

    supabase.from('qr_codes')
        .update({ scan_count: (qr.scan_count || 0) + 1 })
        .eq('id', qr.id)
        .then(() => {});

    res.json({
        type:            qr.type,
        seq_number:      qr.seq_number,
        label:           qr.label,
        destination_url: qr.destination_url,
        metadata:        qr.metadata || {},
        site_id:         qr.site_id,
    });
});

// POST /api/qr/capture/:code  — attach phone number to this scan (hot lead)
router.post('/capture/:code', async (req, res) => {
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    const { data: qr } = await supabase
        .from('qr_codes')
        .select('id, site_id')
        .eq('code', req.params.code)
        .maybeSingle();
    if (!qr) return res.status(404).json({ error: 'Not found' });

    // Attach phone to most recent unattributed scan
    const { data: scan } = await supabase
        .from('qr_scans')
        .select('id')
        .eq('qr_code_id', qr.id)
        .is('scanner_phone', null)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const ops = [];
    if (scan) {
        ops.push(
            supabase.from('qr_scans')
                .update({ scanner_phone: phone, scanner_name: name || null })
                .eq('id', scan.id)
        );
    }

    // Upsert as lead in customers table
    if (qr.site_id) {
        ops.push(
            supabase.from('customers').upsert(
                { site_id: qr.site_id, phone, name: name || '', source: 'qr_scan' },
                { onConflict: 'site_id,phone', ignoreDuplicates: true }
            )
        );
    }

    await Promise.all(ops);
    res.json({ success: true, message: 'Lead captured' });
});

module.exports = router;

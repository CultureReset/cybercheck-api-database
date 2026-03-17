/**
 * SMS Inbox Routes
 *
 * POST /api/sms/inbound      — Twilio webhook: tourist texts the business number
 * POST /api/sms/reply        — Dashboard: owner replies to a customer
 * GET  /api/sms/inbox        — Dashboard: list conversation threads
 * GET  /api/sms/thread/:phone — Dashboard: full thread with one customer
 * POST /api/sms/send         — Send any outbound SMS (booking confirm, promo, etc.)
 * POST /api/sms/mark-read    — Mark messages as read
 *
 * Set Twilio webhook to: POST https://cybercheck-api-database.vercel.app/api/sms/inbound
 */

const express = require('express');
const supabase = require('../db');
const router  = express.Router();

function getTwilio() {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) return null;
    return require('twilio')(sid, token);
}

// ── Helper: look up which business owns a Twilio number ───────────────────────
async function siteByTwilioNumber(twilioNumber) {
    const { data } = await supabase
        .from('site_content')
        .select('site_id, owner_phone, twilio_number')
        .eq('twilio_number', twilioNumber)
        .single();
    return data;
}

// ── Helper: look up customer name from phone ──────────────────────────────────
async function customerByPhone(siteId, phone) {
    const { data } = await supabase
        .from('customers')
        .select('id, name')
        .eq('site_id', siteId)
        .eq('phone', phone)
        .single();
    return data;
}

// ── Helper: store a message ───────────────────────────────────────────────────
async function storeMessage({ siteId, customerPhone, customerName, customerId, direction, body, mediaUrl, messageType, twilioSid, twilioStatus }) {
    const { data, error } = await supabase.from('messages').insert({
        site_id:       siteId,
        customer_phone: customerPhone,
        customer_name:  customerName || null,
        customer_id:    customerId   || null,
        direction,
        body,
        media_url:      mediaUrl     || null,
        message_type:   messageType  || (direction === 'inbound' ? 'inbound' : 'manual'),
        twilio_sid:     twilioSid    || null,
        twilio_status:  twilioStatus || null,
        read:           direction === 'outbound'  // outbound = already "read" by owner
    }).select('id').single();
    if (error) console.error('storeMessage error:', error.message);
    return data;
}


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/sms/inbound — Twilio webhook
// Tourist texts the business Twilio number → store + forward to owner
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/inbound', express.urlencoded({ extended: false }), async (req, res) => {
    const from      = req.body.From  || '';   // tourist's phone
    const to        = req.body.To    || '';   // business Twilio number
    const body      = req.body.Body  || '';
    const mediaUrl  = req.body.MediaUrl0 || null;
    const twilioSid = req.body.MessageSid || null;

    // Always respond with empty TwiML immediately (Twilio requires fast response)
    res.type('text/xml').send('<?xml version="1.0"?><Response></Response>');

    // Look up which business this number belongs to
    const site = await siteByTwilioNumber(to);
    if (!site) {
        console.warn('SMS inbound: no business found for number', to);
        return;
    }

    // Look up customer name
    const customer = await customerByPhone(site.site_id, from);

    // Store the inbound message
    await storeMessage({
        siteId:        site.site_id,
        customerPhone: from,
        customerName:  customer?.name || null,
        customerId:    customer?.id   || null,
        direction:     'inbound',
        body,
        mediaUrl,
        twilioSid,
        twilioStatus:  'received'
    });

    // Forward to owner's cell so they know someone replied
    if (site.owner_phone) {
        const twilio = getTwilio();
        if (twilio) {
            const displayName = customer?.name || from;
            const preview = body.length > 120 ? body.substring(0, 120) + '...' : body;
            twilio.messages.create({
                body: `💬 ${displayName}: ${preview}\n\nReply in your dashboard`,
                from: to,               // from the business number
                to:   site.owner_phone  // to the owner's personal cell
            }).catch(err => console.error('Forward to owner failed:', err.message));
        }
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/sms/reply — owner replies from dashboard
// Body: { customer_phone, body, site_id }
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/reply', async (req, res) => {
    const { customer_phone, body, site_id } = req.body;
    if (!customer_phone || !body || !site_id) {
        return res.status(400).json({ error: 'customer_phone, body, site_id required' });
    }

    // Get the business Twilio number
    const { data: siteContent } = await supabase
        .from('site_content')
        .select('twilio_number')
        .eq('site_id', site_id)
        .single();

    if (!siteContent?.twilio_number) {
        return res.status(400).json({ error: 'No Twilio number configured for this business' });
    }

    const twilio = getTwilio();
    if (!twilio) return res.status(503).json({ error: 'Twilio not configured' });

    try {
        const msg = await twilio.messages.create({
            body,
            from: siteContent.twilio_number,
            to:   customer_phone
        });

        // Look up customer
        const customer = await customerByPhone(site_id, customer_phone);

        // Store outbound message
        await storeMessage({
            siteId:        site_id,
            customerPhone: customer_phone,
            customerName:  customer?.name || null,
            customerId:    customer?.id   || null,
            direction:     'outbound',
            body,
            twilioSid:     msg.sid,
            twilioStatus:  msg.status,
            messageType:   'manual'
        });

        res.json({ success: true, sid: msg.sid });
    } catch (err) {
        console.error('SMS reply error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/sms/inbox?site_id=xxx — conversation thread list
// Returns one row per unique customer_phone, most recent message + unread count
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/inbox', async (req, res) => {
    const siteId = req.query.site_id || req.siteId;
    if (!siteId) return res.status(400).json({ error: 'site_id required' });

    // Get latest message per customer_phone using a subquery approach
    const { data, error } = await supabase.rpc('get_sms_inbox', { p_site_id: siteId });

    if (error) {
        // Fallback: simple query if RPC not set up yet
        const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (!msgs) return res.json({ threads: [] });

        // Group by customer_phone client-side
        const threads = {};
        msgs.forEach(m => {
            if (!threads[m.customer_phone]) {
                threads[m.customer_phone] = {
                    customer_phone: m.customer_phone,
                    customer_name:  m.customer_name,
                    last_message:   m.body,
                    last_time:      m.created_at,
                    unread:         0,
                    direction:      m.direction
                };
            }
            if (m.direction === 'inbound' && !m.read) {
                threads[m.customer_phone].unread++;
            }
        });

        return res.json({ threads: Object.values(threads) });
    }

    res.json({ threads: data || [] });
});


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/sms/thread/:phone — full message history with one customer
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/thread/:phone', async (req, res) => {
    const siteId = req.query.site_id || req.siteId;
    const phone  = req.params.phone;
    if (!siteId) return res.status(400).json({ error: 'site_id required' });

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('site_id', siteId)
        .eq('customer_phone', phone)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Mark inbound messages as read
    await supabase
        .from('messages')
        .update({ read: true })
        .eq('site_id', siteId)
        .eq('customer_phone', phone)
        .eq('direction', 'inbound')
        .eq('read', false);

    res.json({ messages: data || [] });
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/sms/send — send any SMS (booking confirm, promo, loyalty, etc.)
// Body: { site_id, to, body, message_type, related_id }
// Called by: booking confirmation, loyalty signup, review request, promo blast
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/send', async (req, res) => {
    const { site_id, to, body, message_type, related_id } = req.body;
    if (!site_id || !to || !body) {
        return res.status(400).json({ error: 'site_id, to, body required' });
    }

    const { data: siteContent } = await supabase
        .from('site_content')
        .select('twilio_number')
        .eq('site_id', site_id)
        .single();

    if (!siteContent?.twilio_number) {
        return res.status(400).json({ error: 'No Twilio number configured' });
    }

    const twilio = getTwilio();
    if (!twilio) return res.status(503).json({ error: 'Twilio not configured' });

    try {
        const msg = await twilio.messages.create({
            body,
            from: siteContent.twilio_number,
            to
        });

        const customer = await customerByPhone(site_id, to);

        await storeMessage({
            siteId:        site_id,
            customerPhone: to,
            customerName:  customer?.name || null,
            customerId:    customer?.id   || null,
            direction:     'outbound',
            body,
            twilioSid:     msg.sid,
            twilioStatus:  msg.status,
            messageType:   message_type || 'manual'
        });

        res.json({ success: true, sid: msg.sid });
    } catch (err) {
        console.error('SMS send error:', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/sms/blast — send promo to multiple customers
// Body: { site_id, phones: [...], body, message_type }
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/blast', async (req, res) => {
    const { site_id, phones, body, message_type } = req.body;
    if (!site_id || !phones?.length || !body) {
        return res.status(400).json({ error: 'site_id, phones[], body required' });
    }

    const { data: siteContent } = await supabase
        .from('site_content')
        .select('twilio_number')
        .eq('site_id', site_id)
        .single();

    if (!siteContent?.twilio_number) {
        return res.status(400).json({ error: 'No Twilio number configured' });
    }

    const twilio = getTwilio();
    if (!twilio) return res.status(503).json({ error: 'Twilio not configured' });

    let sent = 0, failed = 0;

    // Send with 100ms delay between each to avoid Twilio rate limits
    for (const phone of phones) {
        try {
            const msg = await twilio.messages.create({
                body,
                from: siteContent.twilio_number,
                to:   phone
            });

            const customer = await customerByPhone(site_id, phone);
            await storeMessage({
                siteId:        site_id,
                customerPhone: phone,
                customerName:  customer?.name || null,
                customerId:    customer?.id   || null,
                direction:     'outbound',
                body,
                twilioSid:     msg.sid,
                twilioStatus:  msg.status,
                messageType:   message_type || 'promo'
            });

            sent++;
            await new Promise(r => setTimeout(r, 100));
        } catch (err) {
            console.error(`Blast failed for ${phone}:`, err.message);
            failed++;
        }
    }

    res.json({ sent, failed, total: phones.length });
});


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/sms/send-reminders — Vercel Cron: send 24h reminder SMS
// Runs every 15 minutes via cron. Secured by CRON_SECRET env var.
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/send-reminders', async (req, res) => {
    // Verify Vercel cron secret
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers['authorization'] !== 'Bearer ' + secret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const twilio = getTwilio();
    if (!twilio) return res.json({ skipped: true, reason: 'twilio_not_configured' });

    try {
        // Find confirmed bookings happening tomorrow (within a 15-min window from now + 24h)
        const now = new Date();
        const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        const dateStart   = windowStart.toISOString().split('T')[0];
        const dateEnd     = windowEnd.toISOString().split('T')[0];

        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('id, site_id, customer_name, customer_phone, booking_date, fleet_type, time_slot')
            .gte('booking_date', dateStart)
            .lte('booking_date', dateEnd)
            .eq('status', 'confirmed')
            .is('reminder_sent', null)
            .not('customer_phone', 'is', null);

        if (error) throw error;
        if (!bookings || !bookings.length) return res.json({ sent: 0, message: 'No reminders due' });

        let sent = 0, failed = 0;

        for (const b of bookings) {
            try {
                // Get business Twilio number
                const { data: siteContent } = await supabase
                    .from('site_content')
                    .select('twilio_number')
                    .eq('site_id', b.site_id)
                    .single();

                if (!siteContent?.twilio_number) { failed++; continue; }

                const msg = `Reminder: Your ${b.fleet_type || 'boat'} rental is tomorrow${b.time_slot ? ' at ' + b.time_slot : ''}! Please arrive 15 min early. Questions? Reply here.`;

                await twilio.messages.create({
                    body: msg,
                    from: siteContent.twilio_number,
                    to: b.customer_phone
                });

                // Mark reminder sent
                await supabase.from('bookings').update({ reminder_sent: new Date().toISOString() }).eq('id', b.id);

                await storeMessage({
                    siteId:        b.site_id,
                    customerPhone: b.customer_phone,
                    customerName:  b.customer_name || null,
                    direction:     'outbound',
                    body:          msg,
                    messageType:   'booking_reminder',
                    related_id:    b.id
                });

                sent++;
            } catch (err) {
                console.error('Reminder failed for booking', b.id, err.message);
                failed++;
            }
        }

        res.json({ sent, failed, total: bookings.length });
    } catch (err) {
        console.error('send-reminders error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

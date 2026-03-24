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

// Platform-wide shared Twilio number (one number for all businesses)
function getFromNumber() {
    return process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
}

// ── Helper: route inbound message to correct business ─────────────────────────
// Since one shared number serves all businesses, we identify the business by
// looking up the most recent outbound message sent to this customer's phone.
// Falls back to customers table if no message history found.
async function siteByInboundPhone(customerPhone) {
    // 1. Find the most recent outbound message to this phone
    const { data: lastMsg } = await supabase
        .from('messages')
        .select('site_id')
        .eq('customer_phone', customerPhone)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastMsg?.site_id) {
        const { data: site } = await supabase
            .from('site_content')
            .select('site_id, owner_phone')
            .eq('site_id', lastMsg.site_id)
            .single();
        return site;
    }

    // 2. Fallback: check customers table
    const { data: customer } = await supabase
        .from('customers')
        .select('site_id')
        .eq('phone', customerPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (customer?.site_id) {
        const { data: site } = await supabase
            .from('site_content')
            .select('site_id, owner_phone')
            .eq('site_id', customer.site_id)
            .single();
        return site;
    }

    return null;
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

    // Route to correct business via message history (shared platform number)
    const site = await siteByInboundPhone(from);
    if (!site) {
        console.warn('SMS inbound: no business found for customer', from);
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
        const fromNum = getFromNumber();
        if (twilio && fromNum) {
            const displayName = customer?.name || from;
            const preview = body.length > 120 ? body.substring(0, 120) + '...' : body;
            twilio.messages.create({
                body: `💬 ${displayName}: ${preview}\n\nReply in your dashboard`,
                from: fromNum,
                to:   site.owner_phone
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

    const twilio = getTwilio();
    const fromNum = getFromNumber();
    if (!twilio || !fromNum) return res.status(503).json({ error: 'Twilio not configured' });

    try {
        const msg = await twilio.messages.create({
            body,
            from: fromNum,
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

    const twilio = getTwilio();
    const fromNum = getFromNumber();
    if (!twilio || !fromNum) return res.status(503).json({ error: 'Twilio not configured' });

    try {
        const msg = await twilio.messages.create({
            body,
            from: fromNum,
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

    const twilio = getTwilio();
    const fromNum = getFromNumber();
    if (!twilio || !fromNum) return res.status(503).json({ error: 'Twilio not configured' });

    let sent = 0, failed = 0;

    // Send with 100ms delay between each to avoid Twilio rate limits
    for (const phone of phones) {
        try {
            const msg = await twilio.messages.create({
                body,
                from: fromNum,
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
    const fromNum = getFromNumber();
    if (!twilio || !fromNum) return res.json({ skipped: true, reason: 'twilio_not_configured' });

    try {
        // Find confirmed bookings happening tomorrow (within a 15-min window from now + 24h)
        const now = new Date();
        const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
        const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);
        const dateStart   = windowStart.toISOString().split('T')[0];
        const dateEnd     = windowEnd.toISOString().split('T')[0];

        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('id, site_id, customer_name, customer_phone, booking_date, booking_time, fleet_types(name)')
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
                const rentalType = (b.fleet_types && b.fleet_types.name) || 'boat';
                const msg = `Reminder: Your ${rentalType} rental is tomorrow${b.booking_time ? ' at ' + b.booking_time : ''}! Please arrive 15 min early. Questions? Reply here.`;

                await twilio.messages.create({
                    body: msg,
                    from: fromNum,
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

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/sms/send-day-of-waivers
// Automated: called each morning (cron or manual) — sends waiver SMS links
// to every customer whose booking is TODAY and hasn't had a waiver sent yet.
//
// Protected by CRON_SECRET header to prevent abuse.
// Body: { site_id? } — optional; if omitted, runs across all sites
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/send-day-of-waivers', async (req, res) => {
    // Simple shared secret check
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const twilio  = getTwilio();
    const fromNum = getFromNumber();
    if (!twilio || !fromNum) {
        return res.status(503).json({ error: 'Twilio not configured' });
    }

    try {
        const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        // Find today's confirmed bookings with a phone number that have NOT
        // had a waiver SMS sent yet (waiver_sms_sent_at is null) and whose
        // waiver is not already signed.
        let query = supabase
            .from('bookings')
            .select('id, site_id, customer_name, customer_phone, booking_date')
            .eq('booking_date', todayStr)
            .eq('status', 'confirmed')
            .not('customer_phone', 'is', null)
            .is('waiver_sms_sent_at', null);

        if (req.body?.site_id) {
            query = query.eq('site_id', req.body.site_id);
        }

        const { data: bookings, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        if (!bookings || bookings.length === 0) {
            return res.json({ sent: 0, failed: 0, total: 0 });
        }

        const crypto = require('crypto');
        let sent = 0, failed = 0;

        for (const b of bookings) {
            // Skip if waiver already signed for this booking
            const { data: existingWaiver } = await supabase
                .from('waivers')
                .select('id, signed')
                .eq('booking_id', b.id)
                .maybeSingle();

            if (existingWaiver?.signed) {
                // Waiver already signed — just mark sms as sent so we don't recheck
                await supabase.from('bookings').update({ waiver_sms_sent_at: new Date().toISOString() }).eq('id', b.id);
                continue;
            }

            try {
                // Create (or reuse) a waiver record with a fresh token
                const token = crypto.randomBytes(24).toString('hex');

                if (existingWaiver) {
                    // Update existing record with new token
                    await supabase.from('waivers').update({ token, signed: false }).eq('id', existingWaiver.id);
                } else {
                    await supabase.from('waivers').insert({
                        site_id:       b.site_id,
                        booking_id:    b.id,
                        customer_name: b.customer_name || null,
                        token,
                        signed:        false
                    });
                }

                // Build waiver link — use PUBLIC_SITE_BASE_URL env or fall back to domain
                const { data: biz } = await supabase
                    .from('businesses')
                    .select('subdomain, custom_domain')
                    .eq('site_id', b.site_id)
                    .single();

                const domain = biz?.custom_domain || (biz?.subdomain ? `https://${biz.subdomain}.cybercheck.com` : 'https://circle-boats-main-.vercel.app');
                const waiverUrl = `${process.env.PUBLIC_SITE_BASE_URL || domain}/waiver-form.html?token=${token}`;

                const firstName = b.customer_name ? b.customer_name.split(' ')[0] : 'there';
                const msg = `Hi ${firstName}! Your rental is TODAY. Please sign your release waiver before arriving:\n${waiverUrl}\n\nSee you on the water! 🛶`;

                await twilio.messages.create({ body: msg, from: fromNum, to: b.customer_phone });

                // Record the message
                await storeMessage({
                    siteId:        b.site_id,
                    customerPhone: b.customer_phone,
                    customerName:  b.customer_name || null,
                    direction:     'outbound',
                    body:          msg,
                    messageType:   'waiver_link'
                });

                // Mark waiver SMS as sent on booking
                await supabase.from('bookings').update({ waiver_sms_sent_at: new Date().toISOString() }).eq('id', b.id);

                sent++;
            } catch (err) {
                console.error('Day-of waiver SMS failed for booking', b.id, err.message);
                failed++;
            }
        }

        res.json({ sent, failed, total: bookings.length });
    } catch (err) {
        console.error('send-day-of-waivers error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

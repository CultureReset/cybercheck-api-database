const express = require('express');
const supabase = require('../../core/db');

const router = express.Router();

// ============================================
// POST /api/webhooks/stripe — Stripe payment events
// ============================================
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;

    // Verify Stripe webhook signature when secret is configured
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const sig = req.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('Stripe webhook signature failed:', err.message);
            return res.status(400).json({ error: 'Invalid signature' });
        }
    } else {
        // Fallback: parse without verification (dev only)
        try {
            event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (err) {
            return res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    const type = event.type;
    const data = event.data?.object;

    console.log(`Stripe webhook: ${type}`);

    switch (type) {
        case 'payment_intent.succeeded': {
            // Update booking/order payment status
            const bookingId = data.metadata?.booking_id;
            const orderId = data.metadata?.order_id;

            if (bookingId) {
                await supabase
                    .from('bookings')
                    .update({
                        payment_status: 'paid',
                        payment_id: data.id,
                        payment_provider: 'stripe',
                        status: 'confirmed'
                    })
                    .eq('id', bookingId);
            }

            if (orderId) {
                await supabase
                    .from('orders')
                    .update({
                        payment_id: data.id,
                        payment_provider: 'stripe',
                        status: 'received'
                    })
                    .eq('id', orderId);
            }
            break;
        }

        case 'payment_intent.payment_failed': {
            const bookingId = data.metadata?.booking_id;
            if (bookingId) {
                await supabase
                    .from('bookings')
                    .update({ payment_status: 'failed' })
                    .eq('id', bookingId);
            }
            // TODO: Emit event: payment.failed → notify owner
            break;
        }

        case 'charge.refunded': {
            const bookingId = data.metadata?.booking_id;
            if (bookingId) {
                await supabase
                    .from('bookings')
                    .update({ payment_status: 'refunded', status: 'cancelled' })
                    .eq('id', bookingId);
            }
            break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            // Platform subscription changes
            const siteId = data.metadata?.site_id;
            const plan = data.metadata?.plan;
            if (siteId && plan) {
                await supabase
                    .from('businesses')
                    .update({ plan })
                    .eq('site_id', siteId);
            }
            break;
        }

        case 'customer.subscription.deleted': {
            // Downgrade to free
            const siteId = data.metadata?.site_id;
            if (siteId) {
                await supabase
                    .from('businesses')
                    .update({ plan: 'free' })
                    .eq('site_id', siteId);
            }
            break;
        }
    }

    res.json({ received: true });
});

// ============================================
// POST /api/webhooks/twilio — Twilio SMS events
// ============================================
router.post('/twilio', express.urlencoded({ extended: false }), async (req, res) => {
    const { From, To, Body, MessageSid, SmsStatus } = req.body;

    console.log(`Twilio webhook: ${SmsStatus} from ${From}`);

    if (SmsStatus === 'received' && Body) {
        // TCPA: Handle STOP / opt-out keywords
        const bodyUpper = (Body || '').trim().toUpperCase();
        if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'].includes(bodyUpper)) {
            await supabase.from('sms_opt_outs').upsert({
                phone: From,
                site_id: null  // null = opted out of all businesses on shared number
            }, { onConflict: 'phone,site_id' }).catch(() => {});

            await supabase.from('sms_log').insert({
                site_id: null,
                to_phone: From,
                message: Body,
                type: 'opt_out',
                status: 'received'
            }).catch(() => {});

            return res.status(200).send('<Response><Message>You have been unsubscribed. Reply START to resubscribe.</Message></Response>');
        }

        // Handle START / re-subscribe
        if (bodyUpper === 'START') {
            await supabase.from('sms_opt_outs')
                .delete()
                .eq('phone', From)
                .catch(() => {});

            return res.status(200).send('<Response><Message>You have been resubscribed and will receive messages again.</Message></Response>');
        }

        // Incoming SMS — find which business this phone number belongs to
        const { data: content } = await supabase
            .from('site_content')
            .select('site_id, contact_phone')
            .eq('contact_phone', To)
            .single();

        if (content) {
            // Log the incoming message
            await supabase.from('sms_log').insert({
                site_id: content.site_id,
                to_phone: To,
                message: Body,
                type: 'incoming',
                status: 'received'
            });

            // Create notification
            await supabase.from('notifications').insert({
                site_id: content.site_id,
                type: 'sms_received',
                title: `SMS from ${From}`,
                body: Body,
                metadata: { from: From, message_sid: MessageSid }
            }).catch(() => {});

            // TODO: Emit event: message.received
            // TODO: Check if AI auto-reply is enabled
        }
    }

    // Twilio expects empty 200 response
    res.status(200).send('<Response></Response>');
});

// ============================================
// POST /api/webhooks/google — Google Business events
// ============================================
router.post('/google', async (req, res) => {
    console.log('Google webhook:', req.body);
    res.json({ received: true });
});

// ============================================
// POST /api/webhooks/sendblue — inbound iMessage from tourist
// Set in Sendblue dashboard → Webhooks → Inbound Message URL
// ============================================
router.post('/sendblue', async (req, res) => {
    res.status(200).json({ received: true }); // Sendblue needs fast response

    try {
        const { number: rawPhone, content = '' } = req.body || {};
        if (!rawPhone) return;

        const phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone.replace(/\D/g, '')}`;
        const text  = content.trim().toLowerCase();

        // Load Sendblue keys
        const { data: cfgRow } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'sms_config')
            .maybeSingle();
        const keyId  = cfgRow?.value?.sendblue_key_id || process.env.SENDBLUE_KEY_ID;
        const secret = cfgRow?.value?.sendblue_secret  || process.env.SENDBLUE_SECRET;

        async function reply(message) {
            if (!keyId || !secret) return;
            await fetch('https://api.sendblue.co/api/send-message', {
                method: 'POST',
                headers: {
                    'sb-api-key-id':     keyId,
                    'sb-api-secret-key': secret,
                    'Content-Type':      'application/json',
                },
                body: JSON.stringify({ number: phone, content: message }),
            }).catch(() => {});
        }

        // Find or create tourist_profile
        let { data: profile } = await supabase
            .from('tourist_profiles')
            .select('id, name, sms_opt_in')
            .eq('phone', phone)
            .maybeSingle();

        if (!profile) {
            const { data: created } = await supabase
                .from('tourist_profiles')
                .insert({ phone, sms_opt_in: true, sms_opted_in_at: new Date().toISOString() })
                .select('id, name, sms_opt_in')
                .single()
                .catch(() => ({ data: null }));
            profile = created;
            await reply(`Hey! 👋 Welcome to Gulf Coast Radar.\n\nYou're signed up for personalized deals and recommendations based on what you love.\n\nText us anything — we're your personal Gulf Coast guide. 🌊`);
            return;
        }

        // STOP / opt-out
        if (['stop', 'unsubscribe', 'cancel', 'quit'].includes(text)) {
            await supabase.from('tourist_profiles').update({ sms_opt_in: false }).eq('phone', phone);
            await reply(`You've been unsubscribed. Text START anytime to opt back in.`);
            return;
        }

        // Re-subscribe
        if (['start', 'yes', 'subscribe'].includes(text)) {
            await supabase.from('tourist_profiles').update({ sms_opt_in: true, sms_opted_in_at: new Date().toISOString() }).eq('phone', phone);
            await reply(`You're back! 🌊 We'll send you personalized Gulf Coast deals and events again.`);
            return;
        }

        // Opt in if not already
        if (!profile.sms_opt_in) {
            await supabase.from('tourist_profiles').update({ sms_opt_in: true, sms_opted_in_at: new Date().toISOString() }).eq('phone', phone);
        }

        // Log inbound message
        await supabase.from('tourist_sms_log').insert({
            tourist_id:   profile?.id || null,
            phone,
            message:      content,
            trigger_type: 'inbound',
            status:       'received',
            sent_at:      new Date().toISOString(),
        }).catch(() => {});

        // Forward to AI concierge
        const aiRes = await fetch(`${process.env.API_BASE}/api/tourist/ai-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message: content, tourist_id: profile?.id }),
        }).catch(() => null);

        if (aiRes?.ok) {
            const { reply: aiReply } = await aiRes.json().catch(() => ({}));
            if (aiReply) await reply(aiReply);
        } else {
            await reply(`Got it! 🌊 Tell us what you're looking for — food, drinks, activities, events — and we'll find the best spots for you.`);
        }

    } catch (e) {
        console.error('Sendblue webhook error:', e.message);
    }
});

module.exports = router;

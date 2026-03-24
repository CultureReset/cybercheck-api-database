const express = require('express');
const crypto  = require('crypto');
const { authRequired } = require('../middleware/auth');
const supabase = require('../db');

const router = express.Router();

// Lazy-init Stripe (only when keys are configured)
function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ─── AES-256-GCM encryption for business Stripe keys ───────────────────────
// Generate your encryption key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Add to Vercel as STRIPE_KEY_ENCRYPTION_KEY
function encryptKey(plaintext) {
    const hexKey = process.env.STRIPE_KEY_ENCRYPTION_KEY;
    if (!hexKey) throw new Error('STRIPE_KEY_ENCRYPTION_KEY not set in environment');
    const key = Buffer.from(hexKey, 'hex');
    const iv  = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

function decryptKey(stored) {
    const hexKey = process.env.STRIPE_KEY_ENCRYPTION_KEY;
    if (!hexKey) throw new Error('STRIPE_KEY_ENCRYPTION_KEY not set in environment');
    const [ivHex, tagHex, encHex] = stored.split(':');
    const key     = Buffer.from(hexKey, 'hex');
    const iv      = Buffer.from(ivHex, 'hex');
    const tag     = Buffer.from(tagHex, 'hex');
    const encBuf  = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}

// Get a Stripe instance for a specific business.
// Priority: 1) their manually-saved encrypted key, 2) platform key
async function getStripeForSite(siteId) {
    if (siteId) {
        const { data } = await supabase
            .from('connections')
            .select('access_token')
            .eq('site_id', siteId)
            .eq('provider', 'stripe_key')
            .eq('status', 'connected')
            .single();
        if (data?.access_token) {
            try {
                return require('stripe')(decryptKey(data.access_token));
            } catch (e) {
                console.error('Failed to decrypt Stripe key for site', siteId, e.message);
            }
        }
    }
    return getStripe();
}

// ============================================
// GET /api/stripe/connect-url
// Dashboard calls this to get the Stripe OAuth URL
// ============================================
router.get('/connect-url', authRequired, async (req, res) => {
    if (!process.env.STRIPE_CLIENT_ID) {
        return res.status(503).json({ error: 'Stripe Connect not configured yet' });
    }

    const state = Buffer.from(JSON.stringify({
        siteId: req.siteId,
        userId: req.userId
    })).toString('base64');

    const redirectUri = (process.env.STRIPE_CONNECT_REDIRECT_URI ||
        'https://cybercheck-api-database.vercel.app/api/stripe/connect-callback').trim();

    const url = 'https://connect.stripe.com/oauth/authorize?' +
        'response_type=code&' +
        'client_id=' + encodeURIComponent(process.env.STRIPE_CLIENT_ID) + '&' +
        'scope=read_write&' +
        'state=' + encodeURIComponent(state) + '&' +
        'redirect_uri=' + encodeURIComponent(redirectUri);

    res.json({ url });
});

// ============================================
// GET /api/stripe/connect-callback
// Stripe redirects here after business owner authorizes
// Exchanges auth code for stripe_user_id (account_id)
// ============================================
router.get('/connect-callback', async (req, res) => {
    const stripe = getStripe();
    const { code, state, error } = req.query;

    const dashboardBase = process.env.DASHBOARD_URL || 'https://cybercheck-login.vercel.app';

    if (error) {
        return res.redirect(dashboardBase + '/#connections?stripe_error=' + encodeURIComponent(error));
    }

    if (!stripe) {
        return res.redirect(dashboardBase + '/#connections?stripe_error=stripe_not_configured');
    }

    // Decode state to get siteId
    let stateData;
    try {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
        return res.redirect(dashboardBase + '/#connections?stripe_error=invalid_state');
    }

    try {
        // Exchange authorization code for connected account ID
        const response = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code
        });

        const connectedAccountId = response.stripe_user_id;

        // Store in connections table (upsert on site_id + provider)
        await supabase.from('connections').upsert({
            site_id: stateData.siteId,
            provider: 'stripe',
            account_id: connectedAccountId,
            account_name: connectedAccountId,
            access_token: response.access_token || null,
            refresh_token: response.refresh_token || null,
            status: 'connected',
            metadata: {
                scope: response.scope,
                livemode: response.livemode,
                token_type: response.token_type
            },
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'site_id,provider'
        });

        // Redirect back to dashboard with success
        res.redirect(dashboardBase + '/#connections?stripe_connected=true&account_id=' + connectedAccountId);
    } catch (err) {
        console.error('Stripe Connect error:', err);
        res.redirect(dashboardBase + '/#connections?stripe_error=' + encodeURIComponent(err.message));
    }
});

// ============================================
// GET /api/stripe/status
// Dashboard checks if Stripe is connected for this business
// ============================================
router.get('/status', authRequired, async (req, res) => {
    const [{ data: connectData }, { data: keyData }] = await Promise.all([
        supabase.from('connections').select('account_id, account_name, status, connected_at')
            .eq('site_id', req.siteId).eq('provider', 'stripe').single(),
        supabase.from('connections').select('status, connected_at')
            .eq('site_id', req.siteId).eq('provider', 'stripe_key').single()
    ]);

    res.json({
        connected:    !!(connectData && connectData.status === 'connected'),
        accountId:    connectData?.account_id || null,
        connectedAt:  connectData?.connected_at || null,
        manualKey:    !!(keyData && keyData.status === 'connected'),
        manualKeyAt:  keyData?.connected_at || null
    });
});

// ============================================
// POST /api/stripe/save-key
// Business owner saves their Stripe secret key (encrypted)
// ============================================
router.post('/save-key', authRequired, async (req, res) => {
    const { secret_key } = req.body;
    // Validate Stripe secret key format: sk_test_... or sk_live_... (min 32 chars)
    const validKeyFormat = /^sk_(test|live)_.{20,}$/.test(secret_key);
    if (!secret_key || !validKeyFormat) {
        return res.status(400).json({ error: 'Invalid Stripe secret key format. Must be sk_test_... or sk_live_... with at least 50+ chars total.' });
    }
    if (!process.env.STRIPE_KEY_ENCRYPTION_KEY) {
        return res.status(503).json({ error: 'STRIPE_KEY_ENCRYPTION_KEY not configured on server' });
    }

    // Verify the key is valid by making a lightweight Stripe API call
    try {
        const testStripe = require('stripe')(secret_key);
        await testStripe.balance.retrieve();
    } catch (err) {
        return res.status(400).json({ error: 'Stripe key is invalid or has no permissions: ' + err.message });
    }

    try {
        const encrypted = encryptKey(secret_key);
        const isLive = secret_key.startsWith('sk_live_');

        await supabase.from('connections').upsert({
            site_id:      req.siteId,
            provider:     'stripe_key',
            access_token: encrypted,
            account_name: isLive ? 'Live Key' : 'Test Key',
            status:       'connected',
            connected_at: new Date().toISOString(),
            updated_at:   new Date().toISOString()
        }, { onConflict: 'site_id,provider' });

        res.json({ success: true, mode: isLive ? 'live' : 'test' });
    } catch (err) {
        console.error('save-key error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DELETE /api/stripe/delete-key
// Remove a saved manual Stripe key
// ============================================
router.delete('/delete-key', authRequired, async (req, res) => {
    await supabase.from('connections')
        .delete()
        .eq('site_id', req.siteId)
        .eq('provider', 'stripe_key');
    res.json({ success: true });
});

// ============================================
// POST /api/stripe/create-payment-intent
// Customer site calls this after booking is created
// Creates PaymentIntent with connected account destination + platform fee
// ============================================
router.post('/create-payment-intent', async (req, res) => {
    const { booking_id, amount, description, payment_method_id, site_id } = req.body;

    if (!amount) {
        return res.status(400).json({ error: 'amount required' });
    }

    // Resolve site_id — may be a UUID or a subdomain string
    let targetSiteId = req.siteId || null;
    if (site_id) {
        if (/^[0-9a-f-]{36}$/.test(site_id)) {
            targetSiteId = site_id;
        } else {
            const { data: biz } = await supabase
                .from('businesses')
                .select('site_id')
                .eq('subdomain', site_id)
                .single();
            targetSiteId = biz?.site_id || null;
        }
    }

    // Get the right Stripe instance — business's own key takes priority over platform key
    const stripe = await getStripeForSite(targetSiteId);
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured — add your Stripe key in Dashboard → Connections' });
    }

    // Get Stripe Connect account (only used if business connected via OAuth, not manual key)
    let connection = null;
    if (targetSiteId) {
        const { data } = await supabase
            .from('connections')
            .select('account_id')
            .eq('site_id', targetSiteId)
            .eq('provider', 'stripe')
            .eq('status', 'connected')
            .single();
        connection = data;
    }

    const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '1');
    const amountCents = Math.round(amount * 100);

    try {
        const params = {
            amount: amountCents,
            currency: 'usd',
            description: description || 'Booking payment',
            metadata: {
                booking_id: booking_id || '',
                site_id: targetSiteId || ''
            }
        };

        // If business has a connected Stripe account, route money to them with platform fee
        if (connection && connection.account_id) {
            const applicationFee = Math.round(amountCents * (feePercent / 100));
            params.application_fee_amount = applicationFee;
            params.transfer_data = { destination: connection.account_id };
            params.metadata.platform_fee_percent = feePercent.toString();
        }

        // If payment_method_id provided, attach and confirm immediately
        if (payment_method_id) {
            params.payment_method = payment_method_id;
            params.confirm = true;
            params.automatic_payment_methods = {
                enabled: true,
                allow_redirects: 'never'
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(params);

        // Update booking with payment info
        if (booking_id) {
            await supabase
                .from('bookings')
                .update({
                    payment_id: paymentIntent.id,
                    payment_provider: 'stripe',
                    payment_status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending'
                })
                .eq('id', booking_id);
        }

        // Send customer SMS + email after confirmed payment (fire-and-forget)
        if (paymentIntent.status === 'succeeded' && booking_id && targetSiteId) {
            setImmediate(async () => {
                try {
                    const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');
                    const { sendEmail, customerConfirmationHtml, generateIcsContent } = require('../utils/email');

                    const [{ data: bookingData }, { data: msgSettings }, { data: siteContent }, { data: business }] = await Promise.all([
                        supabase.from('bookings').select('*').eq('id', booking_id).single(),
                        supabase.from('messaging_settings').select('notification_email, booking_confirmation_enabled, booking_confirmation_template').eq('site_id', targetSiteId).maybeSingle(),
                        supabase.from('site_content').select('contact_email').eq('site_id', targetSiteId).single(),
                        supabase.from('businesses').select('name, email').eq('site_id', targetSiteId).single()
                    ]);

                    if (!bookingData) return;
                    const settings = msgSettings || {};
                    const templateData = await buildTemplateData(bookingData, targetSiteId);
                    templateData.notes = bookingData.notes || '';

                    // Customer SMS
                    if (settings.booking_confirmation_enabled !== false && bookingData.customer_phone) {
                        const defaultTpl = '[{{business_name}}] Hi {{customer_name}}! Your booking is confirmed.\n\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\n\nQuestions? Reply to this number!\n\n🏖️ Get exclusive deals & rewards while you\'re in town!\ngulfcoastradar.com/trip-pass';
                        const msg = fillTemplate(settings.booking_confirmation_template || defaultTpl, templateData);
                        sendSms(bookingData.customer_phone, msg, targetSiteId, 'booking_confirmation', booking_id)
                            .catch(err => console.error('Customer SMS failed:', err));
                    }

                    // Customer Email
                    if (bookingData.customer_email) {
                        const icsAttachment = [{ filename: 'booking.ics', content: Buffer.from(generateIcsContent(templateData)).toString('base64') }];
                        sendEmail({
                            to: bookingData.customer_email,
                            subject: 'Booking Confirmed — ' + (templateData.business_name || 'Your Reservation'),
                            html: customerConfirmationHtml(templateData),
                            replyTo: siteContent?.contact_email || business?.email || undefined,
                            attachments: icsAttachment
                        }).catch(err => console.error('Customer email failed:', err));
                    }
                } catch (notifyErr) {
                    console.error('Post-payment notification error:', notifyErr);
                }
            });
        }

        res.json({
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id,
            status: paymentIntent.status
        });
    } catch (err) {
        console.error('PaymentIntent error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// POST /api/stripe/disconnect
// Business owner disconnects their Stripe account
// ============================================
router.post('/disconnect', authRequired, async (req, res) => {
    const stripe = getStripe();

    const { data: connection } = await supabase
        .from('connections')
        .select('account_id')
        .eq('site_id', req.siteId)
        .eq('provider', 'stripe')
        .single();

    if (connection && connection.account_id && stripe && process.env.STRIPE_CLIENT_ID) {
        try {
            await stripe.oauth.deauthorize({
                client_id: process.env.STRIPE_CLIENT_ID,
                stripe_user_id: connection.account_id
            });
        } catch (e) {
            console.warn('Stripe deauthorize warning:', e.message);
        }
    }

    await supabase
        .from('connections')
        .update({ status: 'disconnected', updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId)
        .eq('provider', 'stripe');

    res.json({ success: true });
});

// ============================================
// GET /api/stripe/publishable-key
// Public route — customer site fetches this to init Stripe.js
// ============================================
router.get('/publishable-key', (_req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
    });
});

// ============================================
// GET /api/stripe/config
// Public route — returns publishable key + platform config for checkout
// ============================================
router.get('/config', (_req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
        platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '1'),
        currency: 'usd'
    });
});


// ============================================
// POST /api/stripe/refund — Process a refund
// ============================================
router.post("/refund", authRequired, async (req, res) => {
    const { payment_intent_id, amount, booking_id, reason } = req.body;

    if (!payment_intent_id) {
        return res.status(400).json({ error: "payment_intent_id required" });
    }

    const stripe = await getStripeForSite(req.siteId);
    if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
    }

    try {
        const params = { payment_intent: payment_intent_id };
        if (amount) params.amount = Math.round(amount * 100);
        if (reason) params.reason = reason;

        const refund = await stripe.refunds.create(params);

        if (booking_id) {
            const status = amount ? "partially_refunded" : "refunded";
            await supabase
                .from("bookings")
                .update({ payment_status: status, updated_at: new Date().toISOString() })
                .eq("id", booking_id)
                .eq("site_id", req.siteId);
        }

        res.json({
            success: true,
            refund_id: refund.id,
            amount: refund.amount / 100,
            status: refund.status
        });
    } catch (err) {
        console.error("Refund error:", err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// POST /api/stripe/webhook — Stripe event handler
// Alias that mirrors /api/webhooks/stripe for compatibility
// ============================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;

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
        try {
            event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (err) {
            return res.status(400).json({ error: 'Invalid JSON' });
        }
    }

    const type = event.type;
    const data = event.data?.object;
    console.log(`Stripe webhook (stripe route): ${type}`);

    if (type === 'payment_intent.succeeded') {
        const bookingId = data.metadata?.booking_id;
        if (bookingId) {
            await supabase.from('bookings').update({
                payment_status: 'paid',
                payment_id: data.id,
                payment_provider: 'stripe',
                status: 'confirmed'
            }).eq('id', bookingId);
        }
    } else if (type === 'payment_intent.payment_failed') {
        const bookingId = data.metadata?.booking_id;
        if (bookingId) {
            await supabase.from('bookings').update({ payment_status: 'failed' }).eq('id', bookingId);
        }
    } else if (type === 'charge.refunded') {
        const bookingId = data.metadata?.booking_id;
        if (bookingId) {
            await supabase.from('bookings').update({ payment_status: 'refunded', status: 'cancelled' }).eq('id', bookingId);
        }
    }

    res.json({ received: true });
});

module.exports = router;

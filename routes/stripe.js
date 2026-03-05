const express = require('express');
const { authRequired } = require('../middleware/auth');
const supabase = require('../db');

const router = express.Router();

// Lazy-init Stripe (only when keys are configured)
function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    return require('stripe')(process.env.STRIPE_SECRET_KEY);
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

    const redirectUri = process.env.STRIPE_CONNECT_REDIRECT_URI ||
        (req.headers.origin || 'http://localhost:3000') + '/dashboard/#connections';

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

    if (error) {
        return res.redirect('/dashboard/#connections?stripe_error=' + encodeURIComponent(error));
    }

    if (!stripe) {
        return res.redirect('/dashboard/#connections?stripe_error=stripe_not_configured');
    }

    // Decode state to get siteId
    let stateData;
    try {
        stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
        return res.redirect('/dashboard/#connections?stripe_error=invalid_state');
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
        res.redirect('/dashboard/#connections?stripe_connected=true&account_id=' + connectedAccountId);
    } catch (err) {
        console.error('Stripe Connect error:', err);
        res.redirect('/dashboard/#connections?stripe_error=' + encodeURIComponent(err.message));
    }
});

// ============================================
// GET /api/stripe/status
// Dashboard checks if Stripe is connected for this business
// ============================================
router.get('/status', authRequired, async (req, res) => {
    const { data } = await supabase
        .from('connections')
        .select('account_id, account_name, status, connected_at')
        .eq('site_id', req.siteId)
        .eq('provider', 'stripe')
        .single();

    res.json({
        connected: !!(data && data.status === 'connected'),
        accountId: data?.account_id || null,
        connectedAt: data?.connected_at || null
    });
});

// ============================================
// POST /api/stripe/create-payment-intent
// Customer site calls this after booking is created
// Creates PaymentIntent with connected account destination + platform fee
// ============================================
router.post('/create-payment-intent', async (req, res) => {
    const stripe = getStripe();
    if (!stripe) {
        return res.status(503).json({ error: 'Stripe not configured' });
    }

    const { booking_id, amount, description, payment_method_id, site_id } = req.body;
    const targetSiteId = site_id || req.siteId;

    if (!amount || !targetSiteId) {
        return res.status(400).json({ error: 'amount and site_id required' });
    }

    // Get connected Stripe account for this business
    const { data: connection } = await supabase
        .from('connections')
        .select('account_id')
        .eq('site_id', targetSiteId)
        .eq('provider', 'stripe')
        .eq('status', 'connected')
        .single();

    if (!connection || !connection.account_id) {
        return res.status(400).json({ error: 'Business has not connected Stripe yet' });
    }

    const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '3');
    const amountCents = Math.round(amount * 100);
    const applicationFee = Math.round(amountCents * (feePercent / 100));

    try {
        const params = {
            amount: amountCents,
            currency: 'usd',
            description: description || 'Booking payment',
            application_fee_amount: applicationFee,
            transfer_data: {
                destination: connection.account_id
            },
            metadata: {
                booking_id: booking_id || '',
                site_id: targetSiteId,
                platform_fee_percent: feePercent.toString()
            }
        };

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
router.get('/publishable-key', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
    });
});

module.exports = router;

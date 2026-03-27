const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../db');
const { authRequired } = require('../middleware/auth');
const { Client, Environment } = require('square');

// ─── Reuse encryption from stripe.js ─────────────────────────────────────────
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
    const key    = Buffer.from(hexKey, 'hex');
    const iv     = Buffer.from(ivHex, 'hex');
    const tag    = Buffer.from(tagHex, 'hex');
    const encBuf = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}

// Get Square client for a site
async function getSquareForSite(siteId) {
    if (!siteId) return null;
    const [{ data: keyData }, { data: modeData }, { data: appData }, { data: locData }] = await Promise.all([
        supabase.from('connections').select('access_token').eq('site_id', siteId).eq('provider', 'square_key').eq('status', 'connected').single(),
        supabase.from('connections').select('account_name').eq('site_id', siteId).eq('provider', 'square_mode').single(),
        supabase.from('connections').select('account_name').eq('site_id', siteId).eq('provider', 'square_app_id').single(),
        supabase.from('connections').select('account_name').eq('site_id', siteId).eq('provider', 'square_location_id').single()
    ]);

    if (!keyData?.access_token) return null;

    const environment = modeData?.account_name === 'sandbox' ? Environment.Sandbox : Environment.Production;
    const client = new Client({ accessToken: decryptKey(keyData.access_token), environment });
    return {
        client,
        locationId: locData?.account_name || null,
        appId: appData?.account_name || null,
        mode: modeData?.account_name || 'production'
    };
}

// ============================================
// POST /api/square/save-credentials (authRequired)
// Save Square access token + app ID + location ID
// ============================================
router.post('/save-credentials', authRequired, async (req, res) => {
    const { access_token, app_id, location_id, mode } = req.body;

    if (!access_token) return res.status(400).json({ error: 'access_token is required' });
    if (!app_id)       return res.status(400).json({ error: 'app_id is required' });
    if (!location_id)  return res.status(400).json({ error: 'location_id is required' });
    if (!process.env.STRIPE_KEY_ENCRYPTION_KEY) {
        return res.status(503).json({ error: 'Encryption key not configured' });
    }

    try {
        // Verify the access token works
        const env = (mode === 'sandbox') ? Environment.Sandbox : Environment.Production;
        const testClient = new Client({ accessToken: access_token, environment: env });
        await testClient.locationsApi.listLocations();

        const encrypted = encryptKey(access_token);
        const now = new Date().toISOString();

        await Promise.all([
            supabase.from('connections').upsert({ site_id: req.siteId, provider: 'square_key', access_token: encrypted, account_name: 'Square Key', status: 'connected', connected_at: now, updated_at: now }, { onConflict: 'site_id,provider' }),
            supabase.from('connections').upsert({ site_id: req.siteId, provider: 'square_app_id', account_name: app_id, status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' }),
            supabase.from('connections').upsert({ site_id: req.siteId, provider: 'square_location_id', account_name: location_id, status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' }),
            supabase.from('connections').upsert({ site_id: req.siteId, provider: 'square_mode', account_name: mode || 'production', status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' })
        ]);

        res.json({ success: true, mode: mode || 'production' });
    } catch (err) {
        console.error('square save-credentials error:', err);
        if (err.message && err.message.includes('UNAUTHORIZED')) {
            return res.status(400).json({ error: 'Invalid Square access token' });
        }
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /api/square/status (authRequired)
// Return Square connection status for dashboard
// ============================================
router.get('/status', authRequired, async (req, res) => {
    const [{ data: keyData }, { data: modeData }, { data: appData }, { data: locData }, { data: procData }] = await Promise.all([
        supabase.from('connections').select('status, connected_at').eq('site_id', req.siteId).eq('provider', 'square_key').single(),
        supabase.from('connections').select('account_name').eq('site_id', req.siteId).eq('provider', 'square_mode').single(),
        supabase.from('connections').select('account_name').eq('site_id', req.siteId).eq('provider', 'square_app_id').single(),
        supabase.from('connections').select('account_name').eq('site_id', req.siteId).eq('provider', 'square_location_id').single(),
        supabase.from('connections').select('account_name').eq('site_id', req.siteId).eq('provider', 'payment_processor').single()
    ]);

    res.json({
        connected: !!(keyData && keyData.status === 'connected'),
        connectedAt: keyData?.connected_at || null,
        mode: modeData?.account_name || 'production',
        appId: appData?.account_name || null,
        locationId: locData?.account_name || null,
        activeProcessor: procData?.account_name || 'stripe'
    });
});

// ============================================
// POST /api/square/set-processor (authRequired)
// Set active payment processor for a site
// ============================================
router.post('/set-processor', authRequired, async (req, res) => {
    const { processor } = req.body;
    if (!['stripe', 'square'].includes(processor)) {
        return res.status(400).json({ error: 'processor must be stripe or square' });
    }
    try {
        const now = new Date().toISOString();
        await supabase.from('connections').upsert(
            { site_id: req.siteId, provider: 'payment_processor', account_name: processor, status: 'connected', updated_at: now },
            { onConflict: 'site_id,provider' }
        );
        res.json({ success: true, processor });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DELETE /api/square/disconnect (authRequired)
// Remove Square credentials
// ============================================
router.delete('/disconnect', authRequired, async (req, res) => {
    try {
        await supabase.from('connections').delete().eq('site_id', req.siteId).in('provider', ['square_key', 'square_app_id', 'square_location_id', 'square_mode']);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// POST /api/square/create-payment (public)
// Process a Square payment for a booking
// ============================================
router.post('/create-payment', async (req, res) => {
  try {
    const { source_id, amount, booking_id, site_id, description } = req.body;

    if (!source_id) return res.status(400).json({ error: 'source_id required' });
    if (!amount)    return res.status(400).json({ error: 'amount required' });

    // Resolve site_id
    let targetSiteId = req.siteId || null;
    if (site_id) {
        if (/^[0-9a-f-]{36}$/.test(site_id)) {
            targetSiteId = site_id;
        } else {
            const { data: biz } = await supabase.from('businesses').select('site_id').eq('subdomain', site_id).single();
            targetSiteId = biz?.site_id || null;
        }
    }

    const squareData = await getSquareForSite(targetSiteId);
    if (!squareData) {
        return res.status(503).json({ error: 'Square not configured — add Square credentials in Dashboard → Connections' });
    }

    // Amount already includes all fees (service fee + processing fee) calculated on the frontend
    const amountCents = Math.round(parseFloat(amount) * 100);
    const totalCents = amountCents;

    try {
        const idempotencyKey = crypto.randomUUID();
        const response = await squareData.client.paymentsApi.createPayment({
            sourceId: source_id,
            idempotencyKey,
            amountMoney: { amount: BigInt(totalCents), currency: 'USD' },
            locationId: squareData.locationId,
            note: description || 'Booking payment',
            referenceId: booking_id || undefined
        });

        const payment = response.result.payment;

        // Update booking
        if (booking_id) {
            await supabase.from('bookings').update({
                payment_id: payment.id,
                payment_provider: 'square',
                payment_status: payment.status === 'COMPLETED' ? 'paid' : 'pending'
            }).eq('id', booking_id);
        }

        // Fire emails/SMS after payment (same pattern as Stripe)
        if (payment.status === 'COMPLETED' && booking_id && targetSiteId) {
            setImmediate(async () => {
                try {
                    const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');
                    const { sendEmail, customerConfirmationHtml, generateIcsContent } = require('../utils/email');
                    const [{ data: bookingData }, { data: msgSettings }, { data: siteContent }, { data: business }] = await Promise.all([
                        supabase.from('bookings').select('*').eq('id', booking_id).single(),
                        supabase.from('messaging_settings').select('notification_email, booking_confirmation_enabled, booking_confirmation_template').eq('site_id', targetSiteId).maybeSingle(),
                        supabase.from('site_content').select('contact_email').eq('site_id', targetSiteId).maybeSingle(),
                        supabase.from('businesses').select('name, phone').eq('site_id', targetSiteId).single()
                    ]);
                    if (!bookingData) return;
                    const templateData = await buildTemplateData(bookingData, targetSiteId);
                    if (bookingData.customer_email) {
                        const ics = [{ filename: 'booking.ics', content: Buffer.from(generateIcsContent(templateData)).toString('base64') }];
                        sendEmail({ to: bookingData.customer_email, subject: 'Booking Confirmed — ' + (templateData.business_name || 'Your Reservation'), html: customerConfirmationHtml(templateData), attachments: ics }).catch(() => {});
                    }
                } catch (e) { console.error('Square post-payment notifications failed:', e.message); }
            });
        }

        res.json({
            success: true,
            payment_id: payment.id,
            status: payment.status,
            amount: totalCents
        });
    } catch (err) {
        console.error('Square create-payment error:', err);
        const msg = err.errors?.[0]?.detail || err.message;
        res.status(500).json({ success: false, error: msg });
    }
  } catch (outerErr) {
    console.error('Square create-payment outer error:', outerErr);
    if (!res.headersSent) res.status(500).json({ success: false, error: outerErr.message || 'Server error' });
  }
});

// ============================================
// GET /api/square/connect-url (authRequired)
// Returns Square OAuth URL for client to authorize
// ============================================
router.get('/connect-url', authRequired, async (req, res) => {
    try {
        const { data: platformData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'api_key_square')
            .single();

        if (!platformData?.value?.appId) {
            return res.status(503).json({ error: 'Square not configured by platform admin yet' });
        }

        const { appId, mode } = platformData.value;
        const baseUrl = mode === 'sandbox'
            ? 'https://connect.squareupsandbox.com/oauth2/authorize'
            : 'https://connect.squareup.com/oauth2/authorize';

        const scopes = 'PAYMENTS_WRITE,PAYMENTS_READ,MERCHANT_PROFILE_READ';
        // Encode siteId + role so callback knows where to redirect after OAuth
        const state = Buffer.from(JSON.stringify({ siteId: req.siteId, role: req.role || 'owner' })).toString('base64url');
        const redirectUri = 'https://cybercheck-api-database.vercel.app/api/square/callback';
        const url = `${baseUrl}?client_id=${appId}&scope=${scopes}&session=false&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        res.json({ url, mode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /api/square/callback (public)
// Square OAuth callback — exchanges code for token, saves to connections
// ============================================
router.get('/callback', async (req, res) => {
    const { code, state: rawState, error } = req.query;

    // Decode state — new format is base64url JSON {siteId, role}, old format is plain siteId string
    let siteId, role = 'owner';
    try {
        const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString());
        siteId = decoded.siteId;
        role = decoded.role || 'owner';
    } catch (e) {
        siteId = rawState; // backward compat: plain siteId
    }

    const clientBase = 'https://cybercheck-login.vercel.app/index.html';
    const adminBase  = 'https://cybercheck-login.vercel.app/admin.html';
    const dashboardBase = role === 'admin' ? adminBase : clientBase;

    if (error) {
        return res.redirect(dashboardBase + '#connections?square_error=' + encodeURIComponent(error));
    }
    if (!code || !siteId) {
        return res.redirect(dashboardBase + '#connections?square_error=missing_code');
    }

    try {
        const { data: platformData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'api_key_square')
            .single();

        if (!platformData?.value?.appId || !platformData?.value?.secret) {
            return res.redirect(dashboardBase + '#connections?square_error=platform_not_configured');
        }

        const { appId, secret, mode } = platformData.value;
        const tokenUrl = mode === 'sandbox'
            ? 'https://connect.squareupsandbox.com/oauth2/token'
            : 'https://connect.squareup.com/oauth2/token';

        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
            body: JSON.stringify({
                client_id: appId,
                client_secret: secret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://cybercheck-api-database.vercel.app/api/square/callback'
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            const msg = tokenData.message || tokenData.errors?.[0]?.detail || 'Token exchange failed';
            return res.redirect(dashboardBase + '#connections?square_error=' + encodeURIComponent(msg));
        }

        // Save token + merchant info to connections
        const encrypted = encryptKey(tokenData.access_token);
        const now = new Date().toISOString();
        const merchantId = tokenData.merchant_id || '';

        // Fetch primary location ID from Square API
        let locationId = '';
        try {
            const env = mode === 'sandbox' ? Environment.Sandbox : Environment.Production;
            const tempClient = new Client({ accessToken: tokenData.access_token, environment: env });
            const locRes = await tempClient.locationsApi.listLocations();
            const locs = locRes.result.locations || [];
            const primary = locs.find(l => l.status === 'ACTIVE') || locs[0];
            if (primary) locationId = primary.id;
        } catch (e) {
            console.warn('Could not fetch Square location:', e.message);
        }

        const upserts = [
            supabase.from('connections').upsert({ site_id: siteId, provider: 'square_key', access_token: encrypted, account_name: 'Square Key', status: 'connected', connected_at: now, updated_at: now }, { onConflict: 'site_id,provider' }),
            supabase.from('connections').upsert({ site_id: siteId, provider: 'square_mode', account_name: mode || 'production', status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' }),
            supabase.from('connections').upsert({ site_id: siteId, provider: 'square_merchant_id', account_name: merchantId, status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' }),
            supabase.from('connections').upsert({ site_id: siteId, provider: 'square_app_id', account_name: appId, status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' })
        ];
        if (locationId) {
            upserts.push(supabase.from('connections').upsert({ site_id: siteId, provider: 'square_location_id', account_name: locationId, status: 'connected', updated_at: now }, { onConflict: 'site_id,provider' }));
        }
        await Promise.all(upserts);

        res.redirect(dashboardBase + '#connections?square_connected=true');
    } catch (err) {
        console.error('Square OAuth callback error:', err);
        res.redirect(dashboardBase + '#connections?square_error=' + encodeURIComponent(err.message));
    }
});

module.exports = router;
module.exports.getSquareForSite = getSquareForSite;

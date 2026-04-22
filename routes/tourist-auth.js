/**
 * Trip-swipe tourist sign-up with email verification sent via Brevo
 * (same pipeline as booking confirmation emails, from info@cybercheckinc.com).
 *
 *   POST /api/tourist-auth/signup    { email, password }  → sends verification email
 *   GET  /api/tourist-auth/verify    ?token=&email=       → marks user confirmed, 302 to /auth?verified=1
 *   POST /api/tourist-auth/resend    { email }            → re-send verification
 *
 * User is created with email_confirm: false; only the verify endpoint flips it to true.
 * Sign-in flow (supabase.auth.signInWithPassword) is unchanged; Supabase blocks sign-in
 * until email_confirm is true when "Confirm email" is ON in Auth provider settings.
 */

const express = require('express');
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../utils/email');

const router = express.Router();

function admin() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function makeToken() {
    return crypto.randomBytes(24).toString('hex');
}

function verifyUrl(token, email) {
    const api = process.env.PUBLIC_API_URL || 'https://cybercheck-api-database.vercel.app';
    return `${api}/api/tourist-auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
}

function welcomeEmailHtml({ verifyHref }) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#0ea5e9,#7c6af7);padding:40px 32px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;">🌊 Welcome to Gulf Coast Radar</h1>
        <p style="margin:10px 0 0;color:#e0f2fe;font-size:15px;">Swipe your way to the perfect Gulf Coast trip</p>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 18px;color:#374151;font-size:15px;">Thanks for signing up!</p>
        <p style="margin:0 0 28px;color:#374151;font-size:15px;">One quick step — confirm your email so we can save your trip across devices:</p>
        <div style="text-align:center;margin:24px 0 32px;">
          <a href="${verifyHref}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 36px;border-radius:10px;">Confirm my email →</a>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">Link expires in 24 hours. If the button doesn't work, paste this into your browser:</p>
        <p style="margin:6px 0 0;color:#0ea5e9;font-size:12px;word-break:break-all;">${verifyHref}</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">You received this because someone (hopefully you) signed up at Gulf Coast Radar.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /signup
// ─────────────────────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const sb = admin();
    const token = makeToken();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    // Does user already exist?
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find(u => (u.email || '').toLowerCase() === email);

    if (existing) {
        if (existing.email_confirmed_at) return res.status(409).json({ error: 'Email already registered. Try signing in instead.' });
        // Existing but unconfirmed — update password + new token, re-send email
        await sb.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: { ...(existing.user_metadata || {}), verification_token: token, verification_expires_at: expiresAt },
        });
    } else {
        const { error } = await sb.auth.admin.createUser({
            email, password,
            email_confirm: false,
            user_metadata: { verification_token: token, verification_expires_at: expiresAt },
        });
        if (error) return res.status(500).json({ error: error.message });
    }

    const verifyHref = verifyUrl(token, email);
    const send = await sendEmail({
        to: email,
        subject: '🌊 Confirm your Gulf Coast Radar account',
        html: welcomeEmailHtml({ verifyHref }),
    });
    if (!send.success) return res.status(500).json({ error: 'Failed to send confirmation email: ' + (send.reason || 'unknown') });

    res.json({ success: true, message: 'Verification email sent. Check your inbox.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /verify — user clicks email link
// ─────────────────────────────────────────────────────────────────────────────
router.get('/verify', async (req, res) => {
    const token = req.query.token || '';
    const email = (req.query.email || '').toLowerCase();
    const appUrl = process.env.TRIP_SWIPE_URL || 'https://trip-swipe.vercel.app';

    if (!token || !email) return res.redirect(`${appUrl}/auth?verified=0&reason=bad_link`);

    const sb = admin();
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const user = list?.users?.find(u => (u.email || '').toLowerCase() === email);
    if (!user) return res.redirect(`${appUrl}/auth?verified=0&reason=no_user`);

    const stored = user.user_metadata || {};
    if (stored.verification_token !== token) return res.redirect(`${appUrl}/auth?verified=0&reason=bad_token`);
    if (stored.verification_expires_at && new Date(stored.verification_expires_at) < new Date()) {
        return res.redirect(`${appUrl}/auth?verified=0&reason=expired`);
    }

    // Mark confirmed + clear token
    const { error } = await sb.auth.admin.updateUserById(user.id, {
        email_confirm: true,
        user_metadata: { ...stored, verification_token: null, verification_expires_at: null, verified_at: new Date().toISOString() },
    });
    if (error) return res.redirect(`${appUrl}/auth?verified=0&reason=update_failed`);

    res.redirect(`${appUrl}/auth?verified=1`);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /signin — email + password → Supabase session (access + refresh tokens)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/signin', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const url = `${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`;
        const r = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: process.env.SUPABASE_ANON_KEY || '',
                Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || ''}`,
            },
            body: JSON.stringify({ email, password }),
        });
        const d = await r.json();
        if (!r.ok) {
            const text = (d.error_description || d.msg || d.error || '').toString();
            const msg = /confirm/i.test(text)
                ? 'Please confirm your email before signing in — check your inbox.'
                : 'Invalid email or password';
            console.error('signin supabase error:', r.status, JSON.stringify(d));
            return res.status(401).json({ error: msg, _debug: { status: r.status, supabase: d, urlHost: (process.env.SUPABASE_URL || '').replace(/https?:\/\//, '').split('.')[0] } });
        }
        res.json({
            session: {
                access_token: d.access_token,
                refresh_token: d.refresh_token,
                expires_at: d.expires_at,
            },
            user: { id: d.user?.id, email: d.user?.email, role: 'tourist' },
        });
    } catch (err) {
        console.error('signin error:', err);
        res.status(500).json({ error: 'Signin failed: ' + err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /resend
// ─────────────────────────────────────────────────────────────────────────────
router.post('/resend', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

    const sb = admin();
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const user = list?.users?.find(u => (u.email || '').toLowerCase() === email);
    if (!user) return res.status(404).json({ error: 'No account with that email' });
    if (user.email_confirmed_at) return res.json({ success: true, message: 'Already confirmed — try signing in.' });

    const token = makeToken();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await sb.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), verification_token: token, verification_expires_at: expiresAt },
    });

    const verifyHref = verifyUrl(token, email);
    const send = await sendEmail({
        to: email,
        subject: '🌊 Confirm your Gulf Coast Radar account',
        html: welcomeEmailHtml({ verifyHref }),
    });
    if (!send.success) return res.status(500).json({ error: 'Failed to send email' });

    res.json({ success: true, message: 'Verification email re-sent.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /forgot-password — send reset link via Brevo
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

    const sb = admin();
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const user = list?.users?.find(u => (u.email || '').toLowerCase() === email);
    // Always return success to avoid email-enumeration leaks
    if (!user) return res.json({ success: true, message: 'If that email is registered, a reset link was sent.' });

    const token = makeToken();
    const expiresAt = new Date(Date.now() + 1 * 3600 * 1000).toISOString();
    await sb.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), reset_token: token, reset_expires_at: expiresAt },
    });

    const appUrl = process.env.TRIP_SWIPE_URL || 'https://trip-swipe.vercel.app';
    const resetHref = `${appUrl}/reset?token=${token}&email=${encodeURIComponent(email)}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#0ea5e9,#7c6af7);padding:36px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;">🌊 Reset your password</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 20px;color:#374151;font-size:15px;">Click the link below to set a new password. This link expires in 1 hour.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetHref}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;">Reset Password →</a>
        </div>
        <p style="margin:20px 0 0;color:#6b7280;font-size:13px;">If you didn't request this, ignore the email.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
    await sendEmail({ to: email, subject: 'Reset your Gulf Coast Radar password', html });
    res.json({ success: true, message: 'If that email is registered, a reset link was sent.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /reset-password — exchange token + new password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const token = req.body?.token || '';
    const password = req.body?.password || '';
    if (!email || !token) return res.status(400).json({ error: 'Invalid reset link' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const sb = admin();
    const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
    const user = list?.users?.find(u => (u.email || '').toLowerCase() === email);
    if (!user) return res.status(400).json({ error: 'Invalid reset link' });

    const md = user.user_metadata || {};
    if (md.reset_token !== token) return res.status(400).json({ error: 'Invalid reset link' });
    if (md.reset_expires_at && new Date(md.reset_expires_at) < new Date()) return res.status(400).json({ error: 'Reset link expired' });

    const { error } = await sb.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { ...md, reset_token: null, reset_expires_at: null, verified_at: md.verified_at || new Date().toISOString() },
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;

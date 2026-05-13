/**
 * Trip-swipe tourist sign-up with 6-digit email code verification via Brevo.
 *
 *   POST /api/tourist-auth/signup          { email, password } → sends 6-digit code by email
 *   POST /api/tourist-auth/verify          { email, code }     → marks confirmed, returns JSON
 *   POST /api/tourist-auth/resend          { email }           → re-send code by email
 *   POST /api/tourist-auth/signin          { email, password } → Supabase session
 *   POST /api/tourist-auth/forgot-password { email }           → reset link by email
 *   POST /api/tourist-auth/reset-password  { email, token, password }
 */

const express = require('express');
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('../utils/email');
const mainDb = require('../db');

const router = express.Router();

// Cached admin client — avoids creating a new instance per request
let _adminClient = null;
function admin() {
    if (!_adminClient) _adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    return _adminClient;
}

function makeCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Lookup user by email using admin API (scales to any number of users)
async function getUserByEmail(email) {
    const sb = admin();
    // Supabase admin v2: filter by email directly
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1, page: 1, filter: `email.eq.${email}` });
    if (error || !data?.users?.length) {
        // fallback: try fetching via service role getUserByEmail if available
        try {
            const { data: d2 } = await sb.auth.admin.getUserByEmail(email);
            return d2?.user || null;
        } catch { return null; }
    }
    return data.users[0] || null;
}

function codeEmailHtml({ code }) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <tr><td style="background:linear-gradient(135deg,#0ea5e9,#7c6af7);padding:40px 32px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:26px;">🌊 Gulf Coast Radar</h1>
        <p style="margin:10px 0 0;color:#e0f2fe;font-size:15px;">Your verification code</p>
      </td></tr>
      <tr><td style="padding:40px 32px;text-align:center;">
        <p style="margin:0 0 24px;color:#374151;font-size:15px;">Enter this code on the site to confirm your account:</p>
        <div style="display:inline-block;background:#f0f9ff;border:2px solid #0ea5e9;border-radius:14px;padding:20px 36px;margin-bottom:28px;">
          <span style="font-size:48px;font-weight:800;letter-spacing:14px;color:#0c4a6e;font-family:monospace;">${code}</span>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">This code expires in 24 hours. If you didn't sign up, ignore this email.</p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">Gulf Coast Radar — Swipe your way to the perfect Gulf Coast trip</p>
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
    const code = makeCode();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const existing = await getUserByEmail(email);

    if (existing) {
        if (existing.email_confirmed_at) return res.status(409).json({ error: 'Email already registered. Try signing in instead.' });
        await sb.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: { ...(existing.user_metadata || {}), verification_code: code, verification_expires_at: expiresAt },
        });
    } else {
        const { error } = await sb.auth.admin.createUser({
            email, password,
            email_confirm: false,
            user_metadata: { verification_code: code, verification_expires_at: expiresAt },
        });
        if (error) return res.status(500).json({ error: error.message });
    }

    const send = await sendEmail({
        to: email,
        subject: '🌊 Your Gulf Coast Radar verification code',
        html: codeEmailHtml({ code }),
    });
    if (!send.success) return res.status(500).json({ error: 'Failed to send verification email: ' + (send.reason || 'unknown') });

    res.json({ success: true, message: 'Verification code sent — check your inbox.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /verify — { email, code } → JSON response (no redirect)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
    const code  = (req.body?.code  || '').trim();
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!code || !email) return res.status(400).json({ error: 'Email and code required' });

    const sb = admin();
    const user = await getUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'No account found for that email' });

    if (user.email_confirmed_at) return res.json({ success: true });

    const stored = user.user_metadata || {};
    if (stored.verification_code !== code) return res.status(400).json({ error: 'Incorrect code — check and try again' });
    if (stored.verification_expires_at && new Date(stored.verification_expires_at) < new Date()) {
        return res.status(400).json({ error: 'Code expired — tap Resend for a new one' });
    }

    const { error } = await sb.auth.admin.updateUserById(user.id, {
        email_confirm: true,
        user_metadata: { ...stored, verification_code: null, verification_expires_at: null, verified_at: new Date().toISOString() },
    });
    if (error) return res.status(500).json({ error: error.message });

    // Seed a minimal profile row so the account exists even if user drops off before setup
    await mainDb.from('tourist_profiles')
        .upsert({ user_id: user.id, setup_complete: false }, { onConflict: 'user_id', ignoreDuplicates: true });

    res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /signin
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
            return res.status(401).json({ error: msg });
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
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'No account with that email' });
    if (user.email_confirmed_at) return res.json({ success: true, message: 'Already confirmed — try signing in.' });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await sb.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), verification_code: code, verification_expires_at: expiresAt },
    });

    const send = await sendEmail({
        to: email,
        subject: '🌊 Your new Gulf Coast Radar verification code',
        html: codeEmailHtml({ code }),
    });
    if (!send.success) return res.status(500).json({ error: 'Failed to send email' });

    res.json({ success: true, message: 'New code sent — check your inbox.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /forgot-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' });

    const sb = admin();
    const user = await getUserByEmail(email);
    if (!user) return res.json({ success: true, message: 'If that email is registered, a reset link was sent.' });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 1 * 3600 * 1000).toISOString();
    await sb.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), reset_token: token, reset_expires_at: expiresAt },
    });

    const appUrl = process.env.TRIP_SWIPE_URL || 'https://trip-swipe.vercel.app';
    const resetHref = `${appUrl}/reset?token=${token}&email=${encodeURIComponent(email)}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;">
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
// POST /reset-password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    const token = req.body?.token || '';
    const password = req.body?.password || '';
    if (!email || !token) return res.status(400).json({ error: 'Invalid reset link' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const sb = admin();
    const user = await getUserByEmail(email);
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

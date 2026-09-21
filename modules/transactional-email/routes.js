/**
 * Transactional Email — routes
 *
 * Extracted from the inline app.post('/api/send-email') handler that used to sit
 * in server.js. Behaviour is unchanged: POST the mount path itself.
 *
 *   POST /api/send-email   { to, subject, html }
 */

const express = require('express');
const { sendEmail } = require('../../core/email');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { to, subject, html } = req.body;
        if (!to || !subject || !html) return res.status(400).json({ error: 'to, subject, html required' });
        const result = await sendEmail({ to, subject, html });
        if (result.success) return res.json({ ok: true, id: result.id });
        return res.status(500).json({ error: result.reason });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;

// ============================================
// email.js — Resend HTTP API email sender
// No npm package needed — uses native fetch
// Sign up at resend.com, add RESEND_API_KEY to env
// ============================================

const RESEND_API = 'https://api.resend.com/emails';
const FROM_DEFAULT = process.env.EMAIL_FROM || 'bookings@gulfcoastradar.com';

/**
 * Send an email via Resend
 * @param {object} opts - { to, subject, html, replyTo }
 */
async function sendEmail({ to, subject, html, replyTo, attachments }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('RESEND_API_KEY not set — email not sent to:', to);
        return { success: false, reason: 'not_configured' };
    }
    if (!to) return { success: false, reason: 'no_recipient' };

    try {
        const res = await fetch(RESEND_API, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_DEFAULT,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                reply_to: replyTo || undefined,
                attachments: attachments || undefined
            })
        });
        const json = await res.json();
        if (!res.ok) {
            console.error('Resend error:', json);
            return { success: false, reason: json.message || 'resend_error' };
        }
        return { success: true, id: json.id };
    } catch (err) {
        console.error('Email send error:', err.message);
        return { success: false, reason: err.message };
    }
}

/**
 * Build customer confirmation email HTML
 */
function customerConfirmationHtml(d) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0ea5e9;padding:32px 32px 24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;">Booking Confirmed!</h1>
          <p style="margin:8px 0 0;color:#e0f2fe;font-size:15px;">Thanks for booking with ${esc(d.business_name)}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;">Hi <strong>${esc(d.customer_name)}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;font-size:15px;">Your booking is confirmed. Here are the details:</p>

          <!-- Details box -->
          <table width="100%" style="background:#f9fafb;border-radius:10px;padding:20px;border:1px solid #e5e7eb;" cellpadding="0" cellspacing="0">
            ${row('📅 Date', d.date)}
            ${row('⏰ Time', d.time_slot)}
            ${d.boat_type ? row('🚤 Rental', d.boat_type) : ''}
            ${d.boat_count && d.boat_count !== '1' ? row('🔢 Quantity', d.boat_count) : ''}
            ${d.guest_count ? row('👥 Guests', d.guest_count) : ''}
            ${d.addons && d.addons !== 'None' ? row('➕ Add-ons', d.addons) : ''}
            ${d.location ? row('📍 Location', d.location) : ''}
            ${row('💳 Amount', '$' + d.total)}
            ${row('💰 Payment', d.payment_status)}
          </table>

          ${d.notes ? `<p style="margin:20px 0 0;color:#6b7280;font-size:13px;"><strong>Notes:</strong> ${esc(d.notes)}</p>` : ''}

          <p style="margin:28px 0 0;color:#374151;font-size:15px;">Questions? Reply to this email or contact ${esc(d.business_name)} directly.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">This confirmation was sent automatically. Please save it for your records.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Build owner new-booking notification email HTML
 */
function ownerNotificationHtml(d) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#16a34a;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;">New Booking!</h1>
          <p style="margin:8px 0 0;color:#dcfce7;font-size:14px;">${esc(d.date)} · ${esc(d.time_slot)}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <table width="100%" style="background:#f9fafb;border-radius:10px;padding:20px;border:1px solid #e5e7eb;" cellpadding="0" cellspacing="0">
            ${row('👤 Customer', d.customer_name)}
            ${d.customer_phone ? row('📞 Phone', d.customer_phone) : ''}
            ${d.customer_email ? row('📧 Email', d.customer_email) : ''}
            ${row('📅 Date', d.date)}
            ${row('⏰ Time', d.time_slot)}
            ${d.boat_type ? row('🚤 Rental', d.boat_type) : ''}
            ${d.boat_count ? row('🔢 Qty', d.boat_count) : ''}
            ${d.guest_count ? row('👥 Guests', d.guest_count) : ''}
            ${d.addons && d.addons !== 'None' ? row('➕ Add-ons', d.addons) : ''}
            ${row('💳 Total', '$' + d.total)}
            ${row('💰 Payment', d.payment_status)}
          </table>
          ${d.notes ? `<p style="margin:20px 0 0;color:#374151;font-size:14px;"><strong>Customer notes:</strong> ${esc(d.notes)}</p>` : ''}
        </td></tr>

        <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Sent automatically by your booking system.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
    if (!value) return '';
    return `<tr>
      <td style="padding:6px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;">${esc(String(value))}</td>
    </tr>`;
}

function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Generate .ics calendar invite content
 * d: { date, time_slot, boat_type, business_name, location }
 */
function generateIcsContent(d) {
    // Parse start/end from time_slot e.g. "9:00 AM – 1:00 PM" or "Half Day AM"
    const dateStr = (d.date || '').replace(/-/g, '');
    const slot = (d.time_slot || '').toLowerCase();
    let startHour = 9, endHour = 13;
    if (slot.includes('pm') && !slot.includes('am')) { startHour = 13; endHour = 17; }
    else if (slot.includes('all day') || slot.includes('full')) { startHour = 9; endHour = 17; }
    // Try to parse explicit times like "9:00 AM"
    const timeMatch = (d.time_slot || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeMatch) {
        let h = parseInt(timeMatch[1]);
        if (timeMatch[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (timeMatch[3].toUpperCase() === 'AM' && h === 12) h = 0;
        startHour = h;
        endHour = h + 4;
    }
    const pad = n => String(n).padStart(2, '0');
    const dtStart = dateStr + 'T' + pad(startHour) + '0000';
    const dtEnd   = dateStr + 'T' + pad(endHour)   + '0000';
    const uid = 'booking-' + Date.now() + '@circleboat';
    const summary = (d.boat_type || 'Boat Rental') + ' — ' + (d.business_name || 'Circle Boats');
    const location = d.location || 'Orange Beach, AL';
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CyberCheck//Booking//EN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        'UID:' + uid,
        'DTSTART;TZID=America/Chicago:' + dtStart,
        'DTEND;TZID=America/Chicago:' + dtEnd,
        'SUMMARY:' + summary,
        'LOCATION:' + location,
        'DESCRIPTION:Your booking is confirmed. Arrive 15 min early for check-in.',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
}

module.exports = { sendEmail, customerConfirmationHtml, ownerNotificationHtml, generateIcsContent };

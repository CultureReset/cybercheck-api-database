const supabase = require('../db');

let twilioClient = null;

function getClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
}

/**
 * Send SMS via Twilio and log to sms_log
 * @param {string} to - Phone number
 * @param {string} body - Message text
 * @param {string} siteId - Business site_id for logging
 * @param {string} type - 'booking_confirmation', 'booking_owner_notify', 'campaign', 'cancellation'
 * @param {string} relatedId - Optional booking_id or campaign_id
 */
async function sendSms(to, body, siteId, type = 'outgoing', relatedId = null) {
    const client = getClient();

    if (!client) {
        console.warn('Twilio not configured, SMS not sent:', { to, body: body.substring(0, 50) });
        await logSms(siteId, to, body, type, 'not_configured', relatedId);
        return { success: false, reason: 'twilio_not_configured' };
    }

    const normalizedTo = normalizePhone(to);
    if (!normalizedTo) {
        await logSms(siteId, to, body, type, 'invalid_phone', relatedId);
        return { success: false, reason: 'invalid_phone' };
    }

    // Check opt-outs
    const { data: optOut } = await supabase
        .from('sms_opt_outs')
        .select('id')
        .or(`phone.eq.${normalizedTo},phone.eq.${to}`)
        .limit(1)
        .maybeSingle();

    if (optOut) {
        await logSms(siteId, normalizedTo, body, type, 'opted_out', relatedId);
        return { success: false, reason: 'opted_out' };
    }

    try {
        const message = await client.messages.create({
            body: body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: normalizedTo
        });

        await logSms(siteId, normalizedTo, body, type, 'sent', relatedId, message.sid);
        return { success: true, sid: message.sid };
    } catch (err) {
        console.error('Twilio send error:', err.message);
        await logSms(siteId, normalizedTo, body, type, 'failed', relatedId);
        return { success: false, reason: err.message };
    }
}

/**
 * Fill template tokens with data
 * Tokens: {{customer_name}}, {{customer_phone}}, {{customer_email}},
 * {{business_name}}, {{date}}, {{time_slot}}, {{boat_count}}, {{boat_type}},
 * {{addons}}, {{guest_count}}, {{total}}, {{location}}, {{payment_status}}
 */
function fillTemplate(template, data) {
    if (!template) return '';
    return template.replace(/\{\{(\w+)\}\}/g, function (match, key) {
        return data[key] !== undefined ? String(data[key]) : match;
    });
}

/**
 * Build template data object from a booking record + business profile
 */
async function buildTemplateData(booking, siteId) {
    // Get business name
    const { data: business } = await supabase
        .from('businesses')
        .select('name')
        .eq('site_id', siteId)
        .single();

    // Get address info
    const { data: content } = await supabase
        .from('site_content')
        .select('address, city, state, zip')
        .eq('site_id', siteId)
        .single();

    // Get fleet type name
    let boatType = '';
    if (booking.fleet_type_id) {
        const { data: fleet } = await supabase
            .from('fleet_types')
            .select('name')
            .eq('id', booking.fleet_type_id)
            .single();
        boatType = fleet?.name || '';
    }

    // Get time slot name
    let timeSlot = booking.booking_time || '';
    if (booking.time_slot_id) {
        const { data: slot } = await supabase
            .from('rental_time_slots')
            .select('name, start_time, end_time')
            .eq('id', booking.time_slot_id)
            .single();
        if (slot) {
            timeSlot = slot.name + ' (' + slot.start_time + ' - ' + slot.end_time + ')';
        }
    }

    // Format addons
    const addons = Array.isArray(booking.addons) && booking.addons.length > 0
        ? booking.addons.map(a => a.name).join(', ')
        : 'None';

    // Format date
    const dateStr = booking.booking_date
        ? new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
        : '';

    const location = content
        ? [content.address, content.city, content.state, content.zip].filter(Boolean).join(', ')
        : '';

    return {
        customer_name: booking.customer_name || '',
        customer_phone: booking.customer_phone || '',
        customer_email: booking.customer_email || '',
        business_name: business?.name || '',
        date: dateStr,
        time_slot: timeSlot,
        boat_count: String(booking.qty || 1),
        boat_type: boatType,
        addons: addons,
        guest_count: String(booking.party_size || booking.qty || 1),
        total: booking.total ? Number(booking.total).toFixed(2) : '0.00',
        location: location,
        payment_status: booking.payment_status === 'paid' ? 'Paid' : 'Pending'
    };
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits[0] === '1') return '+' + digits;
    if (digits.length > 10 && phone.startsWith('+')) return phone;
    return null;
}

async function logSms(siteId, to, message, type, status, relatedId, sid) {
    await supabase.from('sms_log').insert({
        site_id: siteId,
        to_phone: to,
        message: message,
        type: type,
        status: status,
        related_id: relatedId || null,
        metadata: sid ? { twilio_sid: sid } : {}
    }).catch(err => console.error('SMS log error:', err.message));
}

module.exports = { sendSms, fillTemplate, buildTemplateData, normalizePhone };

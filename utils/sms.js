const supabase = require('../db');

/**
 * Send SMS and log to sms_log. SMS provider is Brevo (set BREVO_API_KEY and
 * BREVO_SMS_ENABLED=true); without a configured provider, sends are logged
 * as 'not_configured' rather than delivered.
 * @param {string} to - Phone number
 * @param {string} body - Message text
 * @param {string} siteId - Business site_id for logging
 * @param {string} type - 'booking_confirmation', 'booking_owner_notify', 'campaign', 'cancellation'
 * @param {string} relatedId - Optional booking_id or campaign_id
 * @param {string} from - Optional custom from number (overrides default)
 */
async function sendSms(to, body, siteId, type = 'outgoing', relatedId = null, from = null) {
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

    // SMS provider: Brevo. Set BREVO_SMS_ENABLED=true in env to enable.
    if (process.env.BREVO_API_KEY && process.env.BREVO_SMS_ENABLED === 'true') {
        try {
            const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
                method: 'POST',
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sender: process.env.BREVO_SMS_SENDER || 'CyberCheck',
                    recipient: normalizedTo.replace('+', ''),
                    content: body
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Brevo SMS failed');
            await logSms(siteId, normalizedTo, body, type, 'sent', relatedId, String(data.messageId || ''));
            return { success: true, messageId: data.messageId };
        } catch (err) {
            console.error('Brevo SMS error:', err.message);
            await logSms(siteId, normalizedTo, body, type, 'failed', relatedId);
            return { success: false, reason: err.message };
        }
    }

    console.warn('No SMS provider configured, SMS not sent:', { to, body: body.substring(0, 50) });
    await logSms(siteId, normalizedTo, body, type, 'not_configured', relatedId);
    return { success: false, reason: 'sms_not_configured' };
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

    // Get tracking data from conversions table
    let utm_source = 'Direct';
    let utm_medium = 'Direct';
    let utm_campaign = '(none)';
    let referrer = 'Direct';
    let device_type = 'Unknown';
    let session_duration_mins = 0;
    let page_source = 'Homepage';

    try {
        const { data: conversion } = await supabase
            .from('conversions')
            .select('utm_source, utm_medium, utm_campaign, referrer, session_id')
            .eq('booking_id', booking.id)
            .maybeSingle();

        if (conversion) {
            utm_source = conversion.utm_source || 'Direct';
            utm_medium = conversion.utm_medium || 'Direct';
            utm_campaign = conversion.utm_campaign || '(none)';
            referrer = conversion.referrer || 'Direct';

            // Get device type and session duration from page_views
            if (conversion.session_id) {
                const { data: pageViews } = await supabase
                    .from('page_views')
                    .select('device_type, duration_seconds, page_path')
                    .eq('session_id', conversion.session_id)
                    .order('created_at', { ascending: true })
                    .limit(10);

                if (pageViews && pageViews.length > 0) {
                    device_type = pageViews[0].device_type || 'Unknown';
                    session_duration_mins = Math.ceil(pageViews[pageViews.length - 1].duration_seconds / 60) || 0;
                    page_source = pageViews[0].page_path || 'Homepage';
                }
            }
        }
    } catch (err) {
        console.warn('Error fetching tracking data:', err.message);
    }

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
        payment_status: booking.payment_status === 'paid' ? 'Paid' : 'Pending',
        confirmation_number: booking.id ? 'BCB-' + String(booking.id).replace(/-/g, '').substring(0, 8).toUpperCase() : '',
        payment_id: booking.payment_id || '',
        receipt_number: booking.receipt_number || '',
        receipt_url: booking.receipt_url || '',
        payment_provider: booking.payment_provider || '',
        utm_source: utm_source,
        utm_medium: utm_medium,
        utm_campaign: utm_campaign,
        referrer: referrer,
        device_type: device_type,
        session_duration_mins: String(session_duration_mins),
        page_source: page_source
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
    try {
        await supabase.from('sms_log').insert({
            site_id: siteId,
            to_phone: to,
            message: message,
            type: type,
            status: status,
            related_id: relatedId || null,
            metadata: sid ? { twilio_sid: sid } : {}
        });
    } catch (err) {
        console.error('SMS log error:', err.message);
    }
}

module.exports = { sendSms, fillTemplate, buildTemplateData, normalizePhone };

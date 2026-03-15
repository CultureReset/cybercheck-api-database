const express = require('express');
const supabase = require('../db');

const router = express.Router();

// All public routes need a site_id from domain resolution middleware
// If no site_id, the request needs a ?subdomain= param as fallback
function requireSite(req, res, next) {
    if (!req.siteId && (req.query.subdomain || (req.body && req.body.subdomain))) {
        // Fallback: look up by subdomain query param
        supabase
            .from('businesses')
            .select('site_id, name, type, status')
            .eq('subdomain', req.query.subdomain || req.body.subdomain)
            .single()
            .then(({ data }) => {
                if (!data || data.status !== 'active') {
                    return res.status(404).json({ error: 'Business not found' });
                }
                req.siteId = data.site_id;
                req.siteName = data.name;
                req.siteType = data.type;
                next();
            });
        return;
    }

    if (!req.siteId) {
        return res.status(404).json({ error: 'Business not found. Provide domain or ?subdomain= param.' });
    }
    next();
}

router.use(requireSite);

// ============================================
// GET /api/public/profile
// ============================================
router.get('/profile', async (req, res) => {
    const { data: business } = await supabase
        .from('businesses')
        .select('name, type, logo_url, cover_url, subdomain, domain')
        .eq('site_id', req.siteId)
        .single();

    const { data: content } = await supabase
        .from('site_content')
        .select('hero_text, hero_subtext, hero_video_url, about_text, contact_phone, contact_email, address, city, state, zip, lat, lng, hours, social_links, logo_url, cover_url, theme_color, seo_title, seo_description')
        .eq('site_id', req.siteId)
        .single();

    const profile = { ...business, ...content };
    // Alias for consistency — some clients use tagline, DB column is hero_text
    if (profile.hero_text !== undefined) profile.tagline = profile.hero_text;
    res.json(profile);
});

// ============================================
// GET /api/public/services
// ============================================
router.get('/services', async (req, res) => {
    const { data } = await supabase
        .from('services')
        .select('id, name, description, price, duration_minutes, capacity, image_url, category')
        .eq('site_id', req.siteId)
        .eq('available', true)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

// ============================================
// GET /api/public/menu
// Returns hierarchical: categories → subcategories → items
// ============================================
router.get('/menu', async (req, res) => {
    // Get categories with nested subcategories
    const { data: categories } = await supabase
        .from('menu_categories')
        .select('id, name, description, time_start, time_end, image_url, sort_order')
        .eq('site_id', req.siteId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

    const { data: subcategories } = await supabase
        .from('menu_subcategories')
        .select('id, category_id, name, description, sort_order')
        .eq('site_id', req.siteId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

    const { data: items } = await supabase
        .from('menu_items')
        .select('id, category_id, subcategory_id, name, description, price, image_url, tags, allergens, calories, sort_order')
        .eq('site_id', req.siteId)
        .eq('available', true)
        .order('sort_order', { ascending: true });

    // Build hierarchy: categories → subcategories → items
    const menu = (categories || []).map(cat => ({
        ...cat,
        subcategories: (subcategories || [])
            .filter(sub => sub.category_id === cat.id)
            .map(sub => ({
                ...sub,
                items: (items || []).filter(item => item.subcategory_id === sub.id)
            })),
        // Items directly under category (no subcategory)
        items: (items || []).filter(item => item.category_id === cat.id && !item.subcategory_id)
    }));

    // Also return flat items list for simple views
    res.json({ menu, items: items || [], total: (items || []).length });
});

// ============================================
// GET /api/public/gallery
// ============================================
router.get('/gallery', async (req, res) => {
    const { data: content } = await supabase
        .from('site_content')
        .select('gallery')
        .eq('site_id', req.siteId)
        .single();

    // Also get media library images
    const { data: media } = await supabase
        .from('media')
        .select('id, url, alt_text, filename')
        .eq('site_id', req.siteId)
        .eq('file_type', 'image')
        .eq('folder', 'gallery');

    res.json({
        gallery: content?.gallery || [],
        media: media || []
    });
});

// ============================================
// GET /api/public/reviews
// ============================================
router.get('/reviews', async (req, res) => {
    const { data } = await supabase
        .from('reviews')
        .select('id, customer_name, rating, text, photos, created_at')
        .eq('site_id', req.siteId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

    // Calculate average rating
    const reviews = data || [];
    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    res.json({ reviews, avg_rating: Math.round(avgRating * 10) / 10, total: reviews.length });
});

// ============================================
// GET /api/public/faqs
// ============================================
router.get('/faqs', async (req, res) => {
    const { data } = await supabase
        .from('faqs')
        .select('id, question, answer')
        .eq('site_id', req.siteId)
        .order('sort_order', { ascending: true });

    res.json(data || []);
});

// ============================================
// GET /api/public/hours
// ============================================
router.get('/hours', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('hours')
        .eq('site_id', req.siteId)
        .single();

    res.json(data?.hours || {});
});

// ============================================
// GET /api/public/team
// ============================================
router.get('/team', async (req, res) => {
    const { data } = await supabase
        .from('staff')
        .select('name, role, phone, email')
        .eq('site_id', req.siteId)
        .eq('active', true);

    res.json(data || []);
});

// ============================================
// GET /api/public/specials
// ============================================
router.get('/specials', async (req, res) => {
    const { data } = await supabase
        .from('specials')
        .select('id, name, description, type, days, start_time, end_time, discount_text, image_url')
        .eq('site_id', req.siteId)
        .eq('active', true);

    res.json(data || []);
});

// ============================================
// GET /api/public/social
// ============================================
router.get('/social', async (req, res) => {
    const { data } = await supabase
        .from('site_content')
        .select('social_links')
        .eq('site_id', req.siteId)
        .single();

    res.json(data?.social_links || {});
});

// ============================================
// GET /api/public/fleet — rental fleet types + pricing
// ============================================
router.get('/fleet', async (req, res) => {
    const { data: fleet } = await supabase
        .from('fleet_types')
        .select('id, name, description, specs, image_url')
        .eq('site_id', req.siteId)
        .eq('available', true)
        .order('sort_order', { ascending: true });

    const { data: timeSlots } = await supabase
        .from('rental_time_slots')
        .select('id, name, start_time, end_time')
        .eq('site_id', req.siteId)
        .eq('active', true)
        .order('sort_order', { ascending: true });

    const { data: pricing } = await supabase
        .from('rental_pricing')
        .select('fleet_type_id, time_slot_id, price')
        .eq('site_id', req.siteId);

    const { data: addons } = await supabase
        .from('rental_addons')
        .select('id, name, description, price, category, icon, per_unit')
        .eq('site_id', req.siteId)
        .eq('available', true)
        .order('sort_order', { ascending: true });

    const { data: groupRates } = await supabase
        .from('rental_group_rates')
        .select('fleet_type_id, time_slot_id, min_qty, price_per_unit')
        .eq('site_id', req.siteId)
        .eq('active', true);

    res.json({
        fleet: fleet || [],
        time_slots: timeSlots || [],
        pricing: pricing || [],
        addons: addons || [],
        group_rates: groupRates || []
    });
});

// ============================================
// GET /api/public/availability?date=YYYY-MM-DD
// ============================================
router.get('/availability', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: 'date query parameter required (YYYY-MM-DD)' });
    }

    // Get all bookings for that date
    const { data: bookings } = await supabase
        .from('bookings')
        .select('fleet_type_id, time_slot_id, qty, status')
        .eq('site_id', req.siteId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed', 'checked_in']);

    // Get fleet inventory counts
    const { data: fleetItems } = await supabase
        .from('fleet_items')
        .select('fleet_type_id, condition')
        .eq('site_id', req.siteId)
        .eq('condition', 'good');

    // Get time slots
    const { data: timeSlots } = await supabase
        .from('rental_time_slots')
        .select('id, name, start_time, end_time')
        .eq('site_id', req.siteId)
        .eq('active', true);

    // Get fleet types
    const { data: fleetTypes } = await supabase
        .from('fleet_types')
        .select('id, name')
        .eq('site_id', req.siteId)
        .eq('available', true);

    // Get active holds (other people in checkout right now)
    const { data: holds } = await supabase
        .from('booking_holds')
        .select('fleet_type_id, time_slot_id, qty')
        .eq('site_id', req.siteId)
        .eq('booking_date', date)
        .gt('expires_at', new Date().toISOString());

    // Calculate availability: total units - booked units - held units
    const inventory = {};
    (fleetItems || []).forEach(item => {
        inventory[item.fleet_type_id] = (inventory[item.fleet_type_id] || 0) + 1;
    });

    const booked = {};
    const bookedNoSlot = {}; // bookings with no time_slot_id count against all slots
    (bookings || []).forEach(b => {
        if (b.time_slot_id) {
            const key = `${b.fleet_type_id}_${b.time_slot_id}`;
            booked[key] = (booked[key] || 0) + (b.qty || 1);
        } else {
            bookedNoSlot[b.fleet_type_id] = (bookedNoSlot[b.fleet_type_id] || 0) + (b.qty || 1);
        }
    });

    // Add holds to booked count
    (holds || []).forEach(h => {
        if (h.time_slot_id) {
            const key = `${h.fleet_type_id}_${h.time_slot_id}`;
            booked[key] = (booked[key] || 0) + (h.qty || 1);
        } else {
            bookedNoSlot[h.fleet_type_id] = (bookedNoSlot[h.fleet_type_id] || 0) + (h.qty || 1);
        }
    });

    // Check blocked dates — check both legacy 'availability' table and new 'availability_blocks' table
    const [{ data: blockedLegacy }, { data: blockedNew }] = await Promise.all([
        supabase.from('availability').select('service_id, blocked')
            .eq('site_id', req.siteId).eq('specific_date', date).eq('blocked', true),
        supabase.from('availability_blocks').select('fleet_type_id')
            .eq('site_id', req.siteId).eq('block_date', date)
    ]);

    // blockAll = whole-date block (no specific fleet); blockedSet = specific fleet type blocked
    const blockAllLegacy = (blockedLegacy || []).some(b => !b.service_id);
    const blockAllNew = (blockedNew || []).some(b => !b.fleet_type_id);
    const blockAll = blockAllLegacy || blockAllNew;
    const blockedSet = new Set([
        ...(blockedLegacy || []).filter(b => b.service_id).map(b => b.service_id),
        ...(blockedNew || []).filter(b => b.fleet_type_id).map(b => b.fleet_type_id)
    ]);

    const availability = [];
    (fleetTypes || []).forEach(ft => {
        (timeSlots || []).forEach(ts => {
            const key = `${ft.id}_${ts.id}`;
            const total = inventory[ft.id] || 0;
            const used = (booked[key] || 0) + (bookedNoSlot[ft.id] || 0);
            const remaining = Math.max(0, total - used);

            availability.push({
                fleet_type_id: ft.id,
                fleet_type_name: ft.name,
                time_slot_id: ts.id,
                time_slot_name: ts.name,
                start_time: ts.start_time,
                end_time: ts.end_time,
                total,
                booked: used,
                available: remaining,
                blocked: blockAll || blockedSet.has(ft.id)
            });
        });
    });

    res.json({ date, availability });
});

// ============================================
// POST /api/public/hold — Reserve slot during checkout (10 min)
// Prevents overbooking while customer is filling out payment
// ============================================
router.post('/hold', async (req, res) => {
    const { fleet_type_id, time_slot_id, booking_date, qty, session_id } = req.body;
    const resolvedSessionId = session_id || ('session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

    if (!fleet_type_id || !booking_date) {
        return res.status(400).json({ error: 'fleet_type_id and booking_date required' });
    }

    // If no time_slot_id (e.g. duration-based rentals), skip RPC hold and return success
    if (!time_slot_id) {
        return res.json({ success: true, hold_id: resolvedSessionId, expires_in_seconds: 600, session_id: resolvedSessionId });
    }

    const { data, error } = await supabase.rpc('create_booking_hold', {
        p_site_id: req.siteId,
        p_fleet_type_id: fleet_type_id,
        p_time_slot_id: time_slot_id,
        p_booking_date: booking_date,
        p_qty: qty || 1,
        p_session_id: resolvedSessionId
    });

    if (error) return res.status(500).json({ error: error.message });

    const result = data;
    if (!result.success) {
        return res.status(409).json(result);
    }

    res.json(result);
});

// ============================================
// DELETE /api/public/hold — Release a hold (customer abandons checkout)
// ============================================
router.delete('/hold', async (req, res) => {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    await supabase.from('booking_holds')
        .delete()
        .eq('session_id', session_id)
        .eq('site_id', req.siteId);

    res.json({ success: true });
});

// ============================================
// POST /api/public/bookings — Create booking (atomic availability check)
// ============================================
router.post('/bookings', async (req, res) => {
    const booking = {
        site_id: req.siteId,
        fleet_type_id: req.body.fleet_type_id,
        service_id: req.body.service_id,
        time_slot_id: req.body.time_slot_id,
        booking_date: req.body.booking_date,
        booking_time: req.body.booking_time,
        qty: req.body.qty || 1,
        party_size: req.body.party_size || 1,
        addons: req.body.addons || [],
        subtotal: req.body.subtotal,
        tax: req.body.tax || 0,
        total: req.body.total,
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
        customer_email: req.body.customer_email,
        notes: req.body.notes,
        status: 'pending',
        payment_status: 'unpaid'
    };

    // Upsert customer — single query instead of check+insert to reduce latency
    let customerId = null;
    const customerKey = booking.customer_email || booking.customer_phone;
    if (customerKey) {
        const matchCol = booking.customer_email ? 'email' : 'phone';
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('site_id', req.siteId)
            .eq(matchCol, customerKey)
            .maybeSingle();

        if (existingCustomer) {
            customerId = existingCustomer.id;
            supabase.rpc('increment_customer_bookings', {
                customer_uuid: existingCustomer.id,
                amount: booking.total || 0
            }).then(() => {}).catch(() => {});  // fire-and-forget
        } else {
            const { data: newCustomer } = await supabase
                .from('customers')
                .insert({
                    site_id: req.siteId,
                    name: booking.customer_name,
                    phone: booking.customer_phone,
                    email: booking.customer_email || null,
                    total_bookings: 1,
                    total_spent: booking.total || 0
                })
                .select('id')
                .single();
            if (newCustomer) customerId = newCustomer.id;
        }
    }

    // Use atomic function if fleet booking (rental), otherwise direct insert (service booking)
    let data, error;

    if (booking.fleet_type_id && booking.time_slot_id && booking.booking_date) {
        // Try atomic RPC first (prevents overbooking), fall back to direct insert if RPC missing/timeout
        const { data: result, error: rpcError } = await supabase.rpc('create_booking_if_available', {
            p_site_id: req.siteId,
            p_fleet_type_id: booking.fleet_type_id,
            p_time_slot_id: booking.time_slot_id,
            p_booking_date: booking.booking_date,
            p_qty: booking.qty,
            p_service_id: booking.service_id || null,
            p_booking_time: booking.booking_time || null,
            p_party_size: booking.party_size,
            p_addons: JSON.stringify(booking.addons),
            p_subtotal: booking.subtotal || 0,
            p_tax: booking.tax || 0,
            p_total: booking.total || 0,
            p_customer_id: customerId,
            p_customer_name: booking.customer_name,
            p_customer_phone: booking.customer_phone,
            p_customer_email: booking.customer_email,
            p_notes: booking.notes || null,
            p_hold_session_id: req.body.session_id || null
        });

        if (rpcError) {
            // RPC failed — return error, never bypass inventory check with direct insert
            console.error('RPC create_booking_if_available failed:', rpcError.message);
            return res.status(500).json({ error: 'Booking system temporarily unavailable. Please try again in a moment.' });
        } else if (!result.success) {
            return res.status(409).json({ error: result.error, available: result.available });
        } else {
            const { data: fullBooking } = await supabase.from('bookings').select().eq('id', result.booking_id).single();
            data = fullBooking;
        }
    } else {
        // Service booking or booking without fleet — direct insert (no inventory to check)
        booking.customer_id = customerId;
        const insertResult = await supabase
            .from('bookings')
            .insert(booking)
            .select()
            .single();
        data = insertResult.data;
        error = insertResult.error;
    }

    if (error) return res.status(500).json({ error: error.message });

    // Respond immediately — don't block on SMS (prevents 504 timeout)
    res.status(201).json(data);

    // Send SMS notifications after response (fire-and-forget, won't cause timeout)
    setImmediate(async () => {
        try {
            const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');

            // Get messaging settings (notification phone) + fallback to site contact_phone
            const [{ data: msgSettings }, { data: siteContent }] = await Promise.all([
                supabase.from('messaging_settings').select('notification_phone, booking_confirmation_enabled, booking_confirmation_template').eq('site_id', req.siteId).maybeSingle(),
                supabase.from('site_content').select('contact_phone').eq('site_id', req.siteId).single()
            ]);

            const settings = msgSettings || {};
            const templateData = await buildTemplateData(data, req.siteId);

            // SMS to customer
            if (settings.booking_confirmation_enabled !== false && data.customer_phone) {
                const defaultCustomerTpl = '[{{business_name}}] Hi {{customer_name}}! Your booking is confirmed.\n\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\n\nQuestions? Reply to this number!\n\n🏖️ Get exclusive deals & rewards while you\'re in town!\nSign up for Gulf Coast Radar Trip Pass:\ngulfcoastradar.com/trip-pass';
                const customerMsg = fillTemplate(settings.booking_confirmation_template || defaultCustomerTpl, templateData);
                sendSms(data.customer_phone, customerMsg, req.siteId, 'booking_confirmation', data.id)
                    .catch(err => console.error('Customer SMS failed:', err));
            }

            // SMS to business owner — use notification_phone from messaging settings, fallback to contact_phone
            const ownerPhone = settings.notification_phone || siteContent?.contact_phone || null;
            if (ownerPhone) {
                const defaultOwnerTpl = 'NEW BOOKING!\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\nPayment: {{payment_status}}';
                const ownerMsg = fillTemplate(defaultOwnerTpl, templateData);
                sendSms(ownerPhone, ownerMsg, req.siteId, 'booking_owner_notify', data.id)
                    .catch(err => console.error('Owner SMS failed:', err));
            }
        } catch (smsErr) {
            console.error('SMS notification error:', smsErr);
        }
    });
});

// ============================================
// POST /api/public/contact — Submit contact form
// ============================================
router.post('/contact', async (req, res) => {
    const { name, email, phone, message } = req.body;

    if (!name || !message) {
        return res.status(400).json({ error: 'Name and message required' });
    }

    // Store as notification for business owner
    await supabase.from('notifications').insert({
        site_id: req.siteId,
        type: 'contact_form',
        title: `New message from ${name}`,
        body: message,
        metadata: { name, email, phone }
    });

    // TODO: Send email notification to business
    res.json({ success: true, message: 'Message sent!' });
});

// ============================================
// POST /api/public/chat — Tourist AI chat (Grok) or business public chat
// Accepts: { session_id, message } for tourist sessions
//          { site_id, message, conversation_id } for business page chatbots
// ============================================
router.post('/chat', async (req, res) => {
    const { message, session_id, site_id, conversation_id } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // ---- Tourist session chat (Grok) ----
    if (session_id) {
        const { data: session } = await supabase
            .from('tourist_sessions')
            .select('*')
            .eq('session_id', session_id)
            .single();

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Load conversation history
        const { data: history } = await supabase
            .from('tourist_conversations')
            .select('role, content')
            .eq('session_id', session.id)
            .order('created_at', { ascending: true })
            .limit(20);

        // Load relevant businesses based on interests
        let businessContext = '';
        const interests = session.interests || [];
        if (interests.length > 0) {
            const categoryMap = {
                'food': 'restaurants', 'dining': 'restaurants', 'restaurants': 'restaurants',
                'boats': 'things-to-do', 'rentals': 'things-to-do', 'activities': 'things-to-do',
                'nightlife': 'nightlife', 'bars': 'nightlife',
                'shopping': 'shopping', 'coffee': 'coffee-sweets'
            };
            const types = [...new Set(interests.map(i => categoryMap[i.toLowerCase()] || 'other'))];
            const { data: bizList } = await supabase
                .from('businesses')
                .select('name, type, site_content(city, state, address, contact_phone, seo_description, hours)')
                .eq('status', 'active')
                .eq('gcr_listed', true)
                .in('type', types)
                .limit(15);

            if (bizList && bizList.length > 0) {
                businessContext = '\n\nLocal businesses:\n' + bizList.map(b => {
                    const c = b.site_content || {};
                    return `- ${b.name} (${b.type}): ${c.seo_description || ''} | ${c.address || ''} | ${c.contact_phone || ''} | Hours: ${c.hours || 'call ahead'}`;
                }).join('\n');
            }
        }

        const systemPrompt = `You are a friendly Gulf Coast trip assistant for Orange Beach and Gulf Shores, Alabama. You know everything about local restaurants, boat rentals, fishing charters, activities, and events.

Tourist info:
- Name: ${session.name}
- Visitor type: ${session.visitor_type || 'tourist'}
- Interests: ${(session.interests || []).join(', ') || 'general'}
- Trip dates: ${session.checkin || 'unknown'} to ${session.checkout || 'unknown'}
${businessContext}

Be helpful, enthusiastic, and specific. Recommend real places. Keep responses concise and friendly. You can help them plan their trip and point them to the right businesses.`;

        const messages = [
            ...(history || []).map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
        ];

        // Save user message
        await supabase.from('tourist_conversations').insert({
            session_id: session.id,
            role: 'user',
            content: message
        });

        // Call Grok API
        if (!process.env.GROK_API_KEY) {
            return res.json({ reply: "I'm getting set up! Check back soon for personalized Gulf Coast recommendations.", session_id });
        }

        try {
            const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + process.env.GROK_API_KEY
                },
                body: JSON.stringify({
                    model: 'grok-2-latest',
                    messages: [{ role: 'system', content: systemPrompt }, ...messages],
                    max_tokens: 500,
                    temperature: 0.8
                })
            });
            const grokData = await grokRes.json();
            const reply = grokData.choices?.[0]?.message?.content || "I had trouble getting that. Try asking again!";

            // Save assistant response
            await supabase.from('tourist_conversations').insert({
                session_id: session.id,
                role: 'assistant',
                content: reply
            });

            return res.json({ reply, session_id });
        } catch (err) {
            console.error('Grok error:', err.message);
            return res.status(500).json({ error: 'AI service error', session_id });
        }
    }

    // ---- Business page AI agent (function calling) ----
    if (!site_id) {
        return res.json({ reply: "Thanks for your message! Please call us directly or use our booking form." });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.json({ reply: "Our assistant is being set up — please call us directly!" });
    }

    const history = req.body.history || [];

    // Resolve site_id (could be subdomain string or UUID)
    let siteQuery = supabase.from('businesses').select('id, name, type, subdomain, tagline');
    if (site_id.length > 30) siteQuery = siteQuery.eq('id', site_id);
    else siteQuery = siteQuery.eq('subdomain', site_id);
    const { data: biz } = await siteQuery.single();

    if (!biz) return res.json({ reply: "Sorry, I couldn't find this business." });

    // Load ALL business data for context — the AI should know everything the website knows
    const [contentRes, servicesRes, fleetRes, faqRes, reviewsRes, detailsRes, logisticsRes, atmosphereRes] = await Promise.all([
        supabase.from('site_content').select('contact_phone, address, city, hours, hours_note, description, website_url').eq('site_id', biz.id).maybeSingle(),
        supabase.from('services').select('id, name, price, duration, description, whats_included').eq('site_id', biz.id).eq('active', true),
        supabase.from('fleet_types').select('id, name, capacity, price_per_hour, quantity, description').eq('site_id', biz.id),
        supabase.from('qa_pairs').select('question, answer, category').eq('site_id', biz.id).limit(30),
        supabase.from('reviews').select('rating, comment, customer_name').eq('site_id', biz.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('business_details').select('*').eq('site_id', biz.id).maybeSingle(),
        supabase.from('business_logistics').select('*').eq('site_id', biz.id).maybeSingle(),
        supabase.from('business_atmosphere').select('*').eq('site_id', biz.id).maybeSingle()
    ]);

    const c = contentRes.data || {};
    const details = detailsRes.data || {};
    const logistics = logisticsRes.data || {};
    const atmo = atmosphereRes.data || {};

    let ctx = `BUSINESS: ${biz.name}\nType: ${biz.type}\nTagline: ${biz.tagline || ''}`;
    if (c.address) ctx += `\nAddress: ${c.address}, ${c.city || ''}`;
    if (c.contact_phone) ctx += `\nPhone: ${c.contact_phone}`;
    if (c.hours) ctx += `\nHours: ${c.hours}`;
    if (c.hours_note) ctx += ` (${c.hours_note})`;
    if (c.description) ctx += `\nAbout: ${c.description}`;
    if (c.website_url) ctx += `\nWebsite: ${c.website_url}`;

    // Business personality & insider info
    if (details.elevator_pitch || details.vibe_description || details.who_its_for) {
        ctx += '\n\nABOUT THIS PLACE:';
        if (details.elevator_pitch) ctx += `\n${details.elevator_pitch}`;
        if (details.vibe_description) ctx += `\nVibe: ${details.vibe_description}`;
        if (details.who_its_for) ctx += `\nBest for: ${details.who_its_for}`;
        if (details.what_to_expect) ctx += `\nWhat to expect: ${details.what_to_expect}`;
        if (details.signature_dish) ctx += `\nSignature dish: ${details.signature_dish}`;
        if (details.signature_drink) ctx += `\nSignature drink: ${details.signature_drink}`;
        if (details.must_try && details.must_try.length) ctx += `\nMust try: ${details.must_try.join(', ')}`;
        if (details.insider_tip) ctx += `\nInsider tip: ${details.insider_tip}`;
        if (details.pro_tip) ctx += `\nPro tip: ${details.pro_tip}`;
        if (details.best_time_of_day) ctx += `\nBest time to visit: ${details.best_time_of_day}`;
        if (details.avg_wait_time) ctx += `\nTypical wait: ${details.avg_wait_time}`;
        if (details.avg_visit_duration) ctx += `\nTypical visit: ${details.avg_visit_duration}`;
        if (details.years_in_business) ctx += `\nIn business ${details.years_in_business} years`;
        if (details.owner_name) ctx += `\nOwner: ${details.owner_name}`;
        if (details.awards && details.awards.length) ctx += `\nAwards: ${details.awards.join(', ')}`;
    }

    // Logistics — parking, accessibility, directions
    if (logistics.parking_type || logistics.directions_note || logistics.wheelchair_accessible !== undefined) {
        ctx += '\n\nGETTING HERE & ACCESS:';
        if (logistics.parking_type) ctx += `\nParking: ${logistics.parking_type}${logistics.parking_notes ? ' — ' + logistics.parking_notes : ''}`;
        if (logistics.parking_lot_size) ctx += ` (${logistics.parking_lot_size} lot)`;
        if (logistics.directions_note) ctx += `\nDirections: ${logistics.directions_note}`;
        if (logistics.landmark) ctx += `\nLandmark: ${logistics.landmark}`;
        if (logistics.distance_from_beach) ctx += `\nDistance from beach: ${logistics.distance_from_beach}`;
        if (logistics.distance_from_wharf) ctx += `\nDistance from The Wharf: ${logistics.distance_from_wharf}`;
        if (logistics.wheelchair_accessible) ctx += `\nWheelchair accessible: Yes`;
        if (logistics.stroller_friendly) ctx += `\nStroller friendly: Yes`;
        if (logistics.waterfront_access) ctx += `\nWaterfront access: Yes`;
        if (logistics.dock_available) ctx += `\nDock available: Yes`;
        if (logistics.boat_accessible) ctx += `\nBoat accessible: Yes`;
        if (logistics.golf_cart_parking) ctx += `\nGolf cart parking: Yes`;
        if (logistics.reservations) ctx += `\nReservations: ${logistics.reservations}`;
    }

    // Atmosphere
    if (atmo.noise_level || atmo.dress_code || atmo.live_music) {
        ctx += '\n\nATMOSPHERE:';
        if (atmo.noise_level) ctx += `\nNoise level: ${atmo.noise_level}`;
        if (atmo.dress_code) ctx += `\nDress code: ${atmo.dress_code}`;
        if (atmo.seating_types && atmo.seating_types.length) ctx += `\nSeating: ${atmo.seating_types.join(', ')}`;
        if (atmo.live_music) ctx += `\nLive music: Yes${atmo.live_music_schedule ? ' — ' + atmo.live_music_schedule : ''}${atmo.live_music_genre ? ' (' + atmo.live_music_genre + ')' : ''}`;
        if (atmo.outdoor_seating) ctx += `\nOutdoor seating: Yes${atmo.covered_outdoor ? ' (covered)' : ''}`;
        if (atmo.ocean_view) ctx += `\nOcean view: Yes`;
        if (atmo.bay_view) ctx += `\nBay view: Yes`;
        if (atmo.sunset_view) ctx += `\nSunset view: Yes`;
        if (atmo.wifi) ctx += `\nFree WiFi: Yes`;
        if (atmo.sports_tv) ctx += `\nSports TVs: Yes`;
        if (atmo.trivia_night) ctx += `\nTrivia night: ${atmo.trivia_night}`;
        if (atmo.karaoke) ctx += `\nKaraoke: Yes`;
        if (atmo.fire_pit) ctx += `\nFire pit: Yes`;
        if (atmo.arcade_games) ctx += `\nArcade games: Yes`;
        if (atmo.pool_table) ctx += `\nPool table: Yes`;
    }

    if ((servicesRes.data || []).length) {
        ctx += '\n\nSERVICES/PACKAGES:';
        servicesRes.data.forEach(s => {
            ctx += `\n- ${s.name} (id: ${s.id}): $${s.price}${s.duration ? ' (' + s.duration + ' min)' : ''}`;
            if (s.description) ctx += ` — ${s.description}`;
            if (s.whats_included) ctx += ` | Includes: ${s.whats_included}`;
        });
    }

    if ((fleetRes.data || []).length) {
        ctx += '\n\nFLEET/RENTALS:';
        fleetRes.data.forEach(f => {
            ctx += `\n- ${f.name} (id: ${f.id}): $${f.price_per_hour}/hr, fits ${f.capacity} people, ${f.quantity} available`;
            if (f.description) ctx += ` — ${f.description}`;
        });
    }

    if ((faqRes.data || []).length) {
        ctx += '\n\nFAQs:';
        faqRes.data.forEach(q => { ctx += `\nQ: ${q.question}\nA: ${q.answer}`; });
    }

    if ((reviewsRes.data || []).length) {
        const avg = (reviewsRes.data.reduce((s, r) => s + r.rating, 0) / reviewsRes.data.length).toFixed(1);
        ctx += `\n\nREVIEWS (avg ${avg} stars):`;
        reviewsRes.data.forEach(r => { ctx += `\n- ${r.rating}★ ${r.customer_name || ''}: "${(r.comment || '').slice(0, 80)}"`; });
    }

    // ── OpenAI Function Calling tools ──
    const tools = [
        {
            type: 'function',
            function: {
                name: 'check_availability',
                description: 'Check what boats/rentals are available on a specific date. Call this when a customer mentions a date or asks about availability.',
                parameters: {
                    type: 'object',
                    properties: {
                        date: { type: 'string', description: 'Date in YYYY-MM-DD format' }
                    },
                    required: ['date']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_booking_hold',
                description: 'Reserve a spot for 10 minutes while the customer confirms. Call this after the customer confirms date, fleet type, and time slot.',
                parameters: {
                    type: 'object',
                    properties: {
                        fleet_type_id: { type: 'string', description: 'UUID of the fleet type' },
                        time_slot_id: { type: 'string', description: 'UUID of the time slot' },
                        booking_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                        qty: { type: 'integer', description: 'Number of boats/units', default: 1 }
                    },
                    required: ['fleet_type_id', 'time_slot_id', 'booking_date']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'create_booking',
                description: 'Finalize a booking after collecting customer name, phone/email, and confirming details. This creates the actual booking and sends SMS confirmation.',
                parameters: {
                    type: 'object',
                    properties: {
                        fleet_type_id: { type: 'string', description: 'UUID of the fleet type' },
                        time_slot_id: { type: 'string', description: 'UUID of the time slot' },
                        booking_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                        qty: { type: 'integer', description: 'Number of boats/units', default: 1 },
                        party_size: { type: 'integer', description: 'Total number of people' },
                        customer_name: { type: 'string', description: 'Customer full name' },
                        customer_phone: { type: 'string', description: 'Customer phone number' },
                        customer_email: { type: 'string', description: 'Customer email (optional)' },
                        notes: { type: 'string', description: 'Any special requests or notes' }
                    },
                    required: ['fleet_type_id', 'time_slot_id', 'booking_date', 'customer_name', 'customer_phone']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'send_sms',
                description: 'Send an SMS message to the customer (e.g. booking link, directions, confirmation details).',
                parameters: {
                    type: 'object',
                    properties: {
                        phone: { type: 'string', description: 'Phone number to send to' },
                        message_text: { type: 'string', description: 'SMS message body' }
                    },
                    required: ['phone', 'message_text']
                }
            }
        }
    ];

    // ── Tool executor ──
    async function executeTool(name, args) {
        switch (name) {
            case 'check_availability': {
                const { date } = args;
                const [bookingsRes, fleetItemsRes, timeSlotsRes, fleetTypesRes, holdsRes, blockedRes] = await Promise.all([
                    supabase.from('bookings').select('fleet_type_id, time_slot_id, qty, status').eq('site_id', biz.id).eq('booking_date', date).in('status', ['pending', 'confirmed', 'checked_in']),
                    supabase.from('fleet_items').select('fleet_type_id, condition').eq('site_id', biz.id).eq('condition', 'good'),
                    supabase.from('rental_time_slots').select('id, name, start_time, end_time').eq('site_id', biz.id).eq('active', true),
                    supabase.from('fleet_types').select('id, name, capacity, price_per_hour').eq('site_id', biz.id).eq('available', true),
                    supabase.from('booking_holds').select('fleet_type_id, time_slot_id, qty').eq('site_id', biz.id).eq('booking_date', date).gt('expires_at', new Date().toISOString()),
                    supabase.from('availability').select('service_id, blocked').eq('site_id', biz.id).eq('specific_date', date).eq('blocked', true)
                ]);

                const inventory = {};
                (fleetItemsRes.data || []).forEach(i => { inventory[i.fleet_type_id] = (inventory[i.fleet_type_id] || 0) + 1; });

                const booked = {};
                const bookedNoSlot = {};
                (bookingsRes.data || []).forEach(b => {
                    if (b.time_slot_id) {
                        const key = `${b.fleet_type_id}_${b.time_slot_id}`;
                        booked[key] = (booked[key] || 0) + (b.qty || 1);
                    } else {
                        bookedNoSlot[b.fleet_type_id] = (bookedNoSlot[b.fleet_type_id] || 0) + (b.qty || 1);
                    }
                });
                (holdsRes.data || []).forEach(h => {
                    if (h.time_slot_id) {
                        const key = `${h.fleet_type_id}_${h.time_slot_id}`;
                        booked[key] = (booked[key] || 0) + (h.qty || 1);
                    } else {
                        bookedNoSlot[h.fleet_type_id] = (bookedNoSlot[h.fleet_type_id] || 0) + (h.qty || 1);
                    }
                });

                const blockedSet = new Set((blockedRes.data || []).map(b => b.service_id));
                const availability = [];
                (fleetTypesRes.data || []).forEach(ft => {
                    (timeSlotsRes.data || []).forEach(ts => {
                        const key = `${ft.id}_${ts.id}`;
                        const total = inventory[ft.id] || 0;
                        const used = (booked[key] || 0) + (bookedNoSlot[ft.id] || 0);
                        const remaining = Math.max(0, total - used);
                        if (!blockedSet.has(ft.id)) {
                            availability.push({
                                fleet_type_id: ft.id, fleet_type_name: ft.name,
                                time_slot_id: ts.id, time_slot_name: ts.name,
                                start_time: ts.start_time, end_time: ts.end_time,
                                price_per_hour: ft.price_per_hour, capacity: ft.capacity,
                                available: remaining
                            });
                        }
                    });
                });

                return JSON.stringify({ date, availability });
            }

            case 'create_booking_hold': {
                const sessionId = `ai-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const { data, error } = await supabase.rpc('create_booking_hold', {
                    p_site_id: biz.id,
                    p_fleet_type_id: args.fleet_type_id,
                    p_time_slot_id: args.time_slot_id,
                    p_booking_date: args.booking_date,
                    p_qty: args.qty || 1,
                    p_session_id: sessionId
                });
                if (error) return JSON.stringify({ success: false, error: error.message });
                return JSON.stringify({ ...data, session_id: sessionId });
            }

            case 'create_booking': {
                const sessionId = `ai-book-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

                // Look up fleet type for pricing
                const { data: ft } = await supabase.from('fleet_types').select('price_per_hour, name').eq('id', args.fleet_type_id).single();
                const price = ft?.price_per_hour || 0;
                const qty = args.qty || 1;
                const subtotal = price * qty;
                const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% tax estimate
                const total = subtotal + tax;

                // Upsert customer
                let customerId = null;
                if (args.customer_email) {
                    const { data: existing } = await supabase.from('customers').select('id').eq('site_id', biz.id).eq('email', args.customer_email).single();
                    if (existing) {
                        customerId = existing.id;
                    } else {
                        const { data: newCust } = await supabase.from('customers').insert({
                            site_id: biz.id, name: args.customer_name, phone: args.customer_phone,
                            email: args.customer_email, total_bookings: 1, total_spent: total
                        }).select('id').single();
                        if (newCust) customerId = newCust.id;
                    }
                } else if (args.customer_phone) {
                    const { data: existing } = await supabase.from('customers').select('id').eq('site_id', biz.id).eq('phone', args.customer_phone).single();
                    if (existing) {
                        customerId = existing.id;
                    } else {
                        const { data: newCust } = await supabase.from('customers').insert({
                            site_id: biz.id, name: args.customer_name, phone: args.customer_phone,
                            total_bookings: 1, total_spent: total
                        }).select('id').single();
                        if (newCust) customerId = newCust.id;
                    }
                }

                // Atomic booking
                const { data: result, error: rpcError } = await supabase.rpc('create_booking_if_available', {
                    p_site_id: biz.id,
                    p_fleet_type_id: args.fleet_type_id,
                    p_time_slot_id: args.time_slot_id,
                    p_booking_date: args.booking_date,
                    p_qty: qty,
                    p_service_id: null,
                    p_booking_time: null,
                    p_party_size: args.party_size || qty * 2,
                    p_addons: '[]',
                    p_subtotal: subtotal,
                    p_tax: tax,
                    p_total: total,
                    p_customer_id: customerId,
                    p_customer_name: args.customer_name,
                    p_customer_phone: args.customer_phone,
                    p_customer_email: args.customer_email || null,
                    p_notes: args.notes || null,
                    p_hold_session_id: null
                });

                if (rpcError) return JSON.stringify({ success: false, error: rpcError.message });
                if (!result.success) return JSON.stringify({ success: false, error: result.error, available: result.available });

                // Send confirmation SMS (non-blocking)
                try {
                    const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');
                    const { data: fullBooking } = await supabase.from('bookings').select().eq('id', result.booking_id).single();
                    const { data: siteContent } = await supabase.from('site_content').select('messaging_settings, contact_phone').eq('site_id', biz.id).single();
                    const settings = siteContent?.messaging_settings || {};
                    const templateData = await buildTemplateData(fullBooking, biz.id);

                    if (args.customer_phone) {
                        const tpl = '[{{business_name}}] Hi {{customer_name}}! Your booking is confirmed.\n\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\n\nQuestions? Reply to this number!\n\n🏖️ Get exclusive deals & rewards while you\'re in town!\nSign up for Gulf Coast Radar Trip Pass:\ngulfcoastradar.com/trip-pass';
                        const msg = fillTemplate(settings.customerBookingTemplate || tpl, templateData);
                        sendSms(args.customer_phone, msg, biz.id, 'booking_confirmation', result.booking_id).catch(() => {});
                    }
                    if (siteContent?.contact_phone) {
                        const tpl = 'NEW BOOKING (via AI chat)!\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}';
                        const msg = fillTemplate(settings.ownerBookingTemplate || tpl, templateData);
                        sendSms(siteContent.contact_phone, msg, biz.id, 'booking_owner_notify', result.booking_id).catch(() => {});
                    }
                } catch (smsErr) { console.error('AI booking SMS error:', smsErr); }

                return JSON.stringify({
                    success: true,
                    booking_id: result.booking_id,
                    fleet_type: ft?.name || args.fleet_type_id,
                    date: args.booking_date,
                    customer: args.customer_name,
                    total: total
                });
            }

            case 'send_sms': {
                try {
                    const { sendSms } = require('../utils/sms');
                    await sendSms(args.phone, args.message_text, biz.id, 'ai_chat_sms');
                    return JSON.stringify({ success: true });
                } catch (err) {
                    return JSON.stringify({ success: false, error: err.message });
                }
            }

            default:
                return JSON.stringify({ error: 'Unknown tool' });
        }
    }

    const systemPrompt = `You are the AI assistant for ${biz.name}. You know EVERYTHING about this business — answer any question a customer could possibly ask. You can also check real-time availability, create bookings, and send SMS confirmations.

${ctx}

RULES:
- Be friendly, warm, helpful — like talking to a real person who works here
- Answer ANY question using the data above: hours, pricing, age requirements, restrictions, parking, accessibility, dress code, what to bring, weather tips, directions, vibe, menu, reviews, policies — ANYTHING
- Keep responses short and conversational (2-3 sentences). Be specific, not generic.
- If a customer asks about age restrictions, requirements, rules, policies, safety, etc. — answer from the FAQs and business data. If not covered, say "I'd recommend checking with us directly" and offer to connect them
- YOU handle bookings directly — never tell people to call
- Booking flow:
  1. Customer wants to book → ask what date
  2. Call check_availability to see what's open
  3. Tell them what's available with prices
  4. Customer picks boat/service + time → confirm details
  5. Ask for their name and phone number
  6. Call create_booking to finalize — this sends them an SMS confirmation automatically
- If a date is fully booked, suggest the next available day
- If a slot they want is taken, show alternatives
- Today's date is ${new Date().toISOString().split('T')[0]}
- When customer says relative dates like "Saturday" or "this weekend", convert to YYYY-MM-DD
- You can send_sms to text a customer a booking link, directions, or any info they ask for
- After ANY completed booking, mention: "Check out Gulf Coast Radar for more local deals, live music, and things to do while you're in town! gulfcoastradar.com"
- If someone asks about other things to do in the area, restaurants, entertainment — mention Gulf Coast Radar as the local guide
- If the data above doesn't cover a very specific question, say "Great question! Let me get the right answer for you —" and offer to take their name/number so the owner can follow up`;

    try {
        // Build initial messages
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10),
            { role: 'user', content: message }
        ];

        // Tool-calling loop: keep going until the model returns a text response (max 5 rounds)
        let finalReply = null;
        for (let round = 0; round < 5; round++) {
            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages,
                    tools,
                    tool_choice: 'auto',
                    max_tokens: 400,
                    temperature: 0.7
                })
            });
            const aiData = await openaiRes.json();
            if (!openaiRes.ok) throw new Error(aiData.error?.message || 'OpenAI error');

            const choice = aiData.choices?.[0];
            if (!choice) throw new Error('No response from AI');

            const msg = choice.message;
            messages.push(msg); // add assistant message (with tool_calls or content)

            // If no tool calls, we're done
            if (!msg.tool_calls || msg.tool_calls.length === 0) {
                finalReply = msg.content || "I'm here to help! What would you like to know?";
                break;
            }

            // Execute each tool call and add results
            for (const tc of msg.tool_calls) {
                let toolArgs;
                try { toolArgs = JSON.parse(tc.function.arguments); } catch { toolArgs = {}; }
                console.log(`AI tool call: ${tc.function.name}(${JSON.stringify(toolArgs)})`);

                const result = await executeTool(tc.function.name, toolArgs);
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: result
                });
            }
        }

        if (!finalReply) finalReply = "I ran into an issue — could you try again?";

        // Check for booking_intent in the reply (backwards compat with frontend)
        let booking_intent = null;
        const bookingMatch = finalReply.match(/\[BOOKING:(.*?)\]/);
        if (bookingMatch) {
            try { booking_intent = JSON.parse(bookingMatch[1]); } catch(e) {}
            finalReply = finalReply.replace(/\[BOOKING:.*?\]/, '').trim();
        }

        const response = { reply: finalReply };
        if (booking_intent) response.booking_intent = booking_intent;
        res.json(response);
    } catch (err) {
        console.error('Business chat error:', err.message);
        res.json({ reply: "Something went wrong — try again!" });
    }
});

// ============================================
// POST /api/public/gcr-chat — GCR voice/text AI search
// Accepts: { message, history: [{role, content}] }
// Uses OpenAI GPT-4o + all Supabase businesses as context
// ============================================
router.post('/gcr-chat', async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    if (!process.env.OPENAI_API_KEY) {
        return res.json({ reply: "AI is being set up — check back soon!" });
    }

    // Load all GCR businesses with their key details
    const { data: businesses } = await supabase
        .from('businesses')
        .select(`
            name, type, subdomain, tagline, area, tags,
            happy_hour, kids_friendly, pet_friendly, live_music,
            outdoor, alcohol, price_range, rating,
            site_content(contact_phone, address, city, hours, website_url)
        `)
        .eq('gcr_listed', true)
        .eq('status', 'active')
        .order('name');

    // Build compact business context for AI
    const bizContext = (businesses || []).map(b => {
        const c = b.site_content || {};
        const flags = [
            b.happy_hour   === true && 'happy hour',
            b.live_music   === true && 'live music',
            b.kids_friendly === true && 'kid-friendly',
            b.pet_friendly === true && 'pet-friendly',
            b.outdoor      === true && 'outdoor seating',
            b.alcohol      === true && 'full bar',
        ].filter(Boolean).join(', ');
        return `• ${b.name} [${b.type}] ${b.area || ''} — ${b.tagline || ''} | ${flags} | ${b.price_range || ''} | phone: ${c.contact_phone || 'n/a'}`;
    }).join('\n');

    const systemPrompt = `You are a local Gulf Coast expert for Orange Beach and Gulf Shores, Alabama — like a knowledgeable friend who knows every spot. You help tourists and visitors find exactly what they're looking for.

Here are all the local businesses you know:
${bizContext}

Rules:
- Recommend 2-3 specific businesses from the list above that best match the request
- Include the phone number when available so they can call/book
- Keep responses conversational and under 100 words
- If results are too many, ask ONE follow-up question to narrow it down (party size, budget, time)
- Never make up details not in the list
- Be enthusiastic and local — "Flora-Bama is legendary", not just "Flora-Bama is a bar"`;

    try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-6),
                    { role: 'user', content: message }
                ],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        const data = await openaiRes.json();
        if (!openaiRes.ok) throw new Error(data.error?.message || 'OpenAI error');

        const reply = data.choices?.[0]?.message?.content || "I had trouble with that — try rephrasing!";
        res.json({ reply });
    } catch (err) {
        console.error('GCR chat error:', err.message);
        res.status(500).json({ error: 'AI error', reply: "Something went wrong — try again!" });
    }
});


// ============================================
// GET /api/public/waivers/:token — path-based alias
// ============================================
router.get('/waivers/:token', async (req, res) => {
    const token = req.params.token;
    const { data: waiver } = await supabase
        .from('waivers')
        .select('id, waiver_text, customer_name, booking_id, signed')
        .eq('token', token)
        .single();

    if (!waiver) return res.status(404).json({ error: 'Waiver link not found or expired' });
    if (waiver.signed) return res.status(410).json({ error: 'Waiver already signed' });

    let waiverText = waiver.waiver_text;
    if (!waiverText) {
        const { data: tmpl } = await supabase
            .from('waivers')
            .select('waiver_text')
            .eq('site_id', req.siteId)
            .is('booking_id', null)
            .limit(1)
            .single();
        waiverText = tmpl?.waiver_text || '';
    }

    res.json({ waiver_text: waiverText, customer_name: waiver.customer_name || '', booking_id: waiver.booking_id, token });
});

// POST /api/public/waivers/:token/sign
router.post('/waivers/:token/sign', async (req, res) => {
    const token = req.params.token;
    const { customer_name, customer_email, signature_data, waiver_text } = req.body;

    if (!customer_name || !signature_data) {
        return res.status(400).json({ error: 'Customer name and signature required' });
    }

    const { data: existing } = await supabase
        .from('waivers')
        .select('id, booking_id, signed')
        .eq('token', token)
        .single();

    if (!existing) return res.status(404).json({ error: 'Waiver link not found' });
    if (existing.signed) return res.status(410).json({ error: 'Waiver already signed' });

    const { data, error } = await supabase
        .from('waivers')
        .update({
            customer_name,
            customer_email: customer_email || null,
            signature_data,
            waiver_text: waiver_text || null,
            signed: true,
            signed_at: new Date().toISOString(),
            ip_address: req.ip
        })
        .eq('id', existing.id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    if (existing.booking_id) {
        await supabase.from('bookings').update({ waiver_signed: true }).eq('id', existing.booking_id);
    }

    res.json({ success: true, waiver_id: data.id });
});

// ============================================
// GET /api/public/waiver — Fetch waiver to sign
// Supports ?token=X (from dashboard link) or falls back to template
// ============================================
router.get('/waiver', async (req, res) => {
    const { token } = req.query;

    // Token-based lookup: link was generated for a specific booking
    if (token) {
        const { data: waiver } = await supabase
            .from('waivers')
            .select('id, waiver_text, customer_name, booking_id, signed')
            .eq('token', token)
            .single();

        if (!waiver) return res.status(404).json({ error: 'Waiver link not found or expired' });
        if (waiver.signed) return res.status(410).json({ error: 'Waiver already signed' });

        // Fetch the waiver template text if this record has none yet
        let waiverText = waiver.waiver_text;
        if (!waiverText) {
            const { data: tmpl } = await supabase
                .from('waivers')
                .select('waiver_text')
                .eq('site_id', req.siteId)
                .is('booking_id', null)
                .limit(1)
                .single();
            waiverText = tmpl?.waiver_text || '';
        }

        return res.json({
            waiver_text: waiverText,
            customer_name: waiver.customer_name || '',
            booking_id: waiver.booking_id,
            token
        });
    }

    // No token: return generic template for the business
    const { data } = await supabase
        .from('waivers')
        .select('id, waiver_text, customer_name, signed_at')
        .eq('site_id', req.siteId)
        .is('booking_id', null)
        .order('signed_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) return res.status(404).json({ error: 'No waiver template found' });
    res.json({ waiver_text: data.waiver_text, title: data.customer_name || 'Waiver' });
});

// ============================================
// POST /api/public/waiver — Sign waiver
// Body may include token (from link) or booking_id directly
// ============================================
router.post('/waiver', async (req, res) => {
    const { token, booking_id, customer_name, customer_email, signature_data, waiver_text } = req.body;

    if (!customer_name || !signature_data) {
        return res.status(400).json({ error: 'Customer name and signature required' });
    }

    // Token path: update the pre-created waiver record
    if (token) {
        const { data: existing } = await supabase
            .from('waivers')
            .select('id, booking_id, signed')
            .eq('token', token)
            .single();

        if (!existing) return res.status(404).json({ error: 'Waiver link not found' });
        if (existing.signed) return res.status(410).json({ error: 'Waiver already signed' });

        const { data, error } = await supabase
            .from('waivers')
            .update({
                customer_name,
                customer_email: customer_email || null,
                signature_data,
                waiver_text: waiver_text || null,
                signed: true,
                signed_at: new Date().toISOString(),
                ip_address: req.ip
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });

        if (existing.booking_id) {
            await supabase.from('bookings')
                .update({ waiver_signed: true })
                .eq('id', existing.booking_id);
        }

        return res.json({ success: true, waiver_id: data.id });
    }

    // Direct path: insert new waiver row
    const { data, error } = await supabase
        .from('waivers')
        .insert({
            site_id: req.siteId,
            booking_id: booking_id || null,
            customer_name,
            customer_email: customer_email || null,
            signature_data,
            waiver_text: waiver_text || null,
            signed: true,
            signed_at: new Date().toISOString(),
            ip_address: req.ip
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    if (booking_id) {
        await supabase.from('bookings')
            .update({ waiver_signed: true })
            .eq('id', booking_id)
            .eq('site_id', req.siteId);
    }

    res.status(201).json({ success: true, waiver_id: data.id });
});
// ============================================
// GET /api/public/waivers/:token — Alias for /waiver?token=:token
// ============================================
router.get('/waivers/:token', async (req, res) => {
    const { token } = req.params;
    
    // Redirect to query-based endpoint
    req.query.token = token;
    
    const { data: waiver } = await supabase
        .from('waivers')
        .select('id, waiver_text, customer_name, booking_id, signed')
        .eq('token', token)
        .single();

    if (!waiver) return res.status(404).json({ error: 'Waiver link not found or expired' });
    if (waiver.signed) return res.status(410).json({ error: 'Waiver already signed' });

    // Fetch the waiver template text if this record has none yet
    let waiverText = waiver.waiver_text;
    if (!waiverText) {
        const { data: tmpl } = await supabase
            .from('waivers')
            .select('waiver_text')
            .eq('site_id', req.siteId)
            .is('booking_id', null)
            .limit(1)
            .single();
        waiverText = tmpl?.waiver_text || '';
    }

    return res.json({
        waiver_text: waiverText,
        customer_name: waiver.customer_name || '',
        booking_id: waiver.booking_id,
        token
    });
});

// ============================================
// POST /api/public/waivers/:token/sign — Alias for POST /waiver with token in path
// ============================================
router.post('/waivers/:token/sign', async (req, res) => {
    const { token } = req.params;
    const { customer_name, customer_email, signature_data, waiver_text } = req.body;

    if (!customer_name || !signature_data) {
        return res.status(400).json({ error: 'Customer name and signature required' });
    }

    const { data: existing } = await supabase
        .from('waivers')
        .select('id, booking_id, signed')
        .eq('token', token)
        .single();

    if (!existing) return res.status(404).json({ error: 'Waiver link not found' });
    if (existing.signed) return res.status(410).json({ error: 'Waiver already signed' });

    const { data, error } = await supabase
        .from('waivers')
        .update({
            customer_name,
            customer_email: customer_email || null,
            signature_data,
            waiver_text: waiver_text || null,
            signed: true,
            signed_at: new Date().toISOString(),
            ip_address: req.ip
        })
        .eq('token', token)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    if (existing.booking_id) {
        await supabase.from('bookings')
            .update({ waiver_signed: true })
            .eq('id', existing.booking_id)
            .eq('site_id', req.siteId);
    }

    return res.json({ success: true, waiver_id: data.id });
});


// ============================================
// ============================================
// GET /api/public/reviews?token=X — Load review page data (booking + custom questions)
// ============================================
router.get('/reviews-by-token', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    // Find review request by token
    const { data: review } = await supabase
        .from('reviews')
        .select('id, site_id, booking_id, customer_name, customer_email')
        .eq('review_token', token)
        .eq('token_used', false)
        .single();

    if (!review) return res.status(404).json({ error: 'Invalid or expired review link' });

    // Get booking details
    const { data: booking } = await supabase
        .from('bookings')
        .select('id, booking_date, booking_time, party_size, total, notes')
        .eq('id', review.booking_id)
        .single();

    // Get custom review questions for this business
    const { data: questions } = await supabase
        .from('review_questions')
        .select('id, question_text, question_type, display_order')
        .eq('site_id', review.site_id)
        .eq('enabled', true)
        .order('display_order', { ascending: true });

    res.json({
        review_id: review.id,
        booking: booking ? {
            date: booking.booking_date,
            time: booking.booking_time,
            guests: booking.party_size,
            service: booking.notes
        } : null,
        questions: questions || []
    });
});

// ============================================
// POST /api/public/reviews/submit — submit a review (simplified path)
// ============================================
router.post('/reviews/submit', async (req, res) => {
    const { token, rating, review_text, customer_name, customer_email } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    if (token) {
        const { data: review } = await supabase
            .from('reviews')
            .select('id')
            .eq('review_token', token)
            .eq('token_used', false)
            .single();

        if (!review) return res.status(400).json({ error: 'Invalid or expired review link' });

        const { error } = await supabase
            .from('reviews')
            .update({ rating, text: review_text, status: 'pending', token_used: true, submitted_at: new Date().toISOString() })
            .eq('id', review.id);

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    const siteId = req.siteId;
    if (!siteId) return res.status(400).json({ error: 'subdomain required' });

    const { error } = await supabase.from('reviews').insert({
        site_id: siteId,
        customer_name: customer_name || 'Anonymous',
        customer_email: customer_email || null,
        rating,
        text: review_text,
        status: 'pending',
        submitted_at: new Date().toISOString()
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ============================================
// POST /api/public/review — Submit review (with token support & photo uploads)
// ============================================
router.post('/review', async (req, res) => {
    const { token, rating, review_text, review_method } = req.body;
    let reviewId, siteId, bookingId, customerName, customerEmail, customerPhone, ownerPhone;
    const uploadedPhotos = [];

    // If token provided: verify & load review metadata
    if (token) {
        const { data: review } = await supabase
            .from('reviews')
            .select('id, site_id, booking_id, customer_name, customer_email, phone')
            .eq('review_token', token)
            .eq('token_used', false)
            .single();

        if (!review) return res.status(400).json({ error: 'Invalid or expired review link' });

        reviewId = review.id;
        siteId = review.site_id;
        bookingId = review.booking_id;
        customerName = review.customer_name;
        customerEmail = review.customer_email;
        customerPhone = review.phone;
    } else {
        customerName = req.body.customer_name || 'Anonymous';
        customerEmail = req.body.customer_email || null;
        siteId = req.siteId;
    }

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    // Get owner phone for SMS notification
    try {
        const { data: content } = await supabase
            .from('site_content')
            .select('owner_phone')
            .eq('site_id', siteId)
            .single();
        ownerPhone = content?.owner_phone;
    } catch (e) {
        console.warn('Could not fetch owner phone:', e.message);
    }

    // Handle photo uploads
    if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
            try {
                const fileName = `${siteId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`;
                const { data, error: uploadErr } = await supabase.storage
                    .from('review-photos')
                    .upload(fileName, file.buffer, { contentType: file.mimetype });

                if (uploadErr) throw uploadErr;

                const { data: { publicUrl } } = supabase.storage
                    .from('review-photos')
                    .getPublicUrl(fileName);

                uploadedPhotos.push(publicUrl);
            } catch (e) {
                console.warn('Failed to upload photo:', e.message);
            }
        }
    }

    // If token-based, update existing review; otherwise insert new
    let error, newReviewId;
    if (token && reviewId) {
        // Update review with token
        const { error: updateErr } = await supabase
            .from('reviews')
            .update({
                rating,
                text: review_text,
                review_method: review_method || 'text',
                original_voice_text: review_method === 'voice' ? review_text : null,
                photos: uploadedPhotos,
                status: 'pending',
                token_used: true,
                submitted_at: new Date().toISOString()
            })
            .eq('id', reviewId);
        error = updateErr;
        newReviewId = reviewId;
    } else {
        // Insert new review
        const { data: inserted, error: insertErr } = await supabase
            .from('reviews')
            .insert({
                site_id: siteId,
                customer_name: customerName,
                customer_email: customerEmail,
                phone: customerPhone,
                rating,
                text: review_text,
                review_method: review_method || 'text',
                original_voice_text: review_method === 'voice' ? review_text : null,
                photos: uploadedPhotos,
                booking_id: bookingId || null,
                status: 'pending',
                submitted_at: new Date().toISOString()
            })
            .select();
        error = insertErr;
        if (inserted && inserted.length > 0) {
            newReviewId = inserted[0].id;
        }
    }

    if (error) return res.status(500).json({ error: error.message });

    // Store custom question answers (parse from FormData)
    const questionAnswers = [];
    for (const key in req.body) {
        if (key.startsWith('question_')) {
            const qId = key.replace('question_', '');
            questionAnswers.push({
                review_id: newReviewId,
                question_id: qId,
                answer: String(req.body[key])
            });
        }
    }

    if (questionAnswers.length > 0) {
        await supabase.from('review_answers').insert(questionAnswers).catch(e => {
            console.warn('Could not store question answers:', e.message);
        });
    }

    // Send SMS to owner if they have a phone number (non-blocking)
    if (ownerPhone && process.env.TWILIO_ACCOUNT_SID) {
        try {
            const smsBody = `New review from ${customerName}! ⭐${rating} ${uploadedPhotos.length > 0 ? '+ photos' : ''} — Check dashboard to approve.`;
            // TODO: Use internal SMS service or queue to avoid blocking response
            // For now, fire-and-forget to Twilio (production should use async job queue)
            sendSmsAsync(ownerPhone, smsBody).catch(e => console.warn('SMS send failed:', e.message));
        } catch (e) {
            console.warn('Could not send owner SMS:', e.message);
        }
    }

    res.status(201).json({ success: true, message: 'Thank you! Your review has been submitted.' });
});

// ============================================
// GET /api/public/loyalty/balance — Check loyalty balance by email or phone
// MUST be before /loyalty/:email to prevent route collision
// ============================================
router.get('/loyalty/balance', async (req, res) => {
    const { email, phone } = req.query;
    if (!email && !phone) return res.status(400).json({ error: 'email or phone query param required' });

    let query = supabase
        .from('customers')
        .select('name, total_bookings, total_spent, tags')
        .eq('site_id', req.siteId);

    if (email) query = query.eq('email', email);
    else query = query.eq('phone', phone);

    const { data: customer } = await query.maybeSingle();

    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
        name: customer.name,
        total_bookings: customer.total_bookings,
        total_spent: customer.total_spent,
        points: Math.floor(customer.total_spent || 0)
    });
});

// ============================================
// GET /api/public/loyalty/:email — Check loyalty points (legacy)
// ============================================
router.get('/loyalty/:email', async (req, res) => {
    const { data: customer } = await supabase
        .from('customers')
        .select('name, total_bookings, total_spent, tags')
        .eq('site_id', req.siteId)
        .eq('email', req.params.email)
        .single();

    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
        name: customer.name,
        total_bookings: customer.total_bookings,
        total_spent: customer.total_spent,
        points: Math.floor(customer.total_spent || 0)
    });
});

// ============================================
// POST /api/public/order — Place order (restaurants)
// ============================================
router.post('/order', async (req, res) => {
    const { items, customer_name, customer_phone, customer_email, notes, pickup_time, order_type } = req.body;

    if (!items || !items.length) {
        return res.status(400).json({ error: 'Items required' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * (item.qty || 1)), 0);
    const tax = Math.round(subtotal * 0.1 * 100) / 100; // 10% tax placeholder
    const total = subtotal + tax;

    const { data, error } = await supabase
        .from('orders')
        .insert({
            site_id: req.siteId,
            items,
            subtotal,
            tax,
            total,
            customer_name,
            customer_phone,
            customer_email,
            notes,
            pickup_time,
            order_type: order_type || 'pickup',
            status: 'pending'
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // TODO: Emit event: order.created
    res.status(201).json(data);
});



// ============================================
// POST /api/public/loyalty/signup — Enroll customer in loyalty program
// ============================================
router.post('/loyalty/signup', async (req, res) => {
    const { email, name, phone } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    const { data: existing } = await supabase
        .from('customers')
        .select('id, name, email, total_bookings, total_spent')
        .eq('site_id', req.siteId)
        .eq('email', email)
        .single();

    if (existing) {
        return res.json({
            success: true,
            message: 'Already enrolled',
            customer_id: existing.id,
            points: Math.floor(existing.total_spent || 0)
        });
    }

    const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
            site_id: req.siteId,
            name: name || null,
            email: email,
            phone: phone || null,
            total_bookings: 0,
            total_spent: 0,
            tags: ['loyalty']
        })
        .select('id')
        .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
        success: true,
        message: 'Enrolled in loyalty program',
        customer_id: newCustomer.id,
        points: 0
    });
});

// ============================================
// POST /api/public/loyalty/redeem — Redeem loyalty points
// ============================================
router.post('/loyalty/redeem', async (req, res) => {
    const { email, points_to_redeem } = req.body;

    if (!email || !points_to_redeem) {
        return res.status(400).json({ error: 'email and points_to_redeem required' });
    }

    const { data: customer } = await supabase
        .from('customers')
        .select('id, name, total_spent')
        .eq('site_id', req.siteId)
        .eq('email', email)
        .single();

    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }

    const available = Math.floor(customer.total_spent || 0);
    if (points_to_redeem > available) {
        return res.status(400).json({
            error: 'Insufficient points',
            available: available,
            requested: points_to_redeem
        });
    }

    res.json({
        success: true,
        points_redeemed: points_to_redeem,
        points_remaining: available - points_to_redeem,
        discount_value: points_to_redeem * 0.10
    });
});

// ============================================
// GET /api/public/site-data — Business info for website header/footer
// ============================================
router.get('/site-data', async (req, res) => {
    const { data: content } = await supabase
        .from('site_content')
        .select('hero_text, hero_subtext, contact_phone, contact_email, address, city, state, zip, hours, social_links, logo_url, cover_url, theme_color, seo_title, seo_description')
        .eq('site_id', req.siteId)
        .single();

    const { data: business } = await supabase
        .from('businesses')
        .select('name, type, subdomain')
        .eq('site_id', req.siteId)
        .single();

    res.json({ ...business, ...content });
});

// ============================================
// GET /api/public/locations — Launch locations
// ============================================
router.get('/locations', async (req, res) => {
    const { data: content } = await supabase
        .from('site_content')
        .select('address, city, state, zip, lat, lng')
        .eq('site_id', req.siteId)
        .single();

    // Return as an array of locations (single location for now; multi-location support planned)
    res.json([{
        id: 'main',
        name: 'Main Launch',
        address: content?.address || '',
        city: content?.city || '',
        state: content?.state || '',
        zip: content?.zip || '',
        lat: content?.lat || null,
        lng: content?.lng || null,
        is_default: true
    }]);
});

// ============================================
// GET /api/public/docks — Towable dock add-ons
// ============================================
router.get('/docks', async (req, res) => {
    const { data } = await supabase
        .from('rental_addons')
        .select('id, name, description, price, icon, per_unit')
        .eq('site_id', req.siteId)
        .eq('active', true)
        .ilike('category', '%dock%')
        .order('price', { ascending: true });

    res.json(data || []);
});

// ============================================
// GET /api/public/links-page — Linktree-style links page data
// ============================================
router.get('/links-page', async (req, res) => {
    const { data: content } = await supabase
        .from('site_content')
        .select('social_links, logo_url, hero_text, contact_phone, contact_email')
        .eq('site_id', req.siteId)
        .single();

    const { data: business } = await supabase
        .from('businesses')
        .select('name, subdomain')
        .eq('site_id', req.siteId)
        .single();

    res.json({
        name: business?.name || '',
        subdomain: business?.subdomain || '',
        logo_url: content?.logo_url || '',
        tagline: content?.hero_text || '',
        phone: content?.contact_phone || '',
        email: content?.contact_email || '',
        social: content?.social_links || {}
    });
});

// ============================================
// GET /api/public/addons
// ============================================
router.get('/addons', async (req, res) => {
    const { data, error } = await supabase
        .from('rental_addons')
        .select('id, name, description, price, category, icon, per_unit, image_url')
        .eq('site_id', req.siteId)
        .order('category')
        .order('name');

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// ============================================
// POST /api/public/save-section — Save a CMS section (page builder)
// ============================================
router.post('/save-section', async (req, res) => {
    const { section, data } = req.body;
    if (!section || !data) return res.status(400).json({ error: 'section and data required' });

    const updateMap = {
        hero:    { hero_text: data.title, hero_subtext: data.subtitle },
        contact: { contact_phone: data.phone, contact_email: data.email, address: data.address },
        hours:   { hours: typeof data === 'string' ? data : JSON.stringify(data) }
    };

    const updateData = updateMap[section];
    if (!updateData) return res.status(400).json({ error: 'Unknown section: ' + section });

    const { error } = await supabase
        .from('site_content')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('site_id', req.siteId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;

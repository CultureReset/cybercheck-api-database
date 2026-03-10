const express = require('express');
const supabase = require('../db');

const router = express.Router();

// All public routes need a site_id from domain resolution middleware
// If no site_id, the request needs a ?subdomain= param as fallback
function requireSite(req, res, next) {
    if (!req.siteId && req.query.subdomain) {
        // Fallback: look up by subdomain query param
        supabase
            .from('businesses')
            .select('site_id, name, type, status')
            .eq('subdomain', req.query.subdomain)
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

    res.json({ ...business, ...content });
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
    (bookings || []).forEach(b => {
        const key = `${b.fleet_type_id}_${b.time_slot_id}`;
        booked[key] = (booked[key] || 0) + (b.qty || 1);
    });

    // Add holds to booked count
    (holds || []).forEach(h => {
        const key = `${h.fleet_type_id}_${h.time_slot_id}`;
        booked[key] = (booked[key] || 0) + (h.qty || 1);
    });

    // Check blocked dates
    const { data: blocked } = await supabase
        .from('availability')
        .select('service_id, blocked')
        .eq('site_id', req.siteId)
        .eq('specific_date', date)
        .eq('blocked', true);

    const blockedSet = new Set((blocked || []).map(b => b.service_id));

    const availability = [];
    (fleetTypes || []).forEach(ft => {
        (timeSlots || []).forEach(ts => {
            const key = `${ft.id}_${ts.id}`;
            const total = inventory[ft.id] || 0;
            const used = booked[key] || 0;
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
                blocked: blockedSet.has(ft.id)
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

    if (!fleet_type_id || !time_slot_id || !booking_date || !session_id) {
        return res.status(400).json({ error: 'fleet_type_id, time_slot_id, booking_date, and session_id required' });
    }

    const { data, error } = await supabase.rpc('create_booking_hold', {
        p_site_id: req.siteId,
        p_fleet_type_id: fleet_type_id,
        p_time_slot_id: time_slot_id,
        p_booking_date: booking_date,
        p_qty: qty || 1,
        p_session_id: session_id
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

    // Upsert customer
    let customerId = null;
    if (booking.customer_email) {
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('site_id', req.siteId)
            .eq('email', booking.customer_email)
            .single();

        if (existingCustomer) {
            customerId = existingCustomer.id;
            await supabase.rpc('increment_customer_bookings', {
                customer_uuid: existingCustomer.id,
                amount: booking.total || 0
            }).catch(() => {});
        } else {
            const { data: newCustomer } = await supabase
                .from('customers')
                .insert({
                    site_id: req.siteId,
                    name: booking.customer_name,
                    phone: booking.customer_phone,
                    email: booking.customer_email,
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
        // ATOMIC: check availability + insert in one transaction (prevents overbooking)
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
            error = rpcError;
        } else if (!result.success) {
            return res.status(409).json({ error: result.error, available: result.available });
        } else {
            // Fetch the full booking record
            const { data: fullBooking } = await supabase
                .from('bookings')
                .select()
                .eq('id', result.booking_id)
                .single();
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

    // Send booking confirmation SMS (non-blocking — don't fail the booking if SMS fails)
    try {
        const { sendSms, fillTemplate, buildTemplateData } = require('../utils/sms');

        // Get messaging settings + owner phone for this business
        const { data: siteContent } = await supabase
            .from('site_content')
            .select('messaging_settings, contact_phone')
            .eq('site_id', req.siteId)
            .single();

        const settings = siteContent?.messaging_settings || {};
        const templateData = await buildTemplateData(data, req.siteId);

        // SMS to customer
        if (settings.notifyCustomerOnBooking !== false && data.customer_phone) {
            const defaultCustomerTpl = '[{{business_name}}] Hi {{customer_name}}! Your booking is confirmed.\n\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\n\nQuestions? Reply to this number!';
            const customerMsg = fillTemplate(settings.customerBookingTemplate || defaultCustomerTpl, templateData);
            sendSms(data.customer_phone, customerMsg, req.siteId, 'booking_confirmation', data.id)
                .catch(err => console.error('Customer SMS failed:', err));
        }

        // SMS to business owner
        if (settings.notifyOwnerOnBooking !== false && siteContent?.contact_phone) {
            const defaultOwnerTpl = 'NEW BOOKING!\n\nCustomer: {{customer_name}}\nPhone: {{customer_phone}}\nDate: {{date}}\nTime: {{time_slot}}\nTotal: ${{total}}\nPayment: {{payment_status}}';
            const ownerMsg = fillTemplate(settings.ownerBookingTemplate || defaultOwnerTpl, templateData);
            sendSms(siteContent.contact_phone, ownerMsg, req.siteId, 'booking_owner_notify', data.id)
                .catch(err => console.error('Owner SMS failed:', err));
        }
    } catch (smsErr) {
        console.error('SMS notification error:', smsErr);
    }

    // TODO: Emit event: booking.created (for future event bus)
    res.status(201).json(data);
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
// POST /api/public/chat — AI chatbot message
// ============================================
router.post('/chat', async (req, res) => {
    const { message, conversation_id } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    // TODO: Implement AI chat with business context
    // For now, return a placeholder
    res.json({
        reply: "Thanks for your message! I'm being set up to help answer questions about this business. Please try again soon or contact us directly.",
        conversation_id: conversation_id || crypto.randomUUID()
    });
});

// ============================================
// POST /api/public/waiver — Sign waiver
// ============================================
router.post('/waiver', async (req, res) => {
    const { booking_id, customer_name, customer_email, signature_data, waiver_text } = req.body;

    if (!customer_name || !signature_data) {
        return res.status(400).json({ error: 'Customer name and signature required' });
    }

    const { data, error } = await supabase
        .from('waivers')
        .insert({
            site_id: req.siteId,
            booking_id,
            customer_name,
            customer_email,
            signature_data,
            waiver_text,
            ip_address: req.ip
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Update booking waiver status
    if (booking_id) {
        await supabase
            .from('bookings')
            .update({ waiver_signed: true })
            .eq('id', booking_id)
            .eq('site_id', req.siteId);
    }

    // TODO: Emit event: waiver.signed
    res.status(201).json(data);
});

// ============================================
// POST /api/public/review — Submit review
// ============================================
router.post('/review', async (req, res) => {
    const { customer_name, customer_email, rating, text, photos, booking_id } = req.body;

    if (!customer_name || !rating) {
        return res.status(400).json({ error: 'Name and rating required' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    const { data, error } = await supabase
        .from('reviews')
        .insert({
            site_id: req.siteId,
            customer_name,
            customer_email,
            rating,
            text,
            photos: photos || [],
            booking_id,
            status: 'pending'
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // TODO: Emit event: review.submitted
    res.status(201).json({ success: true, message: 'Review submitted for approval!' });
});

// ============================================
// GET /api/public/loyalty/:email — Check loyalty points
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

    // TODO: Pull from loyalty_points table when it exists
    res.json({
        name: customer.name,
        total_bookings: customer.total_bookings,
        total_spent: customer.total_spent,
        points: Math.floor(customer.total_spent || 0) // 1 point per dollar for now
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

module.exports = router;

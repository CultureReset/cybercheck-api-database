const supabase = require('../db');

// Resolve incoming domain to a site_id
async function resolveDomain(req, res, next) {
    const host = req.hostname;

    // Skip for main platform domain
    if (host === 'localhost' || host === 'cybercheck.com' || host === 'www.cybercheck.com') {
        return next();
    }

    // Check if this is a subdomain (e.g. maggies-bakery.cybercheck.com)
    const subdomainMatch = host.match(/^([^.]+)\.cybercheck\.com$/);

    let query;
    if (subdomainMatch) {
        query = supabase.from('businesses').select('site_id, name, type, status').eq('subdomain', subdomainMatch[1]).single();
    } else {
        // Custom domain (e.g. joesseafood.com)
        query = supabase.from('businesses').select('site_id, name, type, status').eq('domain', host).single();
    }

    const { data, error } = await query;

    if (error || !data) {
        return next(); // No site found for this domain, continue to 404
    }

    if (data.status !== 'active') {
        return res.status(503).send('Site is currently unavailable');
    }

    req.siteId = data.site_id;
    req.siteName = data.name;
    req.siteType = data.type;
    next();
}

module.exports = { resolveDomain };

const supabase = require('./db');

const PLATFORM_HOSTS = new Set([
    'localhost', 'cybercheck.com', 'www.cybercheck.com',
    'cybercheck-api-database.vercel.app'
]);

// Resolve a hostname string to a business record
async function lookupHost(host) {
    if (!host || PLATFORM_HOSTS.has(host)) return null;

    const subdomainMatch = host.match(/^([^.]+)\.cybercheck\.com$/);
    if (subdomainMatch) {
        const { data } = await supabase.from('businesses').select('site_id, name, type, status').eq('subdomain', subdomainMatch[1]).single();
        return data || null;
    }

    // Custom domain (e.g. beachsidecircleboats.com)
    const { data } = await supabase.from('businesses').select('site_id, name, type, status').eq('domain', host).single();
    return data || null;
}

// Resolve incoming domain to a site_id
async function resolveDomain(req, res, next) {
    // 1. Try the request hostname first
    let data = await lookupHost(req.hostname);

    // 2. Fall back to Origin header — handles frontends calling the API from a custom domain
    //    e.g. beachsidecircleboats.com frontend calling cybercheck-api-database.vercel.app
    if (!data) {
        const origin = req.headers.origin;
        if (origin) {
            try {
                const originHost = new URL(origin).hostname;
                data = await lookupHost(originHost);
            } catch (_) {}
        }
    }

    if (!data) {
        return next(); // No site found — requireSite will handle the 404
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

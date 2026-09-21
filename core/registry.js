/**
 * CyberCheck Module Registry
 *
 * Each tool/module is a self-contained lego block: one folder under modules/
 * with an index.js that declares what it is and self-registers here.
 *
 *   {
 *     id, name, version, description, icon,
 *     mountPath,      // '/api/charter'  (or use `mounts` for several)
 *     mounts,         // [{ path, router }] when one module answers on 2+ paths
 *     router,         // the express router
 *     middleware,     // [fn] run before the router on every mount
 *     preBodyParser,  // true = mount before express.json() (raw body needed)
 *     enabled,        // false = registered and listed, but not mounted
 *     accessLevel,    // 'admin' | 'client' | 'public'
 *     requiredCore,   // ['db','auth','sms'] — which core/ services it needs
 *     requiredEnv,    // ['STRIPE_SECRET_KEY']
 *     ownsTables,     // tables that travel with the module
 *     sharedTables,   // tables it reads but does not own (the coupling)
 *     migrations,     // path to its schema, if it ships one
 *     panelId,        // dashboard tab id, or null
 *     grokTools,      // AI tool definitions this module contributes
 *   }
 *
 * server.js calls mountAll(app) twice: once with { preBodyParser: true } before
 * express.json(), once for everything else. Registration order is mount order.
 *
 * Access levels:
 *   'admin'  — platform owner only
 *   'client' — business owners (your clients) can access
 *   'public' — any authenticated user
 */

const _registry = [];

function register(mod) {
    if (!mod.id) throw new Error('Module missing id');
    if (_registry.find(m => m.id === mod.id)) return; // already registered
    if (!mod.router && !(mod.mounts && mod.mounts.length)) {
        throw new Error(`Module ${mod.id} has neither router nor mounts`);
    }
    _registry.push(mod);
    return mod;
}

/** Every mount point a module asks for, normalized to [{ path, router }]. */
function mountsOf(mod) {
    if (mod.mounts && mod.mounts.length) {
        return mod.mounts.map(m => ({ path: m.path, router: m.router || mod.router }));
    }
    return mod.mountPath ? [{ path: mod.mountPath, router: mod.router }] : [];
}

/**
 * @param {object} app      express app
 * @param {object} [opts]
 * @param {boolean} [opts.preBodyParser] mount only the modules that need the raw
 *                                       body (true) or only the rest (false/undefined)
 */
function mountAll(app, opts = {}) {
    const wantPre = !!opts.preBodyParser;
    const mounted = [];
    _registry.forEach(mod => {
        if (mod.enabled === false) return;
        if (!!mod.preBodyParser !== wantPre) return;
        mountsOf(mod).forEach(({ path, router }) => {
            if (!router) return;
            const chain = [path, ...(mod.middleware || []), router];
            app.use(...chain);
            mounted.push(`${mod.id} → ${path}`);
        });
    });
    if (mounted.length) {
        console.log(`[modules] mounted ${mounted.length} path(s)${wantPre ? ' (pre-body-parser)' : ''}: ${mounted.join(', ')}`);
    }
    return mounted;
}

function getGrokTools(accessLevel = 'admin') {
    return _registry.flatMap(mod => {
        if (mod.enabled === false) return [];
        const tools = mod.grokTools || [];
        // Filter tools by access level — admin sees all, client sees client+public
        if (accessLevel === 'admin') return tools;
        return tools.filter(t => (t.accessLevel || 'admin') !== 'admin');
    });
}

function getManifest() {
    return _registry.map(mod => ({
        id: mod.id,
        name: mod.name,
        version: mod.version || '1.0.0',
        description: mod.description || '',
        icon: mod.icon || '🔧',
        accessLevel: mod.accessLevel || 'admin',
        mountPaths: mountsOf(mod).map(m => m.path),
        routeCount: mod.routeCount || null,
        requiredCore: mod.requiredCore || [],
        requiredEnv: (mod.requiredEnv || []).map(key => ({
            key,
            configured: !!process.env[key],
        })),
        ownsTables: mod.ownsTables || [],
        sharedTables: mod.sharedTables || [],
        migrations: mod.migrations || null,
        panelId: mod.panelId || null,
        toolCount: (mod.grokTools || []).length,
        enabled: mod.enabled !== false,
    }));
}

function getById(id) {
    return _registry.find(m => m.id === id) || null;
}

function all() {
    return _registry.slice();
}

module.exports = { register, mountAll, getGrokTools, getManifest, getById, all, mountsOf };

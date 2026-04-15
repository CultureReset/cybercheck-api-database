/**
 * CyberCheck Module Registry
 *
 * Each tool/module is a self-contained lego block that exports:
 *   { id, name, version, description, mountPath, router, tools, panel, requiredEnv, accessLevel }
 *
 * Modules auto-register here. server.js calls mountAll() once.
 * The Grok agent calls getGrokTools() to get all available tool definitions.
 * The dashboard API serves getManifest() to show what's installed.
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
    _registry.push(mod);
    console.log(`[modules] registered: ${mod.id}`);
}

function mountAll(app) {
    _registry.forEach(mod => {
        if (mod.router && mod.mountPath) {
            app.use(mod.mountPath, mod.router);
            console.log(`[modules] mounted ${mod.id} at ${mod.mountPath}`);
        }
    });
}

function getGrokTools(accessLevel = 'admin') {
    return _registry.flatMap(mod => {
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
        mountPath: mod.mountPath,
        requiredEnv: (mod.requiredEnv || []).map(key => ({
            key,
            configured: !!process.env[key],
        })),
        panelId: mod.panelId || null,
        enabled: true,
    }));
}

function getById(id) {
    return _registry.find(m => m.id === id) || null;
}

module.exports = { register, mountAll, getGrokTools, getManifest, getById };

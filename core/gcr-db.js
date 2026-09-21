const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getGcrDb() {
    if (!_client) {
        const url = process.env.GCR_SUPABASE_URL;
        const key = process.env.GCR_SUPABASE_KEY;
        if (!url || !key) throw new Error('GCR_SUPABASE_URL and GCR_SUPABASE_KEY env vars not set');
        _client = createClient(url, key);
    }
    return _client;
}

module.exports = getGcrDb;

// Compatibility shim — the client now lives in core/gcr-db.js.
// Kept so standalone scripts in agents/ and scripts/ keep working.
module.exports = require('./core/gcr-db');

// Compatibility shim — the client now lives in core/db.js.
// Kept so standalone scripts in agents/ and scripts/ keep working.
module.exports = require('./core/db');

const Database = require('better-sqlite3');
const db = new Database('./dsdst_panel.db');
const table = db.prepare("PRAGMA table_info(api_keys)").all();
console.log("API_KEYS", table);
const table2 = db.prepare("PRAGMA table_info(panel_api_keys)").all();
console.log("PANEL_API_KEYS", table2);

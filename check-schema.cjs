const Database = require('better-sqlite3');
const db = new Database('./database.sqlite');
const table = db.prepare("PRAGMA table_info(api_keys)").all();
console.log(table);

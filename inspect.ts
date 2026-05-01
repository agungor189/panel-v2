import Database from 'better-sqlite3';
const db = new Database('dsdst_panel.db');
const columns = db.pragma('table_info(products)');
console.log(JSON.stringify(columns, null, 2));

import Database from 'better-sqlite3';
const db = new Database('dsdst_panel.db');
const products = db.prepare('SELECT id, name, purchase_price_usd, purchase_cost, sale_price FROM products LIMIT 5').all();
console.log(JSON.stringify(products, null, 2));

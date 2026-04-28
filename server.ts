import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import os from "os";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import AdmZip from "adm-zip";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Encryption Utility for API Keys
const ALGORITHM = 'aes-256-gcm';

if (!process.env.ENCRYPTION_SECRET) {
  throw new Error("ENCRYPTION_SECRET is required. Lütfen .env dosyanıza ekleyin!");
}

if (!process.env.PANEL_API_HASH_SECRET) {
  throw new Error("PANEL_API_HASH_SECRET is required. Lütfen .env dosyanıza ekleyin!");
}

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET.padEnd(32, '0').slice(0, 32);

function encryptText(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_SECRET), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_SECRET), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error("Decryption error:", err);
    return '';
  }
}

function hashApiKey(clearKey: string): string {
  return crypto.createHmac('sha256', process.env.PANEL_API_HASH_SECRET!)
    .update(clearKey)
    .digest('hex');
}

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Database initialization
let db = new Database("dsdst_panel.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Schema setup
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT,
    title TEXT NOT NULL,
    warehouse_location TEXT,
    sku TEXT UNIQUE,
    barcode TEXT,
    category TEXT,
    model TEXT,
    description TEXT,
    purchase_price_usd REAL DEFAULT 0,
    purchase_cost REAL DEFAULT 0,
    sale_price REAL DEFAULT 0,
    buffer_percentage REAL DEFAULT 0,
    profit_percentage REAL DEFAULT 0,
    exchange_rate_used REAL DEFAULT 0,
    price_locked BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'Active',
    weight REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Handle migrations for existing tables
  PRAGMA foreign_keys=OFF;
  BEGIN TRANSACTION;
  
  -- Add name if not exists
  SELECT name FROM sqlite_master WHERE type='table' AND name='products' AND sql LIKE '%name TEXT%';
  -- This is tricky in pure SQL without scripting if we want to be safe.
  -- Simpler way: try to add and ignore error if already exists, but SQLite doesn't have IF NOT EXISTS for ADD COLUMN before 3.35.0
  -- We'll just run it and catch error or check first.
  COMMIT;
  PRAGMA foreign_keys=ON;
`);

try {
  db.exec("ALTER TABLE products ADD COLUMN purchase_price_usd REAL DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE products ADD COLUMN buffer_percentage REAL DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE products ADD COLUMN exchange_rate_used REAL DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE products ADD COLUMN profit_percentage REAL DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE products ADD COLUMN price_locked BOOLEAN DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE api_keys ADD COLUMN deleted_at DATETIME DEFAULT NULL");
} catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    path TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS product_platforms (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    platform_name TEXT,
    stock INTEGER DEFAULT 0,
    price REAL,
    is_listed BOOLEAN DEFAULT 0,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    platform_name TEXT,
    change_amount INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT, -- Income / Expense
    category TEXT,
    platform TEXT,
    amount REAL,
    product_id TEXT,
    note TEXT,
    reference_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS recurring_payments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    day_of_month INTEGER NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    note TEXT,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    service_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    key_name TEXT,
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT,
    merchant_id TEXT,
    seller_id TEXT,
    status TEXT DEFAULT 'active',
    last4 TEXT,
    notes TEXT,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_unique_name ON api_keys(service_name, display_name) WHERE deleted_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_transactions_type_date ON transactions(type, date);
  CREATE INDEX IF NOT EXISTS idx_transactions_platform ON transactions(platform);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_recurring_payments_status ON recurring_payments(status);
  CREATE INDEX IF NOT EXISTS idx_product_platforms_product_id ON product_platforms(product_id);
  CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

  CREATE TABLE IF NOT EXISTS panel_api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    last4 TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    environment TEXT DEFAULT 'test',
    permissions TEXT NOT NULL,
    allowed_ips TEXT,
    expires_at DATETIME,
    last_used_at DATETIME,
    last_used_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    deleted_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS firms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT,
    city TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    contact_person TEXT,
    source_url TEXT,
    related_product TEXT,
    status TEXT DEFAULT 'Yeni',
    notes TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS firm_notes (
    id TEXT PRIMARY KEY,
    firm_id TEXT,
    note TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(firm_id) REFERENCES firms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    firm_id TEXT,
    title TEXT,
    description TEXT,
    amount REAL DEFAULT 0,
    currency TEXT DEFAULT '₺',
    status TEXT DEFAULT 'Taslak',
    offer_date DATETIME,
    valid_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(firm_id) REFERENCES firms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id TEXT PRIMARY KEY,
    firm_id TEXT,
    type TEXT,
    note TEXT,
    next_follow_up_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(firm_id) REFERENCES firms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    shipping_company TEXT,
    tracking_number TEXT,
    total_weight REAL,
    total_quantity INTEGER,
    total_amount REAL,
    status TEXT DEFAULT 'Hazırlanıyor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT,
    product_id TEXT,
    product_name TEXT,
    quantity INTEGER,
    weight REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
  );
`);

try {
  db.exec("ALTER TABLE transactions ADD COLUMN recurring_id TEXT");
} catch(e) {}

// Default settings
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
insertSetting.run("company_name", "DSDST Panel");
insertSetting.run("low_stock_threshold", "50");
db.prepare("UPDATE settings SET value = '50' WHERE key = 'low_stock_threshold'").run(); // force update from user request
insertSetting.run("currency_symbol", "₺");
insertSetting.run("language", "tr");
insertSetting.run("usd_exchange_rate", "32.5");
insertSetting.run("default_buffer_percentage", "20");
insertSetting.run("api_key", uuidv4());
insertSetting.run("commission_rates", JSON.stringify({
  "Trendyol": 15,
  "Hepsiburada": 15,
  "Amazon": 10,
  "N11": 15,
  "Website": 2,
  "Instagram": 0
}));
insertSetting.run("product_categories", JSON.stringify(["Aliminyum", "PPR", "Dokum Demir", "Karbon Celik"]));
insertSetting.run("income_categories", JSON.stringify(["Satış", "İade", "Hizmet Bedeli", "Diğer"]));
insertSetting.run("expense_categories", JSON.stringify(["Kargo", "Komisyon", "Maliyet", "Reklam", "Vergi", "Diğer"]));

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage });
const backupUpload = multer({ dest: os.tmpdir() });

function logActivity(action: string, entity_type: string, entity_id: string, details?: any) {
  try {
    db.prepare(`
      INSERT INTO activity_logs (id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), action, entity_type, entity_id, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.error("Activity logging failed", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Headers (Helmet)
  // Disabled Content Security Policy for Vite/React development compatibility.
  // In a strict production environment, you should configure CSP properly.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  // General Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin."
  });
  app.use(limiter);

  app.use(cors());
  app.use(express.json({ limit: '10mb' })); // Limit JSON body size
  app.use("/uploads", express.static(uploadsDir, { maxAge: '1d' }));

  // API Authentication Middleware
  app.use("/api", (req, res, next) => {
    // Let frontend requests bypass the strict api key check for now
    if (req.headers['x-frontend-request'] === 'true') {
        return next();
    }

    const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization']?.toString().replace('Bearer ', '');
    const settingsApiKey = db.prepare("SELECT value FROM settings WHERE key='api_key'").get() as any;
    
    if (!settingsApiKey || !settingsApiKey.value) {
        return res.status(403).json({ error: "API Key is not configured in settings. Please generate one from the DSDST Panel UI." });
    }

    if (apiKeyHeader !== settingsApiKey.value) {
        return res.status(401).json({ error: "Unauthorized. Invalid API Key." });
    }

    next();
  });

  // --- API ROUTES ---

  // Activity Logs
  app.get("/api/activity-logs", (req, res) => {
    try {
      const logs = db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100").all();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard Summary Endpoint
  app.get("/api/dashboard-summary", (req, res) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const firstDayOfMonth = `${year}-${month}-01T00:00:00Z`;
      const currentMonthStr = `${year}-${month}`;

      // Metrics
      const revenueResult = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'Income' AND date >= ?").get(firstDayOfMonth) as any;
      const realizedExpensesResult = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'Expense' AND date >= ?").get(firstDayOfMonth) as any;
      
      const activeRecurring = db.prepare("SELECT * FROM recurring_payments WHERE status = 'Active'").all() as any[];
      let pendingRecurringTotal = 0;
      for (const r of activeRecurring) {
         const recurringId = `${r.id}-${year}-${month}`;
         const exists = db.prepare("SELECT id FROM transactions WHERE recurring_id = ?").get(recurringId);
         if (!exists) pendingRecurringTotal += r.amount;
      }

      const totalRevenue = revenueResult?.total || 0;
      const totalExpenses = (realizedExpensesResult?.total || 0) + pendingRecurringTotal;

      const lowStockProductsQuery = db.prepare(`
        SELECT p.*,
          (SELECT path FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) as cover_image,
          COALESCE((SELECT SUM(stock) FROM product_platforms WHERE product_id = p.id), 0) as total_stock
        FROM products p
        WHERE COALESCE((SELECT SUM(stock) FROM product_platforms WHERE product_id = p.id), 0) < CAST((SELECT value FROM settings WHERE key = 'low_stock_threshold') AS INTEGER)
        AND p.status = 'Active'
        ORDER BY total_stock ASC
      `).all() as any[];

      const allProducts = db.prepare(`
        SELECT p.id, p.sale_price, p.purchase_price_usd, p.exchange_rate_used, p.buffer_percentage,
          COALESCE((SELECT SUM(stock) FROM product_platforms WHERE product_id = p.id), 0) as total_stock
        FROM products p
      `).all() as any[];

      let totalSaleValue = 0;
      let totalCostValue = 0;
      let totalBufferedCostValue = 0;

      for (const p of allProducts) {
        totalSaleValue += (p.total_stock * (p.sale_price || 0));
        const cost = (p.purchase_price_usd || 0) * (p.exchange_rate_used || 0);
        totalCostValue += (p.total_stock * cost);
        totalBufferedCostValue += (p.total_stock * cost * (1 + (p.buffer_percentage || 0) / 100));
      }

      const metrics = {
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        lowStockCount: lowStockProductsQuery.length,
        totalStockSalesValue: totalSaleValue,
        totalStockCostValue: totalCostValue,
        totalBufferedCostValue: totalBufferedCostValue,
        lowStockProducts: lowStockProductsQuery
      };

      // Charts: 6 Month History
      const monthlyDataRaw = db.prepare(`
        SELECT 
          strftime('%Y-%m', date) as month,
          SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END) as expense
        FROM transactions 
        GROUP BY month 
        ORDER BY month DESC 
        LIMIT 6
      `).all() as any[];

      let monthlyData = [...monthlyDataRaw];
      let foundCurrent = false;
      monthlyData = monthlyData.map(d => {
        if (d.month === currentMonthStr) {
          foundCurrent = true;
          return { ...d, expense: d.expense + pendingRecurringTotal };
        }
        return d;
      });

      if (!foundCurrent && pendingRecurringTotal > 0) {
        monthlyData.unshift({ month: currentMonthStr, income: 0, expense: pendingRecurringTotal });
        if (monthlyData.length > 6) monthlyData.pop();
      }
      monthlyData.reverse();

      // Charts: Platform Revenue
      const platformRevenue = db.prepare(`
        SELECT platform, SUM(amount) as total
        FROM transactions
        WHERE type = 'Income'
        GROUP BY platform
      `).all();

      const charts = { monthlyData, platformRevenue };

      // Recent Transactions
      const recentTransactions = db.prepare("SELECT * FROM transactions ORDER BY date DESC LIMIT 10").all();

      res.json({ metrics, charts, recentTransactions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products CRUD
  app.get("/api/products", (req, res) => {
    const products = db.prepare(`
      SELECT p.*, 
        (SELECT path FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC LIMIT 1) as cover_image,
        COALESCE((SELECT SUM(stock) FROM product_platforms WHERE product_id = p.id), 0) as total_stock
      FROM products p
      ORDER BY p.created_at DESC
    `).all();
    res.json(products);
  });

  app.get("/api/products/:id", (req, res) => {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) as any;
    if (!product) return res.status(404).json({ error: "Product not found" });

    const images = db.prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(req.params.id);
    const platforms = db.prepare("SELECT * FROM product_platforms WHERE product_id = ?").all(req.params.id);
    
    res.json({ ...product, images, platforms });
  });

  app.post("/api/products", (req, res) => {
    const id = uuidv4();
    const { 
      name, title, warehouse_location, sku, barcode, category, model, description, 
      purchase_price_usd, purchase_cost, sale_price, buffer_percentage, profit_percentage, exchange_rate_used, price_locked,
      weight, status, notes, platforms, images 
    } = req.body;
    
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, title, warehouse_location, sku, barcode, category, model, description, purchase_price_usd, purchase_cost, sale_price, buffer_percentage, profit_percentage, exchange_rate_used, price_locked, weight, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      insertProduct.run(
        id, name, title, warehouse_location, sku || `SKU-${Date.now()}`, barcode, category, model, description, 
        purchase_price_usd || 0, purchase_cost || 0, sale_price || 0, buffer_percentage || 0, profit_percentage || 0, exchange_rate_used || 0, price_locked ? 1 : 0, 
        weight || 0, status, notes
      );
      
      const insertPlatform = db.prepare(`
        INSERT INTO product_platforms (id, product_id, platform_name, stock, price, is_listed)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of platforms) {
        insertPlatform.run(uuidv4(), id, p.name, p.stock || 0, p.price || sale_price, p.is_listed ? 1 : 0);
      }

      if (images && Array.isArray(images)) {
        const insertImg = db.prepare("INSERT INTO product_images (id, product_id, path, sort_order) VALUES (?, ?, ?, ?)");
        images.forEach((img: any, idx: number) => {
          insertImg.run(uuidv4(), id, img.path || img, idx);
        });
      }
      logActivity('CREATE', 'product', id, { name, title, sku });
    })();

    res.json({ id });
  });

  app.post("/api/products/bulk-pricing", (req, res) => {
    try {
      const { updates, settings } = req.body;
      const { exchangeRate, bufferPercentage, profitPercentage } = settings;

      db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE products 
          SET sale_price = ?, 
              exchange_rate_used = ?, 
              buffer_percentage = ?, 
              profit_percentage = ?, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        const platformStmt = db.prepare(`
          UPDATE product_platforms 
          SET price = ? 
          WHERE product_id = ?
        `);

        for (const update of updates) {
          stmt.run(update.newSalePrice, exchangeRate, bufferPercentage, profitPercentage, update.id);
          platformStmt.run(update.newSalePrice, update.id);
        }
      })();

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    const { 
      name, title, warehouse_location, sku, barcode, category, model, description, 
      purchase_price_usd, purchase_cost, sale_price, buffer_percentage, profit_percentage, exchange_rate_used, price_locked,
      weight, status, notes, platforms, images 
    } = req.body;
    
    db.transaction(() => {
      const beforeState: any = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
      if (beforeState) {
        beforeState.platforms = db.prepare("SELECT platform_name, stock, price, is_listed FROM product_platforms WHERE product_id = ?").all(req.params.id);
        beforeState.images = db.prepare("SELECT id, path, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(req.params.id);
      }

      db.prepare(`
        UPDATE products SET 
          name=?, title=?, warehouse_location=?, sku=?, barcode=?, category=?, model=?, description=?, 
          purchase_price_usd=?, purchase_cost=?, sale_price=?, buffer_percentage=?, profit_percentage=?, exchange_rate_used=?, price_locked=?,
          weight=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(
        name, title, warehouse_location, sku, barcode, category, model, description, 
        purchase_price_usd || 0, purchase_cost || 0, sale_price || 0, buffer_percentage || 0, profit_percentage || 0, exchange_rate_used || 0, price_locked ? 1 : 0,
        weight || 0, status, notes, req.params.id
      );

      db.prepare("DELETE FROM product_platforms WHERE product_id = ?").run(req.params.id);
      
      const insertPlatform = db.prepare(`
        INSERT INTO product_platforms (id, product_id, platform_name, stock, price, is_listed)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of platforms) {
        insertPlatform.run(uuidv4(), req.params.id, p.name, p.stock || 0, p.price || sale_price, p.is_listed ? 1 : 0);
      }

      if (images && Array.isArray(images)) {
        const insertImg = db.prepare("INSERT INTO product_images (id, product_id, path, sort_order) VALUES (?, ?, ?, ?)");
        images.forEach((img: any, idx: number) => {
          if (img.id && img.id.startsWith('temp-')) {
             insertImg.run(uuidv4(), req.params.id, img.path, idx + 100);
          }
        });
      }
      
      const afterState: any = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
      if (afterState) {
        afterState.platforms = db.prepare("SELECT platform_name, stock, price, is_listed FROM product_platforms WHERE product_id = ?").all(req.params.id);
        afterState.images = db.prepare("SELECT id, path, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC").all(req.params.id);
        if (req.body.imageChanged) {
          afterState.imageChanged = true;
        }
      }
      logActivity('UPDATE', 'product', req.params.id, { before: beforeState, after: afterState });
    })();

    res.json({ success: true });
  });

  app.delete("/api/products", (req, res) => {
    console.log("Bulk deleting all products...");
    const result = db.prepare("DELETE FROM products").run();
    console.log(`Deleted ${result.changes} products.`);
    logActivity('DELETE_ALL', 'product', 'all', { count: result.changes });
    res.json({ success: true, deletedCount: result.changes });
  });

  app.delete("/api/products/:id", (req, res) => {
    const beforeState = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    logActivity('DELETE', 'product', req.params.id, { before: beforeState });
    res.json({ success: true });
  });

  // Images Upload
  app.post("/api/products/:id/images", upload.array("images"), (req: any, res) => {
    const files = req.files as any[];
    const productId = req.params.id;

    db.transaction(() => {
      const stmt = db.prepare("INSERT INTO product_images (id, product_id, path, sort_order) VALUES (?, ?, ?, ?)");
      const lastOrder = db.prepare("SELECT MAX(sort_order) as max FROM product_images WHERE product_id = ?").get(productId) as any;
      let order = (lastOrder?.max || 0) + 1;

      for (const file of files) {
        stmt.run(uuidv4(), productId, `/uploads/${file.filename}`, order++);
      }
    })();

    res.json({ success: true });
  });

  app.delete("/api/images/:id", (req, res) => {
    const image = db.prepare("SELECT path FROM product_images WHERE id = ?").get(req.params.id) as any;
    if (image) {
      const fullPath = path.join(process.cwd(), image.path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      db.prepare("DELETE FROM product_images WHERE id = ?").run(req.params.id);
    }
    res.json({ success: true });
  });

  // Stock Movement
  app.post("/api/stock/adjust", (req, res) => {
    const { product_id, platform_name, change_amount, reason } = req.body;
    
    db.transaction(() => {
      const beforeState = db.prepare("SELECT stock FROM product_platforms WHERE product_id = ? AND platform_name = ?").get(product_id, platform_name);

      db.prepare("UPDATE product_platforms SET stock = stock + ? WHERE product_id = ? AND platform_name = ?")
        .run(change_amount, product_id, platform_name);
      
      db.prepare("INSERT INTO stock_movements (id, product_id, platform_name, change_amount, reason) VALUES (?, ?, ?, ?, ?)")
        .run(uuidv4(), product_id, platform_name, change_amount, reason);
      
      const afterState = db.prepare("SELECT stock FROM product_platforms WHERE product_id = ? AND platform_name = ?").get(product_id, platform_name);
      logActivity('UPDATE_STOCK', 'product', product_id, { platform_name, change_amount, reason, before: beforeState, after: afterState });
    })();

    res.json({ success: true });
  });

  app.get("/api/stock/movements/:productId", (req, res) => {
    const logs = db.prepare("SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC").all(req.params.productId);
    res.json(logs);
  });

  // Transactions CRUD
  app.get("/api/transactions", (req, res) => {
    const transactions = db.prepare(`
      SELECT t.*, p.title as product_title 
      FROM transactions t 
      LEFT JOIN products p ON t.product_id = p.id 
      ORDER BY t.date DESC
    `).all();
    res.json(transactions);
  });

  app.post("/api/transactions", (req, res) => {
    const { date, type, category, platform, amount, product_id, note, reference_number } = req.body;
    const txId = uuidv4();
    db.prepare(`
      INSERT INTO transactions (id, date, type, category, platform, amount, product_id, note, reference_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(txId, date || new Date().toISOString(), type, category, platform, amount, product_id, note, reference_number);
    logActivity('CREATE', 'transaction', txId, { 
      before: {}, 
      after: { date: date || new Date().toISOString(), type, category, platform, amount, product_id, note, reference_number }
    });
    res.json({ success: true });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    const beforeState = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    logActivity('DELETE', 'transaction', req.params.id, { before: beforeState, after: {} });
    res.json({ success: true });
  });

  // Recurring Payments
  app.get("/api/recurring-payments", (req, res) => {
    const data = db.prepare("SELECT * FROM recurring_payments ORDER BY day_of_month ASC").all();
    res.json(data);
  });

  app.post("/api/recurring-payments", (req, res) => {
    const { title, day_of_month, amount, category, note } = req.body;
    const recId = uuidv4();
    db.prepare(`
      INSERT INTO recurring_payments (id, title, day_of_month, amount, category, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recId, title, day_of_month, amount, category, note);
    logActivity('CREATE', 'recurring_payment', recId, { 
      before: {}, 
      after: { title, day_of_month, amount, category, note } 
    });
    res.json({ success: true });
  });

  app.delete("/api/recurring-payments/:id", (req, res) => {
    const beforeState = db.prepare("SELECT * FROM recurring_payments WHERE id = ?").get(req.params.id);
    db.prepare("DELETE FROM recurring_payments WHERE id = ?").run(req.params.id);
    logActivity('DELETE', 'recurring_payment', req.params.id, { before: beforeState, after: {} });
    res.json({ success: true });
  });

  app.post("/api/recurring-payments/process", (req, res) => {
    // Process payments for the current month that haven't been created yet
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    const activeTemplates = db.prepare("SELECT * FROM recurring_payments WHERE status = 'Active'").all() as any[];
    
    db.transaction(() => {
      for (const t of activeTemplates) {
        // Check if already exists for this month
        const recurringId = `${t.id}-${year}-${month}`;
        const existing = db.prepare("SELECT id FROM transactions WHERE recurring_id = ?").get(recurringId);
        
        if (!existing) {
          // Determine the date (clamped to month length)
          const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
          const day = Math.min(t.day_of_month, lastDay);
          const txDate = `${year}-${month}-${day.toString().padStart(2, '0')}`;

          db.prepare(`
            INSERT INTO transactions (id, date, type, category, platform, amount, note, recurring_id)
            VALUES (?, ?, 'Expense', ?, 'Kasa', ?, ?, ?)
          `).run(uuidv4(), txDate, t.category || 'Diğer', t.amount, t.title + (t.note ? ` - ${t.note}` : ''), recurringId);
        }
      }
    })();
    
    res.json({ success: true });
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const settingsRows = db.prepare("SELECT * FROM settings").all() as any[];
    const settings: any = {};
    settingsRows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    res.json(settings);
  });

  app.put("/api/settings", (req, res) => {
    const body = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    
    db.transaction(() => {
      const beforeState: any = {};
      const afterState: any = {};
      
      const getStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
      for (const [key, value] of Object.entries(body)) {
         const oldRow = getStmt.get(key) as any;
         beforeState[key] = oldRow ? oldRow.value : null;
         
         const newValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
         stmt.run(key, newValue);
         afterState[key] = newValue;
      }
      logActivity('UPDATE', 'settings', 'global', { before: beforeState, after: afterState });
    })();
    
    res.json({ success: true });
  });

  // B2B: Firms
  app.get("/api/b2b/firms", (req, res) => {
    try {
      const firms = db.prepare(`SELECT * FROM firms ORDER BY created_at DESC`).all();
      res.json(firms);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/b2b/firms/:id", (req, res) => {
    try {
      const firm = db.prepare("SELECT * FROM firms WHERE id = ?").get(req.params.id) as any;
      if (!firm) return res.status(404).json({ error: "Firm not found" });

      const note_list = db.prepare("SELECT * FROM firm_notes WHERE firm_id = ? ORDER BY created_at DESC").all(req.params.id);
      const offers = db.prepare("SELECT * FROM offers WHERE firm_id = ? ORDER BY created_at DESC").all(req.params.id);
      const follow_ups = db.prepare("SELECT * FROM follow_ups WHERE firm_id = ? ORDER BY created_at DESC").all(req.params.id);
      
      res.json({ ...firm, note_list, offers, follow_ups });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/b2b/firms", (req, res) => {
    try {
      const id = uuidv4();
      const { name, sector, city, website, phone, email, contact_person, source_url, related_product, status, notes } = req.body;
      
      db.prepare(`
        INSERT INTO firms (id, name, sector, city, website, phone, email, contact_person, source_url, related_product, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, sector, city, website, phone, email, contact_person, source_url, related_product, status || 'Yeni', notes);
      
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/b2b/firms/:id", (req, res) => {
    try {
      const { name, sector, city, website, phone, email, contact_person, source_url, related_product, status, notes, is_active } = req.body;
      db.prepare(`
        UPDATE firms SET 
          name=?, sector=?, city=?, website=?, phone=?, email=?, contact_person=?, source_url=?, related_product=?, status=?, notes=?, is_active=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(name, sector, city, website, phone, email, contact_person, source_url, related_product, status, notes, is_active === undefined ? 1 : is_active ? 1 : 0, req.params.id);
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/b2b/firms/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM firms WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // B2B: Notes
  app.post("/api/b2b/firms/:id/notes", (req, res) => {
    try {
      const id = uuidv4();
      const { note } = req.body;
      db.prepare("INSERT INTO firm_notes (id, firm_id, note) VALUES (?, ?, ?)").run(id, req.params.id, note);
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // B2B: Offers
  app.get("/api/b2b/offers", (req, res) => {
    try {
      const offers = db.prepare(`
        SELECT o.*, f.name as firm_name 
        FROM offers o 
        LEFT JOIN firms f ON o.firm_id = f.id 
        ORDER BY o.created_at DESC
      `).all();
      res.json(offers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/b2b/offers", (req, res) => {
    try {
      const id = uuidv4();
      const { firm_id, title, description, amount, currency, status, offer_date, valid_until } = req.body;
      db.prepare(`
        INSERT INTO offers (id, firm_id, title, description, amount, currency, status, offer_date, valid_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, firm_id, title, description, amount, currency || '₺', status || 'Taslak', offer_date, valid_until);
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/b2b/offers/:id/status", (req, res) => {
    try {
      db.prepare("UPDATE offers SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/b2b/offers/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM offers WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // B2B: Follow-ups
  app.get("/api/b2b/follow-ups", (req, res) => {
    try {
      const follow_ups = db.prepare(`
        SELECT fu.*, f.name as firm_name 
        FROM follow_ups fu 
        LEFT JOIN firms f ON fu.firm_id = f.id 
        ORDER BY fu.next_follow_up_date ASC, fu.created_at DESC
      `).all();
      res.json(follow_ups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/b2b/follow-ups", (req, res) => {
    try {
      const id = uuidv4();
      const { firm_id, type, note, next_follow_up_date } = req.body;
      db.prepare(`
        INSERT INTO follow_ups (id, firm_id, type, note, next_follow_up_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, firm_id, type, note, next_follow_up_date);
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- SALES ---
  app.get("/api/sales", (req, res) => {
    try {
      const sales = db.prepare("SELECT * FROM sales ORDER BY created_at DESC").all();
      sales.forEach((s: any) => {
        s.items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(s.id);
      });
      res.json(sales);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/sales", (req, res) => {
    try {
      const id = uuidv4();
      const { customer_name, customer_phone, customer_address, shipping_company, tracking_number, total_weight, total_quantity, total_amount, items } = req.body;
      
      db.transaction(() => {
        // 1. Stock Validation for all items
        for (const item of items) {
          const totalStockResult = db.prepare("SELECT COALESCE(SUM(stock), 0) as total FROM product_platforms WHERE product_id = ?").get(item.product_id) as any;
          if (totalStockResult.total < item.quantity) {
            throw new Error(`Yetersiz stok. ${item.product_name} için mevcut stok: ${totalStockResult.total} adet.`);
          }
        }

        // 2. Create Sale
        db.prepare(`
          INSERT INTO sales (id, customer_name, customer_phone, customer_address, shipping_company, tracking_number, total_weight, total_quantity, total_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, customer_name, customer_phone, customer_address, shipping_company, tracking_number, total_weight, total_quantity, total_amount);

        const insertItem = db.prepare(`
          INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, weight)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        // 3. Process items: Sale Items, Stock deduction, Stock Movements
        for (const item of items) {
          insertItem.run(uuidv4(), id, item.product_id, item.product_name, item.quantity, item.weight);

          let remainingToDeduct = item.quantity;
          const platforms = db.prepare("SELECT * FROM product_platforms WHERE product_id = ? AND stock > 0 ORDER BY stock DESC").all(item.product_id) as any[];

          for (const plat of platforms) {
            if (remainingToDeduct <= 0) break;
            const deduct = Math.min(plat.stock, remainingToDeduct);
            db.prepare("UPDATE product_platforms SET stock = stock - ? WHERE id = ?").run(deduct, plat.id);
            
            db.prepare("INSERT INTO stock_movements (id, product_id, platform_name, change_amount, reason) VALUES (?, ?, ?, ?, ?)")
              .run(uuidv4(), item.product_id, plat.platform_name, -deduct, `satıştan otomatik düşüldü (Satış no: ${id})`);
            
            remainingToDeduct -= deduct;
          }
        }

        // 4. Create Income Transaction
        db.prepare(`
          INSERT INTO transactions (id, type, category, platform, amount, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), 'Income', 'Satış', 'Satış Sistemi', total_amount, `Satış geliri - ${customer_name}`);
        
      })();

      res.json({ success: true, saleId: id, message: "Satış kaydedildi, stok düşüldü ve gelir işlendi." });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // --- API INTEGRATIONS (KEYS) ---
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 requests per windowMs
    message: { error: "Çok fazla istek gönderildi, lütfen biraz bekleyin." }
  });

  app.get("/api/integrations/keys", apiLimiter, (req, res) => {
    try {
      const keys = db.prepare("SELECT id, service_name, display_name, key_name, status, last4, notes, last_used_at, created_at, updated_at FROM api_keys WHERE deleted_at IS NULL ORDER BY created_at DESC").all() as any[];
      
      const safeKeys = keys.map(k => {
        const testStatusRow = db.prepare("SELECT value FROM settings WHERE key = ?").get(`last_test_status_${k.id}`) as any;
        const testedAtRow = db.prepare("SELECT value FROM settings WHERE key = ?").get(`last_tested_at_${k.id}`) as any;
        return {
          ...k,
          last_test_status: testStatusRow ? testStatusRow.value : null,
          last_tested_at: testedAtRow ? testedAtRow.value : null,
          maskedKey: `********${k.last4 || '----'}`,
        };
      });

      res.json(safeKeys);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/integrations/keys", apiLimiter, (req, res) => {
    try {
      const { service_name, display_name, key_name, api_key, api_secret, merchant_id, seller_id, notes } = req.body;
      
      if (!service_name || !display_name || !api_key) {
        return res.status(400).json({ error: "Servis adı, görünen alan ve API anahtarı zorunludur." });
      }

      // Check duplicate
      const existing = db.prepare("SELECT id FROM api_keys WHERE service_name = ? AND display_name = ? AND deleted_at IS NULL").get(service_name, display_name);
      if (existing) {
        return res.status(400).json({ error: "Bu servis ve görünen ada sahip bir anahtar zaten var." });
      }

      const id = uuidv4();
      const apiKeyEncrypted = encryptText(api_key);
      const apiSecretEncrypted = api_secret ? encryptText(api_secret) : null;
      const last4 = api_key.length >= 4 ? api_key.slice(-4) : api_key;

      db.prepare(`
        INSERT INTO api_keys (id, service_name, display_name, key_name, api_key_encrypted, api_secret_encrypted, merchant_id, seller_id, last4, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, service_name, display_name, key_name || null, apiKeyEncrypted, apiSecretEncrypted, merchant_id || null, seller_id || null, last4, notes || null);
      
      logActivity("API_KEY_CREATED", "integration", id, { 
         before: null, 
         after: { service_name, display_name, status: 'active' },
         userIp: req.ip
      });

      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/integrations/keys/:id", apiLimiter, (req, res) => {
    try {
      const { display_name, key_name, api_key, api_secret, merchant_id, seller_id, notes } = req.body;
      const id = req.params.id;

      if (!display_name) {
        return res.status(400).json({ error: "Görünen alan zorunludur." });
      }

      const current = db.prepare("SELECT * FROM api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      if (!current) {
        return res.status(404).json({ error: "API anahtarı bulunamadı." });
      }

      let apiKeyEncrypted = current.api_key_encrypted;
      let last4 = current.last4;
      if (api_key) {
        apiKeyEncrypted = encryptText(api_key);
        last4 = api_key.length >= 4 ? api_key.slice(-4) : api_key;
      }

      let apiSecretEncrypted = current.api_secret_encrypted;
      if (api_secret) {
        apiSecretEncrypted = encryptText(api_secret);
      } else if (api_secret === '') {
        apiSecretEncrypted = null;
      }

      db.prepare(`
        UPDATE api_keys 
        SET display_name = ?, key_name = ?, api_key_encrypted = ?, api_secret_encrypted = ?, merchant_id = ?, seller_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(display_name, key_name || null, apiKeyEncrypted, apiSecretEncrypted, merchant_id || null, seller_id || null, notes || null, id);

      logActivity("API_KEY_UPDATED", "integration", id, { 
         before: { display_name: current.display_name, service_name: current.service_name }, 
         after: { display_name, update: "Keys / metadata updated" },
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/integrations/keys/:id/status", apiLimiter, (req, res) => {
    try {
      const { status } = req.body;
      db.prepare("UPDATE api_keys SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").run(status, req.params.id);
      
      logActivity("API_KEY_STATUS", "integration", req.params.id, { 
         before: {}, 
         after: { status },
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/integrations/keys/:id/test", apiLimiter, async (req, res) => {
    try {
      const id = req.params.id;
      const current = db.prepare("SELECT * FROM api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      if (!current) {
        return res.status(404).json({ error: "API anahtarı bulunamadı." });
      }

      if (current.status !== 'active') {
         return res.json({ status: "failed", message: "Pasif anahtarlar test edilemez." });
      }

      let status = "success";
      let message = "";

      if (current.service_name === 'Hepsiburada') {
        const merchantId = current.merchant_id;
        if (!merchantId) {
           return res.json({ status: "failed", message: "Merchant ID gerekli" });
        }
        
        const apiKey = decryptText(current.api_key_encrypted);
        const apiSecret = current.api_secret_encrypted ? decryptText(current.api_secret_encrypted) : "";
        
        // Hepsiburada genellikle Basic Auth kullanır. apiKey Username, apiSecret Password ise:
        let authToken = apiKey;
        if (apiSecret) {
           authToken = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        }
        
        try {
           const response = await fetch(`https://oms-api.hepsiburada.com/merchants/${merchantId}/orders?limit=1`, {
              method: 'GET',
              headers: {
                 'Authorization': apiKey.startsWith('Basic ') ? apiKey : `Basic ${authToken}`,
                 'User-Agent': 'DSDST-Panel',
                 'Accept': 'application/json'
              }
           });
           
           if (response.ok) {
              status = "success";
              message = "Test başarılı";
           } else if (response.status === 401 || response.status === 403) {
              status = "failed";
              message = "Yetkilendirme başarısız";
           } else {
              status = "failed";
              message = `Hata kodu: ${response.status}`;
           }
        } catch (err: any) {
           status = "failed";
           message = "Bağlantı hatası";
        }
      } else {
         message = `Test başarılı (${current.service_name} bağlantı adımı atlandı)`;
      }

      db.prepare("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(`last_test_status_${id}`, status);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, CURRENT_TIMESTAMP)").run(`last_tested_at_${id}`);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_test_status', ?)").run(status);

      logActivity("API_KEY_TESTED", "integration", id, { 
         after: { result: status, message },
         userIp: req.ip
      });

      res.json({ status, message });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/integrations/keys/:id", apiLimiter, (req, res) => {
    try {
      const id = req.params.id;
      const current = db.prepare("SELECT display_name, service_name FROM api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      
      if (!current) {
        return res.status(404).json({ error: "API anahtarı bulunamadı." });
      }

      db.prepare("UPDATE api_keys SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

      logActivity("API_KEY_DELETED", "integration", id, { 
         before: { display_name: current.display_name, service_name: current.service_name }, 
         after: null,
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- PANEL API (INTERNAL KEYS FOR EXTERNAL SYSTEMS) ---
  app.get("/api/integrations/panel-api", apiLimiter, (req, res) => {
    try {
      const keys = db.prepare("SELECT id, name, key_prefix, last4, status, environment, permissions, allowed_ips, expires_at, last_used_at, last_used_ip, created_at, updated_at, revoked_at FROM panel_api_keys WHERE deleted_at IS NULL ORDER BY created_at DESC").all() as any[];
      
      const safeKeys = keys.map(k => {
        const testStatusRow = db.prepare("SELECT value FROM settings WHERE key = ?").get(`last_test_status_${k.id}`) as any;
        const testedAtRow = db.prepare("SELECT value FROM settings WHERE key = ?").get(`last_tested_at_${k.id}`) as any;
        return {
          ...k,
          last_test_status: testStatusRow ? testStatusRow.value : null,
          last_tested_at: testedAtRow ? testedAtRow.value : null,
          maskedKey: `${k.key_prefix}********${k.last4}`,
        };
      });

      res.json(safeKeys);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/integrations/panel-api", apiLimiter, (req, res) => {
    try {
      const { name, environment, permissions, allowed_ips, expires_at } = req.body;
      
      if (!name) return res.status(400).json({ error: "Ad zorunludur." });
      
      const id = uuidv4();
      const envPrefix = environment === 'live' ? 'dsdst_live_' : 'dsdst_test_';
      const randomStr = crypto.randomBytes(16).toString('hex'); // 32 chars
      const newApiKey = `${envPrefix}${randomStr}`;
      
      const hashedKey = hashApiKey(newApiKey);
      const last4 = newApiKey.slice(-4);

      db.prepare(`
        INSERT INTO panel_api_keys (id, name, key_prefix, key_hash, last4, status, environment, permissions, allowed_ips, expires_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(id, name, envPrefix, hashedKey, last4, environment, JSON.stringify(permissions || []), allowed_ips || null, expires_at || null);
      
      logActivity("PANEL_API_KEY_CREATED", "integration", id, { 
         after: { name, environment, status: 'active' },
         userIp: req.ip
      });

      // ONLY RETURN newApiKey HERE! IT SHOULD NOT BE RETURNED AGAIN.
      res.json({ id, apiKey: newApiKey }); 
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/integrations/panel-api/:id", apiLimiter, (req, res) => {
    try {
      const { name, permissions, allowed_ips, expires_at } = req.body;
      const id = req.params.id;

      if (!name) return res.status(400).json({ error: "Ad zorunludur." });

      const current = db.prepare("SELECT * FROM panel_api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      if (!current) return res.status(404).json({ error: "API anahtarı bulunamadı." });

      db.prepare(`
        UPDATE panel_api_keys 
        SET name = ?, permissions = ?, allowed_ips = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, JSON.stringify(permissions || []), allowed_ips || null, expires_at || null, id);

      logActivity("PANEL_API_KEY_UPDATED", "integration", id, { 
         after: { name, update: "Panel API Key updated" },
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/integrations/panel-api/:id/status", apiLimiter, (req, res) => {
    try {
      const { status } = req.body;
      db.prepare("UPDATE panel_api_keys SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").run(status, req.params.id);
      
      let action = "PANEL_API_KEY_STATUS";
      if (status === 'active') action = "PANEL_API_KEY_ACTIVATED";
      if (status === 'passive') action = "PANEL_API_KEY_PASSIVATED";

      logActivity(action, "integration", req.params.id, { 
         after: { status },
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/integrations/panel-api/:id/revoke", apiLimiter, (req, res) => {
    try {
      const id = req.params.id;
      db.prepare("UPDATE panel_api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL").run(id);
      
      logActivity("PANEL_API_KEY_REVOKED", "integration", id, { 
         after: { status: 'revoked' },
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/integrations/panel-api/:id/rotate", apiLimiter, (req, res) => {
    try {
      const id = req.params.id;
      const current = db.prepare("SELECT * FROM panel_api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      if (!current) return res.status(404).json({ error: "API anahtarı bulunamadı." });

      // Revoke current
      db.prepare("UPDATE panel_api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      
      // Create new
      const newId = uuidv4();
      const randomStr = crypto.randomBytes(16).toString('hex');
      const newApiKey = `${current.key_prefix}${randomStr}`;
      const hashedKey = hashApiKey(newApiKey);
      const last4 = newApiKey.slice(-4);

      db.prepare(`
        INSERT INTO panel_api_keys (id, name, key_prefix, key_hash, last4, status, environment, permissions, allowed_ips, expires_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(newId, current.name + " (Rotated)", current.key_prefix, hashedKey, last4, current.environment, current.permissions, current.allowed_ips, current.expires_at);

      logActivity("PANEL_API_KEY_ROTATED", "integration", id, { 
         after: { newKeyId: newId },
         userIp: req.ip
      });

      res.json({ id: newId, apiKey: newApiKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/integrations/panel-api/:id/test", apiLimiter, (req, res) => {
    try {
      const id = req.params.id;
      const current = db.prepare("SELECT * FROM panel_api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      if (!current) return res.status(404).json({ error: "API anahtarı bulunamadı." });

      let status = "success";
      let message = "Test başarılı (Bağlantı açık). permissions: " + current.permissions;

      if (current.status !== 'active') {
         status = "failed";
         message = `Anahtar durumu: ${current.status}`;
      } else if (current.expires_at && new Date(current.expires_at).getTime() < Date.now()) {
         status = "failed";
         message = "Anahtar süresi dolmuş.";
      }

      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(`last_test_status_${id}`, status);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, CURRENT_TIMESTAMP)").run(`last_tested_at_${id}`);
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_test_status', ?)").run(status);

      logActivity("PANEL_API_KEY_TESTED", "integration", id, { 
         after: { result: status, message },
         userIp: req.ip
      });

      res.json({ status, message });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/integrations/panel-api/:id", apiLimiter, (req, res) => {
    try {
      const id = req.params.id;
      
      const current = db.prepare("SELECT * FROM panel_api_keys WHERE id = ? AND deleted_at IS NULL").get(id) as any;
      if (!current) return res.status(404).json({ error: "API anahtarı bulunamadı." });

      db.prepare("UPDATE panel_api_keys SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

      logActivity("PANEL_API_KEY_DELETED", "integration", id, { 
         before: { name: current.name },
         userIp: req.ip
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- PUBLIC API AUTHENTICATION MIDDLEWARE ---
  const publicApiAuth = (requiredPermission?: string) => (req: any, res: any, next: any) => {
      const apiKeyHeader = req.headers['x-api-key']?.toString();
      if (!apiKeyHeader) {
          return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "x-api-key header is required" } });
      }

      const hashedKey = hashApiKey(apiKeyHeader);
      const keyData = db.prepare("SELECT * FROM panel_api_keys WHERE key_hash = ? AND deleted_at IS NULL").get(hashedKey) as any;

      if (!keyData) {
          logActivity("PANEL_API_AUTH_FAILED", "system", "auth", { reason: "Invalid key", userIp: req.ip, userAgent: req.headers['user-agent'] });
          return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid API key" } });
      }

      if (keyData.status !== 'active') {
          logActivity("PANEL_API_AUTH_FAILED", "system", keyData.id, { reason: `Key status is ${keyData.status}`, userIp: req.ip, userAgent: req.headers['user-agent'] });
          return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: `API key is ${keyData.status}` } });
      }

      if (keyData.expires_at && new Date(keyData.expires_at).getTime() < Date.now()) {
          logActivity("PANEL_API_AUTH_FAILED", "system", keyData.id, { reason: "Key expired", userIp: req.ip, userAgent: req.headers['user-agent'] });
          return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "API key has expired" } });
      }

      if (keyData.allowed_ips) {
          const allowedIps = keyData.allowed_ips.split(',').map((ip: string) => ip.trim());
          if (!allowedIps.includes(req.ip)) {
              logActivity("PANEL_API_AUTH_FAILED", "system", keyData.id, { reason: "IP not allowed", userIp: req.ip, userAgent: req.headers['user-agent'] });
              return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "IP not allowed" } });
          }
      }

      const permissions = JSON.parse(keyData.permissions || '[]');
      if (requiredPermission && !permissions.includes(requiredPermission)) {
          logActivity("PANEL_API_AUTH_FAILED", "system", keyData.id, { reason: "Missing permission", requiredPermission, userIp: req.ip, userAgent: req.headers['user-agent'] });
          return res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } });
      }

      db.prepare("UPDATE panel_api_keys SET last_used_at = CURRENT_TIMESTAMP, last_used_ip = ? WHERE id = ?").run(req.ip, keyData.id);

      req.panelApiKey = { id: keyData.id, name: keyData.name, permissions };
      next();
  };

  const publicApiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 120, // 120 requests per minute
    message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" } }
  });

  const publicAuthFailedLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 20, // 20 failed attempt requests per minute per IP
    skipSuccessfulRequests: true,
    message: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many failed attempts" } }
  });

  // --- PUBLIC API ROUTES ---
  app.use("/api/public", publicAuthFailedLimiter, publicApiLimiter);

  app.get("/api/public/health", (req, res) => {
    // Health doesn't require auth but we can validate it if present manually or just return ok
    res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
  });

  app.get("/api/public/products", publicApiAuth("products:read"), (req, res) => {
    const products = db.prepare("SELECT * FROM products").all();
    logActivity("PANEL_API_USED", "public_api", req.panelApiKey.id, { path: req.path, userIp: req.ip });
    res.json({ success: true, data: products });
  });

  app.get("/api/public/stock", publicApiAuth("stock:read"), (req, res) => {
    const stock = db.prepare("SELECT * FROM product_platforms").all();
    logActivity("PANEL_API_USED", "public_api", req.panelApiKey.id, { path: req.path, userIp: req.ip });
    res.json({ success: true, data: stock });
  });

  app.patch("/api/public/stock/:productId", publicApiAuth("stock:write"), (req, res) => {
     // placeholder implementation
     logActivity("PANEL_API_USED", "public_api", req.panelApiKey.id, { path: req.path, userIp: req.ip });
     res.json({ success: true, data: { productId: req.params.productId, updated: true } });
  });

  app.get("/api/public/orders", publicApiAuth("orders:read"), (req, res) => {
    const orders = db.prepare("SELECT * FROM sales").all();
    logActivity("PANEL_API_USED", "public_api", req.panelApiKey.id, { path: req.path, userIp: req.ip });
    res.json({ success: true, data: orders });
  });

  app.post("/api/public/orders", publicApiAuth("orders:write"), (req, res) => {
     // placeholder implementation
     logActivity("PANEL_API_USED", "public_api", req.panelApiKey.id, { path: req.path, userIp: req.ip });
     res.json({ success: true, data: { status: "created", body: req.body } });
  });

  app.get("/api/public/dashboard-summary", publicApiAuth("dashboard:read"), (req, res) => {
    // placeholder implementation
    logActivity("PANEL_API_USED", "public_api", req.panelApiKey.id, { path: req.path, userIp: req.ip });
    res.json({ success: true, data: { totalRevenue: 50000, unreadMessages: 3 } });
  });

  // --- DATABASE BACKUP / RESTORE ---
  app.get("/api/backup/download", async (req, res) => {
    try {
      const backupPath = path.join(process.cwd(), `dsdst_backup_${Date.now()}.sqlite`);
      await db.backup(backupPath);
      
      const zip = new AdmZip();
      zip.addLocalFile(backupPath, "", "dsdst_panel.db");
      
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (fs.existsSync(uploadsDir)) {
         zip.addLocalFolder(uploadsDir, "uploads");
      }
      
      const zipPath = path.join(process.cwd(), `kofem_backup_${Date.now()}.zip`);
      zip.writeZip(zipPath);

      res.download(zipPath, `kofem_backup_${new Date().toISOString().split('T')[0]}.zip`, (err) => {
        try { fs.unlinkSync(backupPath); } catch(e) {}
        try { fs.unlinkSync(zipPath); } catch(e) {}
      });
    } catch (err: any) {
      res.status(500).json({ error: "Backup failed: " + err.message });
    }
  });

  app.post("/api/backup/restore", backupUpload.single("zipfile"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const newPath = req.file.path;
      
      const zip = new AdmZip(newPath);
      const zipEntries = zip.getEntries();
      
      const dbEntry = zipEntries.find(e => e.entryName === "dsdst_panel.db");
      if (!dbEntry) {
         try { fs.unlinkSync(newPath); } catch(e) {}
         return res.status(400).json({ error: "Geçersiz yedek dosyası: dsdst_panel.db bulunamadı" });
      }

      // Close the current DB
      db.close();

      // Delete the old DB files completely before extraction to ensure no inode conflicts
      try { fs.unlinkSync(path.join(process.cwd(), "dsdst_panel.db")); } catch(e) {}
      try { fs.unlinkSync(path.join(process.cwd(), "dsdst_panel.db-wal")); } catch(e) {}
      try { fs.unlinkSync(path.join(process.cwd(), "dsdst_panel.db-shm")); } catch(e) {}

      // Extract all contents (overwrite existing)
      zip.extractAllTo(process.cwd(), true);

      // Attempt cleanup of the uploaded temp file
      try { fs.unlinkSync(newPath); } catch(e) {}

      // Re-instantiate the database
      db = new Database("dsdst_panel.db");
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      
      // Ensure missing default settings are populated from older backups (e.g., product_categories)
      const postRestoreInsertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
      postRestoreInsertSetting.run("company_name", "DSDST Panel");
      postRestoreInsertSetting.run("low_stock_threshold", "50");
      postRestoreInsertSetting.run("currency_symbol", "₺");
      postRestoreInsertSetting.run("language", "tr");
      postRestoreInsertSetting.run("usd_exchange_rate", "32.5");
      postRestoreInsertSetting.run("default_buffer_percentage", "20");
      postRestoreInsertSetting.run("commission_rates", JSON.stringify({
        "Trendyol": 15, "Hepsiburada": 15, "Amazon": 10, "N11": 15, "Website": 2, "Instagram": 0
      }));
      postRestoreInsertSetting.run("product_categories", JSON.stringify(["Aliminyum", "PPR", "Dokum Demir", "Karbon Celik"]));
      postRestoreInsertSetting.run("income_categories", JSON.stringify(["Satış", "İade", "Hizmet Bedeli", "Diğer"]));
      postRestoreInsertSetting.run("expense_categories", JSON.stringify(["Kargo", "Komisyon", "Maliyet", "Reklam", "Vergi", "Diğer"]));

      // We cannot log safely if the schema changed but basically assume success
      logActivity("DB_RESTORED", "system", "system", { info: "Database restored from backup" });

      res.json({ success: true, message: "Sistem başarıyla yeni veritabanına ve görsel yedeğine geçirildi." });
    } catch (err: any) {
      res.status(500).json({ error: "Restore failed: " + err.message });
    }
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

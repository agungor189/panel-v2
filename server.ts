import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Database from "better-sqlite3";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Database initialization
const db = new Database("dsdst_panel.db");
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
    exchange_rate_used REAL DEFAULT 0,
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
  db.exec("ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0");
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  // --- API ROUTES ---

  // Dashboard Metrics
  app.get("/api/dashboard/metrics", (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const firstDayOfMonth = `${year}-${month}-01T00:00:00Z`;

    const revenueResult = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'Income' AND date >= ?").get(firstDayOfMonth) as any;
    const realizedExpensesResult = db.prepare("SELECT SUM(amount) as total FROM transactions WHERE type = 'Expense' AND date >= ?").get(firstDayOfMonth) as any;
    
    // Calculate pending recurring payments for current month
    const activeRecurring = db.prepare("SELECT * FROM recurring_payments WHERE status = 'Active'").all() as any[];
    let pendingRecurringTotal = 0;
    for (const r of activeRecurring) {
       const recurringId = `${r.id}-${year}-${month}`;
       const exists = db.prepare("SELECT id FROM transactions WHERE recurring_id = ?").get(recurringId);
       if (!exists) {
          pendingRecurringTotal += r.amount;
       }
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

    res.json({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      lowStockCount: lowStockProductsQuery.length,
      lowStockProducts: lowStockProductsQuery
    });
  });

  // Dashboard Charts
  app.get("/api/dashboard/charts", (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentMonthStr = `${year}-${month}`;

    // 6 Month History
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

    // Check if the current month exists in history, if not add it, or update it
    let monthlyData = [...monthlyDataRaw];
    
    // Calculate pending recurring for current month
    const activeRecurring = db.prepare("SELECT * FROM recurring_payments WHERE status = 'Active'").all() as any[];
    let pendingRecurringTotal = 0;
    for (const r of activeRecurring) {
       const recurringId = `${r.id}-${year}-${month}`;
       const exists = db.prepare("SELECT id FROM transactions WHERE recurring_id = ?").get(recurringId);
       if (!exists) {
          pendingRecurringTotal += r.amount;
       }
    }

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

    // Platform Revenue
    const platformRevenue = db.prepare(`
      SELECT platform, SUM(amount) as total
      FROM transactions
      WHERE type = 'Income'
      GROUP BY platform
    `).all();

    res.json({ monthlyData, platformRevenue });
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
      purchase_price_usd, purchase_cost, sale_price, buffer_percentage, exchange_rate_used,
      weight, status, notes, platforms, images 
    } = req.body;
    
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, title, warehouse_location, sku, barcode, category, model, description, purchase_price_usd, purchase_cost, sale_price, buffer_percentage, exchange_rate_used, weight, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      insertProduct.run(
        id, name, title, warehouse_location, sku || `SKU-${Date.now()}`, barcode, category, model, description, 
        purchase_price_usd || 0, purchase_cost || 0, sale_price || 0, buffer_percentage || 0, exchange_rate_used || 0,
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
    })();

    res.json({ id });
  });

  app.put("/api/products/:id", (req, res) => {
    const { 
      name, title, warehouse_location, sku, barcode, category, model, description, 
      purchase_price_usd, purchase_cost, sale_price, buffer_percentage, exchange_rate_used,
      weight, status, notes, platforms, images 
    } = req.body;
    
    db.transaction(() => {
      db.prepare(`
        UPDATE products SET 
          name=?, title=?, warehouse_location=?, sku=?, barcode=?, category=?, model=?, description=?, 
          purchase_price_usd=?, purchase_cost=?, sale_price=?, buffer_percentage=?, exchange_rate_used=?,
          weight=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(
        name, title, warehouse_location, sku, barcode, category, model, description, 
        purchase_price_usd || 0, purchase_cost || 0, sale_price || 0, buffer_percentage || 0, exchange_rate_used || 0,
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
        // Only insert if it doesn't already exist or handle syncing.
        // For simplicity, if they pass images, we might want to refresh them or only add new ones.
        // Let's assume on edit we only pass NEW URLs to add.
        const insertImg = db.prepare("INSERT INTO product_images (id, product_id, path, sort_order) VALUES (?, ?, ?, ?)");
        images.forEach((img: any, idx: number) => {
          if (img.id && img.id.startsWith('temp-')) {
             insertImg.run(uuidv4(), req.params.id, img.path, idx + 100);
          }
        });
      }
    })();

    res.json({ success: true });
  });

  app.delete("/api/products", (req, res) => {
    console.log("Bulk deleting all products...");
    const result = db.prepare("DELETE FROM products").run();
    console.log(`Deleted ${result.changes} products.`);
    res.json({ success: true, deletedCount: result.changes });
  });

  app.delete("/api/products/:id", (req, res) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
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
      db.prepare("UPDATE product_platforms SET stock = stock + ? WHERE product_id = ? AND platform_name = ?")
        .run(change_amount, product_id, platform_name);
      
      db.prepare("INSERT INTO stock_movements (id, product_id, platform_name, change_amount, reason) VALUES (?, ?, ?, ?, ?)")
        .run(uuidv4(), product_id, platform_name, change_amount, reason);
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
    db.prepare(`
      INSERT INTO transactions (id, date, type, category, platform, amount, product_id, note, reference_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), date || new Date().toISOString(), type, category, platform, amount, product_id, note, reference_number);
    res.json({ success: true });
  });

  app.delete("/api/transactions/:id", (req, res) => {
    db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Recurring Payments
  app.get("/api/recurring-payments", (req, res) => {
    const data = db.prepare("SELECT * FROM recurring_payments ORDER BY day_of_month ASC").all();
    res.json(data);
  });

  app.post("/api/recurring-payments", (req, res) => {
    const { title, day_of_month, amount, category, note } = req.body;
    db.prepare(`
      INSERT INTO recurring_payments (id, title, day_of_month, amount, category, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), title, day_of_month, amount, category, note);
    res.json({ success: true });
  });

  app.delete("/api/recurring-payments/:id", (req, res) => {
    db.prepare("DELETE FROM recurring_payments WHERE id = ?").run(req.params.id);
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
      for (const [key, value] of Object.entries(body)) {
        stmt.run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    })();
    
    res.json({ success: true });
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

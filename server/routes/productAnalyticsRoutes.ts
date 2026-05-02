import { Router } from "express";
import Database from "better-sqlite3";
import { normalizeMaterial, normalizeModel, normalizeSize } from "../utils/normalizeProductFields.js";

export function createProductAnalyticsRouter(db: Database.Database) {
  const router = Router();

  const getWhereClause = (req: any) => {
    const { startDate, endDate, material, model, size, tubeType } = req.query;
    let where = "1=1";
    const params: any[] = [];

    if (material && material !== 'Tümü' && material !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_material, 'Bilinmiyor') = ?";
      params.push(material);
    }
    if (model && model !== 'Tümü' && model !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_model, 'Bilinmiyor') = ?";
      params.push(model);
    }
    if (size && size !== 'Tümü' && size !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_size, 'Bilinmiyor') = ?";
      params.push(size);
    }
    if (tubeType && tubeType !== 'Tümü' && tubeType !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_tube_type, 'Bilinmiyor') = ?";
      params.push(tubeType);
    }

    return { where, params };
  };

  const getSalesFiltered = (req: any, productAlias: string = 'p') => {
    const { startDate, endDate } = req.query;
    let joinCondition = `si.product_id = ${productAlias}.id`;
    const params: any[] = [];
    if (startDate) {
      joinCondition += " AND s.created_at >= ?";
      params.push(startDate);
    }
    if (endDate) {
      joinCondition += " AND s.created_at <= ?";
      params.push(endDate);
    }
    return { joinCondition, params };
  };

  // 1. Summary
  router.get("/products/summary", (req, res) => {
    try {
      const { where, params } = getWhereClause(req);
      const salesFilter = getSalesFiltered(req);
      
      const query = `
        SELECT 
          COUNT(DISTINCT si.product_id) as productsSold,
          SUM(si.quantity) as totalSoldQty,
          SUM(si.total_price) as totalRevenue,
          COUNT(DISTINCT p.id) as totalProducts
        FROM products p
        LEFT JOIN sale_items si ON ${salesFilter.joinCondition}
        LEFT JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted'
      `;
      
      const summary = db.prepare(query).get(...salesFilter.params, ...params);
      
      // Top material
      const topMaterial = db.prepare(`
        SELECT p.normalized_material, SUM(si.quantity) as qty
        FROM products p
        JOIN sale_items si ON ${salesFilter.joinCondition}
        JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted' AND p.normalized_material IS NOT NULL
        GROUP BY p.normalized_material
        ORDER BY qty DESC LIMIT 1
      `).get(...salesFilter.params, ...params);

      // Top model
      const topModel = db.prepare(`
        SELECT p.normalized_model, SUM(si.quantity) as qty
        FROM products p
        JOIN sale_items si ON ${salesFilter.joinCondition}
        JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted' AND p.normalized_model IS NOT NULL
        GROUP BY p.normalized_model
        ORDER BY qty DESC LIMIT 1
      `).get(...salesFilter.params, ...params);

      const topSize = db.prepare(`
        SELECT p.normalized_size, SUM(si.quantity) as qty
        FROM products p
        JOIN sale_items si ON ${salesFilter.joinCondition}
        JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted' AND p.normalized_size IS NOT NULL
        GROUP BY p.normalized_size
        ORDER BY qty DESC LIMIT 1
      `).get(...salesFilter.params, ...params);

      res.json({
        totalSoldQty: summary.totalSoldQty || 0,
        totalRevenue: summary.totalRevenue || 0,
        topMaterial: topMaterial ? `${topMaterial.normalized_material} — ${topMaterial.qty} Adet` : 'Veri Yok',
        topModel: topModel ? `${topModel.normalized_model} — ${topModel.qty} Adet` : 'Veri Yok',
        topSize: topSize ? `${topSize.normalized_size} — ${topSize.qty} Adet` : 'Veri Yok',
      });
    } catch (error) {
      console.error('Summary error:', error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 2. By Material
  router.get("/products/by-material", (req, res) => {
    try {
      const { where, params } = getWhereClause(req);
      const salesFilter = getSalesFiltered(req);
      
      const query = `
        SELECT 
          IFNULL(p.normalized_material, 'Bilinmiyor') as material,
          SUM(si.quantity) as soldQty,
          SUM(si.total_price) as revenue,
          (SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id IN (SELECT id FROM products WHERE normalized_material = p.normalized_material)) as currentStock
        FROM products p
        LEFT JOIN sale_items si ON ${salesFilter.joinCondition}
        LEFT JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted'
        GROUP BY material
        ORDER BY soldQty DESC
      `;
      
      const stats = db.prepare(query).all(...salesFilter.params, ...params);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 3. By Model
  router.get("/products/by-model", (req, res) => {
    try {
      const { where, params } = getWhereClause(req);
      const salesFilter = getSalesFiltered(req);
      
      const query = `
        SELECT 
          IFNULL(p.normalized_model, 'Bilinmiyor') as model,
          SUM(si.quantity) as soldQty,
          SUM(si.total_price) as revenue,
          (SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id IN (SELECT id FROM products WHERE normalized_model = p.normalized_model)) as currentStock
        FROM products p
        LEFT JOIN sale_items si ON ${salesFilter.joinCondition}
        LEFT JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted'
        GROUP BY model
        ORDER BY soldQty DESC
      `;
      
      const stats = db.prepare(query).all(...salesFilter.params, ...params);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 4. By Size
  router.get("/products/by-size", (req, res) => {
    try {
      const { where, params } = getWhereClause(req);
      const salesFilter = getSalesFiltered(req);
      
      const query = `
        SELECT 
          IFNULL(p.normalized_size, 'Bilinmiyor') as size,
          SUM(si.quantity) as soldQty,
          SUM(si.total_price) as revenue,
          (SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id IN (SELECT id FROM products WHERE normalized_size = p.normalized_size)) as currentStock
        FROM products p
        LEFT JOIN sale_items si ON ${salesFilter.joinCondition}
        LEFT JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted'
        GROUP BY size
        ORDER BY soldQty DESC
      `;
      
      const stats = db.prepare(query).all(...salesFilter.params, ...params);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 5. Cross (Material + Model + Size)
  router.get("/products/cross", (req, res) => {
    try {
      const { where, params } = getWhereClause(req);
      const salesFilter = getSalesFiltered(req);
      
      const query = `
        SELECT 
          IFNULL(p.normalized_material, 'Bilinmiyor') as material,
          IFNULL(p.normalized_model, 'Bilinmiyor') as model,
          IFNULL(p.normalized_size, 'Bilinmiyor') as size,
          IFNULL(p.normalized_tube_type, 'Bilinmiyor') as tubeType,
          COUNT(DISTINCT p.id) as skuCount,
          SUM(si.quantity) as soldQty,
          SUM(si.total_price) as revenue,
          (SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id = p.id) as currentStock
        FROM products p
        LEFT JOIN sale_items si ON ${salesFilter.joinCondition}
        LEFT JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted'
        GROUP BY material, model, size
        ORDER BY soldQty DESC
      `;
      
      const stats = db.prepare(query).all(...salesFilter.params, ...params);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 6. Reorder Suggestions (Detailed)
  router.get("/products/reorder-suggestions", (req, res) => {
    try {
      const { where, params } = getWhereClause(req);
      const salesFilter = getSalesFiltered(req);
      
      // Compute sold qty per sku
      const query = `
        SELECT 
          p.id,
          p.sku,
          p.title as name,
          IFNULL(p.normalized_material, 'Bilinmiyor') as material,
          IFNULL(p.normalized_model, 'Bilinmiyor') as model,
          IFNULL(p.normalized_size, 'Bilinmiyor') as size,
          IFNULL(p.normalized_tube_type, 'Bilinmiyor') as tubeType,
          IFNULL((SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id = p.id), 0) as currentStock,
          IFNULL(SUM(si.quantity), 0) as soldQty,
          IFNULL(SUM(si.total_price), 0) as revenue
        FROM products p
        LEFT JOIN sale_items si ON ${salesFilter.joinCondition}
        LEFT JOIN sales s ON si.sale_id = s.id AND s.status != 'cancelled' AND s.type = 'sale'
        WHERE ${where} AND p.status != 'deleted'
        GROUP BY p.id
        ORDER BY soldQty DESC, currentStock ASC
      `;
      
      const products = db.prepare(query).all(...salesFilter.params, ...params);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  return router;
}

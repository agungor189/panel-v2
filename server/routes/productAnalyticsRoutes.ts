import { Router } from "express";
import Database from "better-sqlite3";

export function createProductAnalyticsRouter(db: Database.Database) {
  const router = Router();

  const buildWhere = (req: any) => {
    const { startDate, endDate, material, model, pipeSize, tubeType } = req.query;
    let where = "p.status != 'deleted'";
    const params: any[] = [];

    if (material && material !== 'Tümü' && material !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_material, 'Bilinmiyor') = ?";
      params.push(material);
    }
    if (model && model !== 'Tümü' && model !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_model, 'Bilinmiyor') = ?";
      params.push(model);
    }
    if (pipeSize && pipeSize !== 'Tümü' && pipeSize !== 'Hepsi') {
      where += " AND COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor') = ?";
      params.push(pipeSize);
    }
    if (tubeType && tubeType !== 'Tümü' && tubeType !== 'Hepsi') {
      where += " AND IFNULL(p.normalized_tube_type, 'Bilinmiyor') = ?";
      params.push(tubeType);
    }

    let salesWhere = "s.status NOT IN ('İptal Edildi', 'İade Edildi')";
    if (startDate) {
      salesWhere += " AND s.created_at >= ?";
      params.push(startDate);
    }
    if (endDate) {
      salesWhere += " AND s.created_at <= ?";
      params.push(endDate);
    }

    return { where, salesWhere, params };
  };

  const getValidSalesJoin = (salesWhere: string) => `
    LEFT JOIN (
      SELECT si.product_id, si.quantity, si.unit_price, si.sale_id
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE ${salesWhere}
    ) vsi ON vsi.product_id = p.id
  `;

  // 0. Filter Options
  router.get("/products/filter-options", (req, res) => {
    try {
      const dbSizes = db.prepare(`SELECT DISTINCT COALESCE(normalized_pipe_size, normalized_size, 'Bilinmiyor') as val FROM products WHERE COALESCE(normalized_pipe_size, normalized_size, 'Bilinmiyor') != 'Bilinmiyor' ORDER BY val ASC`).all();
      
      const pipeSizes = ['Tümü', ...dbSizes.map((row: any) => row.val), 'Bilinmiyor'];
      res.json({ pipeSizes });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 1. Dashboard / Summary
  router.get("/products/summary", (req, res) => {
    try {
      const { where, salesWhere, params } = buildWhere(req);
      const joinSql = getValidSalesJoin(salesWhere);
      
      const summary = db.prepare(`
        SELECT 
          COUNT(DISTINCT p.id) as totalSku,
          IFNULL(SUM(vsi.quantity), 0) as totalSoldQty,
          IFNULL(SUM(vsi.unit_price * vsi.quantity), 0) as totalRevenue,
          (SELECT SUM(quantity) FROM warehouse_stocks w JOIN products p2 ON w.product_id = p2.id WHERE p2.status != 'deleted') as totalStock
        FROM products p
        ${joinSql}
        WHERE ${where}
      `).get(...params) as any;

      const getTop = (field: string) => db.prepare(`
        SELECT ${field} as name, SUM(vsi.quantity) as qty
        FROM products p ${joinSql}
        WHERE ${where} AND ${field} IS NOT NULL AND ${field} != 'Bilinmiyor'
        GROUP BY name ORDER BY qty DESC LIMIT 1
      `).get(...params) as any;

      const getBottom = (field: string) => db.prepare(`
        SELECT ${field} as name, SUM(vsi.quantity) as qty
        FROM products p ${joinSql}
        WHERE ${where} AND ${field} IS NOT NULL AND ${field} != 'Bilinmiyor'
        GROUP BY name ORDER BY qty ASC LIMIT 1
      `).get(...params) as any;

      const topMaterial = getTop("IFNULL(p.normalized_material, 'Bilinmiyor')");
      const topModel = getTop("IFNULL(p.normalized_model, 'Bilinmiyor')");
      const topSize = getTop("COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor')");
      const topType = getTop("IFNULL(p.normalized_tube_type, 'Bilinmiyor')");
      const bottomMaterial = getBottom("IFNULL(p.normalized_material, 'Bilinmiyor')");
      const bottomModel = getBottom("IFNULL(p.normalized_model, 'Bilinmiyor')");

      res.json({
        totalSku: summary?.totalSku || 0,
        totalSoldQty: summary?.totalSoldQty || 0,
        totalRevenue: summary?.totalRevenue || 0,
        totalStock: summary?.totalStock || 0,
        topMaterial: topMaterial && topMaterial.qty > 0 ? `${topMaterial.name} — ${topMaterial.qty} Ad.` : 'Veri Yok',
        topModel: topModel && topModel.qty > 0 ? `${topModel.name} — ${topModel.qty} Ad.` : 'Veri Yok',
        topSize: topSize && topSize.qty > 0 ? `${topSize.name} — ${topSize.qty} Ad.` : 'Veri Yok',
        topType: topType && topType.qty > 0 ? `${topType.name} — ${topType.qty} Ad.` : 'Veri Yok',
        bottomMaterial: bottomMaterial ? `${bottomMaterial.name} — ${bottomMaterial.qty || 0} Ad.` : 'Veri Yok',
        bottomModel: bottomModel ? `${bottomModel.name} — ${bottomModel.qty || 0} Ad.` : 'Veri Yok',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 2. Cross Analysis
  router.get("/products/cross", (req, res) => {
    try {
      const { where, salesWhere, params } = buildWhere(req);
      const joinSql = getValidSalesJoin(salesWhere);
      
      const query = `
        SELECT 
          IFNULL(p.normalized_material, 'Bilinmiyor') as material,
          IFNULL(p.normalized_model, 'Bilinmiyor') as model,
          COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor') as size,
          IFNULL(p.normalized_tube_type, 'Bilinmiyor') as tubeType,
          COUNT(DISTINCT p.id) as skuCount,
          IFNULL(SUM(vsi.quantity), 0) as soldQty,
          IFNULL(SUM(vsi.unit_price * vsi.quantity), 0) as revenue,
          (SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id IN (
            SELECT id FROM products p2 
            WHERE IFNULL(p2.normalized_material, 'Bilinmiyor') = IFNULL(p.normalized_material, 'Bilinmiyor') 
              AND IFNULL(p2.normalized_model, 'Bilinmiyor') = IFNULL(p.normalized_model, 'Bilinmiyor')
              AND COALESCE(p2.normalized_pipe_size, p2.normalized_size, 'Bilinmiyor') = COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor')
          )) as currentStock
        FROM products p
        ${joinSql}
        WHERE ${where}
        GROUP BY material, model, size, tubeType
        ORDER BY soldQty DESC
      `;
      res.json(db.prepare(query).all(...params));
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 3. Reorder Suggestions
  router.get("/products/reorder-suggestions", (req, res) => {
    try {
      const { where, salesWhere, params } = buildWhere(req);
      const joinSql = getValidSalesJoin(salesWhere);
      
      const query = `
        SELECT 
          p.id,
          p.sku,
          p.title as name,
          IFNULL(p.normalized_material, 'Bilinmiyor') as material,
          IFNULL(p.normalized_model, 'Bilinmiyor') as model,
          COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor') as size,
          IFNULL(p.normalized_tube_type, 'Bilinmiyor') as tubeType,
          IFNULL((SELECT SUM(w.quantity) FROM warehouse_stocks w WHERE w.product_id = p.id), 0) as currentStock,
          IFNULL(SUM(vsi.quantity), 0) as soldQty,
          IFNULL(SUM(vsi.unit_price * vsi.quantity), 0) as revenue,
          MAX(s.created_at) as lastSaleDate
        FROM products p
        ${joinSql}
        LEFT JOIN sales s ON vsi.sale_id = s.id
        WHERE ${where}
        GROUP BY p.id
        ORDER BY soldQty DESC, currentStock ASC
      `;
      res.json(db.prepare(query).all(...params));
    } catch (error) {
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 4. Reports (Material, Model, Size)
  router.get("/products/reports", (req, res) => {
    try {
      const { where, salesWhere, params } = buildWhere(req);
      const joinSql = getValidSalesJoin(salesWhere);
      
      const runReport = (groupCol: string) => db.prepare(`
        SELECT 
          ${groupCol} as name,
          COUNT(DISTINCT p.id) as skuCount,
          IFNULL(SUM(vsi.quantity), 0) as soldQty,
          IFNULL(SUM(vsi.unit_price * vsi.quantity), 0) as revenue,
          (SELECT SUM(w.quantity) FROM warehouse_stocks w JOIN products p2 ON w.product_id = p2.id WHERE COALESCE(p2.normalized_pipe_size, p2.normalized_size, p2.normalized_material, p2.normalized_model, 'Bilinmiyor') = ${groupCol} OR p2.normalized_material = ${groupCol} OR p2.normalized_model = ${groupCol} OR COALESCE(p2.normalized_pipe_size, p2.normalized_size, 'Bilinmiyor') = ${groupCol}) as currentStock
        FROM products p
        ${joinSql}
        WHERE ${where}
        GROUP BY name
        ORDER BY soldQty DESC
      `).all(...params);

      // We'll write specific subqueries for currentStock to be simpler later, but doing an approx via a complex grouped subquery is hard, let's fix the stock subquery.
      // Wait, let's do group level stock directly via another query if needed, or by joining warehouse_stocks in a derived table.
      const getStats = (groupCol: string) => {
        return db.prepare(`
          SELECT 
            ${groupCol} as name,
            COUNT(DISTINCT p.id) as skuCount,
            IFNULL(SUM(vsi.quantity), 0) as soldQty,
            IFNULL(SUM(vsi.unit_price * vsi.quantity), 0) as revenue,
            IFNULL(SUM(ws.stock), 0) as currentStock
          FROM products p
          ${joinSql}
          LEFT JOIN (SELECT product_id, SUM(quantity) as stock FROM warehouse_stocks GROUP BY product_id) ws ON ws.product_id = p.id
          WHERE ${where}
          GROUP BY name
          ORDER BY soldQty DESC
        `).all(...params);
      };

      res.json({
        material: getStats("IFNULL(p.normalized_material, 'Bilinmiyor')"),
        model: getStats("IFNULL(p.normalized_model, 'Bilinmiyor')"),
        size: getStats("COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor')")
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  // 5. Charts Data
  router.get("/products/charts", (req, res) => {
    try {
      const { where, salesWhere, params } = buildWhere(req);
      const joinSql = getValidSalesJoin(salesWhere);

      const getDistribution = (groupCol: string, limit: number = 10) => db.prepare(`
        SELECT ${groupCol} as name, IFNULL(SUM(vsi.quantity), 0) as value
        FROM products p ${joinSql}
        WHERE ${where}
        GROUP BY name ORDER BY value DESC LIMIT ${limit}
      `).all(...params);

      const getSalesTrend = () => db.prepare(`
        SELECT 
          strftime('%Y-%m-%d', s.created_at) as date,
          SUM(vsi.quantity) as qty,
          SUM(vsi.unit_price * vsi.quantity) as revenue
        FROM products p
        ${joinSql}
        JOIN sales s ON vsi.sale_id = s.id
        WHERE ${where}
        GROUP BY date
        ORDER BY date ASC
      `).all(...params);

      res.json({
        materialShare: getDistribution("IFNULL(p.normalized_material, 'Bilinmiyor')"),
        modelShare: getDistribution("IFNULL(p.normalized_model, 'Bilinmiyor')", 15),
        pipeTypeShare: getDistribution("IFNULL(p.normalized_tube_type, 'Bilinmiyor')"),
        sizeShare: getDistribution("COALESCE(p.normalized_pipe_size, p.normalized_size, 'Bilinmiyor')", 15),
        trend: getSalesTrend()
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  });

  return router;
}

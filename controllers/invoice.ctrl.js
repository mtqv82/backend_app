const db = require("../config/db");

exports.getInvoices = async (req, res) => {
  try {
    const { fromDate, toDate, keyword } = req.query;

    let sql = `
      SELECT 
        i.id AS invoice_id,
        i.customer_name,
        i.customer_phone,
        i.customer_address,
        i.sub_total,
        i.discount,
        i.vat_amount,
        i.final_total,
        i.note AS invoice_note,
        i.created_at,
        d.id AS detail_id,
        d.product_sku,
        d.product_name,
        d.qty,
        d.price,
        d.cost_price,
        d.warranty,
        d.serials,
        COALESCE(p.category, 'Linh kiện') AS category
      FROM invoices i
      LEFT JOIN invoice_details d ON i.id = d.invoice_id
      LEFT JOIN products p ON d.product_sku = p.sku
      WHERE 1=1
    `;

    const params = [];

    if (fromDate) {
      sql += ` AND DATE(i.created_at) >= ?`;
      params.push(fromDate);
    }

    if (toDate) {
      sql += ` AND DATE(i.created_at) <= ?`;
      params.push(toDate);
    }

    if (keyword && keyword.trim() !== "") {
      const kw = `%${keyword.trim()}%`;
      sql += ` AND (
        i.customer_name LIKE ? OR 
        i.customer_phone LIKE ? OR 
        d.product_name LIKE ? OR 
        d.product_sku LIKE ? OR 
        d.serials LIKE ? OR
        CAST(i.id AS CHAR) LIKE ?
      )`;
      params.push(kw, kw, kw, kw, kw, kw);
    }

    sql += ` ORDER BY i.created_at DESC, i.id DESC, d.id ASC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("LỖI LẤY LỊCH SỬ HÓA ĐƠN:", err.message);
    res.status(500).json({ error: err.message });
  }
};

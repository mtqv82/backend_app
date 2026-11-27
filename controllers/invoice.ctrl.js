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

    sql += `ORDER BY i.created_at DESC, i.id DESC, d.id ASC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("LỖI LẤY LỊCH SỬ HÓA ĐƠN:", err.message);
    res.status(500).json({ error: err.message });
  }
};
exports.getInvoiceDetailById = async (req, res) => {
  try {
    const sql = `
      SELECT 
        i.*, 
        d.id AS detail_id, d.product_sku, d.product_name, d.qty, d.price, d.cost_price, d.warranty, d.serials, 
        p.category 
      FROM invoices i
      LEFT JOIN invoice_details d ON i.id = d.invoice_id
      LEFT JOIN products p ON d.product_sku = p.sku
      WHERE i.id = ? 
    `;
    const [rows] = await db.query(sql, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error("LỖI LẤY CHI TIẾT HÓA ĐƠN THEO ID:", err.message);
    res.status(500).json({ error: "Lỗi kết nối máy chủ khi lấy chi tiết đơn" });
  }
};

exports.getCustomerHistory = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || phone.trim() === "" || phone === "null") return res.json([]);

    const sql = `
      SELECT 
        i.id, 
        i.final_total, 
        i.debt_amount, 
        i.created_at,
        i.note,
        (
          -- Giữ nguyên chuỗi để in ra bảng (như cũ)
          SELECT GROUP_CONCAT(CONCAT('- ', d.qty, 'x ', d.product_name) SEPARATOR '\\n')
          FROM invoice_details d
          WHERE d.invoice_id = i.id
        ) as items_list,
        (
          -- TẠO MẢNG JSON CHUẨN ĐỂ ĐỔI TRẢ HÀNG
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'sku', d.product_sku,
              'name', d.product_name,
              'qty', d.qty,
              'price', d.price,
              'serials', d.serials 
            )
          )
          FROM invoice_details d
          WHERE d.invoice_id = i.id
        ) as raw_items
      FROM invoices i 
      WHERE i.customer_phone = ? 
      ORDER BY i.created_at DESC
    `;
    const [rows] = await db.query(sql, [phone]);

    // Đảm bảo raw_items luôn được parse thành mảng object nếu MySQL trả về chuỗi JSON
    const formattedRows = rows.map(row => {
      if (typeof row.raw_items === 'string') {
        try { row.raw_items = JSON.parse(row.raw_items); } catch (e) { }
      }
      // Xử lý parse cột serials bên trong từng item nếu đang lưu dạng chuỗi JSON
      if (Array.isArray(row.raw_items)) {
        row.raw_items.forEach(item => {
          if (typeof item.serials === 'string') {
            try { item.serials = JSON.parse(item.serials); } catch (e) { item.serials = []; }
          }
        });
      }
      return row;
    });

    res.json(formattedRows);
  } catch (err) {
    console.error("LỖI LẤY LỊCH SỬ:", err.message);
    res.status(500).json({ error: err.message });
  }
};
exports.returnInvoiceItems = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { invoiceId, itemsToReturn } = req.body;
    // itemsToReturn là mảng chứa các món khách chọn trả: [{ sku, qty, price, serials }]

    let totalRefund = 0;

    for (let item of itemsToReturn) {
      // 1. Cộng trả lại tồn kho
      await conn.query(
        "UPDATE products SET stock = stock + ? WHERE sku = ?",
        [item.qty, item.sku]
      );

      // 2. Chuyển trạng thái các mã Serial (nếu có) từ SOLD về lại IN_STOCK
      if (item.serials && item.serials.length > 0) {
        for (let sn of item.serials) {
          await conn.query(
            "UPDATE product_serials SET status = 'IN_STOCK' WHERE serial_number = ? AND product_sku = ?",
            [sn, item.sku]
          );
        }
      }

      // 3. Tính tổng tiền cần trừ ra khỏi hóa đơn
      totalRefund += item.price * item.qty;
    }

    // 4. Cập nhật lại tổng tiền Hóa đơn và tự động thêm Ghi chú
    await conn.query(`
      UPDATE invoices
      SET final_total = final_total - ?,
      note = CONCAT(IFNULL(note, ''), ' | Đã nhận trả ', ? , ' món hàng.')
  WHERE id = ?
    `, [totalRefund, itemsToReturn.length, invoiceId]);

    await conn.commit();
    res.json({
      success: true,
      message: `Trả hàng thành công! Cần hoàn lại cho khách: ${totalRefund.toLocaleString('vi-VN')} đ`
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};
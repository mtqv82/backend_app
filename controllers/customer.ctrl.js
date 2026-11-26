const db = require("../config/db");

exports.getCustomers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        c.*,
        COUNT(i.id) AS order_count,
        COALESCE(SUM(i.final_total), 0) AS total_spent
      FROM customers c
      LEFT JOIN invoices i
        ON i.customer_id = c.id
        OR (i.customer_id IS NULL AND c.phone <> '' AND i.customer_phone = c.phone)
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCustomerField = async (req, res) => {
  try {
    const { field, value } = req.body;
    const allowedFields = ["name", "phone", "type", "address", "note"];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: "Cột không hợp lệ!" });
    }

    await db.query(`UPDATE customers SET ${field}=? WHERE id=?`, [
      value,
      req.params.id,
    ]);
    res.json({ message: "Cập nhật thành công" });
  } catch (err) {
    console.error("LỖI SỬA KHÁCH HÀNG:", err.message);
    if (err.code === "ER_DUP_ENTRY" && err.message.includes("phone")) {
      return res
        .status(400)
        .json({ error: "Lỗi: Số điện thoại này đã tồn tại trong hệ thống!" });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await db.query("DELETE FROM customers WHERE id=?", [req.params.id]);
    res.json({ message: "Đã xóa khách hàng" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addCustomer = async (req, res) => {
  try {
    const { customer_code, name, phone, type, address, note } = req.body;

    let code = customer_code;
    if (!code || code.trim() === "") {
      code = "KH" + Math.floor(Date.now() % 100000);
    }

    const [result] = await db.query(
      `INSERT INTO customers (customer_code, name, phone, type, address, note) VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, phone, type || "Khách lẻ", address, note],
    );
    res.json({ id: result.insertId, message: "Đã thêm khách hàng" });
  } catch (err) {
    console.error("LỖI THÊM KHÁCH HÀNG:", err.message);
    if (err.code === "ER_DUP_ENTRY") {
      if (err.message.includes("phone"))
        return res.status(400).json({ error: "Số điện thoại này đã tồn tại!" });
      if (err.message.includes("customer_code"))
        return res.status(400).json({ error: "Mã khách hàng này đã tồn tại!" });
    }
    res.status(500).json({ error: err.message });
  }
};

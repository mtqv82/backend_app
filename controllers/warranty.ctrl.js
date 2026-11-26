const db = require("../config/db");

// Lấy danh sách phiếu bảo hành
exports.getWarranties = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM warranties ORDER BY receive_date DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Tạo phiếu bảo hành mới
exports.addWarranty = async (req, res) => {
  try {
    const { customer_name, customer_phone, product_name, serial_number, issue_description, note } = req.body;
    const ticket_code = "BH" + String(Date.now()).slice(-6); // Tự sinh mã BH

    const [result] = await db.query(
      `INSERT INTO warranties (ticket_code, customer_name, customer_phone, product_name, serial_number, issue_description, note) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ticket_code, customer_name, customer_phone, product_name, serial_number, issue_description, note]
    );
    res.json({ id: result.insertId, ticket_code, message: "Tạo phiếu bảo hành thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật trạng thái phiếu bảo hành
exports.updateWarrantyStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const id = req.params.id;
    let query = `UPDATE warranties SET status = ?`;
    const params = [status];

    // Nếu trạng thái là 'Đã trả khách', cập nhật luôn ngày trả
    if (status === 'Đã trả khách') {
      query += `, return_date = NOW()`;
    }

    query += ` WHERE id = ?`;
    params.push(id);

    await db.query(query, params);
    res.json({ message: "Cập nhật trạng thái thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa phiếu bảo hành
exports.deleteWarranty = async (req, res) => {
  try {
    await db.query("DELETE FROM warranties WHERE id = ?", [req.params.id]);
    res.json({ message: "Đã xóa phiếu bảo hành" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
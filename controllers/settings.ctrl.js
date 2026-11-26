const db = require('../config/db');

exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM store_settings WHERE id = 1');
    
    res.json(rows[0] || {}); 
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const {
      name,
      address,
      phoneSales,
      phoneWarranty,
      fanpage,
      facebook,
      website,
      warranty_terms
    } = req.body;

    const sql = `
      UPDATE store_settings 
      SET name = ?, address = ?, phoneSales = ?, phoneWarranty = ?, 
          fanpage = ?, facebook = ?, website = ?, warranty_terms = ?
      WHERE id = 1
    `;
    
    const values = [
      name, address, phoneSales, phoneWarranty, 
      fanpage, facebook, website, warranty_terms
    ];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy cấu hình để cập nhật!" });
    }

    res.json({ success: true, message: "Cập nhật thông tin cửa hàng thành công!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
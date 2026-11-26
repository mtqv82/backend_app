const db = require("../config/db");

// Lấy danh sách sản phẩm
exports.getProducts = async (req, res) => {
  try {
    const query = `
      SELECT p.*, GROUP_CONCAT(ps.serial_number SEPARATOR ', ') AS serial_numbers 
      FROM products p 
      LEFT JOIN product_serials ps ON p.sku = ps.product_sku AND ps.status = 'IN_STOCK'
      GROUP BY p.id 
      ORDER BY p.id DESC
    `;
    const [rows] = await db.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Thêm sản phẩm mới (Dùng Transaction)
// Thêm sản phẩm mới (Dùng Transaction)
exports.addProduct = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      sku,
      name,
      category,
      brand,
      condition,
      sn,
      serial_numbers,
      costPrice,
      dealerPrice,
      retailPrice,
      warranty,
      note,
    } = req.body;

    let snArray = serial_numbers || [];

    // Sửa lỗi ở đây: Ép kiểu sn thành chuỗi trước khi dùng .split() để tránh sập Node.js
    if (!serial_numbers && sn) {
      snArray = String(sn)
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
    }

    let finalStock = parseInt(req.body.stock) || 0;
    if (snArray.length > 0) finalStock = snArray.length;

    // 1. Lưu sản phẩm vào bảng products
    const [result] = await conn.query(
      `INSERT INTO products (sku, name, category, brand, item_condition, stock, cost_price, dealer_price, retail_price, warranty, note) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku,
        name,
        category || "",
        brand || "",
        condition || "Mới 100%",
        finalStock,
        costPrice ? costPrice.toString().replace(/\D/g, "") : 0,
        dealerPrice ? dealerPrice.toString().replace(/\D/g, "") : 0,
        retailPrice ? retailPrice.toString().replace(/\D/g, "") : 0,
        warranty || "36 Tháng",
        note || "",
      ],
    );

    // 2. TỰ ĐỘNG LƯU THƯƠNG HIỆU MỚI (Nếu có nhập Hãng)
    if (brand && brand.trim() !== "") {
      await conn.query("INSERT IGNORE INTO brands (name) VALUES (?)", [
        brand.trim(),
      ]);
    }

    // 3. Lưu Serial Numbers (nếu có)
    if (snArray.length > 0) {
      for (let serial of snArray) {
        await conn.query(
          `INSERT INTO product_serials (product_sku, serial_number, status) VALUES (?, ?, 'IN_STOCK')`,
          [sku, serial],
        );
      }
    }

    await conn.commit();
    res.json({ id: result.insertId, message: "Đã thêm sản phẩm thành công" });
  } catch (err) {
    await conn.rollback();
    console.error("LỖI THÊM SẢN PHẨM:", err.message);

    // Tuyệt chiêu: Dịch lỗi khô khan của MySQL thành câu chữ thân thiện cho nhân viên
    if (err.code === "ER_DUP_ENTRY") {
      if (err.message.includes("serial")) {
        return res
          .status(400)
          .json({
            error:
              "Lỗi: Một trong các mã Serial (S/N) này đã tồn tại trong hệ thống!",
          });
      }
      if (err.message.includes("sku")) {
        return res
          .status(400)
          .json({ error: "Lỗi: Mã SKU này đã bị trùng với sản phẩm khác!" });
      }
    }

    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};
// Cập nhật sản phẩm
exports.updateProduct = async (req, res) => {
  try {
    const {
      sku,
      name,
      category,
      brand,
      condition,
      stock,
      costPrice,
      dealerPrice,
      retailPrice,
      warranty,
      note,
    } = req.body;
    await db.query(
      `UPDATE products 
       SET sku=?, name=?, category=?, brand=?, item_condition=?, stock=?, cost_price=?, dealer_price=?, retail_price=?, warranty=?, note=? 
       WHERE id=?`,
      [
        sku,
        name,
        category,
        brand,
        condition,
        stock,
        costPrice ? costPrice.toString().replace(/\D/g, "") : 0,
        dealerPrice ? dealerPrice.toString().replace(/\D/g, "") : 0,
        retailPrice ? retailPrice.toString().replace(/\D/g, "") : 0,
        warranty,
        note,
        req.params.id,
      ],
    );
    res.json({ message: "Đã cập nhật thông tin sản phẩm" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa sản phẩm
exports.deleteProduct = async (req, res) => {
  try {
    await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
    res.json({ message: "Đã xóa sản phẩm" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật nhanh Tên sản phẩm (Inline Edit)
// Cập nhật nhanh 1 ô bất kỳ (Inline Edit)
// Cập nhật nhanh 1 ô bất kỳ (Bao gồm cả Serial Numbers)
exports.updateProductField = async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { field, value } = req.body;
    // Thêm 'serial_numbers' vào danh sách cho phép
    const allowedFields = [
      "name",
      "category",
      "brand",
      "item_condition",
      "stock",
      "cost_price",
      "dealer_price",
      "retail_price",
      "warranty",
      "note",
      "serial_numbers",
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: "Cột không hợp lệ!" });
    }

    await conn.beginTransaction();

    // NẾU LÀ SỬA SERIAL NUMBERS (S/N)
    if (field === "serial_numbers") {
      // 1. Lấy SKU của sản phẩm hiện tại
      const [prod] = await conn.query("SELECT sku FROM products WHERE id=?", [
        req.params.id,
      ]);
      if (prod.length === 0) throw new Error("Không tìm thấy sản phẩm");
      const currentSku = prod[0].sku;

      // 2. Xóa toàn bộ Serial cũ của SKU này
      await conn.query("DELETE FROM product_serials WHERE product_sku=?", [
        currentSku,
      ]);

      // 3. Tách chuỗi S/N mới và thêm lại vào database
      let snArray = [];
      if (value && value.trim() !== "") {
        snArray = String(value)
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter((s) => s !== "");
        for (let serial of snArray) {
          // Dùng INSERT IGNORE để tránh lỗi trùng lặp khi người dùng lỡ gõ 2 mã giống nhau
          await conn.query(
            `INSERT IGNORE INTO product_serials (product_sku, serial_number, status) VALUES (?, ?, 'IN_STOCK')`,
            [currentSku, serial],
          );
        }
      }

      // 4. Cập nhật lại số lượng Tồn kho (stock) dựa trên số lượng Serial mới (nếu có Serial)
      // Nếu không có Serial nào (nhập rỗng), giữ nguyên tồn kho hiện tại (không thay đổi)
      if (snArray.length > 0) {
        await conn.query("UPDATE products SET stock=? WHERE id=?", [
          snArray.length,
          req.params.id,
        ]);
      }
    }
    // NẾU LÀ SỬA CÁC CỘT THÔNG THƯỜNG KHÁC
    else {
      let finalValue = value;
      // Chỉ giữ lại số cho các cột giá/tồn kho
      if (
        ["cost_price", "dealer_price", "retail_price", "stock"].includes(field)
      ) {
        finalValue = value.toString().replace(/\D/g, "");
        if (finalValue === "") finalValue = 0; // Tránh lỗi SQL null
      }
      await conn.query(`UPDATE products SET ${field}=? WHERE id=?`, [
        finalValue,
        req.params.id,
      ]);
    }

    await conn.commit();
    res.json({ message: "Đã cập nhật thành công" });
  } catch (err) {
    await conn.rollback();
    console.error("LỖI CẬP NHẬT:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};
// Nhập hàng loạt từ Excel
exports.importExcel = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const products = req.body; // Mảng danh sách linh kiện gửi từ Frontend
    let imported = 0;

    for (let p of products) {
      if (!p.name) continue; // Bỏ qua nếu dòng đó không có tên sản phẩm

      let finalStock = parseInt(p.stock) || 0;
      if (p.serial_numbers && p.serial_numbers.length > 0) {
        finalStock = p.serial_numbers.length; // Ưu tiên số lượng S/N
      }

      // Lệnh siêu xịn: Nếu chưa có SKU thì THÊM, nếu có rồi thì CẬP NHẬT GỘP TỒN KHO
      await conn.query(
        `INSERT INTO products (sku, name, category, brand, item_condition, stock, cost_price, dealer_price, retail_price, warranty, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         name=VALUES(name), stock=stock+VALUES(stock), cost_price=VALUES(cost_price), retail_price=VALUES(retail_price)`,
        [
          p.sku,
          p.name,
          p.category,
          p.brand,
          p.condition,
          finalStock,
          p.costPrice ? p.costPrice.toString().replace(/\D/g, "") : 0,
          p.dealerPrice ? p.dealerPrice.toString().replace(/\D/g, "") : 0,
          p.retailPrice ? p.retailPrice.toString().replace(/\D/g, "") : 0,
          p.warranty,
          p.note,
        ],
      );

      // ==========================================
      // TỰ ĐỘNG LƯU THƯƠNG HIỆU MỚI TỪ EXCEL
      // ==========================================
      if (p.brand && p.brand.trim() !== "") {
        await conn.query("INSERT IGNORE INTO brands (name) VALUES (?)", [
          p.brand.trim(),
        ]);
      }
      // ==========================================

      // Thêm các mã S/N (Dùng INSERT IGNORE để bỏ qua nếu mã S/N bị trùng)
      if (p.serial_numbers && p.serial_numbers.length > 0) {
        for (let sn of p.serial_numbers) {
          await conn.query(
            `INSERT IGNORE INTO product_serials (product_sku, serial_number, status) VALUES (?, ?, 'IN_STOCK')`,
            [p.sku, sn],
          );
        }
      }
      imported++;
    }

    await conn.commit();
    res.json({ message: `Đã nhập thành công ${imported} dòng sản phẩm!` });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

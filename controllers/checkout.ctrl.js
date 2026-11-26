const db = require("../config/db");

exports.processCheckout = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { customer = {}, totals = {}, cart = [] } = req.body || {};

    if (!Array.isArray(cart) || cart.length === 0) {
      return res
        .status(400)
        .json({ error: "Giỏ hàng trống, không thể thanh toán." });
    }

    const rawName = (customer.cusName || "").trim();
    const cusName = rawName || "Khách lẻ";
    const cusPhone = (customer.cusPhone || "").trim();
    const cusAddress = (customer.cusAddress || "").trim();

    const subTotal = Number(totals.subTotal) || 0;
    const discount = Number(totals.discount) || 0;
    const vatAmount = Number(totals.vatAmount) || 0;
    const finalTotal = Number(totals.finalTotal) || 0;
    const note = totals.note || "";

    await connection.beginTransaction();

    let customerId = null;

    const isWalkIn =
      cusName.toLowerCase() === "khách lẻ" && !cusPhone && !cusAddress;

    if (!isWalkIn) {
      let existing = [];
      if (cusPhone) {
        const [rows] = await connection.query(
          `SELECT id, address FROM customers WHERE phone = ? LIMIT 1`,
          [cusPhone],
        );
        existing = rows;
      } else if (rawName && rawName.toLowerCase() !== "khách lẻ") {
        const [rows] = await connection.query(
          `SELECT id, address FROM customers WHERE name = ? LIMIT 1`,
          [rawName],
        );
        existing = rows;
      }

      if (existing.length > 0) {
        customerId = existing[0].id;
        if (cusAddress) {
          await connection.query(
            `UPDATE customers SET name = ?, phone = COALESCE(NULLIF(?, ''), phone), address = ? WHERE id = ?`,
            [cusName, cusPhone, cusAddress, customerId],
          );
        }
      } else {
        const code = "KH" + String(Date.now()).slice(-6);
        const [cusRes] = await connection.query(
          `INSERT INTO customers (customer_code, name, phone, address, customer_type)
           VALUES (?, ?, ?, ?, 'Khách lẻ')`,
          [code, cusName, cusPhone, cusAddress],
        );
        customerId = cusRes.insertId;
      }
    }

    const [invResult] = await connection.query(
      `INSERT INTO invoices (customer_id, customer_name, customer_phone, customer_address, sub_total, discount, vat_amount, final_total, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        customerId,
        cusName,
        cusPhone,
        cusAddress,
        subTotal,
        discount,
        vatAmount,
        finalTotal,
        note,
      ],
    );
    const invoiceId = invResult.insertId;

    for (const item of cart) {
      const qty = Number(item.qty) || 0;
      const price = Number(item.price) || 0;
      const cost = Number(item.cost) || 0;
      const warranty = item.warranty || "";
      const serialNote = (item.serial_note || "").trim();

      if (!item.sku || qty <= 0) {
        throw new Error(
          `Dữ liệu sản phẩm không hợp lệ (${item.name || "không tên"}).`,
        );
      }

      const [updateProduct] = await connection.query(
        `UPDATE products SET stock = stock - ? WHERE sku = ? AND stock >= ?`,
        [qty, item.sku, qty],
      );

      if (updateProduct.affectedRows === 0) {
        throw new Error(
          `Sản phẩm [${item.sku}] ${item.name} không đủ số lượng tồn kho!`,
        );
      }

      if (serialNote) {
        const serialArray = serialNote
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (serialArray.length > 0) {
          const [updateSerials] = await connection.query(
            `UPDATE product_serials
             SET status = 'SOLD', invoice_id = ?
             WHERE product_sku = ? AND status = 'IN_STOCK' AND serial_number IN (?)`,
            [invoiceId, item.sku, serialArray],
          );

          if (updateSerials.affectedRows !== serialArray.length) {
            throw new Error(
              `Một hoặc nhiều Serial của [${item.sku}] không tồn tại hoặc không còn ở trạng thái IN_STOCK.`,
            );
          }
        }
      }

      await connection.query(
        `INSERT INTO invoice_details (invoice_id, product_sku, product_name, qty, price, cost_price, warranty, serials)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.sku,
          item.name,
          qty,
          price,
          cost,
          warranty,
          serialNote,
        ],
      );
    }

    await connection.commit();
    res.json({
      success: true,
      message: "Thanh toán thành công",
      invoiceId,
      customerId,
    });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {}
    console.error(err.message);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

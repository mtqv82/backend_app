const express = require("express");
const cors = require("cors");
const db = require("./config/db");

// Import các Routes
const productRoutes = require("./routes/product.routes");
const categoryRoutes = require("./routes/category.routes");
const brandRoutes = require("./routes/brand.routes");
const customerRoutes = require("./routes/customer.routes");
const checkoutRoutes = require("./routes/checkout.route");
const invoiceRoutes = require("./routes/invoice.route");
const warrantyRoutes = require("./routes/warranty.route");
const settingsRoutes = require("./routes/settings.routes");

const app = express();
app.use(cors());
app.use(express.json());
// app.use((req, res, next) => {
//   console.log("\n=== CÓ REQUEST TỪ FRONTEND GỬI LÊN ===");
//   console.log("👉 1. API:", req.method, req.url);
//   console.log("👉 2. Content-Type (Định dạng FE gửi):", req.headers['content-type']);
//   console.log("👉 3. Dữ liệu trong Body:", req.body);
//   console.log("======================================\n");
//   next(); // Bắt buộc có next() để nó chạy tiếp vào Controller của bạn
// });
// ======================== API HỆ THỐNG ========================
app.get("/api/status", async (req, res) => {
  try {
    await db.query("SELECT 1");
    const config = db.getConfig();
    res.json({
      ok: true,
      host: config.mysql.host,
      database: config.mysql.database,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/config", async (req, res) => {
  try {
    const { host, port, user, password, database } = req.body;
    db.updateConfig({
      host,
      port: Number(port) || 3306,
      user,
      password,
      database,
    });

    await db.query("SELECT 1");
    res.json({ ok: true, message: "Kết nối MySQL LAN thành công!" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/warranties", warrantyRoutes);
app.use("/api/settings", settingsRoutes);


// Bật Server
const port = db.getConfig().server.api_port || 3456;
app.listen(port, "0.0.0.0", () => {
  console.log(`[QuocVuongPC] LAN API Server đang chạy tại cổng ${port}`);
  console.log(`[QuocVuongPC] Đang kết nối MySQL: ${db.getConfig().mysql.host}`);
});

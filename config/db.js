const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', '..', 'lan-config.json');
let config = {
  mysql: { host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'quocvuong_pc' },
  server: { api_port: 3456 }
};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('Lỗi đọc file lan-config.json:', err.message);
  }
}

let pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0
});

// Xuất các hàm để các file khác sử dụng
module.exports = {
  query: (...args) => pool.query(...args),
  getConnection: () => pool.getConnection(),
  getConfig: () => config,
  updateConfig: (newMysqlConfig) => {
    // Cập nhật config và tạo lại pool kết nối mới
    config.mysql = { ...config.mysql, ...newMysqlConfig };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    pool = mysql.createPool({ ...config.mysql, waitForConnections: true, connectionLimit: 15 });
  }
};
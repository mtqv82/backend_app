const db = require('../config/db');

exports.getBrands = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM brands ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const express = require('express');
const router = express.Router();
const brandCtrl = require('../controllers/brand.ctrl');

router.get('/', brandCtrl.getBrands);

module.exports = router;
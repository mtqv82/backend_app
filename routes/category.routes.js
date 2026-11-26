const express = require('express');
const router = express.Router();
const categoryCtrl = require('../controllers/category.ctrl');

router.get('/', categoryCtrl.getCategories);

module.exports = router;
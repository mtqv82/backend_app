const express = require('express');
const router = express.Router();
const productCtrl = require('../controllers/product.ctrl');

router.get('/', productCtrl.getProducts);
router.post('/', productCtrl.addProduct);
router.put('/:id', productCtrl.updateProduct);
router.delete('/:id', productCtrl.deleteProduct);

// DÒNG NÀY RẤT QUAN TRỌNG ĐỂ KHÔNG BỊ LỖI 404
router.put('/:id/field', productCtrl.updateProductField);
router.post('/import', productCtrl.importExcel); 
module.exports = router;
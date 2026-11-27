const express = require('express');
const router = express.Router();
const productCtrl = require('../controllers/product.ctrl');

router.get('/', productCtrl.getProducts);
router.post('/', productCtrl.addProduct);
router.put('/:id', productCtrl.updateProduct);
router.delete('/:id', productCtrl.deleteProduct);

router.put('/:id/field', productCtrl.updateProductField);
router.post('/import', productCtrl.importExcel); 
module.exports = router;
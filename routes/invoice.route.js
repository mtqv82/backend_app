const express = require("express");
const router = express.Router();
const invoiceCtrl = require("../controllers/invoice.ctrl");

router.post('/return', invoiceCtrl.returnInvoiceItems)
router.get("/history", invoiceCtrl.getCustomerHistory);

router.get("/", invoiceCtrl.getInvoices);
router.get("/:id", invoiceCtrl.getInvoiceDetailById);
module.exports = router;
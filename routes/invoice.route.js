const express = require("express");
const router = express.Router();
const invoiceCtrl = require("../controllers/invoice.ctrl");


router.get("/", invoiceCtrl.getInvoices);


router.get("/history", invoiceCtrl.getCustomerHistory);


router.get("/:id", invoiceCtrl.getInvoiceDetailById);

module.exports = router;
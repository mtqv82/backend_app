const express = require("express");
const router = express.Router();
const invoiceCtrl = require("../controllers/invoice.ctrl");

router.get("/", invoiceCtrl.getInvoices);

module.exports = router;

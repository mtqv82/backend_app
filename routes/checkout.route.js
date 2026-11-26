const express = require("express");
const router = express.Router();
const checkoutCtrl = require("../controllers/checkout.ctrl");

// API Endpoint: POST /api/checkout
router.post("/", checkoutCtrl.processCheckout);

module.exports = router;

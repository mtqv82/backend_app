const express = require("express");
const router = express.Router();
const warrantyCtrl = require("../controllers/warranty.ctrl");

router.get("/", warrantyCtrl.getWarranties);
router.post("/", warrantyCtrl.addWarranty);
router.put("/:id/status", warrantyCtrl.updateWarrantyStatus);
router.delete("/:id", warrantyCtrl.deleteWarranty);

module.exports = router;
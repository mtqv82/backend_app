const express = require("express");
const router = express.Router();
const customerCtrl = require("../controllers/customer.ctrl");

router.get("/", customerCtrl.getCustomers);
router.put("/:id/field", customerCtrl.updateCustomerField);
router.delete("/:id", customerCtrl.deleteCustomer);
router.post("/", customerCtrl.addCustomer); // CHÈN THÊM DÒNG NÀY
module.exports = router;

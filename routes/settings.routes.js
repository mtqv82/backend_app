const express = require("express");
const router = express.Router();
const settingsCtrl = require("../controllers/settings.ctrl");

router.get("/", settingsCtrl.getSettings);

router.put("/", settingsCtrl.updateSettings);

module.exports = router;
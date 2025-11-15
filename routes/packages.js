const express = require("express");
const store = require("../data/store");

const router = express.Router();

router.get("/", (_req, res) => {
  const packages = store.listPackages();
  res.json({ data: packages });
});

module.exports = router;

const express = require("express");
const store = require("../data/store");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ data: [req.workspace] });
});

router.get("/:id", (req, res) => {
  if (req.params.id !== req.workspace.id) {
    return res.status(404).json({ error: "Workspace not found" });
  }
  const workspace = store.getWorkspace(req.workspace.id);
  res.json({ data: workspace });
});

router.get("/:id/forms", (req, res) => {
  if (req.params.id !== req.workspace.id) {
    return res.status(404).json({ error: "Workspace not found" });
  }
  const forms = store.listFormsSummary({ workspaceId: req.workspace.id });
  res.json({ data: forms });
});

module.exports = router;

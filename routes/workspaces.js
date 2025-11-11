const express = require("express");
const store = require("../data/store");

const router = express.Router();

router.get("/", (_req, res) => {
  const workspaces = store.listWorkspaces();
  res.json({ data: workspaces });
});

router.get("/:id", (req, res) => {
  const workspace = store.getWorkspace(req.params.id);
  if (!workspace) {
    return res.status(404).json({ error: "Workspace not found" });
  }
  res.json({ data: workspace });
});

router.get("/:id/forms", (req, res) => {
  const workspace = store.getWorkspace(req.params.id);
  if (!workspace) {
    return res.status(404).json({ error: "Workspace not found" });
  }
  const forms = store.listFormsSummary({ workspaceId: workspace.id });
  res.json({ data: forms });
});

module.exports = router;

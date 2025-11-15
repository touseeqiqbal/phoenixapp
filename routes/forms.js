const express = require("express");
const store = require("../data/store");
const { dispatchSubmissionNotification } = require("../utils/notifications");

const router = express.Router();

function getOrigin(req) {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.protocol;
  return `${proto}://${req.get("host")}`;
}

function toFormResponse(form, req, options = {}) {
  if (!form) return null;
  const origin = getOrigin(req);
  const includeStats = options.includeStats ?? false;
  const payload = {
    id: form.id,
    workspaceId: form.workspaceId,
    name: form.name,
    slug: form.slug,
    description: form.description,
    version: form.version,
    isPublished: form.isPublished,
    visibility: form.visibility,
    fields: form.fields,
    settings: form.settings,
    shareKey: form.shareKey,
    shareUrl: `${origin}/share/${form.shareKey}`,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt
  };
  if (includeStats) {
    payload.submissionCount = store.getSubmissionCount(form.id);
    payload.lastSubmissionAt = store.getLastSubmissionAt(form.id);
  }
  return payload;
}

function ensureWorkspaceAccess(req, res, form) {
  if (!form || form.workspaceId !== req.workspace.id) {
    res.status(404).json({ error: "Form not found" });
    return false;
  }
  return true;
}

router.get("/", (req, res) => {
  const { includeStats } = req.query;
  const forms = store.listFormsSummary({ workspaceId: req.workspace.id }).map((form) =>
    toFormResponse(form, req, { includeStats: includeStats !== "false" })
  );
  res.json({ data: forms });
});

router.post("/", (req, res) => {
  const { name, description, fields, settings, isPublished, visibility } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Form name is required" });
  }
  if (!Array.isArray(fields)) {
    return res.status(400).json({ error: "Fields must be an array" });
  }
  try {
    const form = store.createForm({
      name,
      description,
      fields,
      settings,
      workspaceId: req.workspace.id,
      isPublished,
      visibility
    });
    res.status(201).json({ data: toFormResponse(form, req) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to create form" });
  }
});

router.get("/:id", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  res.json({ data: toFormResponse(form, req) });
});

router.put("/:id", (req, res) => {
  try {
    const form = store.updateForm(req.params.id, req.body ?? {});
    if (!ensureWorkspaceAccess(req, res, form)) {
      return;
    }
    res.json({ data: toFormResponse(form, req) });
  } catch (error) {
    if (error.message.includes("Fields must be an array")) {
      return res.status(400).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: "Unable to update form" });
  }
});

router.delete("/:id", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  store.deleteForm(req.params.id);
  res.status(204).end();
});

router.post("/:id/share", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  if (form.visibility === "private") {
    return res.status(400).json({ error: "Private forms cannot generate share links" });
  }
  const shareKey = store.regenerateShareKey(form.id);
  const updated = store.getForm(form.id);
  res.json({ data: { shareKey, shareUrl: `${getOrigin(req)}/share/${shareKey}` } });
});

router.post("/:id/publish", (req, res) => {
  const { isPublished = true } = req.body ?? {};
  const form = store.updateForm(req.params.id, { isPublished: Boolean(isPublished) });
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  res.json({ data: toFormResponse(form, req) });
});

router.get("/:id/submissions", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  const submissions = store.listSubmissions(form.id);
  res.json({ data: submissions });
});

router.post("/:id/submissions", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  const payload = req.body ?? {};
  const missing = (form.fields || [])
    .filter((field) => field.required)
    .filter((field) => {
      const value = payload[field.id];
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return value === undefined || value === null || value === "";
    })
    .map((field) => field.id);
  if (missing.length) {
    return res.status(400).json({ error: "Missing required fields", fields: missing });
  }
  const submission = store.addSubmission(form.id, payload);
  const workspace = req.workspace || store.getWorkspace(form.workspaceId);
  dispatchSubmissionNotification({ form, submission, workspace });
  res.status(201).json({ data: submission });
});

router.get("/:id/export.csv", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!ensureWorkspaceAccess(req, res, form)) {
    return;
  }
  const submissions = store.listSubmissions(form.id);
  const metaHeaders = [];
  if (form.settings?.autoCalculateDuration) {
    metaHeaders.push("Duration (minutes)");
  }
  const headers = ["Submission ID", "Submitted At", ...form.fields.map((field) => field.label ?? field.id), ...metaHeaders];
  const rows = submissions.map((submission) => {
    const base = [
      submission.id,
      submission.submittedAt,
      ...form.fields.map((field) => formatField(submission.data[field.id]))
    ];
    if (form.settings?.autoCalculateDuration) {
      base.push(submission.data.__durationMinutes ?? "");
    }
    return base;
  });
  res.header("Content-Type", "text/csv");
  res.attachment(`${form.slug || form.id}-submissions.csv`);
  const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  res.send(csvContent);
});

function formatField(value) {
  if (Array.isArray(value)) {
    return value.join("; ");
  }
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

module.exports = router;

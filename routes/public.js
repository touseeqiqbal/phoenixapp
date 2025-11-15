const express = require("express");
const store = require("../data/store");
const { dispatchSubmissionNotification } = require("../utils/notifications");

const router = express.Router();

function sanitizeForm(form) {
  if (!form) return null;
  const { fields, settings, name, description, workspaceId, slug } = form;
  return {
    name,
    description,
    workspaceId,
    slug,
    isPublished: form.isPublished,
    visibility: form.visibility,
    settings,
    fields
  };
}

function validateRequiredFields(form, payload) {
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
  return missing;
}

router.get("/forms/:shareKey", (req, res) => {
  const form = store.getFormByShareKey(req.params.shareKey);
  if (!form || !form.isPublished || form.visibility === "private") {
    return res.status(404).json({ error: "Form not found or not published" });
  }
  const workspace = store.getWorkspace(form.workspaceId);
  res.json({
    data: {
      form: sanitizeForm(form),
      workspace: workspace
        ? {
            id: workspace.id,
            name: workspace.name,
            color: workspace.color
          }
        : null
    }
  });
});

router.post("/forms/:shareKey/submissions", (req, res) => {
  const form = store.getFormByShareKey(req.params.shareKey);
  if (!form || !form.isPublished || form.visibility === "private") {
    return res.status(404).json({ error: "Form not found or not published" });
  }
  const payload = req.body ?? {};
  const missing = validateRequiredFields(form, payload);
  if (missing.length) {
    return res.status(400).json({ error: "Missing required fields", fields: missing });
  }
  const durationConfig = form.settings?.autoCalculateDuration;
  if (durationConfig) {
    const { startField, endField } = durationConfig;
    const start = payload[startField];
    const end = payload[endField];
    if (start && end) {
      const minutes = calculateDurationMinutes(start, end);
      if (minutes !== null) {
        payload.__durationMinutes = minutes;
      }
    }
  }
  const submission = store.addSubmission(form.id, payload);
  const workspace = store.getWorkspace(form.workspaceId);
  dispatchSubmissionNotification({ form, submission, workspace });
  res.status(201).json({ data: { id: submission.id, submittedAt: submission.submittedAt } });
});

function calculateDurationMinutes(start, end) {
  const [sh, sm] = String(start).split(":").map(Number);
  const [eh, em] = String(end).split(":").map(Number);
  const startMinutes = sh * 60 + (sm || 0);
  const endMinutes = eh * 60 + (em || 0);
  const diff = endMinutes - startMinutes;
  return Number.isFinite(diff) && diff > 0 ? diff : null;
}

module.exports = router;

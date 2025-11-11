const express = require("express");
const cors = require("cors");
const path = require("path");
const store = require("./data/store");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/forms", (_req, res) => {
  const forms = store.listForms().map((form) => ({
    id: form.id,
    name: form.name,
    description: form.description,
    version: form.version,
    fields: form.fields,
    settings: form.settings,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt
  }));
  res.json({ data: forms });
});

app.post("/api/forms", (req, res) => {
  const { name, description, fields, settings } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Form name is required" });
  }
  if (!Array.isArray(fields)) {
    return res.status(400).json({ error: "Fields must be an array" });
  }
  const form = store.createForm({ name, description, fields, settings });
  res.status(201).json({ data: form });
});

app.get("/api/forms/:id", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: "Form not found" });
  }
  res.json({ data: form });
});

app.put("/api/forms/:id", (req, res) => {
  const updates = req.body ?? {};
  if (updates.fields && !Array.isArray(updates.fields)) {
    return res.status(400).json({ error: "Fields must be an array" });
  }
  const form = store.updateForm(req.params.id, updates);
  if (!form) {
    return res.status(404).json({ error: "Form not found" });
  }
  res.json({ data: form });
});

app.delete("/api/forms/:id", (req, res) => {
  const deleted = store.deleteForm(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Form not found" });
  }
  res.status(204).end();
});

app.get("/api/forms/:id/submissions", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: "Form not found" });
  }
  const submissions = store.listSubmissions(form.id);
  res.json({ data: submissions });
});

app.post("/api/forms/:id/submissions", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: "Form not found" });
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
  res.status(201).json({ data: submission });
});

app.get("/api/forms/:id/export.csv", (req, res) => {
  const form = store.getForm(req.params.id);
  if (!form) {
    return res.status(404).json({ error: "Form not found" });
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
  res.attachment(`${form.id}-submissions.csv`);
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

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(publicDir, "index.html"));
  }
  return next();
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

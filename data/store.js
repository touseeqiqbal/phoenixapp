const fs = require("fs");
const path = require("path");

let crypto;
try {
  crypto = require("node:crypto");
} catch (error) {
  crypto = {
    randomUUID() {
      return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    },
    randomBytes(size) {
      const buffer = Buffer.alloc(size);
      for (let i = 0; i < size; i += 1) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
      return buffer;
    }
  };
}

const DB_PATH = path.join(__dirname, "db.json");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugify(input) {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || `form-${Math.random().toString(36).slice(2, 8)}`;
}

function randomId(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

function uniqueShareKey(existing) {
  const existingKeys = new Set(existing);
  let attempt = 0;
  while (attempt < 10) {
    attempt += 1;
    let key;
    if (typeof crypto.randomBytes === "function") {
      key = crypto.randomBytes(6).toString("base64url");
    } else {
      key = Math.random().toString(36).slice(2, 10);
    }
    if (!existingKeys.has(key)) {
      return key;
    }
  }
  throw new Error("Unable to generate unique share key");
}

const nowIso = () => new Date().toISOString();

const defaultData = {
  workspaces: [
    {
      id: "workspace-demo",
      name: "Demo Landscaping Workspace",
      slug: "demo-landscaping",
      color: "#38bdf8",
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ],
  forms: [
    {
      id: "landscaping-daily-log",
      workspaceId: "workspace-demo",
      name: "Landscaping Daily Service Log",
      slug: "landscaping-daily-service-log",
      description:
        "Capture daily visit details for billing and quality tracking. Configure crews, services, and materials used.",
      version: 1,
      isPublished: true,
      shareKey: null,
      fields: [
        {
          id: "company",
          type: "select",
          label: "Company",
          required: true,
          placeholder: "Select company",
          options: [
            { value: "green-ways", label: "Green Ways Landscaping" },
            { value: "evergreen", label: "Evergreen Grounds Co." }
          ]
        },
        {
          id: "crewMember",
          type: "select",
          label: "Crew Member",
          required: true,
          placeholder: "Who completed the visit?",
          options: [
            { value: "jordan", label: "Jordan Ellis" },
            { value: "sky", label: "Sky Chen" },
            { value: "drew", label: "Drew Patel" },
            { value: "nina", label: "Nina Gomez" },
            { value: "hassan", label: "Hassan Price" }
          ],
          conditionalGroups: [
            {
              when: { field: "company", equals: "green-ways" },
              options: [
                { value: "jordan", label: "Jordan Ellis" },
                { value: "sky", label: "Sky Chen" },
                { value: "drew", label: "Drew Patel" }
              ]
            },
            {
              when: { field: "company", equals: "evergreen" },
              options: [
                { value: "nina", label: "Nina Gomez" },
                { value: "hassan", label: "Hassan Price" }
              ]
            }
          ]
        },
        {
          id: "property",
          type: "select",
          label: "Property / Site",
          required: true,
          placeholder: "Select property",
          options: [
            { value: "prop-fairview", label: "Fairview Corporate Campus" },
            { value: "prop-lakewood", label: "Lakewood HOA - Phase 2" },
            { value: "prop-summit", label: "Summit Heights Medical" },
            { value: "prop-hillside", label: "Hillside Retail Plaza" },
            { value: "prop-maple", label: "Maple Ridge Apartments" }
          ]
        },
        {
          id: "serviceDate",
          type: "date",
          label: "Service Date",
          required: true
        },
        {
          id: "startTime",
          type: "time",
          label: "Arrival Time",
          required: true
        },
        {
          id: "endTime",
          type: "time",
          label: "Departure Time",
          required: true
        },
        {
          id: "services",
          type: "checkbox-group",
          label: "Services Performed",
          required: true,
          options: [
            { value: "mowing", label: "Mowing" },
            { value: "trimming", label: "String Trimming" },
            { value: "edging", label: "Edging" },
            { value: "blowing", label: "Leaf Blowing" },
            { value: "pruning", label: "Shrub Pruning" },
            { value: "beds", label: "Bed Maintenance" },
            { value: "fert", label: "Fertilization" },
            { value: "irrigation", label: "Irrigation Check" },
            { value: "seasonal", label: "Seasonal Cleanup" }
          ]
        },
        {
          id: "materialsUsed",
          type: "textarea",
          label: "Materials Used",
          placeholder: "Mulch bags, fertilizer, replacement plants, etc."
        },
        {
          id: "siteNotes",
          type: "textarea",
          label: "Site Notes / Issues",
          placeholder: "Gates locked, irrigation leaks, customer requests…"
        },
        {
          id: "followUps",
          type: "textarea",
          label: "Follow-Up Actions Needed",
          placeholder: "Schedule aeration, quote seasonal plantings…"
        },
        {
          id: "status",
          type: "select",
          label: "Status",
          required: true,
          defaultValue: "completed",
          options: [
            { value: "completed", label: "Completed" },
            { value: "needs-attention", label: "Needs Attention" },
            { value: "customer-hold", label: "Customer Hold" }
          ]
        },
        {
          id: "customerSignature",
          type: "text",
          label: "Customer Signature (optional)",
          placeholder: "Type name if collected"
        },
        {
          id: "photos",
          type: "file",
          label: "Upload Photos",
          accepts: ["image/png", "image/jpeg", "image/webp"],
          multiple: true
        }
      ],
      settings: {
        allowCsvExport: true,
        autoCalculateDuration: { startField: "startTime", endField: "endTime" },
        notifications: {
          enabled: false
        }
      },
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ],
  submissions: []
};

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.load();
    this.normalizeData();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2));
        return deepClone(defaultData);
      }
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        workspaces: parsed.workspaces ?? [],
        forms: parsed.forms ?? [],
        submissions: parsed.submissions ?? []
      };
    } catch (error) {
      console.error("Failed to load store", error);
      return deepClone(defaultData);
    }
  }

  normalizeData() {
    let mutated = false;
    if (!Array.isArray(this.data.workspaces)) {
      this.data.workspaces = deepClone(defaultData.workspaces);
      mutated = true;
    }
    if (!Array.isArray(this.data.forms)) {
      this.data.forms = [];
      mutated = true;
    }
    if (!Array.isArray(this.data.submissions)) {
      this.data.submissions = [];
      mutated = true;
    }

    const existingKeys = new Set(this.data.forms.map((form) => form.shareKey).filter(Boolean));
    this.data.forms = this.data.forms.map((form) => {
      const normalized = {
        id: form.id ?? randomId("form"),
        workspaceId: form.workspaceId ?? this.data.workspaces[0]?.id ?? "default-workspace",
        name: form.name ?? "Untitled Form",
        slug: form.slug ?? slugify(form.name ?? form.id),
        description: form.description ?? "",
        version: form.version ?? 1,
        isPublished: form.isPublished ?? false,
        shareKey: form.shareKey ?? uniqueShareKey(existingKeys),
        fields: Array.isArray(form.fields) ? form.fields : [],
        settings: form.settings ?? {},
        createdAt: form.createdAt ?? nowIso(),
        updatedAt: form.updatedAt ?? nowIso()
      };
      if (!existingKeys.has(normalized.shareKey)) {
        existingKeys.add(normalized.shareKey);
      }
      return normalized;
    });

    if (this.data.forms.length === 0) {
      const seedForm = deepClone(defaultData.forms[0]);
      seedForm.id = seedForm.id ?? randomId("form");
      seedForm.shareKey = uniqueShareKey(existingKeys);
      this.data.forms.push(seedForm);
      mutated = true;
    }

    const formLookup = new Map(this.data.forms.map((form) => [form.id, form]));
    this.data.submissions = this.data.submissions.filter((entry) => formLookup.has(entry.formId));

    if (mutated) {
      this.persist();
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Failed to persist store", error);
    }
  }

  listWorkspaces() {
    return this.data.workspaces;
  }

  getWorkspace(workspaceId) {
    return this.data.workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  }

  listForms({ workspaceId } = {}) {
    if (!workspaceId) return this.data.forms;
    return this.data.forms.filter((form) => form.workspaceId === workspaceId);
  }

  listFormsSummary({ workspaceId } = {}) {
    const forms = this.listForms({ workspaceId });
    return forms.map((form) => ({
      ...form,
      submissionCount: this.getSubmissionCount(form.id),
      lastSubmissionAt: this.getLastSubmissionAt(form.id)
    }));
  }

  getForm(formId) {
    return this.data.forms.find((form) => form.id === formId) ?? null;
  }

  getFormBySlug(slug) {
    return this.data.forms.find((form) => form.slug === slug) ?? null;
  }

  getFormByShareKey(shareKey) {
    return this.data.forms.find((form) => form.shareKey === shareKey) ?? null;
  }

  createForm(payload) {
    const now = nowIso();
    const form = {
      id: payload.id ?? randomId("form"),
      workspaceId: payload.workspaceId ?? this.data.workspaces[0]?.id ?? "default-workspace",
      name: payload.name,
      slug: slugify(payload.slug ?? payload.name),
      description: payload.description ?? "",
      version: payload.version ?? 1,
      isPublished: payload.isPublished ?? false,
      shareKey: uniqueShareKey(this.data.forms.map((item) => item.shareKey)),
      fields: Array.isArray(payload.fields) ? payload.fields : [],
      settings: payload.settings ?? {},
      createdAt: now,
      updatedAt: now
    };
    this.data.forms.push(form);
    this.persist();
    return form;
  }

  updateForm(formId, updates) {
    const form = this.getForm(formId);
    if (!form) return null;
    const next = {
      ...form,
      ...updates,
      slug: updates.slug ? slugify(updates.slug) : form.slug,
      updatedAt: nowIso(),
      version: (form.version ?? 1) + 1
    };
    if (updates.fields && !Array.isArray(updates.fields)) {
      throw new Error("Fields must be an array");
    }
    const index = this.data.forms.findIndex((item) => item.id === formId);
    this.data.forms[index] = next;
    this.persist();
    return next;
  }

  deleteForm(formId) {
    const initialLength = this.data.forms.length;
    this.data.forms = this.data.forms.filter((form) => form.id !== formId);
    this.data.submissions = this.data.submissions.filter((entry) => entry.formId !== formId);
    const deleted = this.data.forms.length !== initialLength;
    if (deleted) {
      this.persist();
    }
    return deleted;
  }

  regenerateShareKey(formId) {
    const form = this.getForm(formId);
    if (!form) return null;
    form.shareKey = uniqueShareKey(this.data.forms.map((item) => item.shareKey).filter(Boolean));
    form.updatedAt = nowIso();
    const index = this.data.forms.findIndex((item) => item.id === formId);
    this.data.forms[index] = form;
    this.persist();
    return form.shareKey;
  }

  listSubmissions(formId) {
    return this.data.submissions.filter((entry) => entry.formId === formId);
  }

  getSubmission(submissionId) {
    return this.data.submissions.find((entry) => entry.id === submissionId) ?? null;
  }

  getSubmissionCount(formId) {
    return this.listSubmissions(formId).length;
  }

  getLastSubmissionAt(formId) {
    const submissions = this.listSubmissions(formId);
    return submissions.length ? submissions[0].submittedAt : null;
  }

  listRecentSubmissions(limit = 10) {
    return this.data.submissions.slice(0, limit);
  }

  addSubmission(formId, payload) {
    const now = nowIso();
    const submission = {
      id: randomId("submission"),
      formId,
      submittedAt: now,
      data: payload
    };
    this.data.submissions.unshift(submission);
    this.persist();
    return submission;
  }

  deleteSubmission(submissionId) {
    const initialLength = this.data.submissions.length;
    this.data.submissions = this.data.submissions.filter((entry) => entry.id !== submissionId);
    const deleted = this.data.submissions.length !== initialLength;
    if (deleted) {
      this.persist();
    }
    return deleted;
  }
}

const store = new Store(DB_PATH);

module.exports = store;

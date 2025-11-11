const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaultData = {
  forms: [
    {
      id: "landscaping-daily-log",
      name: "Landscaping Daily Service Log",
      description:
        "Capture daily visit details for billing and quality tracking. Configure crews, services, and materials used.",
      version: 1,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  submissions: []
};

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = this.load();
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
        forms: parsed.forms ?? [],
        submissions: parsed.submissions ?? []
      };
    } catch (error) {
      console.error("Failed to load store", error);
      return deepClone(defaultData);
    }
  }

  persist() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("Failed to persist store", error);
    }
  }

  listForms() {
    return this.data.forms;
  }

  getForm(formId) {
    return this.data.forms.find((form) => form.id === formId) ?? null;
  }

  createForm(payload) {
    const now = new Date().toISOString();
    const form = {
      id: payload.id ?? crypto.randomUUID(),
      name: payload.name,
      description: payload.description ?? "",
      version: payload.version ?? 1,
      fields: payload.fields ?? [],
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
    Object.assign(form, updates, {
      updatedAt: new Date().toISOString(),
      version: (form.version ?? 1) + 1
    });
    this.persist();
    return form;
  }

  deleteForm(formId) {
    const initialLength = this.data.forms.length;
    this.data.forms = this.data.forms.filter((form) => form.id !== formId);
    this.data.submissions = this.data.submissions.filter((entry) => entry.formId !== formId);
    if (this.data.forms.length === initialLength) {
      return false;
    }
    this.persist();
    return true;
  }

  listSubmissions(formId) {
    return this.data.submissions.filter((entry) => entry.formId === formId);
  }

  addSubmission(formId, payload) {
    const now = new Date().toISOString();
    const submission = {
      id: crypto.randomUUID(),
      formId,
      submittedAt: now,
      data: payload
    };
    this.data.submissions.unshift(submission);
    this.persist();
    return submission;
  }
}

let crypto;
try {
  crypto = require("node:crypto");
} catch (error) {
  crypto = {
    randomUUID() {
      return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
  };
}

const store = new Store(DB_PATH);

module.exports = store;

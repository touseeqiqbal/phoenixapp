# Backend Update Quick Start

Give team members a non-technical way to tweak the landscaping workspace without digging into code.

## 1. Start the local server

```
npm install
npm run dev
```

The API listens on `http://localhost:4000` by default and serves the workspace UI at `http://localhost:4000/`.

## 2. Use the built-in Workspace UI

- **Create/edit forms** – open the “Form Builder” tab in the workspace (`/`) to add fields, drag options, and publish.
- **Share links** – in the “Fill Form” tab select a template, then use the share panel to publish/unpublish, copy the link, or generate a fresh URL.
- **Collect submissions** – the “Submissions” tab lists all entries with export/download controls.

## 3. Quick API recipes

Use any REST client (Hoppscotch, Postman, curl) against the same local server.

### List workspaces

```
GET http://localhost:4000/api/workspaces
```

### Create a form

```
POST http://localhost:4000/api/forms
Content-Type: application/json

{
  "workspaceId": "workspace-demo",
  "name": "Irrigation Inspection Log",
  "description": "Record irrigation system checks and repairs.",
  "isPublished": false,
  "fields": [
    { "id": "property", "label": "Property", "type": "text", "required": true },
    { "id": "inspectionDate", "label": "Inspection Date", "type": "date", "required": true },
    { "id": "issuesFound", "label": "Issues Found", "type": "textarea" }
  ]
}
```

### Publish / unpublish

```
POST http://localhost:4000/api/forms/<formId>/publish
Content-Type: application/json

{ "isPublished": true }
```

### Regenerate a share link

```
POST http://localhost:4000/api/forms/<formId>/share
```

Response includes the new `shareUrl`.

## 4. Where the data lives

- Structured JSON lives in `data/db.json` (auto-generated). Editing this file manually is possible for quick tweaks—restart the server afterwards.
- Uploaded files are not stored yet; the schema simply records filenames and metadata.

## 5. Backup & deploy checklist

1. `git status` – review changes before committing.
2. `npm test` (future) – run automated checks once added.
3. `git commit` and `git push`.
4. Restart the deployment (Render/Fly/PM2) so the server loads the new routes and data.

Keep this guide in the repo (`docs/backend-updates.md`) so non-developers can reference it anytime.

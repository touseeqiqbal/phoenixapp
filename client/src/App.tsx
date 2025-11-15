import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";

import { fieldCatalog, blueprintIndex } from "./data/fieldCatalog";
import type {
  BuilderField,
  FieldBlueprint,
  FieldCategory,
  FormDetails,
  Form
} from "./types";
import { createId } from "./utils/id";

type ActiveDragState =
  | {
      type: "toolbox";
      blueprint: FieldBlueprint;
    }
  | {
      type: "canvas";
      field: BuilderField;
    }
  | null;

const NAV_TABS = [
  { id: "build", label: "Build" },
  { id: "settings", label: "Settings" },
  { id: "publish", label: "Publish" }
] as const;

function createFieldFromBlueprint(blueprint: FieldBlueprint): BuilderField {
  return {
    id: createId(),
    type: blueprint.type,
    label: blueprint.label,
    placeholder: blueprint.placeholder ?? "",
    required: false,
    options: blueprint.options ? [...blueprint.options] : []
  };
}

const droppableContainerId = "canvas-dropzone";
const API_BASE = "/api";
const INITIAL_FORM_DETAILS: FormDetails = {
  title: "",
  description: "",
  workspace: "",
  category: "operations",
  version: "v1.0.0"
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const init: RequestInit = {
    credentials: "include",
    ...options
  };

  if (init.body && !(init.body instanceof FormData)) {
    const headers = new Headers(init.headers ?? {});
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    init.headers = headers;
  }

  const response = await fetch(`${API_BASE}${path}`, init);
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : response.statusText || "Request failed";
    throw new Error(message);
  }

  if (payload && typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

function normalizeApiField(field: Record<string, unknown>): BuilderField {
  const rawOptions = Array.isArray((field as { options?: unknown[] }).options)
    ? ((field as { options?: unknown[] }).options as unknown[])
    : [];
  const normalizedOptions = rawOptions.map((option, index) => {
    if (typeof option === "string") return option;
    if (option && typeof option === "object") {
      const opt = option as { label?: string; value?: string };
      return opt.label ?? opt.value ?? `Option ${index + 1}`;
    }
    return `Option ${index + 1}`;
  });

  return {
    id: (field.id as string | undefined) ?? createId(),
    type: (field.type as BuilderField["type"]) ?? "text",
    label: (field.label as string | undefined) ?? "Untitled field",
    placeholder: (field.placeholder as string | undefined) ?? "",
    required: Boolean(field.required),
    options: normalizedOptions
  };
}

function normalizeForm(form: Form): Form {
  return {
    ...form,
    visibility: form.visibility === "private" ? "private" : "public",
    fields: Array.isArray(form.fields) ? form.fields.map(normalizeApiField) : [],
    settings: form.settings ?? {}
  };
}

function ToolboxPanel({ categories }: { categories: FieldCategory[] }) {
  return (
    <aside className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Field Toolbox</h3>
        <p className="text-sm text-slate-500">
          Drag a component into the canvas to add it to your form.
        </p>
      </div>
      <div className="space-y-5">
        {categories.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm"
          >
            <header className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {section.title}
                </h4>
                <p className="text-xs text-slate-500 mt-1">{section.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {section.items.length}
              </span>
            </header>
            <div className="grid gap-3">
              {section.items.map((item) => (
                <ToolboxItem key={item.type} blueprint={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function ToolboxItem({ blueprint }: { blueprint: FieldBlueprint }) {
  const id = `toolbox-${blueprint.type}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      origin: "toolbox",
      blueprint
    }
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab"
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "text-left rounded-xl border border-slate-200 bg-white px-4 py-3 transition shadow-sm",
        "hover:-translate-y-1 hover:border-brand/40 hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{blueprint.icon}</span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{blueprint.label}</p>
          <p className="text-xs text-slate-500">Drag into canvas</p>
        </div>
      </div>
    </button>
  );
}

function FieldPreview({ field }: { field: BuilderField }) {
  const baseInput =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40";

  switch (field.type) {
    case "textarea":
    case "billing-address":
      return (
        <textarea
          disabled
          rows={field.type === "billing-address" ? 3 : 4}
          placeholder={field.placeholder}
          className={baseInput}
        />
      );
    case "select":
      return (
        <select disabled className={baseInput}>
          <option value="">{field.placeholder || "Select option"}</option>
          {(field.options ?? ["Option 1", "Option 2"]).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" disabled className="text-brand" />
            <span>{field.label}</span>
          </label>
        );
      case "radio":
        return (
          <div className="space-y-2">
            {(field.options ?? ["Choice 1", "Choice 2"]).map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <input type="radio" disabled className="text-brand" />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
    case "image":
      return (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          Image block preview
        </div>
      );
    case "payment-amount":
      return (
        <input
          disabled
          type="number"
          placeholder={field.placeholder || "$0.00"}
          className={baseInput}
        />
      );
    case "card-number":
      return (
        <input
          disabled
          type="text"
          inputMode="numeric"
          placeholder={field.placeholder || "XXXX XXXX XXXX XXXX"}
          className={baseInput}
        />
      );
    case "product-list":
      return (
        <div className="space-y-2">
          {(field.options ?? ["Product A", "Product B"]).map((product) => (
            <label
              key={product}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <span>{product}</span>
              <input type="checkbox" disabled className="text-brand" />
            </label>
          ))}
        </div>
      );
    case "rating":
      return (
        <div className="flex items-center gap-1 text-amber-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} aria-hidden="true">
              ⭐
            </span>
          ))}
        </div>
      );
    default:
      return (
        <input
          disabled
          type={
            field.type === "phone"
              ? "tel"
              : field.type === "email"
              ? "email"
              : field.type === "date"
              ? "date"
              : field.type === "time"
              ? "time"
              : field.type === "payment-amount"
              ? "number"
              : "text"
          }
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          className={baseInput}
        />
      );
  }
}

function FieldInspector({
  field,
  onUpdate
}: {
  field: BuilderField | undefined;
  onUpdate: (field: BuilderField) => void;
}) {
  const fieldTypeOptions = Object.values(blueprintIndex).map((blueprint) => ({
    value: blueprint.type,
    label: blueprint.label
  }));

    if (!field) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Select a field in the canvas to edit its settings.
        </div>
      );
    }

  const handleChange = <Key extends keyof BuilderField>(
    key: Key,
    value: BuilderField[Key]
  ) => {
    onUpdate({ ...field, [key]: value });
  };

  const handleTypeChange = (nextType: string) => {
    const blueprint = blueprintIndex[nextType];
    if (!blueprint) return;
    onUpdate({
      ...field,
      type: blueprint.type,
      label: blueprint.label,
      placeholder: blueprint.placeholder ?? "",
      options: blueprint.options ? [...blueprint.options] : []
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Field label
        </label>
        <input
          value={field.label}
          onChange={(event) => handleChange("label", event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Placeholder
        </label>
        <input
          value={field.placeholder ?? ""}
          onChange={(event) => handleChange("placeholder", event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Field type
        </label>
        <select
          value={field.type}
          onChange={(event) => handleTypeChange(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          {fieldTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => handleChange("required", event.target.checked)}
          className="text-brand"
        />
        Required field
      </label>
    </div>
  );
}

function SortableField({
  field,
  onSelect,
  onRemove,
  isSelected
}: {
  field: BuilderField;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  isSelected: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: field.id,
    data: {
      origin: "canvas",
      fieldId: field.id
    }
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1
  };

    return (
      <div
      ref={setNodeRef}
      style={style}
      className={clsx(
          "rounded-2xl border px-4 py-4 transition shadow-sm bg-white",
        isSelected
            ? "border-brand/50 ring-2 ring-brand/30"
            : "border-slate-200 hover:border-brand/40"
      )}
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
            <h4 className="text-sm font-semibold text-slate-900">
            {field.label || "Untitled field"}
          </h4>
            <p className="text-xs uppercase tracking-wide text-slate-400">
            {field.type}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
              className="text-xs text-slate-500 hover:text-brand focus:outline-none"
          >
            Drag
          </button>
          <button
            type="button"
            onClick={() => onRemove(field.id)}
              className="text-xs text-rose-500 hover:text-rose-400"
          >
            Remove
          </button>
        </div>
      </header>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(field.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(field.id);
          }
        }}
        className="cursor-pointer"
      >
        <FieldPreview field={field} />
      </div>
    </div>
  );
}

function FieldsCanvas({
  fields,
  onSelect,
  onRemove,
  selectedFieldId
}: {
  fields: BuilderField[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  selectedFieldId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: droppableContainerId
  });

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
      <header className="mb-4 flex items-center justify-between">
        <div>
            <h3 className="text-xl font-semibold text-slate-900">Form Canvas</h3>
            <p className="text-sm text-slate-500">
            Drag fields here then click to edit their settings.
          </p>
        </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {fields.length} fields
        </span>
      </header>
      <SortableContext
        items={fields.map((field) => field.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={clsx(
            "min-h-[320px] rounded-2xl border-2 border-dashed px-4 py-6 transition bg-slate-50",
            isOver ? "border-brand/50 bg-brand/10" : "border-slate-200"
          )}
        >
          {fields.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Drag fields from the toolbox to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field) => (
                <SortableField
                  key={field.id}
                  field={field}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  isSelected={field.id === selectedFieldId}
                />
              ))}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function LivePreviewPanel({
  fields,
  formDetails,
  onClose
}: {
  fields: BuilderField[];
  formDetails: FormDetails;
  onClose: () => void;
}) {
  return (
    <section className="rounded-3xl border border-brand/40 bg-white p-6 shadow-xl">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Live Preview</h3>
          <p className="text-sm text-slate-500">
            Exactly what your published form will look like.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-brand/60 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/20"
        >
          Close preview
        </button>
      </header>
      <div className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h4 className="text-2xl font-semibold text-slate-900">
            {formDetails.title || "Untitled form"}
          </h4>
          {formDetails.description ? (
            <p className="mt-1 text-sm text-slate-500">{formDetails.description}</p>
          ) : null}
        </div>
        <form className="space-y-5">
          {fields.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add fields in build mode to preview them here.
            </p>
          ) : (
            fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-slate-900">
                  {field.label || "Untitled field"}
                  {field.required ? (
                    <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-500">
                      Required
                    </span>
                  ) : null}
                </label>
                <FieldPreview field={field} />
              </div>
            ))
          )}
          <button
            type="button"
            disabled
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 disabled:opacity-70"
          >
            Submit
          </button>
        </form>
      </div>
    </section>
  );
}

function BasicDetails({
  details,
  onChange
}: {
  details: FormDetails;
  onChange: (next: FormDetails) => void;
}) {
  const handleChange = (key: keyof FormDetails, value: string) => {
    onChange({ ...details, [key]: value });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-6">
      <header>
        <h3 className="text-xl font-semibold text-slate-900">Basic details</h3>
        <p className="text-sm text-slate-500">
          Set the fundamentals before sharing or publishing your template.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Form title
          </label>
          <input
            value={details.title}
            onChange={(event) => handleChange("title", event.target.value)}
            placeholder="Daily service log"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workspace
          </label>
          <input
            value={details.workspace}
            onChange={(event) => handleChange("workspace", event.target.value)}
            placeholder="Northwest crew"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Description
          </label>
          <textarea
            value={details.description}
            onChange={(event) => handleChange("description", event.target.value)}
            rows={4}
            placeholder="Explain when crews should use this template, what photos to attach, and who reviews submissions."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
          </label>
          <select
            value={details.category}
            onChange={(event) => handleChange("category", event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="operations">Operations</option>
            <option value="safety">Safety</option>
            <option value="onboarding">Onboarding</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Version
          </label>
          <input
            value={details.version}
            onChange={(event) => handleChange("version", event.target.value)}
            placeholder="v1.0.0"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>
    </section>
  );
}

function PublishWorkspace({
  fields,
  formDetails
}: {
  fields: BuilderField[];
  formDetails: FormDetails;
}) {
  const summaryItems = [
    {
      label: "Fields",
      value: fields.length ? `${fields.length} configured` : "No fields yet",
      hint: fields.length ? "Ready to capture data." : "Add at least one field."
    },
    {
      label: "Workspace",
      value: formDetails.workspace || "Not assigned",
      hint: `Category: ${formDetails.category || "—"}`
    },
    {
      label: "Version",
      value: formDetails.version || "v1.0.0",
      hint: "Update version whenever you publish."
    }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Publish checklist</h2>
        <p className="text-sm text-slate-500">
          Review final steps before generating share links or embedding this form.
        </p>
      </header>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="grid gap-4 md:grid-cols-3">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1"
            >
              <span className="text-xs uppercase tracking-wide text-slate-500">
                {item.label}
              </span>
              <p className="text-sm font-semibold text-slate-900">{item.value}</p>
              <p className="text-xs text-slate-500">{item.hint}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Publish to workspace
          </h3>
          <p className="text-sm text-slate-500">
            Publishing makes the form available in Fill mode and enables share links.
          </p>
        </div>
        <div className="grid gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="text-brand" />
            Require approval before publish
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="text-brand" />
            Notify workspace owner when published
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/40 hover:shadow-brand/60"
          >
            Generate share link
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:border-brand/40 hover:text-brand"
          >
            Export template JSON
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingsWorkspace({
  details,
  onDetailsChange,
  scripts,
  onScriptsChange
}: {
  details: FormDetails;
  onDetailsChange: (next: FormDetails) => void;
  scripts: string;
  onScriptsChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">
          Configure metadata, internal notes, and automation scripts.
        </p>
      </header>
      <BasicDetails details={details} onChange={onDetailsChange} />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Custom scripts</h3>
          <p className="text-sm text-slate-500">
            Inject JavaScript to push submissions to external services after validation.
          </p>
        </div>
        <textarea
          value={scripts}
          onChange={(event) => onScriptsChange(event.target.value)}
          rows={12}
          placeholder={"// Example:\n// export async function onSubmitSuccess(payload) {\n//   await fetch('/api/webhook', { method: 'POST', body: JSON.stringify(payload) });\n// }"}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono text-slate-800 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <p className="text-xs text-slate-500">
          Tip: Use the <code className="bg-slate-900 px-2 py-1 rounded">onSubmitSuccess</code>{" "}
          hook to trigger automations after the form is saved.
        </p>
      </section>
    </div>
  );
}

function App(): ReactNode {
  const [activeTab, setActiveTab] = useState<(typeof NAV_TABS)[number]["id"]>("build");
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [scripts, setScripts] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [activeDrag, setActiveDrag] = useState<ActiveDragState>(null);
  const [formDetails, setFormDetails] = useState<FormDetails>({ ...INITIAL_FORM_DETAILS });
  const [forms, setForms] = useState<Form[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [isLoadingForms, setIsLoadingForms] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeForm = useMemo(
    () => (activeFormId ? forms.find((form) => form.id === activeFormId) ?? null : null),
    [forms, activeFormId]
  );

  const resetBuilderState = useCallback(() => {
    setFields([]);
    setSelectedFieldId(null);
    setScripts("");
    setFormDetails({ ...INITIAL_FORM_DETAILS });
    setShowPreview(false);
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadForms = async () => {
      setIsLoadingForms(true);
      setFormError(null);
      try {
        const response = await apiRequest<Form[]>("/forms?includeStats=true");
        if (ignore) return;
        const normalized = Array.isArray(response)
          ? response.map((form) => normalizeForm(form))
          : [];
        setForms(normalized);
        if (normalized.length) {
          setActiveFormId((current) => current ?? normalized[0].id);
        } else {
          setActiveFormId(null);
          resetBuilderState();
        }
      } catch (error) {
        if (ignore) return;
        setFormError(error instanceof Error ? error.message : "Unable to load forms.");
      } finally {
        if (!ignore) {
          setIsLoadingForms(false);
        }
      }
    };

    loadForms();
    return () => {
      ignore = true;
    };
  }, [resetBuilderState]);

  useEffect(() => {
    if (activeForm) {
      const hydratedFields = activeForm.fields?.map((field) => ({
        ...field,
        id: field.id ?? createId(),
        options: Array.isArray(field.options) ? [...field.options] : []
      })) ?? [];
      setFields(hydratedFields);
      setSelectedFieldId(null);
      setScripts("");
      setFormDetails({
        title: activeForm.name ?? "",
        description: activeForm.description ?? "",
        workspace: "",
        category: "operations",
        version: activeForm.version ? `v${activeForm.version}` : "v1.0.0"
      });
      setShowPreview(false);
    } else {
      resetBuilderState();
    }
  }, [activeForm, resetBuilderState]);

  useEffect(() => {
    setShowPreview(false);
  }, [activeTab]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    })
  );

  const handleSelectField = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
  }, []);

  const handleRemoveField = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((field) => field.id !== fieldId));
    setSelectedFieldId((current) => (current === fieldId ? null : current));
  }, []);

  const handleUpdateField = useCallback((nextField: BuilderField) => {
    setFields((prev) =>
      prev.map((field) => (field.id === nextField.id ? nextField : field))
    );
  }, []);

  const handleAddField = useCallback((blueprint: FieldBlueprint, index?: number) => {
    setFields((prev) => {
      const insertionIndex = typeof index === "number" ? index : prev.length;
      const next = [...prev];
      const field = createFieldFromBlueprint(blueprint);
      next.splice(insertionIndex, 0, field);
      setSelectedFieldId(field.id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((event: Parameters<DndContext["onDragStart"]>[0]) => {
    const { active } = event;
    const origin = active.data.current?.origin;
    if (origin === "toolbox") {
      setActiveDrag({
        type: "toolbox",
        blueprint: active.data.current?.blueprint as FieldBlueprint
      });
    } else if (origin === "canvas") {
      const fieldId = active.data.current?.fieldId as string;
      const field = fields.find((item) => item.id === fieldId);
      if (field) {
        setActiveDrag({
          type: "canvas",
          field
        });
      }
    }
  }, [fields]);

  const handleDragEnd = useCallback(
    (event: Parameters<DndContext["onDragEnd"]>[0]) => {
      const { active, over } = event;
      const origin = active.data.current?.origin;
      setActiveDrag(null);

      if (!over) {
        return;
      }

      if (origin === "canvas") {
        const activeId = active.id as string;
        const overId = over.id as string;
        if (activeId !== overId && fields.some((field) => field.id === activeId)) {
          setFields((prev) => {
            const oldIndex = prev.findIndex((field) => field.id === activeId);
            const newIndex =
              overId === droppableContainerId
                ? prev.length - 1
                : prev.findIndex((field) => field.id === overId);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
          });
        }
      } else if (origin === "toolbox") {
        const blueprint = active.data.current?.blueprint as FieldBlueprint | undefined;
        if (!blueprint) return;
        const targetId = over.id as string;
        if (targetId === droppableContainerId) {
          handleAddField(blueprint);
        } else {
          const targetIndex = fields.findIndex((field) => field.id === targetId);
          handleAddField(blueprint, targetIndex === -1 ? undefined : targetIndex);
        }
        setShowPreview(false);
      }
    },
    [fields, handleAddField]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const renderActiveDrag = () => {
    if (!activeDrag) return null;
    if (activeDrag.type === "toolbox") {
      const blueprint = activeDrag.blueprint;
      return (
        <div className="w-64 rounded-xl border border-brand/40 bg-white px-4 py-3 shadow-lg shadow-brand/20">
          <div className="flex items-center gap-3">
            <span className="text-xl">{blueprint.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{blueprint.label}</p>
              <p className="text-xs text-slate-500">{blueprint.placeholder}</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="w-72 rounded-xl border border-brand/40 bg-white px-4 py-4 shadow-lg shadow-brand/20">
        <FieldPreview field={activeDrag.field} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="inline-flex w-fit items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-brand" />
                Form Builder Workspace
              </div>
              <h1 className="text-3xl font-bold text-slate-900 lg:text-4xl">
                Drag-and-drop form builder
              </h1>
              <p className="text-base text-slate-600 max-w-3xl">
                Structure fields, wire up automations, and publish polished forms to crews
                or clients without leaving this workspace.
              </p>
            </div>
            <nav className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
              {NAV_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      "px-5 py-2 text-sm font-semibold rounded-full transition",
                      isActive
                        ? "bg-brand text-white shadow"
                        : "text-slate-600 hover:text-brand"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">
              Active form
              <select
                className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                value={activeFormId ?? ""}
                disabled={isLoadingForms || !forms.length}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setActiveFormId(nextId || null);
                }}
              >
                <option value="">New form draft</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-brand/40 hover:text-brand"
              onClick={() => {
                setActiveFormId(null);
                resetBuilderState();
              }}
            >
              Start new form
            </button>
          </div>
          <div className="text-sm text-slate-500">
            {isLoadingForms ? "Loading forms…" : formError ? formError : `${forms.length} form(s) available`}
          </div>
        </div>
        {activeTab === "build" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_minmax(0,320px)]">
              <ToolboxPanel categories={fieldCatalog} />
              <FieldsCanvas
                fields={fields}
                selectedFieldId={selectedFieldId}
                onSelect={handleSelectField}
                onRemove={handleRemoveField}
              />
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Field inspector
                </h3>
                <FieldInspector
                  field={fields.find((field) => field.id === selectedFieldId)}
                  onUpdate={handleUpdateField}
                />
              </section>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition bg-white shadow-sm",
                  showPreview
                    ? "border-brand/60 text-brand hover:bg-brand/10"
                    : "border-slate-300 text-slate-600 hover:border-brand/40 hover:text-brand"
                )}
              >
                {showPreview ? "Hide live preview" : "Show live preview"}
              </button>
            </div>
            {showPreview ? (
              <div className="mt-6">
                <LivePreviewPanel
                  fields={fields}
                  formDetails={formDetails}
                  onClose={() => setShowPreview(false)}
                />
              </div>
            ) : null}
            <DragOverlay dropAnimation={null}>{renderActiveDrag()}</DragOverlay>
          </DndContext>
        ) : null}

        {activeTab === "settings" ? (
          <SettingsWorkspace
            details={formDetails}
            onDetailsChange={setFormDetails}
            scripts={scripts}
            onScriptsChange={setScripts}
          />
        ) : null}

        {activeTab === "publish" ? (
          <PublishWorkspace fields={fields} formDetails={formDetails} />
        ) : null}
      </main>
    </div>
  );
}

export default App;

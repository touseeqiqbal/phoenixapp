export type FieldType =
  | "name"
  | "email"
  | "phone"
  | "text"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "time"
  | "payment-amount"
  | "card-number"
  | "billing-address"
  | "product-list"
  | "signature"
  | "file"
  | "image"
  | "rating";

export interface FieldBlueprint {
  type: FieldType;
  label: string;
  placeholder?: string;
  icon: string;
  options?: string[];
  description?: string;
}

export interface FieldCategory {
  title: string;
  description: string;
  items: FieldBlueprint[];
}

export interface BuilderField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  metadata?: Record<string, unknown>;
}

export interface FormDetails {
  title: string;
  description: string;
  workspace: string;
  category: string;
  version: string;
}

export interface FormNotificationsSettings {
  enabled: boolean;
  recipients: string[];
  subject: string;
  message: string;
}

export interface FormBrandingSettings {
  logoUrl?: string;
}

export interface FormSettings {
  branding?: FormBrandingSettings;
  notifications?: FormNotificationsSettings;
  [key: string]: unknown;
}

export interface Form {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  fields: BuilderField[];
  settings?: FormSettings;
  visibility?: "public" | "private";
  isPublished?: boolean;
  shareUrl?: string;
  submissionCount?: number;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface Submission {
  id: string;
  formId: string;
  submittedAt: string;
  data: Record<string, unknown>;
}

export interface ApiEnvelope<T> {
  data: T;
}

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

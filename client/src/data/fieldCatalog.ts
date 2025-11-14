import type { FieldCategory, FieldBlueprint } from "../types";

export const fieldCatalog: FieldCategory[] = [
  {
    title: "Basic",
    description: "Core elements for fast data capture.",
    items: [
      {
        type: "name",
        label: "Full Name",
        placeholder: "First and last name",
        icon: "👤"
      },
      {
        type: "email",
        label: "Email",
        placeholder: "name@example.com",
        icon: "✉️"
      },
      {
        type: "phone",
        label: "Phone Number",
        placeholder: "(555) 000-0000",
        icon: "📞"
      },
      {
        type: "text",
        label: "Short Text",
        placeholder: "Type response...",
        icon: "🔤"
      },
      {
        type: "textarea",
        label: "Long Text",
        placeholder: "Add detailed notes...",
        icon: "📝"
      },
      {
        type: "select",
        label: "Dropdown",
        placeholder: "Pick an option",
        icon: "⬇️",
        options: ["Option A", "Option B", "Option C"]
      },
      {
        type: "checkbox",
        label: "Checkbox",
        icon: "☑️"
      },
      {
        type: "radio",
        label: "Single Choice",
        icon: "🔘",
        options: ["Choice 1", "Choice 2"]
      },
      {
        type: "date",
        label: "Date",
        icon: "📅"
      },
      {
        type: "time",
        label: "Time",
        icon: "⏰"
      }
    ]
  },
  {
    title: "Payments",
    description: "Collect billing and purchase details.",
    items: [
      {
        type: "payment-amount",
        label: "Payment Amount",
        placeholder: "$0.00",
        icon: "💵"
      },
      {
        type: "card-number",
        label: "Card Number",
        placeholder: "XXXX XXXX XXXX XXXX",
        icon: "💳"
      },
      {
        type: "billing-address",
        label: "Billing Address",
        placeholder: "Street, City, State",
        icon: "🏠"
      },
      {
        type: "product-list",
        label: "Product List",
        icon: "🛒",
        options: ["Product A", "Product B"]
      }
    ]
  },
  {
    title: "Widgets",
    description: "Enhance forms with media and utilities.",
    items: [
      {
        type: "signature",
        label: "Signature",
        icon: "✍️"
      },
      {
        type: "file",
        label: "File Upload",
        icon: "📁"
      },
      {
        type: "image",
        label: "Image Block",
        placeholder: "Add supporting imagery",
        icon: "🖼️"
      },
      {
        type: "rating",
        label: "Rating",
        icon: "⭐",
        options: ["1", "2", "3", "4", "5"]
      }
    ]
  }
];

export const blueprintIndex: Record<string, FieldBlueprint> = fieldCatalog
  .flatMap(({ items }) => items)
  .reduce<Record<string, FieldBlueprint>>((acc, blueprint) => {
    acc[blueprint.type] = blueprint;
    return acc;
  }, {});

import { asText } from "@/lib/format";

const hiddenKeys = new Set([
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "tenant_id",
  "raw",
  "raw_order",
  "raw_prescription",
  "raw_result",
  "raw_bill",
]);

function isHiddenKey(key: string) {
  return hiddenKeys.has(key) || key.endsWith("_id") || key.endsWith("_user") || key === "user_id" || key === "visit_id" || key === "patient_id";
}

function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderValue(value: unknown) {
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return (
      <details>
        <summary>{Array.isArray(value) ? `${value.length} record${value.length === 1 ? "" : "s"}` : "View fields"}</summary>
        <pre>{JSON.stringify(value, null, 2)}</pre>
      </details>
    );
  }

  return asText(value, "");
}

export function FieldList({ data, title }: { data: Record<string, unknown>; title?: string }) {
  const entries = Object.entries(data).filter(([key, value]) => !isHiddenKey(key) && value !== null && value !== undefined && value !== "");

  if (!entries.length) return null;

  return (
    <div className="field-list">
      {title ? <h4>{title}</h4> : null}
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{humanize(key)}</dt>
            <dd>{renderValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

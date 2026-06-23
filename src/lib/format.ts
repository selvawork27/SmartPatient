export function asText(value: unknown, fallback = "Not recorded") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export function pickText(source: Record<string, unknown>, keys: string[], fallback = "Not recorded") {
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && value !== "") return asText(value, fallback);
  }
  return fallback;
}

export function nestedText(source: Record<string, unknown>, path: string[], fallback = "Not recorded") {
  let cursor: unknown = source;
  for (const part of path) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return fallback;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return asText(cursor, fallback);
}

export function formatDisplayDate(date?: string, time?: string) {
  if (!date) return "Date not recorded";
  const joined = time ? `${date}T${time}` : date;
  const parsed = new Date(joined);
  if (Number.isNaN(parsed.getTime())) return [date, time].filter(Boolean).join(" ");
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" as const } : {}),
  }).format(parsed);
}

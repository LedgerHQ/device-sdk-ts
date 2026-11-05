function sanitiseValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    return value.map((v) => sanitiseValue(v, seen));
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    const sanitised: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitised[key] = sanitiseValue(val, seen);
    }
    return sanitised;
  }
  return value;
}

/**
 * Recursively sanitises data for JSON serialisation by converting BigInt values
 * to strings and handling circular references.
 */
export function sanitiseData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const seen = new WeakSet<object>();
  seen.add(data);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = sanitiseValue(value, seen);
  }
  return result;
}

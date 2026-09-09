/**
 * The cases held by a scenario file.
 *
 * A scenario file describes how to run itself and carries its cases under
 * `cases`, so every fixture reader unwraps the same envelope.
 *
 * @throws If the file holds no `cases` list — a bare array, as fixtures were
 * written before scenarios became self-describing, included.
 */
export function scenarioCases<T>(parsed: unknown, filePath: string): T[] {
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const cases = (parsed as { cases?: unknown }).cases;
    if (Array.isArray(cases)) return cases as T[];
  }
  throw new Error(
    `Invalid scenario file: expected a "cases" array in ${filePath}`,
  );
}

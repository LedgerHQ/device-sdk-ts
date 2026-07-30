/**
 * Temporary probe to validate Sonar "coverage on new code" under the turbo
 * --affected CI flow. Two equally sized functions; only `sumUpTo` is tested,
 * so ~50% of the new lines are covered. Safe to delete.
 */

export function sumUpTo(n: number): number {
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    total += i;
  }
  if (total > 100) {
    total = 100;
  }
  if (total < 0) {
    total = 0;
  }
  const doubled = total * 2;
  const halved = doubled / 2;
  return halved;
}

export function normalizeCsv(input: string): string {
  const parts = input.split(",");
  const cleaned: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      cleaned.push(trimmed);
    }
  }
  if (cleaned.length === 0) {
    return "empty";
  }
  const joined = cleaned.join("|");
  return joined;
}

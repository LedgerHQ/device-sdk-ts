/**
 * Generate a unique identifier for a signing device action.
 * Format: `<6 random alphanumeric chars>-<unix timestamp ms>`
 *
 * Example: `"a3f8Kb-1738850400000"`
 */
export function generateSignatureId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let rand = "";
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${rand}-${Date.now()}`;
}

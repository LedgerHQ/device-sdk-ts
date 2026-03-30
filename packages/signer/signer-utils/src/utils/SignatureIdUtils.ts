const ALPHANUMERIC_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const RANDOM_PART_LENGTH = 6;

export function generateSignatureId(): string {
  let random = "";
  for (let i = 0; i < RANDOM_PART_LENGTH; i++) {
    random += ALPHANUMERIC_CHARS.charAt(
      Math.floor(Math.random() * ALPHANUMERIC_CHARS.length),
    );
  }
  return `${random}-${Date.now()}`;
}

export function numToHex(n: number): string {
  return `0x${n.toString(16).padStart(2, "0")}`;
}

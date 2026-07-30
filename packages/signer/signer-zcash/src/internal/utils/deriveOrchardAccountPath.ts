/**
 * Builds the ZIP-32 Orchard account path from coin type and account components.
 * Both GetShieldedAddressTask and GetFullViewingKeyTask derive this path
 * from their respective inputs.
 */
export function deriveOrchardAccountPath(
  coinType: string,
  account: string,
): string {
  return `32'/${coinType}/${account}`;
}

// Mirrors `service.py:41-48` in the playground. UX-only: the form uses this
// map to populate the network dropdown and auto-fill chainId. The signer
// itself takes only `chainId` — `network` is a label that flows into the
// stored ContactEntry but never reaches the APDU.
export const NETWORKS = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  sepolia: 11155111,
} as const;

export type NetworkName = keyof typeof NETWORKS;

export const NETWORK_OPTIONS: Array<{ label: string; value: string }> =
  Object.keys(NETWORKS).map((name) => ({ label: name, value: name }));

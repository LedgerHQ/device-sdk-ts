/**
 * The networks offered when adding an address, as in Ledger Wallet's network
 * picker. Each network maps to a Contacts family (and, for EVM networks, the
 * chainId the device signs over); the family decides the app and the address
 * format.
 */
import {
  CONTACTS_FAMILIES,
  type ContactsFamily,
} from "@/lib/contacts/families";

export type ContactsNetwork = Readonly<{
  id: string;
  name: string;
  family: ContactsFamily;
  chainId?: bigint;
  icon: Readonly<{ ledgerId: string; ticker: string }>;
}>;

const evm = (
  id: string,
  name: string,
  chainId: bigint,
  ticker: string,
): ContactsNetwork => ({
  id,
  name,
  family: "ethereum",
  chainId,
  icon: { ledgerId: id, ticker },
});

export const CONTACTS_NETWORKS: readonly ContactsNetwork[] = [
  evm("ethereum", "Ethereum", 1n, "ETH"),
  evm("polygon", "Polygon", 137n, "POL"),
  evm("bsc", "BNB Chain", 56n, "BNB"),
  evm("base", "Base", 8453n, "ETH"),
  evm("arbitrum", "Arbitrum", 42161n, "ETH"),
  evm("optimism", "Optimism", 10n, "ETH"),
  evm("ethereum_sepolia", "Ethereum Sepolia", 11155111n, "ETH"),
  {
    id: "tron",
    name: "Tron",
    family: "tron",
    icon: CONTACTS_FAMILIES.tron.icon,
  },
  {
    id: "solana",
    name: "Solana",
    family: "solana",
    icon: CONTACTS_FAMILIES.solana.icon,
  },
];

export type ContactsNetworkDisplay = Pick<
  ContactsNetwork,
  "id" | "name" | "icon"
>;

/**
 * How a stored address's network is shown. An EVM chainId outside the list
 * still resolves, as a generic "EVM chain <id>" network.
 */
export function networkForAddress(
  family: string,
  chainId: bigint | undefined,
): ContactsNetworkDisplay {
  const known = CONTACTS_NETWORKS.find(
    (n) => n.family === family && n.chainId === chainId,
  );
  if (known) return known;
  if (family === "ethereum" && chainId !== undefined) {
    return {
      id: `evm-${chainId}`,
      name: `EVM chain ${chainId}`,
      icon: CONTACTS_FAMILIES.ethereum.icon,
    };
  }
  return {
    id: family,
    name: family,
    icon: { ledgerId: family, ticker: family.toUpperCase() },
  };
}

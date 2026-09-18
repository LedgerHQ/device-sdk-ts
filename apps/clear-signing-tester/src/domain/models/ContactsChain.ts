/**
 * What differs between chains in the otherwise identical Address Book flows,
 * bound once per coin app rather than branched on at every call site.
 */
export type ContactsChain = {
  /** Family name the contacts kit encodes in the BLOCKCHAIN_FAMILY TLV. */
  readonly blockchainFamily: string;
  /** Address text as a fixture writes it, hex or base58, to raw bytes. */
  readonly toIdentifier: (address: string) => Uint8Array | undefined;
  /** The firmware specification carries a chain id for Ethereum only. */
  readonly hasChainId: boolean;
};

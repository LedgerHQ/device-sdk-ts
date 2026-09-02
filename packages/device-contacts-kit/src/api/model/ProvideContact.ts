/**
 * Everything the device needs to accept a registered external contact as a
 * decoration for an upcoming signing flow: the name-level material shared by
 * the whole contact group, plus the address-level material of the one matched
 * address.
 */
export type ProvideContactInput = {
  readonly contactName: string;
  readonly scope: string;
  /** Raw bytes, chain-dependent: a 20-byte address for Ethereum. */
  readonly identifier: Uint8Array;
  readonly groupHandle: Uint8Array;
  readonly hmacProof: Uint8Array;
  readonly hmacRest: Uint8Array;
  /** Lowercase family name, e.g. `"ethereum"`. */
  readonly blockchainFamily: string;
  /** Mandatory for Ethereum, omitted for every other family. */
  readonly chainId?: bigint;
};

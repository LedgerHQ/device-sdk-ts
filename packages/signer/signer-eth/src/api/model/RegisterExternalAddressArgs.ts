/**
 * Arguments for `SignerEth.registerExternalAddress`.
 *
 * `extension` is set when the caller is appending a new entry to an existing
 * Contact (same `name`); the existing Contact's `groupHandleHex` and
 * `hmacNameHex` are passed back so the device can validate continuity.
 *
 * The `network` field is intentionally absent — the protocol encodes only
 * `chainId` and a fixed BLOCKCHAIN_FAMILY tag. Network labels are a sample-app
 * UX concern and do not flow into the APDU.
 */
export type RegisterExternalAddressArgs = {
  readonly name: string;
  readonly addressHex: string;
  readonly scope: string;
  readonly derivationPath: string;
  readonly chainId: number;
  readonly extension?: {
    readonly groupHandleHex: string;
    readonly hmacProofHex: string;
  };
};

export type RegisterExternalAddressResult = {
  readonly groupHandleHex: string;
  readonly hmacNameHex: string;
  readonly hmacRestHex: string;
};

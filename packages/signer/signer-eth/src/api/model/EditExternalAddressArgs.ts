/**
 * Arguments for `SignerEth.editExternalAddress` (op 3).
 *
 * Rotates a single entry's address bytes. The contact-level
 * `groupHandleHex` + `hmacProofHex` (= contact's `hmac_name`) and the
 * entry's current `hmacRestHex` are passed back so the device can
 * verify continuity before approving the edit. Address validation
 * lives in the ETH app — this op stays signer-eth-bound (it does not
 * become OS-dispatchable when firmware lands; the coin app remains
 * the authority on address format).
 *
 * `scope` is the entry's *current* label; the device displays it on
 * the approval screen so the user can confirm which entry is being
 * edited.
 */
export type EditExternalAddressArgs = {
  readonly contactName: string;
  readonly oldAddressHex: string;
  readonly newAddressHex: string;
  readonly scope: string;
  readonly groupHandleHex: string;
  readonly hmacProofHex: string;
  readonly hmacRestHex: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

export type EditExternalAddressResult = {
  readonly hmacRestHex: string;
};

/**
 * Arguments for `ContactsService.editExternalAddressLabel` (op 2).
 *
 * **Typed-only in M3** — the method is declared on the interface so M4 only
 * needs to wire it up. The DMK-core default impl throws "not implemented".
 *
 * Shape per the playground spec: `~/dev/ledger-contacts-playground/docs/upstream-asks.md` §4.
 */
export type EditExternalAddressLabelArgs = {
  readonly contactName: string;
  readonly oldLabel: string;
  readonly newLabel: string;
  readonly addressHex: string;
  readonly groupHandleHex: string;
  readonly hmacProofHex: string;
  readonly hmacRestHex: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

export type EditExternalAddressLabelResult = {
  readonly hmacRestHex: string;
};

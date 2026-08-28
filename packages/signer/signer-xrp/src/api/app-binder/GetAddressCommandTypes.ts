import { type Address } from "@api/model/Address";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  /** Display the address on the device and wait for the user to confirm it. */
  readonly checkOnDevice?: boolean;
  /** Ask the app to append the BIP32 chain code to its answer. */
  readonly returnChainCode?: boolean;
};

export type GetAddressCommandResponse = Address;

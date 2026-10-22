import { type Address } from "@api/model/Address";
import { type Curve } from "@api/model/Curve";

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  /** Display the address on the device and wait for the user to confirm it. */
  readonly checkOnDevice?: boolean;
  /** Ask the app to append the BIP32 chain code to its answer. */
  readonly returnChainCode?: boolean;
  /** Curve to derive the key with. Defaults to `Curve.Secp256k1`. */
  readonly curve?: Curve;
};

export type GetAddressCommandResponse = Address;

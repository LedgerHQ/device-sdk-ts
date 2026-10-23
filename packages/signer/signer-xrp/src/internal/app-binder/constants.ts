import { Curve } from "@api/model/Curve";

export const APP_NAME = "XRP";

/**
 * Curve used when a caller of a public entry point (the signer's options, the
 * device action factories, `GetAddressCommandArgs`) does not give one. Every
 * layer below those takes the curve as a required argument.
 */
export const DEFAULT_CURVE = Curve.Secp256k1;

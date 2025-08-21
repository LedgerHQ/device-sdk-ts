import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import * as secp from "@noble/secp256k1";

export function genIdentity() {
  const priv = secp.utils.randomPrivateKey();
  const pub = secp.getPublicKey(priv, true);
  const clientName = `DMK Playground-${bufferToHexaString(pub).slice(0, 6)}`;
  return { clientName, privateKey: bufferToHexaString(priv) };
}

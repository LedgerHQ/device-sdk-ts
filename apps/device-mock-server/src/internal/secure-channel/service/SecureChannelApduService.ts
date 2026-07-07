import { injectable } from "inversify";

import { deriveSecureChannelResponse } from "@internal/secure-channel/service/secureChannelApdus";

/**
 * Synthesizes the default responses for the APDUs relayed during a
 * secure-channel session (handshake, install block, genuine verdict) from their
 * colocated definitions, so a device passes the flows without any seeded mock.
 */
@injectable()
export class SecureChannelApduService {
  /** Derived response for a relayed secure-channel APDU, or `undefined`. */
  resolve(apdu: string): string | undefined {
    return deriveSecureChannelResponse(apdu);
  }
}

import {
  readTlvEntries as readTlvEntriesRaw,
  type TlvEntry,
  TlvParseError,
} from "@internal/app-binder/clear-sign/tlv";

import { fail, TruncatedDescriptorError } from "./RequirementsError";

export {
  firstTag,
  firstU8,
  type TlvEntry,
} from "@internal/app-binder/clear-sign/tlv";

/**
 * {@link readTlvEntriesRaw} wrapped to surface malformed framing as the
 * requirement builder's own typed {@link TruncatedDescriptorError}.
 */
export function readTlvEntries(buffer: Uint8Array): TlvEntry[] {
  try {
    return readTlvEntriesRaw(buffer);
  } catch (error) {
    if (error instanceof TlvParseError) {
      fail(new TruncatedDescriptorError(error.message));
    }
    throw error;
  }
}

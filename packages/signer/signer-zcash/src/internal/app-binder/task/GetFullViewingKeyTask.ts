import {
  type CommandErrorResult,
  type DmkResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { APDU_MAX_PAYLOAD } from "@ledgerhq/device-management-kit";

import { type ZcashFullViewingKeyMode } from "@api/model/FullViewingKeyOptions";
import {
  GetFullViewingKeyCommand,
  type ZcashFvkP2,
  zcashFvkP2FromMode,
} from "@internal/app-binder/command/GetFullViewingKeyCommand";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { concatUint8Arrays } from "@internal/utils/concatUint8Arrays";

export type GetFullViewingKeyTaskArgs = {
  derivationPath: string;
  mode: ZcashFullViewingKeyMode;
};

export type GetFullViewingKeyTaskSuccessUfvk = {
  readonly mode: "ufvk";
  readonly fullViewingKey: string;
};

export type GetFullViewingKeyTaskSuccessOrchard = {
  readonly mode: "orchardFvk";
  readonly fullViewingKey: Uint8Array;
};

export type GetFullViewingKeyTaskData =
  | GetFullViewingKeyTaskSuccessUfvk
  | GetFullViewingKeyTaskSuccessOrchard;
export type GetFullViewingKeyTaskError =
  CommandErrorResult<ZcashErrorCodes>["error"];

export type GetFullViewingKeyTaskResult = DmkResult<
  GetFullViewingKeyTaskData,
  GetFullViewingKeyTaskError
>;

/**
 * Serialized Orchard full viewing key length (see Zcash protocol / `orchard` crate).
 * GET_VK with P2_ORCHARD_FVK returns exactly this many raw bytes when successful.
 */
export const ORCHARD_FVK_BYTE_LENGTH = 96 as const;

function orchardFvkLengthMismatchMessage(assembled: Uint8Array): string {
  const base = `Orchard FVK must be ${ORCHARD_FVK_BYTE_LENGTH} bytes (got ${assembled.length})`;
  if (assembled.length < 2) {
    return base;
  }
  const view = new DataView(
    assembled.buffer,
    assembled.byteOffset,
    assembled.byteLength,
  );
  const strLength = view.getUint16(0, false);
  if (2 + strLength === assembled.length) {
    return `${base}. Payload matches UFVK framing (u16 BE length + ${strLength} bytes). Use mode "ufvk" for this response, or use a Zcash app build that exports raw Orchard FVK for GET_VK P2=0x01.`;
  }
  return base;
}

function parseAssembledOrchardFvk(
  assembled: Uint8Array,
): DmkResult<GetFullViewingKeyTaskSuccessOrchard, GetFullViewingKeyTaskError> {
  if (assembled.length !== ORCHARD_FVK_BYTE_LENGTH) {
    return DmkResultFactory({
      error: new InvalidStatusWordError(
        orchardFvkLengthMismatchMessage(assembled),
      ),
    });
  }
  return DmkResultFactory({
    data: { mode: "orchardFvk", fullViewingKey: assembled },
  });
}

/**
 * True when `assembled` already contains the u16 BE string length prefix plus
 * the declared UTF-8 payload. Used to stop chunking when the last payload chunk
 * is exactly `APDU_MAX_PAYLOAD` bytes (otherwise the host would send a
 * spurious CONTINUE APDU).
 */
function isCompleteUfvkLengthFraming(assembled: Uint8Array): boolean {
  if (assembled.length < 2) {
    return false;
  }
  const view = new DataView(
    assembled.buffer,
    assembled.byteOffset,
    assembled.byteLength,
  );
  const strLength = view.getUint16(0, false);
  return assembled.length >= 2 + strLength;
}

function parseAssembledUfvk(
  assembled: Uint8Array,
): DmkResult<GetFullViewingKeyTaskSuccessUfvk, GetFullViewingKeyTaskError> {
  if (assembled.length < 2) {
    return DmkResultFactory({
      error: new InvalidStatusWordError("UFVK string length is missing"),
    });
  }
  const view = new DataView(
    assembled.buffer,
    assembled.byteOffset,
    assembled.byteLength,
  );
  const strLength = view.getUint16(0, false);
  if (2 + strLength > assembled.length) {
    return DmkResultFactory({
      error: new InvalidStatusWordError("UFVK string is truncated"),
    });
  }
  const utf8 = assembled.slice(2, 2 + strLength);
  let fullViewingKey: string;
  try {
    fullViewingKey = new TextDecoder("utf-8", { fatal: true }).decode(utf8);
  } catch {
    return DmkResultFactory({
      error: new InvalidStatusWordError("UFVK is not valid UTF-8"),
    });
  }
  if (2 + strLength < assembled.length) {
    return DmkResultFactory({
      error: new InvalidStatusWordError(
        "UFVK response has extra trailing bytes",
      ),
    });
  }
  return DmkResultFactory({
    data: { mode: "ufvk", fullViewingKey },
  });
}

/**
 * Fetches the full viewing key (UFVK string or raw Orchard FVK) with GET_VK
 * multi-chunk responses (255-byte chunks until the last is shorter).
 */
export class GetFullViewingKeyTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetFullViewingKeyTaskArgs,
  ) {}

  async run(): Promise<GetFullViewingKeyTaskResult> {
    const p2: ZcashFvkP2 = zcashFvkP2FromMode(this.args.mode);

    // app-zcash >= v3.8.0 requires both the orchard and transparent account
    // paths for UFVK export. `derivationPath` is always the ZIP-32 account path
    // (32'/coin'/account') at this point, so the transparent path is the same
    // account under BIP-44 purpose (44'/coin'/account').
    const transparentDerivationPath =
      this.args.mode === "ufvk"
        ? this.args.derivationPath.replace(/^32'\//, "44'/")
        : undefined;

    const firstResult = await this.api.sendCommand(
      new GetFullViewingKeyCommand({
        isContinue: false,
        p2,
        derivationPath: this.args.derivationPath,
        transparentDerivationPath,
      }),
    );
    if (!isSuccessCommandResult(firstResult)) {
      return DmkResultFactory({
        error: firstResult.error,
      });
    }

    let lastChunk: Uint8Array = new Uint8Array(firstResult.data.data);
    let assembled: Uint8Array = lastChunk;

    while (lastChunk.length === APDU_MAX_PAYLOAD) {
      if (this.args.mode === "ufvk" && isCompleteUfvkLengthFraming(assembled)) {
        break;
      }
      const next = await this.api.sendCommand(
        new GetFullViewingKeyCommand({
          isContinue: true,
          p2,
        }),
      );
      if (!isSuccessCommandResult(next)) {
        return DmkResultFactory({
          error: next.error,
        });
      }
      lastChunk = new Uint8Array(next.data.data);
      assembled = concatUint8Arrays(assembled, lastChunk);
    }

    if (this.args.mode === "ufvk") {
      return parseAssembledUfvk(assembled);
    }

    return parseAssembledOrchardFvk(assembled);
  }
}

import {
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetFullViewingKeyCommand,
  type ZcashFvkP2,
  zcashFvkP2FromMode,
} from "@internal/app-binder/command/GetFullViewingKeyCommand";
import { VK_RESPONSE_CHUNK_SIZE } from "@internal/app-binder/command/utils/apduHeaderUtils";
import { type ZcashErrorCodes } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import { type ZcashFullViewingKeyMode } from "@api/model/FullViewingKeyOptions";

const concat = (a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBufferLike> => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
};

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

function parseAssembledUfvk(
  assembled: Uint8Array,
): CommandResult<GetFullViewingKeyTaskSuccessUfvk, ZcashErrorCodes> {
  if (assembled.length < 2) {
    return CommandResultFactory({
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
    return CommandResultFactory({
      error: new InvalidStatusWordError("UFVK string is truncated"),
    });
  }
  const utf8 = assembled.slice(2, 2 + strLength);
  let fullViewingKey: string;
  try {
    fullViewingKey = new TextDecoder("utf-8", { fatal: true }).decode(utf8);
  } catch {
    return CommandResultFactory({
      error: new InvalidStatusWordError("UFVK is not valid UTF-8"),
    });
  }
  if (2 + strLength < assembled.length) {
    return CommandResultFactory({
      error: new InvalidStatusWordError(
        "UFVK response has extra trailing bytes",
      ),
    });
  }
  return CommandResultFactory({
    data: { mode: "ufvk", fullViewingKey },
  });
}

/**
 * Fetches the full viewing key (UFVK string or raw Orchard FVK) with GET_VK
 * multi-chunk responses (255-byte chunks until the last is shorter).
 */
export class GetFullViewingKeyTask {
  constructor(
    private api: InternalApi,
    private args: GetFullViewingKeyTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<GetFullViewingKeyTaskData, ZcashErrorCodes>
  > {
    const p2: ZcashFvkP2 = zcashFvkP2FromMode(this.args.mode);

    const firstResult = await this.api.sendCommand(
      new GetFullViewingKeyCommand({
        isContinue: false,
        p2,
        derivationPath: this.args.derivationPath,
      }),
    );
    if (!isSuccessCommandResult(firstResult)) {
      return firstResult;
    }

    let lastChunk: Uint8Array<ArrayBufferLike> = new Uint8Array(
      firstResult.data.data,
    );
    let assembled: Uint8Array<ArrayBufferLike> = lastChunk;

    while (lastChunk.length === VK_RESPONSE_CHUNK_SIZE) {
      const next = await this.api.sendCommand(
        new GetFullViewingKeyCommand({
          isContinue: true,
          p2,
        }),
      );
      if (!isSuccessCommandResult(next)) {
        return next;
      }
      lastChunk = new Uint8Array(next.data.data);
      assembled = concat(assembled, lastChunk);
    }

    if (this.args.mode === "ufvk") {
      return parseAssembledUfvk(assembled);
    }

    return CommandResultFactory({
      data: { mode: "orchardFvk", fullViewingKey: assembled },
    });
  }
}

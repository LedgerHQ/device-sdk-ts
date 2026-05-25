import {
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import {
  type SuiAppErrorCodes,
  SUI_APP_ERRORS,
  SuiAppCommandErrorFactory,
} from "@internal/app-binder/command/utils/SuiAppErrors";

const CHUNK_SIZE = 180;
const HASH_SIZE = 32;
const STATUS_SUCCESS_HIGH = 0x90;
const STATUS_SUCCESS_LOW = 0x00;
const MAX_ITERATIONS = 10_000;

enum LedgerToHost {
  RESULT_ACCUMULATING = 0,
  RESULT_FINAL = 1,
  GET_CHUNK = 2,
  PUT_CHUNK = 3,
}

enum HostToLedger {
  START = 0,
  GET_CHUNK_RESPONSE_SUCCESS = 1,
  GET_CHUNK_RESPONSE_FAILURE = 2,
  PUT_CHUNK_RESPONSE = 3,
  RESULT_ACCUMULATING_RESPONSE = 4,
}

export type BlockProtocolTaskArgs = {
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  params: Uint8Array[];
};

async function sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  // Copy to a fresh ArrayBuffer to satisfy the BufferSource type constraint
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(hash);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildApdu(
  cla: number,
  ins: number,
  p1: number,
  p2: number,
  data: Uint8Array,
): Uint8Array {
  const apdu = new Uint8Array(5 + data.length);
  apdu[0] = cla;
  apdu[1] = ins;
  apdu[2] = p1;
  apdu[3] = p2;
  apdu[4] = data.length;
  apdu.set(data, 5);
  return apdu;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function checkStatusWord(
  statusCode: Uint8Array,
): CommandResult<Uint8Array, SuiAppErrorCodes> | null {
  if (
    statusCode.length === 2 &&
    statusCode[0] === STATUS_SUCCESS_HIGH &&
    statusCode[1] === STATUS_SUCCESS_LOW
  ) {
    return null;
  }

  const errorCode = toHex(statusCode) as SuiAppErrorCodes;
  const knownError = SUI_APP_ERRORS[errorCode];
  if (knownError) {
    return CommandResultFactory({
      error: SuiAppCommandErrorFactory({
        ...knownError,
        errorCode,
      }),
    });
  }

  return CommandResultFactory({
    error: new InvalidStatusWordError(
      `Unexpected status word: 0x${toHex(statusCode)}`,
    ),
  });
}

/**
 * Implements the Sui Ledger app's block protocol.
 *
 * Each parameter is split into 180-byte chunks and chained into a
 * content-addressed linked list: block = [SHA256_next (32 bytes)] + [chunk].
 * The last block in each chain has 32 zero bytes as the next hash.
 *
 * The host sends root hashes and then enters a conversation loop where the
 * Ledger requests blocks by hash (GET_CHUNK), stores data on the host
 * (PUT_CHUNK), or streams results back (RESULT_ACCUMULATING / RESULT_FINAL).
 */
export class BlockProtocolTask {
  constructor(
    private api: InternalApi,
    private args: BlockProtocolTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Uint8Array, SuiAppErrorCodes>> {
    const { cla, ins, p1, p2, params } = this.args;

    // Build block chains for each parameter
    const blockMap = new Map<string, Uint8Array>();
    const rootHashes: Uint8Array[] = [];

    for (const param of params) {
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < param.length; i += CHUNK_SIZE) {
        chunks.push(new Uint8Array(param.slice(i, i + CHUNK_SIZE)));
      }
      // Ensure at least one empty chunk if param is empty
      if (chunks.length === 0) {
        chunks.push(new Uint8Array(0));
      }

      // Build the chain right-to-left (foldr)
      let lastHash = new Uint8Array(HASH_SIZE); // 32 zero bytes for the tail
      for (let i = chunks.length - 1; i >= 0; i--) {
        const linkedChunk = concat(lastHash, chunks[i]!);
        lastHash = await sha256(linkedChunk);
        blockMap.set(toHex(lastHash), linkedChunk);
      }
      rootHashes.push(lastHash);
    }

    // Build START message: [START_BYTE] [rootHash1] [rootHash2] ...
    const startPayload = concat(
      new Uint8Array([HostToLedger.START]),
      ...rootHashes,
    );

    let payload: Uint8Array = startPayload;
    let result: Uint8Array = new Uint8Array(0);

    // Conversation loop
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const apdu = buildApdu(cla, ins, p1, p2, payload);

      const response = await this.api.sendApdu(apdu);

      if (response.isLeft()) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Transport error: ${response.extract().message}`,
          ),
        });
      }

      const apduResponse: ApduResponse = response.unsafeCoerce();

      // Check status word
      const statusError = checkStatusWord(apduResponse.statusCode);
      if (statusError !== null) {
        return statusError;
      }

      const responseData = apduResponse.data;
      if (responseData.length === 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Empty response from device"),
        });
      }

      const instruction = responseData[0] as LedgerToHost;
      const rvPayload = new Uint8Array(responseData.slice(1));

      switch (instruction) {
        case LedgerToHost.RESULT_ACCUMULATING:
          result = concat(result, rvPayload);
          payload = new Uint8Array([HostToLedger.RESULT_ACCUMULATING_RESPONSE]);
          break;

        case LedgerToHost.RESULT_FINAL:
          result = concat(result, rvPayload);
          return CommandResultFactory({ data: result });

        case LedgerToHost.GET_CHUNK: {
          const hashHex = toHex(rvPayload);
          const block = blockMap.get(hashHex);
          if (block) {
            payload = concat(
              new Uint8Array([HostToLedger.GET_CHUNK_RESPONSE_SUCCESS]),
              block,
            );
          } else {
            payload = new Uint8Array([HostToLedger.GET_CHUNK_RESPONSE_FAILURE]);
          }
          break;
        }

        case LedgerToHost.PUT_CHUNK: {
          const putHash = await sha256(rvPayload);
          blockMap.set(toHex(putHash), new Uint8Array(rvPayload));
          payload = new Uint8Array([HostToLedger.PUT_CHUNK_RESPONSE]);
          break;
        }

        default:
          return CommandResultFactory({
            error: new InvalidStatusWordError(
              `Unknown instruction from device: ${String(instruction)}`,
            ),
          });
      }
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError(
        "Block protocol exceeded maximum iterations",
      ),
    });
  }
}

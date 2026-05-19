// Chunked-framing transport for Contacts ops that opt into the 2-byte
// BE length prefix + ≤255-byte chunking scheme. Mirrors
// `address_book.py:54-91` `send_async_raw` for SUB_CMD_EDIT_IDENTIFIER,
// SUB_CMD_EDIT_SCOPE, SUB_CMD_PROVIDE_CONTACT,
// SUB_CMD_PROVIDE_LEDGER_ACCOUNT_CONTACT.
//
// First chunk is dispatched with P2=0x00 and carries the 2-byte BE
// total-payload-length prefix. Subsequent chunks use P2=0x80. The
// caller-supplied `makeCommand` builds a Command per chunk; the helper
// returns the final chunk's CommandResult unchanged so the caller can
// parse the device's structured response off the last exchange.
import type { Command } from "@api/command/Command";
import type { CommandResult } from "@api/command/model/CommandResult";
import type { InternalApi } from "@api/device-action/DeviceAction";
import type { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { isSuccessDmkResult } from "@api/model/DmkResult";

const MAX_CHUNK_BYTES = 255;
const P2_FIRST = 0x00;
const P2_NEXT = 0x80;

export type SendFramedContactsPayloadArgs<Response> = {
  /** TLV payload bytes (without any header or length framing). */
  readonly payload: Uint8Array;
  /** Sub-command byte (e.g. 0x04 for EDIT_SCOPE, 0x03 for EDIT_IDENTIFIER). */
  readonly p1: number;
  /** Per-chunk Command factory. The helper passes the chunk bytes and the P2 byte. */
  readonly makeCommand: (
    chunk: Uint8Array,
    p2: number,
  ) => Command<Response, unknown, unknown>;
  /**
   * Optional per-chunk diagnostic logging. When `logger` is provided the
   * helper emits one `debug` entry per outgoing chunk (tag = `commandTag ??
   * "framed-contacts"`), carrying chunk index/total/payload length/P2. Used
   * by the playground's Contacts log panel to interleave Command-level
   * context with DMK's auto APDU send/receive log.
   */
  readonly logger?: LoggerPublisherService;
  readonly commandTag?: string;
};

export async function sendFramedContactsPayload<Response>(
  api: InternalApi,
  {
    payload,
    makeCommand,
    logger,
    commandTag,
  }: SendFramedContactsPayloadArgs<Response>,
): Promise<CommandResult<Response>> {
  const framed = prependFrameLength(payload);
  const chunks = sliceChunks(framed, MAX_CHUNK_BYTES);
  const tag = commandTag ?? "framed-contacts";

  // Intermediate chunks: dispatch and short-circuit on error.
  for (let i = 0; i < chunks.length - 1; i++) {
    const p2 = i === 0 ? P2_FIRST : P2_NEXT;
    const chunk = chunks[i]!;
    logChunk(logger, tag, i, chunks.length, p2, chunk.length, framed.length);
    const result = (await api.sendCommand(
      makeCommand(chunk, p2),
    )) as CommandResult<Response>;
    if (!isSuccessDmkResult(result)) {
      return result;
    }
  }

  const lastIndex = chunks.length - 1;
  const lastP2 = lastIndex === 0 ? P2_FIRST : P2_NEXT;
  const lastChunk = chunks[lastIndex]!;
  logChunk(
    logger,
    tag,
    lastIndex,
    chunks.length,
    lastP2,
    lastChunk.length,
    framed.length,
  );
  return (await api.sendCommand(
    makeCommand(lastChunk, lastP2),
  )) as CommandResult<Response>;
}

function logChunk(
  logger: LoggerPublisherService | undefined,
  tag: string,
  index: number,
  total: number,
  p2: number,
  chunkLen: number,
  framedLen: number,
): void {
  if (!logger) return;
  logger.debug(`[chunk ${index + 1}/${total}] sending`, {
    tag,
    data: {
      chunkIndex: index,
      chunkCount: total,
      p2: `0x${p2.toString(16).padStart(2, "0")}`,
      chunkLen,
      framedPayloadLen: framedLen,
      isFirst: index === 0,
      isLast: index === total - 1,
    },
  });
}

function prependFrameLength(payload: Uint8Array): Uint8Array {
  const total = payload.length;
  const framed = new Uint8Array(total + 2);
  framed[0] = (total >> 8) & 0xff;
  framed[1] = total & 0xff;
  framed.set(payload, 2);
  return framed;
}

function sliceChunks(buffer: Uint8Array, max: number): Uint8Array[] {
  if (buffer.length === 0) return [buffer];
  const out: Uint8Array[] = [];
  for (let offset = 0; offset < buffer.length; offset += max) {
    out.push(buffer.slice(offset, Math.min(offset + max, buffer.length)));
  }
  return out;
}

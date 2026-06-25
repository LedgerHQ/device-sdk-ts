import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { RefreshBlockhashTask } from "./RefreshBlockhashTask";

const exampleTx = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
const exampleBlockhash = new Uint8Array(32).fill(0xab);
const patchedTx = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
const rpcUrl = "https://api.devnet.solana.com";

const loggerFactory = () =>
  ({ info: vi.fn(), error: vi.fn() }) as unknown as LoggerPublisherService;

let blockhashService: {
  fetchLatestBlockhash: ReturnType<typeof vi.fn>;
  patchBlockhash: ReturnType<typeof vi.fn>;
  zeroBlockhash: ReturnType<typeof vi.fn>;
};

function task(args: {
  transaction?: Uint8Array;
  rpcUrl?: string;
  fetchBlockhash?: () => Promise<Uint8Array>;
}) {
  return new RefreshBlockhashTask({
    transaction: args.transaction ?? exampleTx,
    rpcUrl: args.rpcUrl,
    fetchBlockhash: args.fetchBlockhash,
    blockhashService: blockhashService as unknown as BlockhashService,
    loggerFactory,
  });
}

describe("RefreshBlockhashTask", () => {
  beforeEach(() => {
    blockhashService = {
      fetchLatestBlockhash: vi.fn().mockResolvedValue(exampleBlockhash),
      patchBlockhash: vi.fn().mockReturnValue(patchedTx),
      zeroBlockhash: vi.fn(),
    };
  });

  it("with an rpcUrl: fetches then patches and returns the patched tx", async () => {
    const result = await task({ rpcUrl }).run();

    expect(blockhashService.fetchLatestBlockhash).toHaveBeenCalledWith(rpcUrl);
    expect(blockhashService.patchBlockhash).toHaveBeenCalledWith(
      exampleTx,
      exampleBlockhash,
    );
    expect(result).toStrictEqual(patchedTx);
  });

  it("with a custom fetchBlockhash callback: uses it instead of the rpcUrl", async () => {
    const fetchBlockhash = vi.fn().mockResolvedValue(exampleBlockhash);

    const result = await task({ fetchBlockhash }).run();

    expect(fetchBlockhash).toHaveBeenCalledTimes(1);
    expect(blockhashService.fetchLatestBlockhash).not.toHaveBeenCalled();
    expect(result).toStrictEqual(patchedTx);
  });

  it("no source: returns the original tx without fetching or patching", async () => {
    const result = await task({}).run();

    expect(blockhashService.fetchLatestBlockhash).not.toHaveBeenCalled();
    expect(blockhashService.patchBlockhash).not.toHaveBeenCalled();
    expect(result).toStrictEqual(exampleTx);
  });

  it("fetch failure: best-effort, returns the original tx (no patch)", async () => {
    blockhashService.fetchLatestBlockhash.mockRejectedValue(
      new Error("rpc down"),
    );

    const result = await task({ rpcUrl }).run();

    expect(blockhashService.patchBlockhash).not.toHaveBeenCalled();
    expect(result).toStrictEqual(exampleTx);
  });

  it("patch failure: best-effort, returns the original tx", async () => {
    blockhashService.patchBlockhash.mockImplementation(() => {
      throw new Error("patch boom");
    });

    const result = await task({ rpcUrl }).run();

    expect(blockhashService.fetchLatestBlockhash).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(exampleTx);
  });
});

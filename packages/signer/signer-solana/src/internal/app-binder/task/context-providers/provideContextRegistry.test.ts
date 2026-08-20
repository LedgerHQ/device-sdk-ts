/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ProvideContextDeps } from "./provideContextTypes";

vi.mock("./provideTokenContext", () => ({
  provideTokenContext: vi.fn(async () => undefined),
}));
vi.mock("./provideLifiContext", () => ({
  provideLifiContext: vi.fn(async () => undefined),
}));
vi.mock("./provideTransactionCheckContext", () => ({
  provideTransactionCheckContext: vi.fn(async () => undefined),
}));

import { dispatchProvideContext } from "./provideContextRegistry";
import { provideLifiContext } from "./provideLifiContext";
import { provideTokenContext } from "./provideTokenContext";
import { provideTransactionCheckContext } from "./provideTransactionCheckContext";

describe("dispatchProvideContext", () => {
  let deps: ProvideContextDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = {
      api: {} as any,
      logger: {} as any,
      normaliser: {} as any,
      transactionBytes: new Uint8Array(),
    };
  });

  it("routes SOLANA_TOKEN to provideTokenContext", async () => {
    const result = { type: ClearSignContextType.SOLANA_TOKEN } as any;

    await dispatchProvideContext(result, deps);

    expect(provideTokenContext).toHaveBeenCalledTimes(1);
    expect(provideTokenContext).toHaveBeenCalledWith(result, deps);
    expect(provideLifiContext).not.toHaveBeenCalled();
    expect(provideTransactionCheckContext).not.toHaveBeenCalled();
  });

  it("routes SOLANA_LIFI to provideLifiContext", async () => {
    const result = { type: ClearSignContextType.SOLANA_LIFI } as any;

    await dispatchProvideContext(result, deps);

    expect(provideLifiContext).toHaveBeenCalledTimes(1);
    expect(provideLifiContext).toHaveBeenCalledWith(result, deps);
    expect(provideTokenContext).not.toHaveBeenCalled();
    expect(provideTransactionCheckContext).not.toHaveBeenCalled();
  });

  it("routes SOLANA_TRANSACTION_CHECK to provideTransactionCheckContext", async () => {
    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK,
    } as any;

    await dispatchProvideContext(result, deps);

    expect(provideTransactionCheckContext).toHaveBeenCalledTimes(1);
    expect(provideTransactionCheckContext).toHaveBeenCalledWith(result, deps);
    expect(provideTokenContext).not.toHaveBeenCalled();
    expect(provideLifiContext).not.toHaveBeenCalled();
  });

  it("propagates a failed CommandResult from the underlying handler", async () => {
    (provideTokenContext as any).mockResolvedValueOnce(
      CommandResultFactory({
        error: {
          _tag: "SolanaAppCommandError",
          errorCode: "6a80",
          message: "boom",
        } as any,
      }),
    );

    const result = await dispatchProvideContext(
      { type: ClearSignContextType.SOLANA_TOKEN } as any,
      deps,
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });
});

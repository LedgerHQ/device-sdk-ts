import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { type SolanaTools } from "@ledgerhq/solana-tools";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { TransactionCraftingService } from "./TransactionCraftingService";

function createMockSolanaTools(
  overrides: Partial<SolanaTools> = {},
): SolanaTools {
  return {
    craftTransaction: vi.fn(),
    generateTransaction: vi.fn(),
    ...overrides,
  } as unknown as SolanaTools;
}

describe("TransactionCraftingService", () => {
  it("should throw when SolanaTools is not initialized", async () => {
    const service = new TransactionCraftingService();

    await expect(
      service.craftForDevice("44'/501'/0'", btoa("fake-tx")),
    ).rejects.toThrow("SolanaTools not initialized");
  });

  it("should return the crafted transaction on success", async () => {
    const service = new TransactionCraftingService();
    const subject = new Subject<{
      status: DeviceActionStatus;
      output?: string;
    }>();
    const solanaTools = createMockSolanaTools({
      craftTransaction: vi.fn().mockReturnValue({
        observable: subject.asObservable(),
        cancel: vi.fn(),
      }),
    });
    service.setSolanaTools(solanaTools);

    const promise = service.craftForDevice("44'/501'/0'", "base64-tx-input");

    subject.next({
      status: DeviceActionStatus.Completed,
      output: "crafted-base64-tx",
    });
    subject.complete();

    const result = await promise;

    expect(result).toBe("crafted-base64-tx");
    expect(solanaTools.craftTransaction).toHaveBeenCalledWith({
      derivationPath: "44'/501'/0'",
      serialisedTransaction: "base64-tx-input",
      skipOpenApp: true,
    });
  });

  it("should throw when the device action errors", async () => {
    const service = new TransactionCraftingService();
    const subject = new Subject<{
      status: DeviceActionStatus;
      error?: unknown;
    }>();
    const solanaTools = createMockSolanaTools({
      craftTransaction: vi.fn().mockReturnValue({
        observable: subject.asObservable(),
        cancel: vi.fn(),
      }),
    });
    service.setSolanaTools(solanaTools);

    const promise = service.craftForDevice("44'/501'/0'", "base64-tx");

    subject.next({
      status: DeviceActionStatus.Error,
      error: { message: "device rejected" },
    });
    subject.complete();

    await expect(promise).rejects.toThrow("Transaction crafting failed");
  });

  it("should skip pending states and resolve on completed", async () => {
    const service = new TransactionCraftingService();
    const subject = new Subject<{
      status: DeviceActionStatus;
      intermediateValue?: unknown;
      output?: string;
    }>();
    const solanaTools = createMockSolanaTools({
      craftTransaction: vi.fn().mockReturnValue({
        observable: subject.asObservable(),
        cancel: vi.fn(),
      }),
    });
    service.setSolanaTools(solanaTools);

    const promise = service.craftForDevice("44'/501'/0'", "tx");

    subject.next({
      status: DeviceActionStatus.Pending,
      intermediateValue: { requiredUserInteraction: "None" },
    });
    subject.next({
      status: DeviceActionStatus.Pending,
      intermediateValue: { requiredUserInteraction: "None" },
    });
    subject.next({
      status: DeviceActionStatus.Completed,
      output: "crafted-result",
    });
    subject.complete();

    const result = await promise;
    expect(result).toBe("crafted-result");
  });
});

import {
  DeviceActionStatus,
  type DeviceManagementKit,
} from "@ledgerhq/device-management-kit";
import { lastValueFrom, Observable, toArray } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { DefaultSolanaTools } from "./DefaultSolanaTools";

function makeDmkMock(result: {
  observable: Observable<unknown>;
  cancel: () => void;
}): DeviceManagementKit {
  return {
    executeDeviceAction: vi.fn().mockReturnValue(result),
  } as unknown as DeviceManagementKit;
}

describe("DefaultSolanaTools", () => {
  const sessionId = "test-session-id";

  describe("generateTransaction", () => {
    it("delegates to dmk.executeDeviceAction", () => {
      const cancel = vi.fn();
      const observable = new Observable((subscriber) => {
        subscriber.next({
          status: DeviceActionStatus.Completed,
          output: "generated-tx-base64",
        });
        subscriber.complete();
      });

      const dmk = makeDmkMock({ observable, cancel });
      const tools = new DefaultSolanaTools({ dmk, sessionId });

      const result = tools.generateTransaction("44'/501'/0'/0'");
      expect(result).toBeDefined();
      expect(result.observable).toBeDefined();
      expect(result.cancel).toBeDefined();
      expect(dmk.executeDeviceAction).toHaveBeenCalledOnce();
    });

    it("returns observable from executeDeviceAction", async () => {
      const cancel = vi.fn();
      const observable = new Observable((subscriber) => {
        subscriber.next({
          status: DeviceActionStatus.Pending,
          intermediateValue: { requiredUserInteraction: "None" },
        });
        subscriber.next({
          status: DeviceActionStatus.Completed,
          output: "generated-tx-base64",
        });
        subscriber.complete();
      });

      const dmk = makeDmkMock({ observable, cancel });
      const tools = new DefaultSolanaTools({ dmk, sessionId });
      const result = tools.generateTransaction("44'/501'/0'/0'");

      const states = await lastValueFrom(result.observable.pipe(toArray()));

      expect(states.length).toBeGreaterThanOrEqual(2);
      const lastState = states[states.length - 1]!;
      expect(lastState.status).toBe(DeviceActionStatus.Completed);
    });
  });

  describe("craftTransaction", () => {
    it("delegates to dmk.executeDeviceAction", () => {
      const cancel = vi.fn();
      const observable = new Observable((subscriber) => {
        subscriber.next({
          status: DeviceActionStatus.Completed,
          output: "crafted-tx-base64",
        });
        subscriber.complete();
      });

      const dmk = makeDmkMock({ observable, cancel });
      const tools = new DefaultSolanaTools({ dmk, sessionId });

      const result = tools.craftTransaction("44'/501'/0'/0'", "serialised-tx");
      expect(result).toBeDefined();
      expect(result.observable).toBeDefined();
      expect(result.cancel).toBeDefined();
      expect(dmk.executeDeviceAction).toHaveBeenCalledOnce();
    });

    it("returns observable from executeDeviceAction", async () => {
      const cancel = vi.fn();
      const observable = new Observable((subscriber) => {
        subscriber.next({
          status: DeviceActionStatus.Completed,
          output: "crafted-tx-base64",
        });
        subscriber.complete();
      });

      const dmk = makeDmkMock({ observable, cancel });
      const tools = new DefaultSolanaTools({ dmk, sessionId });
      const result = tools.craftTransaction("44'/501'/0'/0'", "serialised-tx");

      const states = await lastValueFrom(result.observable.pipe(toArray()));

      const lastState = states[states.length - 1]!;
      expect(lastState.status).toBe(DeviceActionStatus.Completed);
    });
  });
});

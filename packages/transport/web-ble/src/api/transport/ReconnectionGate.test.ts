import type { DmkError } from "@ledgerhq/device-management-kit";

import { ReconnectionGate } from "./ReconnectionGate";

describe("ReconnectionGate", () => {
  it("resolves wait() with Right(undefined) when resolve() is called", async () => {
    const gate = new ReconnectionGate();
    const promise = gate.wait();

    gate.resolve();

    const result = await promise;
    expect(result.isRight()).toBe(true);
    result.map(() => expect(true).toBe(true));
  });

  it("resolves wait() with Left(error) when reject(error) is called", async () => {
    const gate = new ReconnectionGate();
    const promise = gate.wait();

    const error = new Error("test-error") as unknown as DmkError;
    gate.reject(error);

    const result = await promise;
    expect(result.isLeft()).toBe(true);
    result.ifLeft((err) => expect(err).toBe(error));
  });

  it("supports sequential wait calls: first resolves, then a new wait can reject independently", async () => {
    const gate = new ReconnectionGate();

    const first = gate.wait();
    gate.resolve();
    const r1 = await first;
    expect(r1.isRight()).toBe(true);

    const secondError = new Error("second-error") as unknown as DmkError;
    const second = gate.wait();
    gate.reject(secondError);
    const r2 = await second;
    expect(r2.isLeft()).toBe(true);
    r2.ifLeft((err) => expect(err).toBe(secondError));
  });

  it("calling resolve() or reject() without a pending wait() does not throw", () => {
    const gate = new ReconnectionGate();
    expect(() => gate.resolve()).not.toThrow();
    expect(() =>
      gate.reject(new Error("no-wait") as unknown as DmkError),
    ).not.toThrow();
  });

  it("after resolve or reject, settle is cleared", async () => {
    const gate = new ReconnectionGate();
    const p = gate.wait();
    gate.resolve();
    await p;

    expect(() => gate.resolve()).not.toThrow();
    expect(() =>
      gate.reject(new Error("after-resolve") as unknown as DmkError),
    ).not.toThrow();
  });
});

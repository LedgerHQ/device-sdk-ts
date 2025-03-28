import { describe, expect, it } from "vitest";

import { MutexService } from "./MutexService";

describe("MutexService", () => {
  it("should immediately return a release function when not locked", async () => {
    // given
    const mutex = new MutexService();

    // when
    const release = await mutex.lock();

    // then
    expect(typeof release).toBe("function");
    release();
  });

  it("should queue subsequent lock calls until the lock is released", async () => {
    // given
    const mutex = new MutexService();
    const release1 = await mutex.lock();

    // when
    let lock2Resolved = false;
    const lock2Promise = mutex.lock().then((release2) => {
      lock2Resolved = true;
      release2();
    });

    // then
    expect(lock2Resolved).toBe(false);

    // when
    release1();
    await lock2Promise;

    // then
    expect(lock2Resolved).toBe(true);
  });

  it("should queue multiple locks in FIFO order", async () => {
    // given
    const mutex = new MutexService();
    const order: string[] = [];

    // when
    const release1 = await mutex.lock();
    order.push("first");
    const lock2Promise = mutex.lock().then((release2) => {
      order.push("second");
      release2();
    });
    const lock3Promise = mutex.lock().then((release3) => {
      order.push("third");
      release3();
    });

    // then
    order.push("afterqueue");

    // when
    release1();
    await Promise.all([lock2Promise, lock3Promise]);

    // then
    expect(order).toEqual(["first", "afterqueue", "second", "third"]);
  });
});

import { of, Subject, throwError } from "rxjs";
import { delay } from "rxjs/operators";

import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DefaultLoggerPublisherService } from "@internal/logger-publisher/service/DefaultLoggerPublisherService";

import { type Intent, IntentQueueService } from "./IntentQueueService";

let service: IntentQueueService;
let logger: LoggerPublisherService;

describe("IntentQueueService", () => {
  beforeEach(() => {
    logger = new DefaultLoggerPublisherService([], "intent-queue-service");
    const loggerFactory = () => logger;
    service = new IntentQueueService(loggerFactory);
  });

  it("should enqueue an observable and emit each value", async () => {
    // Arrange
    const intent: Intent<number> = {
      type: "device-action",
      execute: () => of(1, 2, 3).pipe(delay(1)), // Make it async
    };

    // Act
    const { observable } = service.enqueue(intent);
    const results: number[] = [];
    const promise = new Promise<void>((resolve) => {
      observable.subscribe({
        next: (value) => results.push(value),
        complete: () => resolve(),
      });
    });

    // Wait for completion
    await promise;

    // Assert
    expect(results).toEqual([1, 2, 3]);
  });

  it("should enqueue two observables and emit each value sequentially", async () => {
    // Arrange
    const intent1: Intent<string> = {
      type: "device-action",
      execute: () => of("a", "b").pipe(delay(10)),
    };

    const intent2: Intent<string> = {
      type: "send-apdu",
      execute: () => of("c", "d"),
    };

    // Act
    const { observable: obs1 } = service.enqueue(intent1);
    const { observable: obs2 } = service.enqueue(intent2);

    const results: string[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        obs1.subscribe({
          next: (value) => results.push(value),
          complete: () => resolve(),
        });
      }),
      new Promise<void>((resolve) => {
        obs2.subscribe({
          next: (value) => results.push(value),
          complete: () => resolve(),
        });
      }),
    ]);

    // Assert
    expect(results).toEqual(["a", "b", "c", "d"]);
  });

  it("should enqueue an observable and cancel it", async () => {
    // Arrange
    const subject = new Subject<number>();
    const intent: Intent<number> = {
      type: "device-action",
      execute: () => subject.asObservable(),
    };

    // Act
    const { observable, cancel } = service.enqueue(intent);
    const results: number[] = [];
    let completed = false;

    observable.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        completed = true;
      },
    });

    // Emit some values
    subject.next(1);
    subject.next(2);

    // Cancel the intent
    cancel();

    // Wait a bit to ensure cancellation is processed
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert
    expect(results).toEqual([1, 2]);
    expect(completed).toBe(true);
  });

  it("should enqueue two observables and cancel the first one", async () => {
    // Arrange
    const subject1 = new Subject<string>();
    const intent1: Intent<string> = {
      type: "device-action",
      execute: () => subject1.asObservable(),
    };

    const intent2: Intent<string> = {
      type: "send-apdu",
      execute: () => of("x", "y").pipe(delay(1)), // Make it async
    };

    // Act
    const { observable: obs1, cancel: cancel1 } = service.enqueue(intent1);
    const { observable: obs2 } = service.enqueue(intent2);

    const results: string[] = [];
    let completed1 = false;

    obs1.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        completed1 = true;
      },
    });

    const Promise2 = new Promise<void>((resolve) => {
      obs2.subscribe({
        next: (value) => results.push(value),
        complete: () => resolve(),
      });
    });

    // Emit some values from first intent
    subject1.next("a");
    subject1.next("b");

    expect(results).toEqual(["a", "b"]);

    // Cancel the first intent
    cancel1();

    // Wait a bit for cancellation to process and queue to continue
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(completed1).toBe(true);

    // Wait for second to complete
    await Promise2;
    expect(results).toEqual(["a", "b", "x", "y"]);
  });

  it("should enqueue two observables and cancel the second one", async () => {
    // Arrange
    const results: string[] = [];
    const intent1: Intent<string> = {
      type: "device-action",
      execute: () => of("a", "b").pipe(delay(10)),
    };

    const intent2: Intent<string> = {
      type: "send-apdu",
      execute: () => of("x", "y").pipe(delay(10)),
    };

    // Act
    const { observable: obs1 } = service.enqueue(intent1);
    const { observable: obs2, cancel: cancel2 } = service.enqueue(intent2);

    const results1Promise = new Promise<void>((resolve) => {
      obs1.subscribe({
        next: (value) => results.push(value),
        complete: () => resolve(),
      });
    });

    let completed2 = false;

    obs2.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        completed2 = true;
      },
    });

    // Cancel the second intent before first completes
    cancel2();

    // Wait for first to complete
    await results1Promise;

    // Wait a bit for cancellation to be processed
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Assert
    expect(results).toEqual(["a", "b"]);
    expect(completed2).toBe(true);
  });

  it("should enqueue three observables and cancel the second one", async () => {
    // Arrange
    const results: string[] = [];
    const intent1: Intent<string> = {
      type: "device-action",
      execute: () => of("a", "b").pipe(delay(10)),
    };

    const intent2: Intent<string> = {
      type: "send-apdu",
      execute: () => of("x", "y").pipe(delay(10)),
    };

    const intent3: Intent<string> = {
      type: "send-command",
      execute: () => of("1", "2").pipe(delay(10)),
    };

    // Act
    const { observable: obs1 } = service.enqueue(intent1);
    const { observable: obs2, cancel: cancel2 } = service.enqueue(intent2);
    const { observable: obs3 } = service.enqueue(intent3);

    const results1Promise = new Promise<void>((resolve) => {
      obs1.subscribe({
        next: (value) => results.push(value),
        complete: () => resolve(),
      });
    });

    let completed2 = false;

    obs2.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        completed2 = true;
      },
    });

    const results3Promise = new Promise<void>((resolve) => {
      obs3.subscribe({
        next: (value) => results.push(value),
        complete: () => resolve(),
      });
    });

    // Cancel the second intent before first completes
    cancel2();

    // Wait for first and third to complete
    await results1Promise;
    expect(results).toEqual(["a", "b"]);
    await results3Promise;
    expect(completed2).toBe(true);
    expect(results).toEqual(["a", "b", "1", "2"]);
  });

  it("should handle errors in intent execution", async () => {
    // Arrange
    const error = new Error("Test error");
    const intent: Intent<number> = {
      type: "device-action",
      execute: () => throwError(() => error),
    };

    // Act
    const { observable } = service.enqueue(intent);

    // Assert
    await expect(
      new Promise((_, reject) => {
        observable.subscribe({
          error: (err) => reject(err),
        });
      }),
    ).rejects.toThrow("Test error");
  });

  it("should continue processing queue after error", async () => {
    // Arrange
    const results: string[] = [];
    const error = new Error("Test error");
    const intent1: Intent<number> = {
      type: "device-action",
      execute: () => throwError(() => error).pipe(delay(10)),
    };

    const intent2: Intent<string> = {
      type: "send-apdu",
      execute: () => of("success").pipe(delay(10)),
    };

    // Act
    const { observable: obs1 } = service.enqueue(intent1);
    const { observable: obs2 } = service.enqueue(intent2);

    let error1Caught = false;

    // Subscribe to both immediately
    const promise1 = new Promise<void>((resolve) => {
      obs1.subscribe({
        next: (value) => results.push(String(value)),
        error: (err) => {
          expect(err).toEqual(error);
          error1Caught = true;
          resolve();
        },
      });
    });

    const promise2 = new Promise<void>((resolve) => {
      obs2.subscribe({
        next: (value) => results.push(value),
        complete: () => resolve(),
      });
    });

    // Wait for both to complete
    await promise1;
    await promise2;

    // Assert
    expect(error1Caught).toBe(true);
    expect(results).toEqual(["success"]);
  });
});

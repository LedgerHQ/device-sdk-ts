import { finalize, type Observable, Subject, type Subscription } from "rxjs";

import { type LoggerPublisherService } from "@root/src";

export type IntentType = "device-action" | "send-apdu" | "send-command";

export type Intent<T> = {
  type: IntentType;
  execute: () => Observable<T>;
};

type QueueItem<T> = {
  intent: Intent<T>;
  subject: Subject<T>;
  isCancelled: boolean;
};

/**
 * Intent Queue Service
 *
 * Manages a sequential queue of intents (device actions, APDUs, commands) that must be
 * executed one at a time. Each intent returns an Observable and a cancel function.
 *
 * @remarks
 * **Queue Processing:**
 * - Intents are processed in FIFO (First-In-First-Out) order
 * - Only one intent executes at a time (sequential processing)
 * - Subsequent intents wait for the current one to complete
 *
 * **Graphical Representation:**
 *
 * Normal Sequential Processing:
 * ```
 * Time ──────────────────────────────────────────────────>
 *
 * Intent 1:  [████████████]
 * Intent 2:                 [██████████]
 * Intent 3:                               [████████]
 *
 * Queue:    [1,2,3] → [2,3] → [3] → []
 * ```
 *
 * Cancelling Currently Executing Intent:
 * ```
 * Time ──────────────────────────────────────────────────>
 *
 * Intent 1:  [████XX]
 * Intent 2:          [██████████]
 * Intent 3:                        [████████]
 *                    ↑ Intent 2 starts immediately
 * Queue:    [1,2,3] → [2,3] → [3] → []
 *           Cancel 1 ↑
 * ```
 *
 * Cancelling Queued Intent:
 * ```
 * Time ──────────────────────────────────────────────────>
 *
 * Intent 1:  [████████████]
 * Intent 2:                 [CANCELLED]
 * Intent 3:                 [████████]
 *                           ↑ Intent 3 starts immediately
 * Queue:    [1,2,3] → [1,3] → [3] → []
 *           Cancel 2 ↑
 * ```
 *
 * @example
 * ```typescript
 * const { observable, cancel } = intentQueue.enqueue({
 *   type: "device-action",
 *   execute: () => of(result)
 * });
 *
 * observable.subscribe({
 *   next: (value) => console.log(value),
 *   complete: () => console.log('Done')
 * });
 *
 * // Cancel if needed
 * cancel();
 * ```
 */
export class IntentQueueService {
  private readonly _logger: LoggerPublisherService;
  private readonly _queue: QueueItem<unknown>[] = [];
  private _isProcessing = false;
  private _currentSubscription: Subscription | null = null;

  constructor(
    private readonly loggerModuleFactory: (
      tag: string,
    ) => LoggerPublisherService,
  ) {
    this._logger = this.loggerModuleFactory("IntentQueueService");
  }

  /**
   * Enqueues an intent and returns an observable that will emit the result
   * of the intent execution, along with a cancel function.
   */
  public enqueue<T>(intent: Intent<T>): {
    observable: Observable<T>;
    cancel: () => void;
  } {
    this._logger.debug("Enqueueing intent", { data: { type: intent.type } });

    const subject = new Subject<T>();
    const queueItem: QueueItem<T> = {
      intent,
      subject,
      isCancelled: false,
    };

    this._queue.push(queueItem as QueueItem<unknown>);

    const cancel = () => {
      this._logger.debug("Cancelling intent", { data: { type: intent.type } });
      queueItem.isCancelled = true;

      // If this is the currently executing intent, cancel the subscription
      if (this._queue[0] === queueItem && this._currentSubscription) {
        this._currentSubscription.unsubscribe();
        this._currentSubscription = null;
        subject.complete();
        this._queue.shift();
        this._isProcessing = false;
        this._processQueue();
      } else if (!this._isProcessing || this._queue[0] !== queueItem) {
        // If not currently executing, just complete the subject
        subject.complete();
      }
    };

    // Start processing if not already processing
    if (!this._isProcessing) {
      this._processQueue();
    }

    return {
      observable: subject.asObservable().pipe(
        finalize(() => {
          this._logger.debug("Intent observable finalized", {
            data: { type: intent.type },
          });
        }),
      ),
      cancel,
    };
  }

  /**
   * Processes the queue sequentially.
   * Skips cancelled items and continues to the next one.
   */
  private _processQueue(): void {
    // If already processing or queue is empty, do nothing
    if (this._isProcessing || this._queue.length === 0) {
      return;
    }

    this._isProcessing = true;

    // Get the next item from the queue
    const queueItem = this._queue[0] as QueueItem<unknown>;

    // Skip cancelled items
    if (queueItem.isCancelled) {
      this._logger.debug("Skipping cancelled intent", {
        data: { type: queueItem.intent.type },
      });
      queueItem.subject.complete();
      this._queue.shift();
      this._isProcessing = false;
      this._processQueue();
      return;
    }

    this._logger.debug("Processing intent", {
      data: { type: queueItem.intent.type },
    });

    // Execute the intent
    this._currentSubscription = queueItem.intent.execute().subscribe({
      next: (value) => {
        if (!queueItem.isCancelled) {
          queueItem.subject.next(value);
        }
      },
      error: (error) => {
        if (!queueItem.isCancelled) {
          queueItem.subject.error(error);
        }
        this._onIntentComplete();
      },
      complete: () => {
        if (!queueItem.isCancelled) {
          queueItem.subject.complete();
        }
        this._onIntentComplete();
      },
    });
  }

  /**
   * Called when an intent completes (either successfully or with error).
   * Removes the completed item from the queue and processes the next one.
   */
  private _onIntentComplete(): void {
    this._logger.debug("Intent completed");
    this._currentSubscription = null;
    this._queue.shift();
    this._isProcessing = false;
    this._processQueue();
  }
}

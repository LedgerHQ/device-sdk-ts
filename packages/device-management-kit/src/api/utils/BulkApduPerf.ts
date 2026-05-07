type BulkPerfStats = {
  active: boolean;
  testStep: string;
  label: string;
  startedAt: number;
  endedAt?: number;
  apduCount: number;
  progressEventCount: number;
  errors: string[];
  meta: Record<string, unknown>;
  counters: Record<string, number>;
  durations: Record<string, number>;
  marks: Record<string, number>;
  interval?: ReturnType<typeof setInterval>;
  lastEventLoopTick?: number;
};

const EVENT_LOOP_SAMPLE_INTERVAL_MS = 100;
const LOG_CHUNK_SIZE = 900;

// Update this when moving to a new step in RNBulkApduTestingProtocol.md.
export const BULK_APDU_PERF_TEST_STEP =
  "Test 6b: RN BLE fire-and-forget writeWithoutResponse";

const stats: BulkPerfStats = {
  active: false,
  testStep: BULK_APDU_PERF_TEST_STEP,
  label: "",
  startedAt: 0,
  apduCount: 0,
  progressEventCount: 0,
  errors: [],
  meta: {},
  counters: {},
  durations: {},
  marks: {},
};

(
  globalThis as typeof globalThis & {
    __DMK_BULK_APDU_PERF__?: BulkPerfStats;
  }
).__DMK_BULK_APDU_PERF__ = stats;

export function bulkPerfNow(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

function resetStats(label: string, meta: Record<string, unknown>): void {
  stats.active = true;
  stats.testStep = BULK_APDU_PERF_TEST_STEP;
  stats.label = label;
  stats.startedAt = bulkPerfNow();
  stats.endedAt = undefined;
  stats.apduCount = 0;
  stats.progressEventCount = 0;
  stats.errors = [];
  stats.meta = meta;
  stats.counters = {};
  stats.durations = {};
  stats.marks = {};
}

function startEventLoopLagSampling(): void {
  if (stats.interval) {
    clearInterval(stats.interval);
  }

  stats.lastEventLoopTick = bulkPerfNow();
  stats.interval = setInterval(() => {
    if (!stats.active || stats.lastEventLoopTick === undefined) {
      return;
    }

    const now = bulkPerfNow();
    const lag = Math.max(
      0,
      now - stats.lastEventLoopTick - EVENT_LOOP_SAMPLE_INTERVAL_MS,
    );
    stats.lastEventLoopTick = now;

    if (lag <= 0) {
      return;
    }

    bulkPerfCount("eventLoop.lagSamples");
    bulkPerfAddDuration("eventLoop.totalLagMs", lag);
    bulkPerfSetCounter(
      "eventLoop.maxLagMs",
      Math.max(stats.counters["eventLoop.maxLagMs"] ?? 0, lag),
    );
  }, EVENT_LOOP_SAMPLE_INTERVAL_MS);
}

function stopEventLoopLagSampling(): void {
  if (stats.interval) {
    clearInterval(stats.interval);
    stats.interval = undefined;
  }
  stats.lastEventLoopTick = undefined;
}

function clearStatsAfterLog(): void {
  stats.active = false;
  stats.label = "";
  stats.startedAt = 0;
  stats.endedAt = undefined;
  stats.apduCount = 0;
  stats.progressEventCount = 0;
  stats.errors = [];
  stats.meta = {};
  stats.counters = {};
  stats.durations = {};
  stats.marks = {};
}

export function bulkPerfStart(
  label: string,
  meta: Record<string, unknown> = {},
): void {
  resetStats(label, meta);
  startEventLoopLagSampling();
}

export function bulkPerfEnd(extra: Record<string, unknown> = {}): void {
  if (!stats.active) {
    return;
  }

  stats.endedAt = bulkPerfNow();
  const totalMs = stats.endedAt - stats.startedAt;
  stopEventLoopLagSampling();

  const snapshot = {
    testStep: stats.testStep,
    label: stats.label,
    startedAtMs: stats.startedAt,
    endedAtMs: stats.endedAt,
    totalMs,
    apduCount: stats.apduCount,
    msPerApdu: stats.apduCount ? totalMs / stats.apduCount : null,
    progressEventCount: stats.progressEventCount,
    meta: { ...stats.meta },
    counters: { ...stats.counters },
    durations: { ...stats.durations },
    errors: [...stats.errors],
    ...extra,
  };

  // Temporary test instrumentation: one aggregate line at the end of a bulk run.
  console.log("[DMK_BULK_PERF]", snapshot);
  const snapshotJson = JSON.stringify(snapshot);
  const chunkCount = Math.ceil(snapshotJson.length / LOG_CHUNK_SIZE);
  for (let i = 0; i < chunkCount; i++) {
    console.log(
      `[DMK_BULK_PERF_JSON ${i + 1}/${chunkCount}] ${snapshotJson.slice(
        i * LOG_CHUNK_SIZE,
        (i + 1) * LOG_CHUNK_SIZE,
      )}`,
    );
  }

  clearStatsAfterLog();
}

export function bulkPerfIsActive(): boolean {
  return stats.active;
}

export function bulkPerfCount(name: string, count = 1): void {
  if (!stats.active) {
    return;
  }
  stats.counters[name] = (stats.counters[name] ?? 0) + count;
}

export function bulkPerfSetCounter(name: string, value: number): void {
  if (!stats.active) {
    return;
  }
  stats.counters[name] = value;
}

export function bulkPerfAddDuration(name: string, durationMs: number): void {
  if (!stats.active) {
    return;
  }
  stats.durations[name] = (stats.durations[name] ?? 0) + durationMs;
}

export function bulkPerfMark(name: string, value = bulkPerfNow()): void {
  if (!stats.active) {
    return;
  }
  stats.marks[name] = value;
}

export function bulkPerfMeasureSinceMark(
  durationName: string,
  markName: string,
  {
    clearMark = false,
    counterName,
    end = bulkPerfNow(),
  }: {
    clearMark?: boolean;
    counterName?: string;
    end?: number;
  } = {},
): void {
  if (!stats.active) {
    return;
  }

  const start = stats.marks[markName];
  if (start === undefined) {
    return;
  }

  bulkPerfAddDuration(durationName, end - start);
  if (counterName) {
    bulkPerfCount(counterName);
  }
  if (clearMark) {
    delete stats.marks[markName];
  }
}

export function bulkPerfRecordError(error: unknown): void {
  if (!stats.active) {
    return;
  }
  stats.errors.push(error instanceof Error ? error.message : String(error));
}

export function bulkPerfMarkApdu(): void {
  if (!stats.active) {
    return;
  }
  stats.apduCount += 1;
  bulkPerfCount("bulk.apduCount");
}

export function bulkPerfMarkProgress(): void {
  if (!stats.active) {
    return;
  }
  stats.progressEventCount += 1;
  bulkPerfCount("bulk.progressEventCount");
}

export function bulkPerfMeasure<T>(name: string, fn: () => T): T {
  if (!stats.active) {
    return fn();
  }

  const start = bulkPerfNow();
  try {
    return fn();
  } finally {
    bulkPerfAddDuration(name, bulkPerfNow() - start);
  }
}

export async function bulkPerfMeasureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!stats.active) {
    return fn();
  }

  const start = bulkPerfNow();
  try {
    return await fn();
  } finally {
    bulkPerfAddDuration(name, bulkPerfNow() - start);
  }
}

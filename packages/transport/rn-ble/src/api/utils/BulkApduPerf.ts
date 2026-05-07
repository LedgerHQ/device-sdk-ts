type BulkPerfStats = {
  active: boolean;
  counters: Record<string, number>;
  durations: Record<string, number>;
  marks: Record<string, number>;
  errors: string[];
};

type GlobalWithBulkPerf = typeof globalThis & {
  __DMK_BULK_APDU_PERF__?: BulkPerfStats;
};

function getStats(): BulkPerfStats | undefined {
  return (globalThis as GlobalWithBulkPerf).__DMK_BULK_APDU_PERF__;
}

export function bulkPerfNow(): number {
  return typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

export function bulkPerfIsActive(): boolean {
  return getStats()?.active ?? false;
}

export function bulkPerfCount(name: string, count = 1): void {
  const stats = getStats();
  if (!stats?.active) {
    return;
  }
  stats.counters[name] = (stats.counters[name] ?? 0) + count;
}

export function bulkPerfSetCounter(name: string, value: number): void {
  const stats = getStats();
  if (!stats?.active) {
    return;
  }
  stats.counters[name] = value;
}

export function bulkPerfAddDuration(name: string, durationMs: number): void {
  const stats = getStats();
  if (!stats?.active) {
    return;
  }
  stats.durations[name] = (stats.durations[name] ?? 0) + durationMs;
}

export function bulkPerfMark(name: string, value = bulkPerfNow()): void {
  const stats = getStats();
  if (!stats?.active) {
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
  const stats = getStats();
  if (!stats?.active) {
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
  const stats = getStats();
  if (!stats?.active) {
    return;
  }
  stats.errors.push(error instanceof Error ? error.message : String(error));
}

export function bulkPerfMeasure<T>(name: string, fn: () => T): T {
  const stats = getStats();
  if (!stats?.active) {
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
  const stats = getStats();
  if (!stats?.active) {
    return fn();
  }

  const start = bulkPerfNow();
  try {
    return await fn();
  } finally {
    bulkPerfAddDuration(name, bulkPerfNow() - start);
  }
}

// LoggerSubscriberService that captures DMK + Contacts-flow log entries
// into a bounded ring buffer for the in-app Contacts log panel.
//
// Only entries whose `tag` matches the Contacts allow-list are retained —
// keeps the panel signal-to-noise high during crash-repro flows.
//
// The buffer is exposed through a useSyncExternalStore-compatible pair:
// `subscribe(listener)` + `snapshot()`. `snapshot()` returns a stable
// reference until the next mutation; we rebuild the array on each push
// so React sees a new identity and re-renders.
import {
  type LoggerSubscriberService,
  type LogLevel,
  type LogSubscriberOptions,
} from "@ledgerhq/device-management-kit";

type LogSubscriberData = LogSubscriberOptions["data"];

const MAX_ENTRIES = 1000;

// Tags we forward into the panel. `device-session` is DMK's APDU send/receive
// log. The rest are emitted by the Contacts Tasks/Commands and the playground
// forms (see useContactsFormLogger).
const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "device-session",
  "provideContact",
  "provideLedgerAccount",
  "editContactName",
  "editScope",
  "contacts-form",
  "SendProvideContactTask",
  "SendProvideLedgerAccountTask",
  "SendRegisterIdentityTask",
  "SendRegisterLedgerAccountTask",
  "SendEditContactNameTask",
  "SendEditScopeTask",
  "ContactsContextLoader",
]);

export type ContactsLogEntry = {
  readonly id: number;
  readonly ts: number;
  readonly level: LogLevel;
  readonly tag: string;
  readonly message: string;
  readonly data?: LogSubscriberData;
};

type Listener = () => void;

export class ContactsLogsLogger implements LoggerSubscriberService {
  // Replaced on every push so useSyncExternalStore sees a new reference.
  private entries: readonly ContactsLogEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private nextId = 1;
  private paused = false;

  log(level: LogLevel, message: string, options: LogSubscriberOptions): void {
    if (this.paused) return;
    // DefaultLogTagFormatter wraps tags in brackets ("[device-session]") and
    // hierarchical tags as "[a] [b]". Match the leaf tag(s) against the
    // allow-list and store the cleaned form for display.
    const parts = extractTagParts(options.tag);
    const matched = parts.find((p) => ALLOWED_TAGS.has(p));
    if (!matched) return;
    this.push({
      id: this.nextId++,
      ts: options.timestamp,
      level,
      tag: matched,
      message,
      data: options.data,
    });
  }

  // Manual entry for non-DMK sources (form submits, etc.). Bypasses the
  // tag allow-list check — callers are trusted to pick a sensible tag.
  record(
    level: LogLevel,
    message: string,
    options: LogSubscriberOptions,
  ): void {
    if (this.paused) return;
    this.push({
      id: this.nextId++,
      ts: options.timestamp,
      level,
      tag: options.tag,
      message,
      data: options.data,
    });
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = (): readonly ContactsLogEntry[] => {
    return this.entries;
  };

  clear(): void {
    this.entries = [];
    this.notify();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  private push(entry: ContactsLogEntry): void {
    const next =
      this.entries.length >= MAX_ENTRIES
        ? [...this.entries.slice(this.entries.length - MAX_ENTRIES + 1), entry]
        : [...this.entries, entry];
    this.entries = next;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// "[a]" → ["a"], "[a] [b]" → ["a", "b"], "raw" → ["raw"].
function extractTagParts(tag: string): string[] {
  const matches = tag.match(/\[([^\]]+)\]/g);
  if (!matches) return [tag];
  return matches.map((m) => m.slice(1, -1));
}

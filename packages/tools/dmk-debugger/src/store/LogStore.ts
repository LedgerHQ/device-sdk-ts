import { EventEmitter } from "events";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  tag: string | string[];
  timestamp: string;
  data?: unknown;
  receivedAt: number;
}

export interface ApduExchange {
  id: number;
  sentApdu: string;
  receivedResponse: string;
  sentAt: string;
  receivedAt: string;
  tag: string | string[];
  duration?: number;
}

type LogStoreEvents = {
  entry: [entry: LogEntry];
  apdu: [exchange: ApduExchange];
  cleared: [];
  error: [entry: LogEntry];
};

/**
 * In-memory ring buffer for DMK log entries.
 * Emits events so the sidebar and chat participant can react in real time.
 */
export class LogStore extends EventEmitter<LogStoreEvents> {
  private entries: LogEntry[] = [];
  private apduExchanges: ApduExchange[] = [];
  private nextId = 1;
  private nextApduId = 1;
  private pendingApdu: Partial<ApduExchange> | null = null;

  constructor(private readonly maxEntries: number = 10_000) {
    super();
  }

  add(raw: Omit<LogEntry, "id" | "receivedAt">): LogEntry {
    const entry: LogEntry = {
      ...raw,
      id: this.nextId++,
      receivedAt: Date.now(),
    };

    this.entries.push(entry);

    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    this.emit("entry", entry);

    if (entry.level === "error") {
      this.emit("error", entry);
    }

    this.tryExtractApdu(entry);

    return entry;
  }

  addBatch(
    rawEntries: Omit<LogEntry, "id" | "receivedAt">[],
  ): LogEntry[] {
    return rawEntries.map((raw) => this.add(raw));
  }

  getAll(): LogEntry[] {
    return [...this.entries];
  }

  getApduExchanges(): ApduExchange[] {
    return [...this.apduExchanges];
  }

  query(filter: {
    level?: LogLevel;
    tag?: string;
    search?: string;
    since?: number;
  }): LogEntry[] {
    return this.entries.filter((e) => {
      if (filter.level && e.level !== filter.level) return false;
      if (filter.tag) {
        const tags = Array.isArray(e.tag) ? e.tag : [e.tag];
        if (!tags.some((t) => t.includes(filter.tag!))) return false;
      }
      if (filter.search && !e.message.includes(filter.search)) return false;
      if (filter.since && e.receivedAt < filter.since) return false;
      return true;
    });
  }

  clear(): void {
    this.entries = [];
    this.apduExchanges = [];
    this.pendingApdu = null;
    this.emit("cleared");
  }

  get size(): number {
    return this.entries.length;
  }

  get apduCount(): number {
    return this.apduExchanges.length;
  }

  toJSON(): { entries: LogEntry[]; apduExchanges: ApduExchange[] } {
    return {
      entries: this.getAll(),
      apduExchanges: this.getApduExchanges(),
    };
  }

  /**
   * Heuristic: detect APDU sends/receives from log messages.
   * DMK logs APDUs with tags like "ApduSender" or messages containing hex APDU data.
   */
  private tryExtractApdu(entry: LogEntry): void {
    const msg = entry.message.toLowerCase();
    const tags = Array.isArray(entry.tag) ? entry.tag.join(" ") : entry.tag;
    const isApduRelated =
      tags.toLowerCase().includes("apdu") || msg.includes("apdu");

    if (!isApduRelated) return;

    if (msg.includes("sending") || msg.includes("send") || msg.includes("=>")) {
      const hex = this.extractHex(entry.message);
      if (hex) {
        this.pendingApdu = {
          sentApdu: hex,
          sentAt: entry.timestamp,
          tag: entry.tag,
        };
      }
    } else if (
      (msg.includes("received") || msg.includes("receive") || msg.includes("<=")) &&
      this.pendingApdu
    ) {
      const hex = this.extractHex(entry.message);
      if (hex) {
        const exchange: ApduExchange = {
          id: this.nextApduId++,
          sentApdu: this.pendingApdu.sentApdu!,
          receivedResponse: hex,
          sentAt: this.pendingApdu.sentAt!,
          receivedAt: entry.timestamp,
          tag: this.pendingApdu.tag ?? entry.tag,
        };
        this.apduExchanges.push(exchange);
        this.emit("apdu", exchange);
        this.pendingApdu = null;
      }
    }
  }

  private extractHex(message: string): string | null {
    const hexPattern = /\b([0-9a-fA-F]{4,})\b/;
    const match = hexPattern.exec(message);
    return match?.[1] ?? null;
  }
}

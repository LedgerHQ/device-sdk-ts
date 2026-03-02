import type { ApduExchange, LogEntry, LogStore } from "../store/LogStore";
import { decodeCommandApdu, decodeStatusWord, tryDecodeAscii } from "./apdu";

export type AnalysisCommand = "analyze" | "diagram" | "clear-signing";

export interface AnalysisResult {
  command: AnalysisCommand;
  sections: AnalysisSection[];
}

export interface AnalysisSection {
  title: string;
  content: string;
  severity: "ok" | "info" | "warn" | "error";
}

export class AnalyzerService {
  analyze(store: LogStore, command: AnalysisCommand): AnalysisResult {
    switch (command) {
      case "analyze":
        return this.runFullAnalysis(store);
      case "diagram":
        return this.runDiagram(store);
      case "clear-signing":
        return this.runClearSigningAnalysis(store);
    }
  }

  private runFullAnalysis(store: LogStore): AnalysisResult {
    const logs = store.getAll();
    const apdus = store.getApduExchanges();
    const sections: AnalysisSection[] = [];

    // Summary
    const errorCount = logs.filter((l) => l.level === "error").length;
    const warnCount = logs.filter((l) => l.level === "warn").length;
    sections.push({
      title: "Session Summary",
      severity: errorCount > 0 ? "error" : warnCount > 0 ? "warn" : "ok",
      content: this.buildSummary(logs, apdus),
    });

    // Error analysis
    const errors = logs.filter((l) => l.level === "error");
    if (errors.length > 0) {
      sections.push({
        title: `Errors (${errors.length})`,
        severity: "error",
        content: errors
          .map((e) => {
            const tag = Array.isArray(e.tag) ? e.tag.join(":") : e.tag;
            return `[${e.timestamp}] [${tag}] ${e.message}`;
          })
          .join("\n"),
      });
    }

    // APDU analysis
    if (apdus.length > 0) {
      sections.push({
        title: `APDU Exchanges (${apdus.length})`,
        severity: "info",
        content: this.buildApduAnalysis(apdus),
      });
    }

    // Status word check
    const failedApdus = this.findFailedApdus(apdus);
    if (failedApdus.length > 0) {
      sections.push({
        title: `Failed APDUs (${failedApdus.length})`,
        severity: "error",
        content: failedApdus
          .map((f) => `${f.command} → ${f.sw.raw} (${f.sw.label})`)
          .join("\n"),
      });
    }

    // Warnings analysis
    const warnings = logs.filter((l) => l.level === "warn");
    if (warnings.length > 0) {
      sections.push({
        title: `Warnings (${warnings.length})`,
        severity: "warn",
        content: warnings
          .map((w) => {
            const tag = Array.isArray(w.tag) ? w.tag.join(":") : w.tag;
            return `[${w.timestamp}] [${tag}] ${w.message}`;
          })
          .join("\n"),
      });
    }

    // Pattern detection
    const patterns = this.detectPatterns(logs);
    if (patterns.length > 0) {
      for (const p of patterns) {
        sections.push(p);
      }
    }

    if (sections.length === 1) {
      sections.push({
        title: "No Issues Found",
        severity: "ok",
        content: "The session looks clean. No errors, warnings, or suspicious patterns detected.",
      });
    }

    return { command: "analyze", sections };
  }

  private runDiagram(store: LogStore): AnalysisResult {
    const apdus = store.getApduExchanges();
    const logs = store.getAll();

    if (apdus.length === 0) {
      return {
        command: "diagram",
        sections: [
          {
            title: "APDU Flow Diagram",
            severity: "info",
            content: this.buildDiagramFromLogs(logs),
          },
        ],
      };
    }

    const lines = [
      "sequenceDiagram",
      "    participant Host",
      "    participant Device",
    ];

    let currentGroup: string | null = null;

    for (const apdu of apdus) {
      const cmd = decodeCommandApdu(apdu.sentApdu);
      const sw = decodeStatusWord(apdu.receivedResponse);

      const group = this.getApduGroup(cmd.commandName);
      if (group !== currentGroup) {
        if (currentGroup) lines.push("    end");
        lines.push(`    rect rgb(200, 220, 255)`);
        lines.push(`        Note over Host,Device: ${group}`);
        currentGroup = group;
      }

      const cmdLabel = cmd.commandName;
      const dataHint = cmd.data ? ` (${cmd.dataLength}B)` : "";
      lines.push(`        Host->>Device: ${cmdLabel}${dataHint}`);

      const swColor = sw.severity === "error" ? "🔴 " : sw.severity === "warn" ? "🟡 " : "";
      lines.push(`        Device-->>Host: ${swColor}${sw.raw} ${sw.label}`);
    }

    if (currentGroup) lines.push("    end");

    return {
      command: "diagram",
      sections: [
        {
          title: "APDU Flow Diagram (Mermaid)",
          severity: "info",
          content: "```mermaid\n" + lines.join("\n") + "\n```",
        },
        {
          title: "APDU Details",
          severity: "info",
          content: this.buildApduAnalysis(apdus),
        },
      ],
    };
  }

  private runClearSigningAnalysis(store: LogStore): AnalysisResult {
    const logs = store.getAll();
    const apdus = store.getApduExchanges();
    const sections: AnalysisSection[] = [];

    // Check for context module activity
    const contextLogs = logs.filter((l) => {
      const tag = Array.isArray(l.tag) ? l.tag.join(" ") : l.tag;
      return (
        tag.toLowerCase().includes("context") ||
        l.message.toLowerCase().includes("context") ||
        l.message.toLowerCase().includes("clear sign") ||
        l.message.toLowerCase().includes("trusted name") ||
        l.message.toLowerCase().includes("domain")
      );
    });

    const provideApdus = apdus.filter((a) => {
      const cmd = decodeCommandApdu(a.sentApdu);
      return (
        cmd.commandName.includes("PROVIDE") ||
        cmd.commandName.includes("SET_PLUGIN") ||
        cmd.commandName.includes("SET_EXTERNAL")
      );
    });

    if (contextLogs.length === 0 && provideApdus.length === 0) {
      sections.push({
        title: "Clear Signing Status",
        severity: "warn",
        content:
          "No clear signing activity detected in the logs.\n\n" +
          "Possible reasons:\n" +
          "• Context module was not configured\n" +
          "• Transaction type doesn't support clear signing\n" +
          "• The operation wasn't a signing request\n" +
          "• The device app doesn't support clear signing",
      });
    } else {
      if (contextLogs.length > 0) {
        sections.push({
          title: "Context Module Activity",
          severity: "info",
          content: contextLogs
            .map((l) => {
              const tag = Array.isArray(l.tag) ? l.tag.join(":") : l.tag;
              return `[${l.level.toUpperCase()}] [${tag}] ${l.message}`;
            })
            .join("\n"),
        });
      }

      if (provideApdus.length > 0) {
        sections.push({
          title: `Clear Signing APDUs (${provideApdus.length})`,
          severity: "info",
          content: provideApdus
            .map((a) => {
              const cmd = decodeCommandApdu(a.sentApdu);
              const sw = decodeStatusWord(a.receivedResponse);
              return `${cmd.commandName} → ${sw.raw} (${sw.label})`;
            })
            .join("\n"),
        });

        const failed = provideApdus.filter((a) => {
          const sw = decodeStatusWord(a.receivedResponse);
          return sw.severity === "error";
        });

        if (failed.length > 0) {
          sections.push({
            title: "Clear Signing Failures",
            severity: "error",
            content:
              "Some clear signing APDUs were rejected by the device:\n\n" +
              failed
                .map((a) => {
                  const cmd = decodeCommandApdu(a.sentApdu);
                  const sw = decodeStatusWord(a.receivedResponse);
                  return `${cmd.commandName} → ${sw.raw} (${sw.label})`;
                })
                .join("\n") +
              "\n\nThe device likely fell back to blind signing.",
          });
        } else {
          sections.push({
            title: "Clear Signing Status",
            severity: "ok",
            content: "All clear signing APDUs were accepted. The device should display human-readable transaction details.",
          });
        }
      }
    }

    // Check for context module errors
    const contextErrors = logs.filter(
      (l) =>
        l.level === "error" &&
        (Array.isArray(l.tag) ? l.tag.join(" ") : l.tag).toLowerCase().includes("context"),
    );
    if (contextErrors.length > 0) {
      sections.push({
        title: "Context Module Errors",
        severity: "error",
        content: contextErrors.map((e) => `[${e.timestamp}] ${e.message}`).join("\n"),
      });
    }

    return { command: "clear-signing", sections };
  }

  // --- helpers ---

  private buildSummary(logs: LogEntry[], apdus: ApduExchange[]): string {
    const byLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const l of logs) byLevel[l.level]++;

    const first = logs[0];
    const last = logs[logs.length - 1];
    const duration =
      first && last
        ? ((new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000).toFixed(1)
        : "?";

    return [
      `Total logs: ${logs.length}`,
      `Duration: ${duration}s`,
      `Debug: ${byLevel.debug}  Info: ${byLevel.info}  Warn: ${byLevel.warn}  Error: ${byLevel.error}`,
      `APDU exchanges: ${apdus.length}`,
    ].join("\n");
  }

  private buildApduAnalysis(apdus: ApduExchange[]): string {
    return apdus
      .map((a, i) => {
        const cmd = decodeCommandApdu(a.sentApdu);
        const sw = decodeStatusWord(a.receivedResponse);
        const ascii = cmd.data ? tryDecodeAscii(cmd.data) : null;
        const dataNote = ascii ? ` "${ascii}"` : cmd.data ? ` (${cmd.dataLength}B data)` : "";
        return `${i + 1}. ${cmd.commandName}${dataNote} → ${sw.raw} ${sw.label}`;
      })
      .join("\n");
  }

  private findFailedApdus(
    apdus: ApduExchange[],
  ): { command: string; sw: { raw: string; label: string } }[] {
    return apdus
      .map((a) => {
        const cmd = decodeCommandApdu(a.sentApdu);
        const sw = decodeStatusWord(a.receivedResponse);
        return { command: cmd.commandName, sw };
      })
      .filter((r) => r.sw.raw !== "9000");
  }

  private detectPatterns(logs: LogEntry[]): AnalysisSection[] {
    const patterns: AnalysisSection[] = [];

    // Device locked
    if (logs.some((l) => l.message.toLowerCase().includes("locked") || l.message.includes("6FAA"))) {
      patterns.push({
        title: "Device Locked",
        severity: "warn",
        content: "The device appears to be locked. Unlock it with the PIN to proceed.",
      });
    }

    // User rejection
    if (logs.some((l) => l.message.includes("6985") || l.message.toLowerCase().includes("rejected"))) {
      patterns.push({
        title: "User Rejected",
        severity: "warn",
        content: "The user rejected the operation on the device.",
      });
    }

    // App not found
    if (logs.some((l) => l.message.includes("6A82") || l.message.toLowerCase().includes("not found"))) {
      patterns.push({
        title: "App Not Found",
        severity: "error",
        content: "The requested app was not found on the device. Install it via Ledger Live.",
      });
    }

    // Connection timeout
    if (logs.some((l) => l.message.toLowerCase().includes("timeout"))) {
      patterns.push({
        title: "Timeout Detected",
        severity: "error",
        content: "A timeout occurred during communication. Check device connection.",
      });
    }

    return patterns;
  }

  private getApduGroup(commandName: string): string {
    if (commandName.includes("GET_APP")) return "Get App Info";
    if (commandName.includes("OPEN_APP")) return "Open App";
    if (commandName.includes("CLOSE_APP")) return "Close App";
    if (commandName.includes("GET_ADDRESS") || commandName.includes("GET_PUBLIC")) return "Get Address";
    if (commandName.includes("SIGN")) return "Sign Transaction";
    if (commandName.includes("PROVIDE") || commandName.includes("SET_PLUGIN") || commandName.includes("SET_EXTERNAL"))
      return "Clear Signing Context";
    if (commandName.includes("LIST_APPS")) return "List Apps";
    if (commandName.includes("BATTERY")) return "Battery Status";
    return "Device Command";
  }

  private buildDiagramFromLogs(logs: LogEntry[]): string {
    const apduLogs = logs.filter((l) => {
      const tag = Array.isArray(l.tag) ? l.tag.join(" ") : l.tag;
      return tag.toLowerCase().includes("apdu") || l.message.toLowerCase().includes("apdu");
    });

    if (apduLogs.length === 0) {
      return "No APDU exchanges found in the logs to generate a diagram.";
    }

    const lines = [
      "sequenceDiagram",
      "    participant Host",
      "    participant Device",
    ];

    for (const log of apduLogs) {
      const msg = log.message;
      if (msg.includes("=>") || msg.toLowerCase().includes("send")) {
        lines.push(`    Host->>Device: ${this.truncate(msg, 60)}`);
      } else if (msg.includes("<=") || msg.toLowerCase().includes("receiv")) {
        lines.push(`    Device-->>Host: ${this.truncate(msg, 60)}`);
      } else {
        lines.push(`    Note over Host,Device: ${this.truncate(msg, 50)}`);
      }
    }

    return "```mermaid\n" + lines.join("\n") + "\n```";
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) + "..." : s;
  }
}

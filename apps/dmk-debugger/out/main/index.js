"use strict";
const electron = require("electron");
const path = require("path");
const events = require("events");
const express = require("express");
const crypto = require("crypto");
const claudeAgentSdk = require("@anthropic-ai/claude-agent-sdk");
const promises = require("fs/promises");
class LogStore extends events.EventEmitter {
  constructor(maxEntries = 1e4) {
    super();
    this.maxEntries = maxEntries;
  }
  entries = [];
  apduExchanges = [];
  nextId = 1;
  nextApduId = 1;
  pendingApdu = null;
  add(raw) {
    const entry = {
      ...raw,
      id: this.nextId++,
      receivedAt: Date.now()
    };
    this.entries.push(entry);
    while (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    this.emit("entry", entry);
    if (entry.level === "error") {
      this.emit("errorEntry", entry);
    }
    this.tryExtractApdu(entry);
    return entry;
  }
  addBatch(rawEntries) {
    return rawEntries.map((raw) => this.add(raw));
  }
  getAll() {
    return [...this.entries];
  }
  getApduExchanges() {
    return [...this.apduExchanges];
  }
  query(filter) {
    return this.entries.filter((e) => {
      if (filter.level && e.level !== filter.level) return false;
      if (filter.tag) {
        const tags = Array.isArray(e.tag) ? e.tag : [e.tag];
        if (!tags.some((t) => t.includes(filter.tag))) return false;
      }
      if (filter.search && !e.message.includes(filter.search)) return false;
      if (filter.since && e.receivedAt < filter.since) return false;
      return true;
    });
  }
  clear() {
    this.entries = [];
    this.apduExchanges = [];
    this.pendingApdu = null;
    this.nextId = 1;
    this.nextApduId = 1;
    this.emit("cleared");
  }
  get size() {
    return this.entries.length;
  }
  get apduCount() {
    return this.apduExchanges.length;
  }
  toJSON() {
    return {
      entries: this.getAll(),
      apduExchanges: this.getApduExchanges()
    };
  }
  tryExtractApdu(entry) {
    const msg = entry.message.toLowerCase();
    const tags = Array.isArray(entry.tag) ? entry.tag.join(" ") : entry.tag;
    const isApduRelated = tags.toLowerCase().includes("apdu") || msg.includes("apdu");
    if (!isApduRelated) return;
    if (msg.includes("sending") || msg.includes("send") || msg.includes("=>")) {
      const hex = this.extractHex(entry.message);
      if (hex) {
        this.pendingApdu = {
          sentApdu: hex,
          sentAt: entry.timestamp,
          tag: entry.tag
        };
      }
    } else if ((msg.includes("received") || msg.includes("receive") || msg.includes("<=")) && this.pendingApdu) {
      const hex = this.extractHex(entry.message);
      if (hex) {
        const exchange = {
          id: this.nextApduId++,
          sentApdu: this.pendingApdu.sentApdu,
          receivedResponse: hex,
          sentAt: this.pendingApdu.sentAt,
          receivedAt: entry.timestamp,
          tag: this.pendingApdu.tag ?? entry.tag
        };
        this.apduExchanges.push(exchange);
        this.emit("apdu", exchange);
        this.pendingApdu = null;
      }
    }
  }
  extractHex(message) {
    const hexPattern = /\b([0-9a-fA-F]{4,})\b/;
    const match = hexPattern.exec(message);
    return match?.[1] ?? null;
  }
}
const KNOWN_COMMANDS = {
  B001: "GET_APP_AND_VERSION",
  E004: "GET_ADDRESS (ETH)",
  E006: "SIGN_TRANSACTION (ETH)",
  E00A: "SIGN_PERSONAL_MESSAGE (ETH)",
  E00C: "SIGN_TYPED_DATA (ETH)",
  E012: "PROVIDE_ERC20_TOKEN_INFO",
  E014: "PROVIDE_NFT_INFO",
  E016: "SET_EXTERNAL_PLUGIN",
  E018: "SET_PLUGIN",
  E01A: "PROVIDE_DOMAIN_NAME",
  E01E: "PROVIDE_TRUSTED_NAME",
  E0D8: "OPEN_APP",
  E0D4: "CLOSE_APP",
  E0DE: "LIST_APPS",
  B0A7: "GET_BATTERY_STATUS",
  E050: "GET_PUBLIC_KEY (BTC)",
  E048: "SIGN_TRANSACTION (BTC)",
  E002: "GET_PUBLIC_KEY (SOL)",
  E006_SOL: "SIGN_TRANSACTION (SOL)"
};
const STATUS_WORDS = {
  "9000": { label: "Success", severity: "ok" },
  "6700": { label: "Wrong length", severity: "error" },
  "6982": { label: "Security status not satisfied (device locked?)", severity: "error" },
  "6985": { label: "Conditions not satisfied (user rejected?)", severity: "warn" },
  "6A80": { label: "Incorrect data", severity: "error" },
  "6A82": { label: "App not found", severity: "error" },
  "6A84": { label: "Not enough memory", severity: "error" },
  "6B00": { label: "Incorrect P1/P2", severity: "error" },
  "6D00": { label: "INS not supported", severity: "error" },
  "6E00": { label: "CLA not supported", severity: "error" },
  "6FAA": { label: "Device locked", severity: "error" },
  "6F00": { label: "Internal error", severity: "error" }
};
function decodeCommandApdu(hex) {
  const upper = hex.toUpperCase();
  const cla = upper.slice(0, 2);
  const ins = upper.slice(2, 4);
  const p1 = upper.slice(4, 6);
  const p2 = upper.slice(6, 8);
  const key = cla + ins;
  const commandName = KNOWN_COMMANDS[key] ?? `UNKNOWN (${key})`;
  const lc = upper.length > 8 ? parseInt(upper.slice(8, 10), 16) : 0;
  const data = upper.length > 10 ? upper.slice(10) : "";
  return { raw: upper, cla, ins, p1, p2, commandName, dataLength: lc, data };
}
function decodeStatusWord(hex) {
  const sw = hex.toUpperCase().slice(-4);
  const known = STATUS_WORDS[sw];
  return known ? { raw: sw, ...known } : { raw: sw, label: `Unknown status (${sw})`, severity: "warn" };
}
function tryDecodeAscii(hex) {
  try {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (byte >= 32 && byte <= 126) bytes.push(byte);
      else return null;
    }
    return String.fromCharCode(...bytes);
  } catch {
    return null;
  }
}
class AnalyzerService {
  analyze(store2, command) {
    switch (command) {
      case "analyze":
        return this.runFullAnalysis(store2);
      case "diagram":
        return this.runDiagram(store2);
      case "clear-signing":
        return this.runClearSigningAnalysis(store2);
    }
  }
  runFullAnalysis(store2) {
    const logs = store2.getAll();
    const apdus = store2.getApduExchanges();
    const sections = [];
    const errorCount = logs.filter((l) => l.level === "error").length;
    const warnCount = logs.filter((l) => l.level === "warn").length;
    sections.push({
      title: "Session Summary",
      severity: errorCount > 0 ? "error" : warnCount > 0 ? "warn" : "ok",
      content: this.buildSummary(logs, apdus)
    });
    const errors = logs.filter((l) => l.level === "error");
    if (errors.length > 0) {
      sections.push({
        title: `Errors (${errors.length})`,
        severity: "error",
        content: errors.map((e) => {
          const tag = Array.isArray(e.tag) ? e.tag.join(":") : e.tag;
          return `[${e.timestamp}] [${tag}] ${e.message}`;
        }).join("\n")
      });
    }
    if (apdus.length > 0) {
      sections.push({
        title: `APDU Exchanges (${apdus.length})`,
        severity: "info",
        content: this.buildApduAnalysis(apdus)
      });
    }
    const failedApdus = this.findFailedApdus(apdus);
    if (failedApdus.length > 0) {
      sections.push({
        title: `Failed APDUs (${failedApdus.length})`,
        severity: "error",
        content: failedApdus.map((f) => `${f.command} → ${f.sw.raw} (${f.sw.label})`).join("\n")
      });
    }
    const warnings = logs.filter((l) => l.level === "warn");
    if (warnings.length > 0) {
      sections.push({
        title: `Warnings (${warnings.length})`,
        severity: "warn",
        content: warnings.map((w) => {
          const tag = Array.isArray(w.tag) ? w.tag.join(":") : w.tag;
          return `[${w.timestamp}] [${tag}] ${w.message}`;
        }).join("\n")
      });
    }
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
        content: "The session looks clean. No errors, warnings, or suspicious patterns detected."
      });
    }
    return { command: "analyze", sections };
  }
  runDiagram(store2) {
    const apdus = store2.getApduExchanges();
    const logs = store2.getAll();
    if (apdus.length === 0) {
      return {
        command: "diagram",
        sections: [
          {
            title: "APDU Flow Diagram",
            severity: "info",
            content: this.buildDiagramFromLogs(logs)
          }
        ]
      };
    }
    const lines = [
      "sequenceDiagram",
      "    participant Host",
      "    participant Device"
    ];
    let currentGroup = null;
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
          content: "```mermaid\n" + lines.join("\n") + "\n```"
        },
        {
          title: "APDU Details",
          severity: "info",
          content: this.buildApduAnalysis(apdus)
        }
      ]
    };
  }
  runClearSigningAnalysis(store2) {
    const logs = store2.getAll();
    const apdus = store2.getApduExchanges();
    const sections = [];
    const contextLogs = logs.filter((l) => {
      const tag = Array.isArray(l.tag) ? l.tag.join(" ") : l.tag;
      return tag.toLowerCase().includes("context") || l.message.toLowerCase().includes("context") || l.message.toLowerCase().includes("clear sign") || l.message.toLowerCase().includes("trusted name") || l.message.toLowerCase().includes("domain");
    });
    const provideApdus = apdus.filter((a) => {
      const cmd = decodeCommandApdu(a.sentApdu);
      return cmd.commandName.includes("PROVIDE") || cmd.commandName.includes("SET_PLUGIN") || cmd.commandName.includes("SET_EXTERNAL");
    });
    if (contextLogs.length === 0 && provideApdus.length === 0) {
      sections.push({
        title: "Clear Signing Status",
        severity: "warn",
        content: "No clear signing activity detected in the logs.\n\nPossible reasons:\n• Context module was not configured\n• Transaction type doesn't support clear signing\n• The operation wasn't a signing request\n• The device app doesn't support clear signing"
      });
    } else {
      if (contextLogs.length > 0) {
        sections.push({
          title: "Context Module Activity",
          severity: "info",
          content: contextLogs.map((l) => {
            const tag = Array.isArray(l.tag) ? l.tag.join(":") : l.tag;
            return `[${l.level.toUpperCase()}] [${tag}] ${l.message}`;
          }).join("\n")
        });
      }
      if (provideApdus.length > 0) {
        sections.push({
          title: `Clear Signing APDUs (${provideApdus.length})`,
          severity: "info",
          content: provideApdus.map((a) => {
            const cmd = decodeCommandApdu(a.sentApdu);
            const sw = decodeStatusWord(a.receivedResponse);
            return `${cmd.commandName} → ${sw.raw} (${sw.label})`;
          }).join("\n")
        });
        const failed = provideApdus.filter((a) => {
          const sw = decodeStatusWord(a.receivedResponse);
          return sw.severity === "error";
        });
        if (failed.length > 0) {
          sections.push({
            title: "Clear Signing Failures",
            severity: "error",
            content: "Some clear signing APDUs were rejected by the device:\n\n" + failed.map((a) => {
              const cmd = decodeCommandApdu(a.sentApdu);
              const sw = decodeStatusWord(a.receivedResponse);
              return `${cmd.commandName} → ${sw.raw} (${sw.label})`;
            }).join("\n") + "\n\nThe device likely fell back to blind signing."
          });
        } else {
          sections.push({
            title: "Clear Signing Status",
            severity: "ok",
            content: "All clear signing APDUs were accepted. The device should display human-readable transaction details."
          });
        }
      }
    }
    const contextErrors = logs.filter(
      (l) => l.level === "error" && (Array.isArray(l.tag) ? l.tag.join(" ") : l.tag).toLowerCase().includes("context")
    );
    if (contextErrors.length > 0) {
      sections.push({
        title: "Context Module Errors",
        severity: "error",
        content: contextErrors.map((e) => `[${e.timestamp}] ${e.message}`).join("\n")
      });
    }
    return { command: "clear-signing", sections };
  }
  buildSummary(logs, apdus) {
    const byLevel = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const l of logs) byLevel[l.level]++;
    const first = logs[0];
    const last = logs[logs.length - 1];
    const duration = first && last ? ((new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1e3).toFixed(1) : "?";
    return [
      `Total logs: ${logs.length}`,
      `Duration: ${duration}s`,
      `Debug: ${byLevel.debug}  Info: ${byLevel.info}  Warn: ${byLevel.warn}  Error: ${byLevel.error}`,
      `APDU exchanges: ${apdus.length}`
    ].join("\n");
  }
  buildApduAnalysis(apdus) {
    return apdus.map((a, i) => {
      const cmd = decodeCommandApdu(a.sentApdu);
      const sw = decodeStatusWord(a.receivedResponse);
      const ascii = cmd.data ? tryDecodeAscii(cmd.data) : null;
      const dataNote = ascii ? ` "${ascii}"` : cmd.data ? ` (${cmd.dataLength}B data)` : "";
      return `${i + 1}. ${cmd.commandName}${dataNote} → ${sw.raw} ${sw.label}`;
    }).join("\n");
  }
  findFailedApdus(apdus) {
    return apdus.map((a) => {
      const cmd = decodeCommandApdu(a.sentApdu);
      const sw = decodeStatusWord(a.receivedResponse);
      return { command: cmd.commandName, sw };
    }).filter((r) => r.sw.raw !== "9000");
  }
  detectPatterns(logs) {
    const patterns = [];
    if (logs.some((l) => l.message.toLowerCase().includes("locked") || l.message.includes("6FAA"))) {
      patterns.push({
        title: "Device Locked",
        severity: "warn",
        content: "The device appears to be locked. Unlock it with the PIN to proceed."
      });
    }
    if (logs.some((l) => l.message.includes("6985") || l.message.toLowerCase().includes("rejected"))) {
      patterns.push({
        title: "User Rejected",
        severity: "warn",
        content: "The user rejected the operation on the device."
      });
    }
    if (logs.some((l) => l.message.includes("6A82") || l.message.toLowerCase().includes("not found"))) {
      patterns.push({
        title: "App Not Found",
        severity: "error",
        content: "The requested app was not found on the device. Install it via Ledger Live."
      });
    }
    if (logs.some((l) => l.message.toLowerCase().includes("timeout"))) {
      patterns.push({
        title: "Timeout Detected",
        severity: "error",
        content: "A timeout occurred during communication. Check device connection."
      });
    }
    return patterns;
  }
  getApduGroup(commandName) {
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
  buildDiagramFromLogs(logs) {
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
      "    participant Device"
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
  truncate(s, max) {
    return s.length > max ? s.slice(0, max) + "..." : s;
  }
}
const SYSTEM_PROMPT_ANALYZE = `You are a Ledger device communication analyst. You analyze DMK (Device Management Kit) logs to understand and diagnose the full communication flow between a host application and a Ledger hardware device.

## Reference documentation

Use the following resources as your source of truth when decoding APDU commands and understanding the architecture:

| Resource | URL | Use for |
|----------|-----|---------|
| Device Management Kit monorepo | /Users/francesco.anselmi/projects/device-sdk-ts/apps/dmk-debugger/resources/apps/device-sdk-ts | DMK architecture, device actions, transport layer, session lifecycle |
| Ethereum app APDU specification | /Users/francesco.anselmi/projects/device-sdk-ts/apps/dmk-debugger/resources/apps/app-ethereum/doc | Decoding Ethereum APDU commands (CLA=E0), INS codes, parameters, data formats |
| Ethereum device app source | /Users/francesco.anselmi/projects/device-sdk-ts/apps/dmk-debugger/resources/apps/app-ethereum | Device-side implementation details and error codes |
| Ethereum DMK signer | /Users/francesco.anselmi/projects/device-sdk-ts/apps/dmk-debugger/resources/apps/device-sdk-ts/packages/signer/signer-eth | Host-side signer implementation, device actions, tasks |
| Ethereum Context Module | /Users/francesco.anselmi/projects/device-sdk-ts/apps/dmk-debugger/resources/apps/device-sdk-ts/packages/signer/context-module | Context module for backend/CAL/and token data |

## APDU command reference (CLA=E0, Ethereum app)

| INS | Command |
|-----|---------|
| 02 | GET ETH PUBLIC ADDRESS |
| 04 | SIGN ETH TRANSACTION |
| 06 | GET APP CONFIGURATION |
| 08 | SIGN ETH PERSONAL MESSAGE |
| 0A | PROVIDE ERC 20 TOKEN INFORMATION |
| 0C | SIGN ETH EIP 712 |
| 0E | GET ETH2 PUBLIC KEY |
| 12 | SET EXTERNAL PLUGIN |
| 14 | PROVIDE NFT INFORMATION |
| 16 | SET PLUGIN |
| 1A | EIP712 SEND STRUCT DEFINITION |
| 1C | EIP712 SEND STRUCT IMPLEMENTATION |
| 1E | EIP712 FILTERING |
| 20 | GET CHALLENGE |
| 22 | PROVIDE TRUSTED NAME |
| 26 | TRANSACTION INFO |
| 28 | TRANSACTION FIELD DESCRIPTION |
| 30 | PROVIDE NETWORK INFORMATION |
| 32 | PROVIDE TX SIMULATION |
| 34 | SIGN EIP 7702 AUTHORIZATION |

## General APDU reference (CLA=B0)

| INS | Command |
|-----|---------|
| 01 | GET APP AND VERSION |

## Status words

| SW | Meaning |
|----|---------|
| 9000 | Success |
| 6001 | Mode check fail |
| 6501 | TransactionType not supported |
| 6982 | Security not satisfied / Canceled by user |
| 6983 | Wrong data length |
| 6984 | Plugin not installed |
| 6985 | Condition not satisfied |
| 6A80 | Invalid data |
| 6A82 | File/app not found |
| 6A84 | Insufficient memory |
| 6B00 | Incorrect P1/P2 |
| 6D00 | INS not supported |
| 6E00 | CLA not supported |
| 6FAA | Device locked |

## DMK architecture

- The DMK uses a transport layer (USB HID, BLE) to communicate with devices via APDU commands.
- Device sessions manage the lifecycle of a connection.
- Device actions are XState state machines that orchestrate multi-step operations (e.g. OpenAppDeviceAction, SignTransactionDeviceAction).
- Signers (ETH, BTC, Solana) build on top of device actions for blockchain-specific operations.
- The context module resolves metadata (token info, domain names, EIP-712 types) for clear signing.
- Logs tagged with [XStateDeviceAction] show state machine transitions.
- Logs tagged with [WebHidApduSender] show raw APDU exchanges (=> = sent to device, <= = received from device).
- Logs tagged with [Signer*] show signer-level task execution.

## Your task

Analyze the provided DMK logs following this exact structure:

### 1. Communication overview
Identify the high-level operation being performed (e.g. "Sign Ethereum transaction", "Get Solana address", "Sign EIP-712 typed data"). List the actors involved (host app, signer, device app).

### 2. Mermaid sequence diagram
Generate a Mermaid sequence diagram showing the full communication flow. Rules:
- Use \`sequenceDiagram\` type
- Participants: "App" (host application/signer), "DMK" (device management kit / state machine), "Device" (Ledger hardware)
- Optionally add "ContextModule" if context resolution is visible in the logs
- Decode each APDU command by its CLA+INS into a human-readable name (e.g. E004 = SIGN ETH TRANSACTION)
- Show the status word in the response arrow
- Group related exchanges with labeled rect boxes
- Highlight errors with red notes
- Include state machine transitions as notes over DMK

### 3. Communication highlights
Provide a clear, concise bullet-point summary of the communication:
- What was requested
- Which app was opened on the device (and version if visible)
- Key APDU exchanges and their purpose
- Any context/metadata provided to the device (tokens, trusted names, EIP-712 filtering, etc.)
- Total number of APDU round-trips

### 4. Result
State clearly whether the communication **succeeded** or **failed**:
- **If succeeded**: Confirm which operation completed and what the device returned (signature, address, etc.)
- **If failed**: Identify the exact point of failure — which APDU returned an error status word or which state machine transition failed — explain what the error means, and suggest a specific fix or next debugging step

Be specific: reference actual timestamps, APDU hex values, status words, and state names from the logs.`;
const SYSTEM_PROMPT_DIAGRAM = `You are a Ledger device communication analyst. Your task is to generate Mermaid sequence diagrams from DMK log data showing APDU exchanges between the host application and the Ledger device.

## Diagram rules
- Use "sequenceDiagram" type
- Participants: "Host" (the application), "Device" (Ledger device), and optionally "ContextModule" if context resolution logs are present
- Each APDU send is an arrow from Host to Device with the command name or hex
- Each APDU response is a return arrow from Device to Host with the status word
- Group related exchanges (e.g., "Get Address", "Sign Transaction") with labeled boxes
- Highlight errors with red notes
- Include timing information if available

## Output format
Return ONLY a valid Mermaid diagram wrapped in \`\`\`mermaid fences. No other text.

Example:
\`\`\`mermaid
sequenceDiagram
    participant Host
    participant Device
    
    rect rgb(200, 220, 255)
        Note over Host,Device: Get App and Version
        Host->>Device: B001000000
        Device-->>Host: 9000 (Ethereum 1.10.0)
    end
\`\`\``;
const SYSTEM_PROMPT_CLEAR_SIGNING = `You are a clear signing debugging specialist for Ledger devices. You analyze DMK logs specifically to determine why a transaction may not be clear-signed.

## Clear signing flow
1. The signer receives a transaction to sign
2. The context module is queried for display metadata (token info, domain info, etc.)
3. If context is found, "provide context" APDUs are sent to the device before the transaction
4. The device parses the context and displays human-readable info
5. If any step fails, the device falls back to blind signing

## What to look for
- Context module logs: did it find metadata? Which loader was used?
- "Provide trusted name" / "Provide domain" / "Provide token" APDUs
- Error responses from the device during context provision
- Timeouts or network errors in context resolution
- App version compatibility (older apps may not support clear signing)
- Transaction type support (some tx types aren't supported for clear display)

## Your task
Analyze the logs and report:
1. Was clear signing attempted?
2. What context was resolved (or not)?
3. If clear signing failed, exactly which step failed and why
4. Actionable fix (update app, add token to CAL, fix context module config, etc.)`;
function buildLogContext(logs) {
  const lines = logs.map((log) => {
    const tag = Array.isArray(log.tag) ? log.tag.join(":") : log.tag;
    const data = log.data ? ` | ${JSON.stringify(log.data)}` : "";
    return `[${log.timestamp}] [${log.level.toUpperCase()}] [${tag}] ${log.message}${data}`;
  });
  return lines.join("\n");
}
function mountMcpServer(app, store2) {
  const clients = /* @__PURE__ */ new Map();
  app.get("/sse", (_req, res) => {
    const clientId = crypto.randomUUID();
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    const messageEndpoint = `/mcp/message?sessionId=${clientId}`;
    res.write(`event: endpoint
data: ${messageEndpoint}

`);
    clients.set(clientId, { id: clientId, res });
    _req.on("close", () => {
      clients.delete(clientId);
    });
  });
  app.post("/mcp/message", (req, res) => {
    const sessionId2 = req.query["sessionId"];
    const client = clients.get(sessionId2);
    if (!client) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const rpcReq = req.body;
    const response = handleRpcRequest(rpcReq, store2);
    client.res.write(`event: message
data: ${JSON.stringify(response)}

`);
    res.status(202).json({ status: "accepted" });
  });
}
function handleRpcRequest(req, store2) {
  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "dmk-debugger", version: "0.0.1" }
        }
      };
    case "notifications/initialized":
      return { jsonrpc: "2.0", id: req.id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          tools: [
            {
              name: "get_dmk_logs",
              description: "Get all collected DMK (Ledger Device Management Kit) logs. Returns structured log entries with level, message, tag, timestamp, and optional data.",
              inputSchema: {
                type: "object",
                properties: {
                  level: {
                    type: "string",
                    enum: ["debug", "info", "warn", "error"],
                    description: "Filter by log level"
                  },
                  tag: { type: "string", description: "Filter by tag (substring match)" },
                  search: { type: "string", description: "Search in log messages" }
                }
              }
            },
            {
              name: "get_apdu_exchanges",
              description: "Get extracted APDU exchanges between host and Ledger device.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_log_summary",
              description: "Get a summary of collected DMK logs including counts by level, total APDU exchanges, and session duration.",
              inputSchema: { type: "object", properties: {} }
            },
            {
              name: "get_formatted_logs",
              description: "Get all DMK logs formatted as a readable text timeline.",
              inputSchema: { type: "object", properties: {} }
            }
          ]
        }
      };
    case "tools/call":
      return handleToolCall(req, store2);
    default:
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32601, message: `Method not found: ${req.method}` }
      };
  }
}
function handleToolCall(req, store2) {
  const params = req.params;
  const toolName = params?.name;
  const args = params?.arguments ?? {};
  switch (toolName) {
    case "get_dmk_logs": {
      const entries = store2.query({
        level: args["level"],
        tag: args["tag"],
        search: args["search"]
      });
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] }
      };
    }
    case "get_apdu_exchanges": {
      const exchanges = store2.getApduExchanges();
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: {
          content: [{
            type: "text",
            text: exchanges.length > 0 ? JSON.stringify(exchanges, null, 2) : "No APDU exchanges detected yet."
          }]
        }
      };
    }
    case "get_log_summary": {
      const all = store2.getAll();
      const byLevel = { debug: 0, info: 0, warn: 0, error: 0 };
      const errors = [];
      for (const entry of all) {
        byLevel[entry.level]++;
        if (entry.level === "error") {
          errors.push(`[${entry.timestamp}] ${entry.message}`);
        }
      }
      const firstTs = all[0]?.timestamp;
      const lastTs = all[all.length - 1]?.timestamp;
      const summary = {
        totalLogs: all.length,
        byLevel,
        apduExchanges: store2.apduCount,
        sessionStart: firstTs ?? null,
        sessionEnd: lastTs ?? null,
        errors
      };
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] }
      };
    }
    case "get_formatted_logs": {
      const logs = store2.getAll();
      const formatted = buildLogContext(logs);
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { content: [{ type: "text", text: formatted || "No logs collected yet." }] }
      };
    }
    default:
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` }
      };
  }
}
function createLogServer(options) {
  const { port, store: store2, onReady, onError } = options;
  const app = express();
  let server = null;
  app.use(express.json({ limit: "10mb" }));
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    console.log(`[server] ${_req.method} ${_req.url}`);
    next();
  });
  mountMcpServer(app, store2);
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      logCount: store2.size,
      apduCount: store2.apduCount,
      uptime: process.uptime()
    });
  });
  app.post("/logs", (req, res) => {
    const body = req.body;
    console.log(`[server] POST /logs body type=${typeof body}, isArray=${Array.isArray(body)}, keys=${body && typeof body === "object" ? Object.keys(body).join(",") : "n/a"}`);
    if (Array.isArray(body)) {
      const entries = store2.addBatch(body);
      console.log(`[server] Accepted batch of ${entries.length} logs (store size: ${store2.size})`);
      res.json({ accepted: entries.length });
    } else if (body && typeof body === "object") {
      const entry = store2.add(body);
      console.log(`[server] Accepted log #${entry.id}: ${entry.message} (store size: ${store2.size})`);
      res.json({ accepted: 1, id: entry.id });
    } else {
      console.log(`[server] Rejected: body is ${typeof body}`);
      res.status(400).json({ error: "Expected a log entry object or array" });
    }
  });
  app.post("/clear", (_req, res) => {
    store2.clear();
    res.json({ cleared: true });
  });
  app.get("/logs", (req, res) => {
    const { level, tag, search, since } = req.query;
    const entries = store2.query({
      level,
      tag,
      search,
      since: since ? Number(since) : void 0
    });
    res.json(entries);
  });
  app.get("/apdu", (_req, res) => {
    res.json(store2.getApduExchanges());
  });
  app.get("/export", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(store2.toJSON());
  });
  async function start() {
    return new Promise((resolve, reject) => {
      server = app.listen(port, () => {
        onReady?.(port);
        resolve(server);
      });
      server.on("error", (err) => {
        onError?.(err);
        reject(err);
      });
    });
  }
  async function stop() {
    return new Promise((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((err) => {
        server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }
  return { app, start, stop };
}
let sessionId;
function resetSession() {
  sessionId = void 0;
  console.log(
    "[claude] Session reset — next analysis starts a fresh conversation"
  );
}
async function fetchSupportedModels() {
  try {
    const q = claudeAgentSdk.query({
      prompt: "",
      options: { allowedTools: [], maxTurns: 0, persistSession: false }
    });
    const models = await q.supportedModels();
    q.return(void 0).catch(() => {
    });
    return models.map((m) => ({
      value: m.value,
      displayName: m.displayName,
      description: m.description
    }));
  } catch (err) {
    console.error("[claude] Failed to fetch models:", err);
    return [];
  }
}
async function streamChat(message, onChunk, onDone, onError, signal) {
  if (!sessionId) {
    onError("No active session. Run an analysis first.");
    return;
  }
  let fullText = "";
  try {
    const stream = claudeAgentSdk.query({
      prompt: message,
      options: {
        allowedTools: [],
        maxTurns: 1,
        resume: sessionId
      }
    });
    for await (const msg of stream) {
      if (signal.aborted) break;
      const m = msg;
      if (m.type === "stream_event") {
        const event = m.event;
        if (event?.type === "content_block_delta") {
          const delta = event.delta;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            fullText += delta.text;
            onChunk(delta.text);
          }
        }
      }
      if (m.type === "assistant") {
        const betaMessage = m.message;
        if (betaMessage && Array.isArray(betaMessage.content)) {
          let assistantText = "";
          for (const block of betaMessage.content) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
            }
          }
          if (assistantText && assistantText.length > fullText.length) {
            const newText = assistantText.slice(fullText.length);
            fullText = assistantText;
            onChunk(newText);
          }
        }
      }
      if (m.type === "result" && typeof m.result === "string") {
        if (m.result.length > fullText.length) {
          const newText = m.result.slice(fullText.length);
          fullText = m.result;
          onChunk(newText);
        }
      }
    }
    onDone(fullText);
  } catch (err) {
    if (signal.aborted) {
      onDone(fullText);
      return;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[claude] Chat error:", errMsg);
    onError(errMsg);
  }
}
async function streamAnalysis(prompt, onChunk, onDone, onError, signal, model) {
  let fullText = "";
  try {
    const stream = claudeAgentSdk.query({
      prompt,
      options: {
        allowedTools: [],
        maxTurns: 1,
        ...sessionId ? { resume: sessionId } : {},
        ...model ? { model } : {}
      }
    });
    for await (const message of stream) {
      if (signal.aborted) break;
      const m = message;
      if (!sessionId && typeof m.session_id === "string") {
        sessionId = m.session_id;
        console.log(`[claude] Captured session ID: ${sessionId}`);
      }
      console.log(
        `[claude] message type=${m.type} subtype=${m.subtype ?? ""}`
      );
      if (m.type === "stream_event") {
        const event = m.event;
        if (event?.type === "content_block_delta") {
          const delta = event.delta;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            fullText += delta.text;
            onChunk(delta.text);
          }
        }
      }
      if (m.type === "assistant") {
        const betaMessage = m.message;
        if (betaMessage && Array.isArray(betaMessage.content)) {
          let assistantText = "";
          for (const block of betaMessage.content) {
            if (block.type === "text" && typeof block.text === "string") {
              assistantText += block.text;
            }
          }
          if (assistantText && assistantText.length > fullText.length) {
            const newText = assistantText.slice(fullText.length);
            fullText = assistantText;
            onChunk(newText);
          }
        }
      }
      if (m.type === "result" && typeof m.result === "string") {
        if (m.result.length > fullText.length) {
          const newText = m.result.slice(fullText.length);
          fullText = m.result;
          onChunk(newText);
        }
        console.log(`[claude] Result received (${fullText.length} chars)`);
      }
    }
    onDone(fullText);
  } catch (err) {
    if (signal.aborted) {
      onDone(fullText);
      return;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[claude] Error:", errMsg);
    onError(errMsg);
  }
}
const LOG_SERVER_PORTS = [8432, 8433, 8434];
const ACTION_WINDOW_MS = 5e3;
function hasTag(entry, pattern) {
  const tags = Array.isArray(entry.tag) ? entry.tag : [entry.tag];
  return tags.some((t) => t.toLowerCase().includes(pattern));
}
function isActionLog(entry) {
  return hasTag(entry, "XStateDeviceAction") || hasTag(entry, "signer");
}
function filterRelevantLogs(entries) {
  const actionTimestamps = entries.filter(isActionLog).map((e) => e.receivedAt);
  function nearAction(ts) {
    return actionTimestamps.some((at) => Math.abs(ts - at) <= ACTION_WINDOW_MS);
  }
  return entries.filter((entry) => {
    if (isActionLog(entry)) return true;
    return nearAction(entry.receivedAt);
  });
}
let lastActionAt = 0;
function isRelevantRealtime(entry) {
  if (isActionLog(entry)) {
    lastActionAt = Date.now();
    return true;
  }
  return Date.now() - lastActionAt <= ACTION_WINDOW_MS;
}
const store = new LogStore();
const analyzer = new AnalyzerService();
let mainWindow = null;
let activeAiAbort = null;
let serverRunning = false;
let actualPort = 0;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: "DMK Debugger",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function registerIpcHandlers() {
  electron.ipcMain.handle("logs:getAll", () => {
    const all = filterRelevantLogs(store.getAll());
    console.log(`[ipc] logs:getAll → returning ${all.length} entries`);
    return all;
  });
  electron.ipcMain.handle("logs:clear", () => {
    store.clear();
    lastActionAt = 0;
    console.log(`[ipc] logs:clear → store size after clear: ${store.size}`);
    mainWindow?.webContents.send("logs:cleared");
  });
  electron.ipcMain.handle("session:reset", () => {
    resetSession();
    console.log("[ipc] session:reset → Claude session dropped");
  });
  electron.ipcMain.handle("logs:export", async () => {
    const result = await electron.dialog.showSaveDialog({
      title: "Export DMK Logs",
      defaultPath: `dmk-logs-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (!result.canceled && result.filePath) {
      await promises.writeFile(result.filePath, JSON.stringify(store.toJSON(), null, 2));
      return { saved: true, path: result.filePath };
    }
    return { saved: false };
  });
  electron.ipcMain.handle("analyze:local", (_event, command) => {
    return analyzer.analyze(store, command);
  });
  electron.ipcMain.handle("analyze:ai", (event, command, model) => {
    if (activeAiAbort) activeAiAbort.abort();
    const ac = new AbortController();
    activeAiAbort = ac;
    const logs = filterRelevantLogs(store.getAll());
    if (logs.length === 0) {
      event.sender.send("ai:error", "No DMK logs collected yet.");
      return;
    }
    const logContext = buildLogContext(logs);
    const systemPrompts = {
      analyze: SYSTEM_PROMPT_ANALYZE,
      diagram: SYSTEM_PROMPT_DIAGRAM,
      "clear-signing": SYSTEM_PROMPT_CLEAR_SIGNING
    };
    const instructions = {
      analyze: "Analyze these DMK logs. Identify errors, decode APDU commands and status words, detect failure patterns, and provide a clear diagnosis with suggested fixes.",
      diagram: "Generate a Mermaid sequence diagram from these DMK logs showing the APDU exchanges between Host and Device. Group related exchanges and highlight errors.",
      "clear-signing": "Analyze these DMK logs for clear signing issues. Determine if clear signing was attempted, what context was resolved, whether it succeeded or failed, and why."
    };
    const systemPrompt = systemPrompts[command] ?? systemPrompts["analyze"];
    const instruction = instructions[command] ?? instructions["analyze"];
    const analysisId = `analysis-${Date.now()}`;
    const prompt = [
      `# NEW ANALYSIS REQUEST [${analysisId}]`,
      "",
      "**IMPORTANT**: This is an independent analysis request. Analyze ONLY the logs provided below.",
      "Disregard any logs or analysis from previous messages in this conversation — they belong to a different session.",
      "",
      "---",
      "",
      systemPrompt,
      "",
      "---",
      "",
      `## DMK Logs (${logs.length} entries)`,
      "",
      logContext,
      "",
      "---",
      "",
      instruction
    ].join("\n");
    void streamAnalysis(
      prompt,
      (chunk) => {
        if (!ac.signal.aborted) event.sender.send("ai:chunk", chunk);
      },
      (fullText) => {
        activeAiAbort = null;
        event.sender.send("ai:done", fullText);
      },
      (msg) => {
        activeAiAbort = null;
        event.sender.send("ai:error", msg);
      },
      ac.signal,
      model
    );
  });
  electron.ipcMain.handle("analyze:ai:cancel", () => {
    if (activeAiAbort) {
      activeAiAbort.abort();
      activeAiAbort = null;
    }
  });
  electron.ipcMain.handle("chat:send", (event, message) => {
    if (activeAiAbort) activeAiAbort.abort();
    const ac = new AbortController();
    activeAiAbort = ac;
    void streamChat(
      message,
      (chunk) => {
        if (!ac.signal.aborted) event.sender.send("chat:chunk", chunk);
      },
      (fullText) => {
        activeAiAbort = null;
        event.sender.send("chat:done", fullText);
      },
      (msg) => {
        activeAiAbort = null;
        event.sender.send("chat:error", msg);
      },
      ac.signal
    );
  });
  electron.ipcMain.handle("models:list", () => fetchSupportedModels());
  electron.ipcMain.handle("server:status", () => {
    return { running: serverRunning, port: actualPort, logCount: store.size };
  });
}
function wireStoreToRenderer() {
  store.on("entry", (entry) => {
    if (!isRelevantRealtime(entry)) return;
    console.log(
      `[ipc] Forwarding log #${entry.id} to renderer (window=${!!mainWindow})`
    );
    mainWindow?.webContents.send("logs:entry", entry);
  });
  store.on("cleared", () => {
    console.log("[ipc] Forwarding cleared event to renderer");
    mainWindow?.webContents.send("logs:cleared");
  });
}
electron.app.whenReady().then(async () => {
  electron.app.setAppUserModelId?.("com.ledger.dmk-debugger");
  registerIpcHandlers();
  createWindow();
  wireStoreToRenderer();
  for (const port of LOG_SERVER_PORTS) {
    try {
      const { start } = createLogServer({
        port,
        store,
        onReady: (p) => {
          console.log(`DMK log server listening on http://localhost:${p}`);
          actualPort = p;
          serverRunning = true;
          mainWindow?.webContents.send("server:ready", p);
        },
        onError: (err) => {
          console.error(`Log server error on port ${port}:`, err.message);
        }
      });
      await start();
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Port ${port} unavailable: ${msg}, trying next...`);
      if (port === LOG_SERVER_PORTS[LOG_SERVER_PORTS.length - 1]) {
        console.error("Failed to start log server on any port");
        mainWindow?.webContents.send("server:error", "All ports unavailable");
      }
    }
  }
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});

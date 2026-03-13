import { ContextModuleBuilder } from "@ledgerhq/context-module";
import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  DeviceManagementKitBuilder,
  type DiscoveredDevice,
  hexaStringToBuffer,
  LogLevel,
} from "@ledgerhq/device-management-kit";
import {
  type Signature,
  type SignerEth,
  SignerEthBuilder,
  type TypedData,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
  speculosIdentifier,
  speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import type { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";
import { firstValueFrom, type Observable } from "rxjs";

import { clearLogs, log } from "./logger";

const DMK_LEVEL_MAP: Record<LogLevel, LoggingLevel> = {
  [LogLevel.Fatal]: "critical",
  [LogLevel.Error]: "error",
  [LogLevel.Warning]: "warning",
  [LogLevel.Info]: "info",
  [LogLevel.Debug]: "debug",
};

class McpDmkLogger {
  log(
    level: LogLevel,
    message: string,
    options: { tag: string; data?: Record<string, unknown> },
  ): void {
    const mcpLevel = DMK_LEVEL_MAP[level] ?? "debug";
    const data = options.data ? { message, ...options.data } : message;
    log(mcpLevel, `dmk:${options.tag}`, data);
  }
}

export type SigningState =
  | { status: "idle" }
  | { status: "pending"; step: string; requiredUserInteraction: string }
  | { status: "completed"; signature: Signature }
  | { status: "error"; error: string }
  | { status: "stopped" };

export type Session = {
  dmk: DeviceManagementKit;
  signer: SignerEth;
};

let currentSession: Session | null = null;
let lastSigningState: SigningState = { status: "idle" };

const GATING_TOKEN = process.env["GATING_TOKEN"] ?? "0".repeat(64);

export async function newSession(speculosUrl: string): Promise<Session> {
  if (currentSession) {
    currentSession.dmk.close();
  }
  clearLogs();
  lastSigningState = { status: "idle" };

  const dmk = new DeviceManagementKitBuilder()
    .addTransport(speculosTransportFactory(speculosUrl))
    .addLogger(new McpDmkLogger())
    .build();

  const device = await firstValueFrom(
    dmk.startDiscovering({ transport: speculosIdentifier }),
  );

  const sessionId = await dmk.connect({
    device: device as DiscoveredDevice,
    sessionRefresherOptions: { isRefresherDisabled: true },
  });

  const contextModule = new ContextModuleBuilder({
    originToken: GATING_TOKEN,
  }).build();

  const signer = new SignerEthBuilder({
    dmk,
    sessionId,
    originToken: GATING_TOKEN,
  })
    .withContextModule(contextModule)
    .build();

  currentSession = { dmk, signer };
  return currentSession;
}

export function getLastSigningState(): SigningState {
  return lastSigningState;
}

export async function waitForSigningReady(
  timeoutMs = 15000,
  pollMs = 200,
): Promise<SigningState> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = lastSigningState;

    if (
      state.status === "completed" ||
      state.status === "error" ||
      state.status === "stopped"
    ) {
      return state;
    }

    if (
      state.status === "pending" &&
      state.requiredUserInteraction.toLowerCase() !== "none"
    ) {
      return state;
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  return lastSigningState;
}

function trackDeviceAction<Output extends Signature>(action: {
  observable: Observable<
    DeviceActionState<Output, unknown, { requiredUserInteraction: string }>
  >;
}): void {
  lastSigningState = {
    status: "pending",
    step: "starting",
    requiredUserInteraction: "None",
  };

  action.observable.subscribe({
    next: (state) => {
      switch (state.status) {
        case DeviceActionStatus.Pending:
          lastSigningState = {
            status: "pending",
            step:
              "step" in state.intermediateValue
                ? String(state.intermediateValue.step)
                : "unknown",
            requiredUserInteraction: String(
              state.intermediateValue.requiredUserInteraction,
            ),
          };
          break;
        case DeviceActionStatus.Completed:
          lastSigningState = { status: "completed", signature: state.output };
          break;
        case DeviceActionStatus.Error:
          lastSigningState = { status: "error", error: String(state.error) };
          break;
        case DeviceActionStatus.Stopped:
          lastSigningState = { status: "stopped" };
          break;
      }
    },
    error: (err: unknown) => {
      lastSigningState = { status: "error", error: String(err) };
    },
  });
}

export function startSignTransaction(
  signer: SignerEth,
  derivationPath: string,
  rawTxHex: string,
): void {
  const rawTx = hexaStringToBuffer(
    rawTxHex.startsWith("0x") ? rawTxHex : `0x${rawTxHex}`,
  );
  if (!rawTx) {
    lastSigningState = { status: "error", error: "Invalid hex transaction" };
    return;
  }

  const action = signer.signTransaction(derivationPath, rawTx, {
    skipOpenApp: true,
  });
  trackDeviceAction(
    action as {
      observable: Observable<
        DeviceActionState<
          Signature,
          unknown,
          { requiredUserInteraction: string }
        >
      >;
    },
  );
}

export function startSignTypedData(
  signer: SignerEth,
  derivationPath: string,
  typedDataJson: string,
): void {
  let typedData: TypedData;
  try {
    typedData = JSON.parse(typedDataJson) as TypedData;
  } catch {
    lastSigningState = { status: "error", error: "Invalid JSON typed data" };
    return;
  }

  const action = signer.signTypedData(derivationPath, typedData, {
    skipOpenApp: true,
  });
  trackDeviceAction(
    action as {
      observable: Observable<
        DeviceActionState<
          Signature,
          unknown,
          { requiredUserInteraction: string }
        >
      >;
    },
  );
}

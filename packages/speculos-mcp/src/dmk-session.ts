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

const GATING_TOKEN = process.env["GATING_TOKEN"] ?? "0".repeat(64);

export class DmkSession {
  private currentSession: Session | null = null;
  private lastSigningState: SigningState = { status: "idle" };

  async newSession(speculosUrl: string): Promise<Session> {
    if (this.currentSession) {
      this.currentSession.dmk.close();
    }
    clearLogs();
    this.lastSigningState = { status: "idle" };

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

    this.currentSession = { dmk, signer };
    return this.currentSession;
  }

  getSigningState(): SigningState {
    return this.lastSigningState;
  }

  async waitForSigningReady(
    timeoutMs = 15000,
    pollMs = 200,
  ): Promise<SigningState> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const state = this.lastSigningState;

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

    return this.lastSigningState;
  }

  private trackDeviceAction<Output extends Signature>(action: {
    observable: Observable<
      DeviceActionState<Output, unknown, { requiredUserInteraction: string }>
    >;
  }): void {
    this.lastSigningState = {
      status: "pending",
      step: "starting",
      requiredUserInteraction: "None",
    };

    action.observable.subscribe({
      next: (state) => {
        switch (state.status) {
          case DeviceActionStatus.Pending:
            this.lastSigningState = {
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
            this.lastSigningState = {
              status: "completed",
              signature: state.output,
            };
            break;
          case DeviceActionStatus.Error:
            this.lastSigningState = {
              status: "error",
              error: String(state.error),
            };
            break;
          case DeviceActionStatus.Stopped:
            this.lastSigningState = { status: "stopped" };
            break;
        }
      },
      error: (err: unknown) => {
        this.lastSigningState = { status: "error", error: String(err) };
      },
    });
  }

  startSignTransaction(
    signer: SignerEth,
    derivationPath: string,
    rawTxHex: string,
  ): void {
    const rawTx = hexaStringToBuffer(
      rawTxHex.startsWith("0x") ? rawTxHex : `0x${rawTxHex}`,
    );
    if (!rawTx) {
      this.lastSigningState = {
        status: "error",
        error: "Invalid hex transaction",
      };
      return;
    }

    const action = signer.signTransaction(derivationPath, rawTx, {
      skipOpenApp: true,
    });
    this.trackDeviceAction(
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

  startSignTypedData(
    signer: SignerEth,
    derivationPath: string,
    typedDataJson: string,
  ): void {
    let typedData: TypedData;
    try {
      typedData = JSON.parse(typedDataJson) as TypedData;
    } catch {
      this.lastSigningState = {
        status: "error",
        error: "Invalid JSON typed data",
      };
      return;
    }

    const action = signer.signTypedData(derivationPath, typedData, {
      skipOpenApp: true,
    });
    this.trackDeviceAction(
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
}

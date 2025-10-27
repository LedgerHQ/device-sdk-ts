import { Connector } from "@ledgerhq/device-management-kit-devtools-core";
import {
  RozeniteDevToolsClient,
  useRozeniteDevToolsClient,
} from "@rozenite/plugin-bridge";
import { ReplaySubject, Subject } from "rxjs";
import { PluginEvents } from "../shared/PluginEvents";
import { pluginId } from "../shared/pluginId";
import { useEffect, useMemo } from "react";

export function useDashboardRozeniteConnector(): Connector | null {
  const client = useRozeniteDevToolsClient<PluginEvents>({ pluginId });
  const connector = useMemo(() => {
    if (client) {
      return new DashboardRozeniteConnector(client);
    }
    return null;
  }, [client]);
  useEffect(() => {
    return () => {
      connector?.destroy();
    };
  }, [connector]);
  return connector;
}

export class DashboardRozeniteConnector implements Connector {
  /**
   * INSTANCE METHODS
   */
  private client: RozeniteDevToolsClient<PluginEvents>;
  private messagesToSend: ReplaySubject<{ type: string; payload: string }> =
    new ReplaySubject();
  private messagesFromDashboard: Subject<{ type: string; payload: string }> =
    new Subject();

  constructor(rozeniteDevToolsClient: RozeniteDevToolsClient<PluginEvents>) {
    this.client = rozeniteDevToolsClient;
    this.initialize().catch((error) => {
      console.error("[DashboardRozeniteConnector] Error initializing", error);
    });
  }

  destroy(): void {
    console.log("[DashboardRozeniteConnector][destroy] Destroying...");
    this.client?.close();
    this.messagesToSend.complete();
    this.messagesFromDashboard.complete();
  }

  private async initialize(): Promise<void> {
    console.log("[DashboardRozeniteConnector][initialize] Initializing...");
    const client = this.client;
    client.send("init", "init message from dashboard");
    console.log("[DashboardRozeniteConnector][initialize] Client initialized");
    this.messagesToSend.subscribe({
      next: (message) => {
        console.log(
          "[DashboardRozeniteConnector] Sending message properly",
          message
        );
        client.send("message", message);
      },
    });
    client.onMessage("init", (message) => {
      console.log("[DashboardRozeniteConnector] Received init message", {
        message,
      });
    });
    client.onMessage("message", ({ type, payload }) => {
      console.log("[DashboardRozeniteConnector] Received message", {
        type,
        payload,
      });
      this.messagesFromDashboard.next({ type, payload });
    });
  }

  public sendMessage(type: string, payload: string): void {
    this.messagesToSend.next({ type, payload });
  }

  public listenToMessages(listener: (type: string, payload: string) => void): {
    unsubscribe: () => void;
  } {
    return this.messagesFromDashboard.subscribe({
      next: (message) => listener(message.type, message.payload),
    });
  }
}

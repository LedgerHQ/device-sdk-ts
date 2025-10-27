import { Connector } from "@ledgerhq/device-management-kit-devtools-core";
import {
  RozeniteDevToolsClient,
  getRozeniteDevToolsClient,
  useRozeniteDevToolsClient,
} from "@rozenite/plugin-bridge";
import { ReplaySubject, Subject } from "rxjs";
import { PluginEvents } from "../shared/PluginEvents";
import { pluginId } from "../shared/pluginId";
import { useEffect, useMemo, useState } from "react";

export class ClientRozeniteConnector implements Connector {
  /**
   * STATIC METHODS
   */
  static instance: ClientRozeniteConnector | null = null;
  static getInstance(): ClientRozeniteConnector {
    if (!ClientRozeniteConnector.instance) {
      ClientRozeniteConnector.instance = new ClientRozeniteConnector();
    }
    return ClientRozeniteConnector.instance;
  }

  static destroyInstance(): void {
    if (ClientRozeniteConnector.instance) {
      ClientRozeniteConnector.instance.destroy();
      ClientRozeniteConnector.instance = null;
    }
  }

  /**
   * INSTANCE METHODS
   */
  private rozeniteClient: RozeniteDevToolsClient<PluginEvents> | null = null;
  private messagesToSend: ReplaySubject<{ type: string; payload: string }> =
    new ReplaySubject();
  private messagesFromDashboard: Subject<{ type: string; payload: string }> =
    new Subject();

  private constructor() {}

  setClient(rozeniteClient: RozeniteDevToolsClient<PluginEvents>): void {
    if (this.rozeniteClient) {
      this.rozeniteClient.close();
    }
    this.rozeniteClient = rozeniteClient;
    this.initialize().catch((error) => {
      console.error("[ClientRozeniteConnector] Error initializing", error);
    });
  }

  private destroy(): void {
    console.log("[ClientRozeniteConnector][destroy] Destroying...");
    this.rozeniteClient?.close();
    this.messagesToSend.complete();
    this.messagesFromDashboard.complete();
  }

  private async initialize(): Promise<void> {
    console.log("[ClientRozeniteConnector][initialize] Initializing...");
    const rozeniteClient = this.rozeniteClient;
    if (!rozeniteClient) {
      throw new Error("[ClientRozeniteConnector] Client not set");
    }
    rozeniteClient.send("init", "init message from client");
    console.log("[ClientRozeniteConnector][initialize] Client initialized");
    this.messagesToSend.subscribe({
      next: (message) => {
        rozeniteClient.send("message", message);
      },
    });
    rozeniteClient.onMessage("init", (message) => {
      console.log("[ClientRozeniteConnector] Received init message", {
        message,
      });
    });
    rozeniteClient.onMessage("message", ({ type, payload }) => {
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

export function useClientRozeniteConnector(): Connector | null {
  const client = useRozeniteDevToolsClient<PluginEvents>({ pluginId });
  const [connector, setConnector] = useState<ClientRozeniteConnector | null>(
    null
  );

  useEffect(() => {
    if (client) {
      const connector = ClientRozeniteConnector.getInstance();
      connector.setClient(client);
      setConnector(connector);
      return () => {
        ClientRozeniteConnector.destroyInstance();
      };
    }
  }, [client]);
  return connector;
}

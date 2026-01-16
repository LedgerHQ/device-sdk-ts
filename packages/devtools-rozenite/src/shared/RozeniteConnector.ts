import { Connector } from "@ledgerhq/device-management-kit-devtools-core";
import { RozeniteDevToolsClient } from "@rozenite/plugin-bridge";
import { ReplaySubject, Subject, type Subscription } from "rxjs";
import { PluginEvents } from "./PluginEvents";

export class RozeniteConnector implements Connector {
  /**
   * STATIC METHODS
   */
  static instance: RozeniteConnector | null = null;
  static getInstance(): RozeniteConnector {
    if (!RozeniteConnector.instance) {
      RozeniteConnector.instance = new RozeniteConnector();
    }
    return RozeniteConnector.instance;
  }

  static destroyInstance(): void {
    if (RozeniteConnector.instance) {
      RozeniteConnector.instance.destroy();
      RozeniteConnector.instance = null;
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
  private messagesToSendSubscription: Subscription | null = null;

  private constructor() {}

  setClient(rozeniteClient: RozeniteDevToolsClient<PluginEvents>): void {
    // Clean up old subscription if it exists
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
      this.messagesToSendSubscription = null;
    }
    if (this.rozeniteClient) {
      this.rozeniteClient.close();
    }
    this.rozeniteClient = rozeniteClient;
    this.initialize().catch((error) => {
      console.error("[RozeniteConnector] Error initializing", error);
    });
  }

  private destroy(): void {
    console.log("[RozeniteConnector][destroy] Destroying...");
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
      this.messagesToSendSubscription = null;
    }
    this.rozeniteClient?.close();
    this.messagesToSend.complete();
    this.messagesFromDashboard.complete();
  }

  private async initialize(): Promise<void> {
    console.log("[RozeniteConnector][initialize] Initializing...");
    const rozeniteClient = this.rozeniteClient;
    if (!rozeniteClient) {
      throw new Error("[RozeniteConnector] Client not set");
    }
    rozeniteClient.send("init", "init message from client");
    console.log("[RozeniteConnector][initialize] Client initialized");

    // Clean up old subscription if it exists
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
    }

    this.messagesToSendSubscription = this.messagesToSend.subscribe({
      next: (message) => {
        rozeniteClient.send("message", message);
      },
    });
    rozeniteClient.onMessage("init", (message) => {
      console.log("[RozeniteConnector] Received init message", {
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

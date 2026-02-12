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
  private verbose: boolean = false;

  private constructor() {}

  /**
   * VERBOSE LOGGING
   */

  public setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  private error(...args: unknown[]): void {
    if (this.verbose) console.error(...args);
  }

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
      this.error("[RozeniteConnector] Error initializing", error);
    });
  }

  private destroy(): void {
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
      this.messagesToSendSubscription = null;
    }
    this.rozeniteClient?.close();
    this.messagesToSend.complete();
    this.messagesFromDashboard.complete();
  }

  private async initialize(): Promise<void> {
    const rozeniteClient = this.rozeniteClient;
    if (!rozeniteClient) {
      throw new Error("[RozeniteConnector] Client not set");
    }

    // Clean up old subscription if it exists
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
      this.messagesToSendSubscription = null;
    }

    // Helper to create/recreate the message forwarding subscription
    const setupMessageForwarding = () => {
      if (this.messagesToSendSubscription) {
        this.messagesToSendSubscription.unsubscribe();
      }
      this.messagesToSendSubscription = this.messagesToSend.subscribe({
        next: (msg) => {
          rozeniteClient.send("message", msg);
        },
      });
    };

    // Set up message handlers FIRST, before sending init
    rozeniteClient.onMessage("init", () => {
      // When we receive "init" from the other side, they're ready to receive messages.
      // Set up or refresh the message forwarding subscription.
      const wasAlreadySetup = !!this.messagesToSendSubscription;
      setupMessageForwarding();

      // If we hadn't set up yet, the other side might have sent their init before
      // we were ready. Send our init again so they can set up their subscription too.
      if (!wasAlreadySetup) {
        rozeniteClient.send("init", "init response");
      }
    });

    rozeniteClient.onMessage("message", ({ type, payload }) => {
      this.messagesFromDashboard.next({ type, payload });
    });

    // THEN send our init - the other side will receive it and know we're ready
    rozeniteClient.send("init", "init message from client");
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

import {
  flipperClient,
  type FlipperPlugin,
  type FlipperPluginConnection,
  type FlipperWebSocket,
} from "js-flipper";
import { BehaviorSubject, type Observable, Subject } from "rxjs";

export class FlipperPluginManager implements FlipperPlugin {
  private static instance: FlipperPluginManager;
  static getInstance(): FlipperPluginManager {
    if (!FlipperPluginManager.instance) {
      FlipperPluginManager.instance = new FlipperPluginManager();
    }
    return FlipperPluginManager.instance;
  }

  private flipperPluginConnection: FlipperPluginConnection | null = null;
  private connectSubject: Subject<FlipperPluginConnection> = new Subject();
  private disconnectSubject: Subject<void> = new Subject();
  private isConnected: Subject<boolean> = new BehaviorSubject(false);

  private constructor() {
    this.attemptInitialization();
  }

  /**
   * Attempt to initialize the Flipper plugin.
   * If the Flipper server is not running, this will fail silently.
   */
  attemptInitialization() {
    flipperClient.start(this.getId(), {
      onError: () => {},
      websocketFactory: (url) => {
        console.log("Creating Flipper WebSocket");
        const ws = new WebSocket(url);
        ws.addEventListener("close", () => {
          this.isConnected.next(false);
        });
        ws.addEventListener("open", () => {
          this.isConnected.next(true);
        });
        return ws as FlipperWebSocket;
      },
      reconnectTimeout: 2 ** 31 - 1, // We don't want auto reconnection as it spams the console with uncatchable WebSocket errors when the Flipper server is not running
    });
    flipperClient.addPlugin(this);
  }

  public getFlipperPluginConnection(): FlipperPluginConnection | null {
    return this.flipperPluginConnection;
  }

  public addConnectListener(
    callback: (connection: FlipperPluginConnection) => void,
  ) {
    return this.connectSubject.subscribe(callback);
  }

  public addDisconnectListener(callback: () => void) {
    return this.disconnectSubject.subscribe(callback);
  }

  public observeIsConnected(): Observable<boolean> {
    return this.isConnected.asObservable();
  }

  /** FlipperPlugin interface methods */
  getId(): string {
    return "ledger-device-management-kit";
  }

  onConnect(connection: FlipperPluginConnection): void {
    connection.send("init", { message: "Hello, Flipper!" });
    this.flipperPluginConnection = connection; // we handle only one connection for simplicity
    this.connectSubject.next(connection);
  }

  onDisconnect(): void {
    this.flipperPluginConnection = null;
    this.disconnectSubject.next();
  }
}

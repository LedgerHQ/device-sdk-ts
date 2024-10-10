import {
  flipperClient,
  FlipperPlugin,
  FlipperPluginConnection,
} from "js-flipper";
import { Subject } from "rxjs";

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

  private constructor() {
    this.initializeFlipperPlugin();
  }

  initializeFlipperPlugin() {
    flipperClient.start("ledger-device-sdk");
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

  /** FlipperPlugin interface methods */
  getId(): string {
    return "ledger-device-sdk";
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

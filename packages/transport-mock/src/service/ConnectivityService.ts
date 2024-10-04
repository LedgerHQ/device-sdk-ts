import { HttpClient } from "../HttpClient";
import { Session } from "../model/Session";

type ConnectivityServiceArgs = {
  client: HttpClient;
};

export class ConnectivityService {
  private client: HttpClient;

  constructor({ client }: ConnectivityServiceArgs) {
    this.client = client;
  }

  async connect(sessionId: string): Promise<Session> {
    return this.client.post<Session>("connect", {}, { session_id: sessionId });
  }

  async disconnect(sessionId: string): Promise<boolean> {
    await this.client.post("disconnect", {}, { session_id: sessionId });
    return true;
  }

  async disconnectAll(): Promise<boolean> {
    await this.client.get("clear");
    return true;
  }

  async getConnected(): Promise<Session[]> {
    return this.client.get<Session[]>("get-connected");
  }
}
